import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { appointments, patients, leads, transactions } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { syncAppointment, removeAppointment } from '@/lib/google/calendar'
import { logActivity } from '@/lib/db/logger'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'
import { notify } from '@/lib/notifications'
import { formatDateTime, toDateBR } from '@/lib/utils'

const updateSchema = z.object({
  status: z.enum(['scheduled', 'confirmed', 'attended', 'no_show', 'rescheduled', 'cancelled']).optional(),
  type: z.enum(['consultation', 'prp', 'bmac', 'hyaluronic', 'prolotherapy', 'surgery', 'return', 'block']).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  notes: z.string().nullable().optional(),
  room: z.string().nullable().optional(),
  roomId: z.string().uuid().nullable().optional(),
  confirmedAt: z.string().datetime().nullable().optional(),
  reminderSent: z.boolean().optional(),
  returnDeadline: z.string().datetime().nullable().optional(),
  returnEstimatedAt: z.string().datetime().nullable().optional(),
  isPaidConsultation: z.boolean().optional(),
  consultationPrice: z.string().nullable().optional(),
  paymentMethodId: z.string().uuid().nullable().optional(),
  paymentTiming: z.enum(['antecipado', 'no_ato']).nullable().optional(),
  paymentStatus: z.enum(['pending', 'paid']).nullable().optional(),
  paymentReceiptUrl: z.string().nullable().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'agenda:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  // No PATCH os dois campos são opcionais, então a validação precisa comparar o
  // resultado final (o que veio no corpo mesclado com o que já está no banco).
  // Sem isto era possível salvar um agendamento que termina antes de começar.
  if (parsed.data.startAt || parsed.data.endAt) {
    const atual = await db.query.appointments.findFirst({
      where: eq(appointments.id, id),
      columns: { startAt: true, endAt: true },
    })
    if (!atual) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
    const inicio = parsed.data.startAt ? new Date(parsed.data.startAt) : atual.startAt
    const fim = parsed.data.endAt ? new Date(parsed.data.endAt) : atual.endAt
    if (fim <= inicio) {
      return NextResponse.json(
        { error: 'O término deve ser posterior ao início' },
        { status: 400 }
      )
    }
  }

  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() }
  if (parsed.data.startAt) updateData.startAt = new Date(parsed.data.startAt)
  if (parsed.data.endAt) updateData.endAt = new Date(parsed.data.endAt)
  if (parsed.data.confirmedAt) updateData.confirmedAt = new Date(parsed.data.confirmedAt)
  if (parsed.data.returnDeadline) updateData.returnDeadline = new Date(parsed.data.returnDeadline)
  if (parsed.data.returnDeadline === null) updateData.returnDeadline = null
  if (parsed.data.returnEstimatedAt) updateData.returnEstimatedAt = new Date(parsed.data.returnEstimatedAt)
  if (parsed.data.returnEstimatedAt === null) updateData.returnEstimatedAt = null

  const [updated] = await db.update(appointments)
    .set(updateData)
    .where(eq(appointments.id, id))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })

  // Sincroniza o faturamento/financeiro da consulta.
  // ATENÇÃO: o appointmentId NÃO identifica sozinho o lançamento da consulta —
  // as parcelas de tratamento herdam o mesmo appointmentId (tratamentos/[id]).
  // Todo acesso aqui é escopado à taxa de consulta; sem isso, arrastar um card
  // na agenda apagava as parcelas do tratamento junto.
  const somenteTaxaDeConsulta = and(
    eq(transactions.appointmentId, updated.id),
    eq(transactions.category, 'consultation_fee'),
    isNull(transactions.treatmentId),
  )

  if (updated.isPaidConsultation && updated.patientId) {
    let displayName: string | null = null
    if (updated.patientId) {
      const [p] = await db.select({ name: patients.name }).from(patients).where(eq(patients.id, updated.patientId))
      displayName = p?.name ?? null
    }

    const [existingTx] = await db.select().from(transactions).where(somenteTaxaDeConsulta)

    // Só recalcula a baixa quando a requisição realmente mexeu no pagamento —
    // senão remarcar o horário reverteria um recebimento já dado no Financeiro.
    const pagamentoMudou = parsed.data.paymentStatus !== undefined
    const isPaid = pagamentoMudou ? updated.paymentStatus === 'paid' : (existingTx?.isPaid ?? false)

    const txData = {
      type: 'income' as const,
      category: 'consultation_fee' as const,
      amount: updated.consultationPrice || '0.00',
      description: `Consulta: ${displayName || 'Paciente'}` + (isPaid ? ' (Pago)' : ' (A receber)'),
      date: toDateBR(),
      dueDate: updated.startAt.toISOString().split('T')[0],
      isPaid,
      paidAt: pagamentoMudou ? (isPaid ? new Date() : null) : (existingTx?.paidAt ?? null),
      patientId: updated.patientId,
      appointmentId: updated.id,
      notes: updated.paymentReceiptUrl ? `Comprovante: ${updated.paymentReceiptUrl}` : null,
      createdById: session.user.id,
    }

    if (existingTx) {
      await db.update(transactions).set(txData).where(eq(transactions.id, existingTx.id))
    } else {
      await db.insert(transactions).values(txData)
    }
  } else if (parsed.data.isPaidConsultation !== undefined) {
    // Só remove quando a PRÓPRIA requisição desmarcou a cobrança da consulta.
    // Um PATCH de status ou de horário não pode encostar no financeiro.
    await db.delete(transactions).where(somenteTaxaDeConsulta)
  }

  // Reflete na Google Agenda do médico (não-bloqueante)
  if (updated.doctorId) {
    if (updated.status === 'cancelled') {
      if (updated.googleEventId) {
        await removeAppointment(updated.doctorId, updated.googleEventId)
        await db.update(appointments).set({ googleEventId: null }).where(eq(appointments.id, id))
        updated.googleEventId = null
      }
    } else {
      let displayName: string | null = null
      if (updated.patientId) {
        const [p] = await db.select({ name: patients.name }).from(patients).where(eq(patients.id, updated.patientId))
        displayName = p?.name ?? null
      } else if (updated.leadId) {
        const [l] = await db.select({ name: leads.name }).from(leads).where(eq(leads.id, updated.leadId))
        displayName = l?.name ?? null
      }
      const eventId = await syncAppointment(updated, displayName)
      if (eventId && eventId !== updated.googleEventId) {
        await db.update(appointments).set({ googleEventId: eventId }).where(eq(appointments.id, id))
        updated.googleEventId = eventId
      }
    }
  }

  // Registra no log de auditoria
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
  let displayName: string | null = null
  if (updated.patientId) {
    const [p] = await db.select({ name: patients.name }).from(patients).where(eq(patients.id, updated.patientId))
    displayName = p?.name ?? null
  } else if (updated.leadId) {
    const [l] = await db.select({ name: leads.name }).from(leads).where(eq(leads.id, updated.leadId))
    displayName = l?.name ?? null
  }

  // Só avisa quando o cancelamento veio nesta requisição — evita repetir o aviso
  // a cada edição posterior de um agendamento já cancelado.
  if (parsed.data.status === 'cancelled') {
    await notify({
      type: 'appointment_cancelled',
      title: `Agendamento cancelado: ${displayName || updated.title || 'Compromisso'}`,
      body: formatDateTime(updated.startAt),
      link: '/agenda',
      entityId: updated.id,
      priority: 'high',
    })
  }

  await logActivity({
    userId: session.user.id,
    userName: session.user.name || session.user.email || null,
    action: 'agenda:edit',
    module: 'agenda',
    targetId: updated.id,
    targetName: displayName || updated.title || 'Compromisso',
    ip,
    details: {
      status: updated.status,
      type: updated.type,
      startAt: updated.startAt,
      endAt: updated.endAt
    }
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'agenda:delete', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  let reason = 'Exclusão sem motivo'
  try {
    const body = await req.json().catch(() => ({}))
    if (body?.reason && body.reason.trim().length >= 3) {
      reason = body.reason.trim()
    } else {
      return NextResponse.json({ error: 'Motivo da exclusão é obrigatório (mínimo 3 caracteres)' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: 'Dados de requisição inválidos' }, { status: 400 })
  }

  // Busca detalhes do agendamento para enriquecer o log antes de excluir
  const appointmentData = await db.query.appointments.findFirst({
    where: eq(appointments.id, id),
    with: {
      patient: { columns: { name: true } },
      lead: { columns: { name: true } },
      doctor: { columns: { name: true } }
    }
  })

  if (!appointmentData) {
    return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
  }

  const targetName = appointmentData.patient?.name || appointmentData.lead?.name || appointmentData.title || 'Compromisso'
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')

  // Registra no log de auditoria
  await logActivity({
    userId: session.user.id,
    userName: session.user.name || session.user.email || null,
    action: 'agenda:delete',
    module: 'agenda',
    targetId: id,
    targetName,
    ip,
    details: {
      reason,
      title: appointmentData.title,
      startAt: appointmentData.startAt,
      endAt: appointmentData.endAt,
      doctorName: appointmentData.doctor?.name,
      room: appointmentData.room
    }
  })

  // Remove o evento da Google Agenda antes de apagar (não-bloqueante)
  if (appointmentData.googleEventId && appointmentData.doctorId) {
    await removeAppointment(appointmentData.doctorId, appointmentData.googleEventId)
  }

  // Excluir o agendamento só pode levar embora a taxa da própria consulta.
  await db.delete(transactions).where(and(
    eq(transactions.appointmentId, id),
    eq(transactions.category, 'consultation_fee'),
    isNull(transactions.treatmentId),
  ))

  // O que sobrou (parcelas de tratamento) é apenas desvinculado: continua no
  // contas a receber e libera a FK para o agendamento poder ser excluído.
  await db.update(transactions)
    .set({ appointmentId: null })
    .where(eq(transactions.appointmentId, id))

  // Deleta o agendamento
  await db.delete(appointments).where(eq(appointments.id, id))
  
  return NextResponse.json({ success: true })
}
