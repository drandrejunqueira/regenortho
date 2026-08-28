import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { appointments, leads, patients, transactions } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { syncAppointment } from '@/lib/google/calendar'
import { logActivity } from '@/lib/db/logger'
import { notify } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { buscarConflitos, mensagemDeConflito } from '@/app/api/agenda/conflitos'
import { z } from 'zod'
import type { UserRole } from '@/types'
import { APPOINTMENT_TYPE_LABELS, LEAD_SOURCE_LABELS } from '@/lib/constants'
import { formatDateTime, toDateBR } from '@/lib/utils'

// Conversão lead -> ficha de paciente -> agendamento em UMA requisição.
//
// Antes isto era orquestrado pelo navegador em três chamadas (POST /api/pacientes,
// PATCH /api/leads/[id], POST /api/agenda). Sem atomicidade, qualquer falha no meio
// deixava rastro: ficha criada sem consulta, ou lead marcado "Agendado" sem nada na
// agenda — um card indistinguível de um agendamento real.
//
// O driver é neon-http: cada query é um POST HTTP independente e db.transaction()
// interativo NÃO existe. Não há BEGIN/ROLLBACK aqui. O que substitui a transação:
//   1. ORDEM DEFENSIVA — a ficha e a consulta nascem ANTES do vínculo no lead. Se o
//      agendamento falhar, o lead continua no status anterior e ninguém vê
//      "Agendado" sem consulta por trás.
//   2. IDEMPOTÊNCIA DA FICHA — reuso de lead.patientId e, na falta dele, busca por
//      telefone normalizado. Repetir a chamada depois de um erro não abre um segundo
//      prontuário para a mesma pessoa.
//   3. ERRO FALANTE — se algo quebrar no meio, a resposta diz o que ficou criado e o
//      que não ficou, em pt-BR, em vez de estourar um 500 mudo.

const converterSchema = z
  .object({
    // Dados da consulta
    doctorId: z.string().uuid().nullable().optional(),
    type: z
      .enum(['consultation', 'prp', 'bmac', 'hyaluronic', 'prolotherapy', 'surgery', 'return', 'block'])
      .optional(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    roomId: z.string().uuid().nullable().optional(),
    room: z.string().optional(),
    title: z.string().optional(),
    notes: z.string().optional(),
    isPaidConsultation: z.boolean().optional(),
    consultationPrice: z.string().nullable().optional(),
    paymentMethodId: z.string().uuid().nullable().optional(),
    paymentTiming: z.enum(['antecipado', 'no_ato']).nullable().optional(),
    paymentStatus: z.enum(['pending', 'paid']).nullable().optional(),
    paymentReceiptUrl: z.string().nullable().optional(),
    // Dados da ficha que o lead não carrega (a recepção pode completar no ato)
    patient: z
      .object({
        email: z.string().email().nullable().optional(),
        cpf: z.string().nullable().optional(),
        birthDate: z.string().nullable().optional(),
        gender: z.enum(['male', 'female', 'other']).nullable().optional(),
        address: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
        insurance: z.string().nullable().optional(),
        insuranceNum: z.string().nullable().optional(),
      })
      .optional(),
  })
  .refine((d) => new Date(d.endAt) > new Date(d.startAt), {
    message: 'O término deve ser posterior ao início',
    path: ['endAt'],
  })

type Params = { params: Promise<{ id: string }> }
type PatientRow = typeof patients.$inferSelect
type LeadRow = typeof leads.$inferSelect
type ConverterInput = z.infer<typeof converterSchema>

/** Só os dígitos: '(12) 98176-7896' e '12981767896' são a mesma pessoa. */
const onlyDigits = (v: string) => (v || '').replace(/\D/g, '')

/**
 * Devolve a ficha do lead reaproveitando o que já existe. É esta função que torna a
 * conversão segura para repetir: nem o vínculo antigo nem um cadastro feito por
 * outro canal viram um segundo prontuário.
 */
async function resolvePatient(
  lead: LeadRow,
  input: ConverterInput,
): Promise<{ patient: PatientRow; created: boolean }> {
  if (lead.patientId) {
    const [byLink] = await db.select().from(patients).where(eq(patients.id, lead.patientId)).limit(1)
    if (byLink) return { patient: byLink, created: false }
  }

  // A mesma pessoa preenche a landing page e depois chama no WhatsApp: viram dois
  // leads, mas o prontuário tem de ser um só. Sem esta busca a segunda conversão
  // abre a ficha de novo e racha histórico clínico e financeiro em dois.
  const phoneDigits = onlyDigits(lead.phone)
  if (phoneDigits.length >= 8) {
    const [byPhone] = await db
      .select()
      .from(patients)
      .where(sql`regexp_replace(${patients.phone}, '[^0-9]', '', 'g') = ${phoneDigits}`)
      .limit(1)
    if (byPhone) return { patient: byPhone, created: false }
  }

  const origem = LEAD_SOURCE_LABELS[lead.source] ?? lead.source
  const [created] = await db
    .insert(patients)
    .values({
      name: lead.name,
      phone: lead.phone,
      // O e-mail digitado agora vale mais que o do lead: costuma ser a correção.
      email: input.patient?.email ?? lead.email ?? null,
      cpf: input.patient?.cpf ?? null,
      birthDate: input.patient?.birthDate ?? null,
      gender: input.patient?.gender ?? null,
      address: input.patient?.address ?? null,
      city: input.patient?.city ?? null,
      insurance: input.patient?.insurance ?? null,
      insuranceNum: input.patient?.insuranceNum ?? null,
      notes: `Convertido do CRM Lead. Queixa: ${lead.complaint || 'Não informada'}`,
      // Origem e especialidade morriam na conversão antiga: o prontuário perdia de
      // onde o paciente veio e o marketing perdia o rastro do que converteu.
      internalNotes: `Origem do lead: ${origem}. Especialidade de interesse: ${lead.specialty || 'Não informada'}.`,
    })
    .returning()

  return { patient: created, created: true }
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // As três permissões que as três rotas antigas exigiam, juntas: quem converte mexe
  // no funil, abre prontuário e ocupa a agenda. Exigir menos aqui seria abrir por
  // esta porta o que as outras três fecham.
  const role = session.user.role as UserRole
  const perms = session.user.customPermissions
  if (
    !hasPermission(role, 'leads:edit', perms) ||
    !hasPermission(role, 'patients:create', perms) ||
    !hasPermission(role, 'agenda:create', perms)
  ) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params

  const body = await req.json()
  const parsed = converterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }
  const input = parsed.data

  const lead = await db.query.leads.findFirst({ where: eq(leads.id, id) })
  if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')

  // Conflito de horário antes de qualquer escrita: converter um lead cria uma
  // consulta como qualquer outra, e esta porta não pode furar a regra que o
  // POST /api/agenda aplica. Checar antes evita abrir a ficha para uma consulta
  // que não vai existir.
  const conflitos = await buscarConflitos({
    inicio: new Date(input.startAt),
    fim: new Date(input.endAt),
    doctorId: input.doctorId ?? null,
    roomId: input.roomId ?? null,
  })
  if (conflitos.length > 0) {
    return NextResponse.json(
      {
        error: mensagemDeConflito(conflitos, input.doctorId ?? null, input.roomId ?? null),
        conflitos: conflitos.map((c) => ({
          id: c.id,
          startAt: c.startAt.toISOString(),
          endAt: c.endAt.toISOString(),
        })),
      },
      { status: 409 },
    )
  }

  // ── 1. Ficha do paciente ─────────────────────────────────────────────
  let resolved: { patient: PatientRow; created: boolean }
  try {
    resolved = await resolvePatient(lead, input)
  } catch (err: any) {
    console.error('[leads/converter] erro ao resolver a ficha do paciente:', err)
    return NextResponse.json(
      {
        error:
          'Não foi possível criar a ficha do paciente. Nada foi alterado: o lead segue como estava e nenhuma consulta foi agendada.',
        details: err?.message,
      },
      { status: 500 },
    )
  }
  const { patient, created: patientCreated } = resolved

  if (patientCreated) {
    await logActivity({
      userId: session.user.id,
      userName: session.user.name || session.user.email || null,
      action: 'patient:create',
      module: 'patients',
      targetId: patient.id,
      targetName: patient.name,
      ip,
      details: { email: patient.email, phone: patient.phone, fromLeadId: lead.id },
    })
  }

  // ── 2. Agendamento ───────────────────────────────────────────────────
  let apt: typeof appointments.$inferSelect
  try {
    const [createdApt] = await db
      .insert(appointments)
      .values({
        patientId: patient.id,
        leadId: lead.id,
        doctorId: input.doctorId ?? null,
        type: input.type ?? 'consultation',
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        title: input.title ?? `Consulta: ${lead.name}`,
        notes: input.notes ?? '',
        room: input.room ?? '',
        roomId: input.roomId ?? null,
        isPaidConsultation: input.isPaidConsultation ?? false,
        consultationPrice: input.consultationPrice ?? null,
        paymentMethodId: input.paymentMethodId ?? null,
        paymentTiming: input.paymentTiming ?? null,
        paymentStatus: input.paymentStatus ?? null,
        paymentReceiptUrl: input.paymentReceiptUrl ?? null,
        createdById: session.user.id,
      })
      .returning()
    apt = createdApt
  } catch (err: any) {
    console.error('[leads/converter] erro ao criar o agendamento:', err)
    // O lead ainda NÃO foi marcado como convertido — é exatamente isso que impede o
    // card de virar "Agendado" sem nenhuma consulta por trás.
    return NextResponse.json(
      {
        error: patientCreated
          ? 'A ficha do paciente foi criada, mas a consulta NÃO foi agendada e o lead continua no status anterior. Tente agendar de novo — a ficha existente será reaproveitada, sem duplicar o prontuário.'
          : 'A consulta NÃO foi agendada e o lead continua no status anterior. Tente de novo.',
        details: err?.message,
      },
      { status: 500 },
    )
  }

  // ── 3. Vínculo no lead (por último, de propósito) ─────────────────────
  let leadUpdated = true
  try {
    await db
      .update(leads)
      .set({
        patientId: patient.id,
        // Reconversão não reescreve a data original da primeira conversão.
        convertedAt: lead.convertedAt ?? new Date(),
        status: 'scheduled',
        updatedAt: new Date(),
      })
      .where(eq(leads.id, lead.id))

    await logActivity({
      userId: session.user.id,
      userName: session.user.name || session.user.email || null,
      action: 'lead:convert',
      module: 'leads',
      targetId: lead.id,
      targetName: lead.name,
      ip,
      details: { patientId: patient.id, appointmentId: apt.id, patientCreated },
    })
  } catch (err) {
    console.error('[leads/converter] erro ao vincular o lead ao paciente:', err)
    leadUpdated = false
  }

  // ── 4. Efeitos colaterais do agendamento (espelham POST /api/agenda) ──

  // Lança a taxa da consulta no financeiro quando ela é paga. Falhar aqui não pode
  // derrubar a resposta: a consulta já está marcada e o paciente já foi avisado.
  if (apt.isPaidConsultation && apt.patientId) {
    try {
      await db.insert(transactions).values({
        type: 'income',
        category: 'consultation_fee',
        amount: apt.consultationPrice || '0.00',
        description: `Consulta: ${patient.name}` + (apt.paymentStatus === 'paid' ? ' (Pago)' : ' (A receber)'),
        date: toDateBR(),
        dueDate: apt.startAt.toISOString().split('T')[0],
        isPaid: apt.paymentStatus === 'paid',
        paidAt: apt.paymentStatus === 'paid' ? new Date() : null,
        patientId: apt.patientId,
        appointmentId: apt.id,
        notes: apt.paymentReceiptUrl ? `Comprovante: ${apt.paymentReceiptUrl}` : null,
        createdById: session.user.id,
      })
    } catch (err) {
      console.error('[leads/converter] erro ao lançar a taxa da consulta:', err)
    }
  }

  // Sincroniza com a Google Agenda do médico (não-bloqueante).
  if (apt.doctorId && apt.status !== 'cancelled') {
    try {
      const eventId = await syncAppointment(apt, patient.name)
      if (eventId && eventId !== apt.googleEventId) {
        await db.update(appointments).set({ googleEventId: eventId }).where(eq(appointments.id, apt.id))
        apt.googleEventId = eventId
      }
    } catch (err) {
      console.error('[leads/converter] erro ao sincronizar com o Google Calendar:', err)
    }
  }

  await notify({
    type: 'appointment_new',
    title: `Novo agendamento: ${patient.name}`,
    body: `${APPOINTMENT_TYPE_LABELS[apt.type] ?? apt.type} • ${formatDateTime(apt.startAt)}`,
    link: '/agenda',
    entityId: apt.id,
  })

  await logActivity({
    userId: session.user.id,
    userName: session.user.name || session.user.email || null,
    action: 'agenda:create',
    module: 'agenda',
    targetId: apt.id,
    targetName: patient.name,
    ip,
    details: { title: apt.title, startAt: apt.startAt, endAt: apt.endAt, type: apt.type, fromLeadId: lead.id },
  })

  // O vínculo é a única etapa que pode falhar sem abortar o resto. Avisamos qual é o
  // estado real em vez de responder um sucesso que esconderia o lead fora do funil.
  if (!leadUpdated) {
    return NextResponse.json(
      {
        error:
          'A ficha e a consulta foram criadas, mas o lead não pôde ser marcado como convertido. Atualize o status do lead manualmente — NÃO repita o agendamento, ele já existe.',
        data: { patient, appointment: apt, patientCreated, leadUpdated: false },
      },
      { status: 500 },
    )
  }

  return NextResponse.json(
    { data: { patient, appointment: apt, patientCreated, leadUpdated: true } },
    { status: 201 },
  )
}
