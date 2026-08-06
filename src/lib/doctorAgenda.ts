// Resumo diário da agenda de UM médico — server side.
// Diferente de lib/clinicReport.ts (panorama da clínica inteira enviado ao grupo),
// aqui o recorte é pessoal: só os agendamentos daquele médico, no dia dele.
// Determinístico de ponta a ponta — nenhum número passa por IA.
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appointments, patients, leads, rooms, users, whatsappMessages } from '@/lib/db/schema'
import { sendEvolutionText, waNumber } from '@/lib/evolution'
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_TYPE_LABELS } from '@/lib/constants'
import { toWhatsappText } from '@/lib/clinicReport'

const TZ = 'America/Sao_Paulo'

/** Dia-calendário (YYYY-MM-DD) no fuso da clínica. O servidor roda em UTC na Vercel. */
export function brDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
}
function brTime(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(d)
}
function brLongDate(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(d)
}

/** Hora atual (HH:mm) no fuso da clínica — usado pelo cron para casar o horário configurado. */
export function brHourMinute(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

// Não aparecem na agenda do dia: já foram desmarcados.
const HIDDEN_STATUSES = new Set(['cancelled', 'no_show'])

export interface AgendaSlot {
  id: string
  time: string
  endTime: string
  patientName: string
  patientPhone: string | null
  type: string
  typeLabel: string
  status: string
  statusLabel: string
  room: string | null
  notes: string | null
  isPaid: boolean
}

export interface DoctorAgenda {
  doctorId: string
  doctorName: string
  date: string
  dateLabel: string
  slots: AgendaSlot[]
  total: number
  confirmed: number
  markdown: string
  whatsappText: string
}

/**
 * Monta a agenda de um médico para um dia (padrão: hoje, fuso da clínica).
 *
 * A janela vai de -12h a +36h em UTC e o filtro fino é feito em memória por
 * dia-calendário BR: comparar timestamps direto em SQL erraria a virada do dia
 * porque o Postgres guarda `timestamp` sem fuso.
 */
export async function buildDoctorAgenda(doctorId: string, date?: string): Promise<DoctorAgenda> {
  const target = date || brDay()
  // Ancora no meio-dia BR (15:00 UTC) para a janela cobrir o dia inteiro com folga.
  const anchor = new Date(`${target}T15:00:00.000Z`)
  const from = new Date(anchor.getTime() - 24 * 3600_000)
  const to = new Date(anchor.getTime() + 24 * 3600_000)

  const [doctor] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, doctorId))

  const rows = await db
    .select({
      id: appointments.id,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      type: appointments.type,
      status: appointments.status,
      title: appointments.title,
      notes: appointments.notes,
      room: appointments.room,
      roomId: appointments.roomId,
      patientId: appointments.patientId,
      leadId: appointments.leadId,
      isPaid: appointments.isPaidConsultation,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, doctorId),
        gte(appointments.startAt, from),
        lte(appointments.startAt, to),
      ),
    )
    .orderBy(asc(appointments.startAt))

  const todays = rows.filter(
    (a) => brDay(new Date(a.startAt)) === target && !HIDDEN_STATUSES.has(a.status),
  )

  // Nomes de pacientes/leads e salas em lote — evita N+1 numa agenda cheia.
  const patientIds = [...new Set(todays.map((a) => a.patientId).filter(Boolean))] as string[]
  const leadIds = [...new Set(todays.map((a) => a.leadId).filter(Boolean))] as string[]
  const roomIds = [...new Set(todays.map((a) => a.roomId).filter(Boolean))] as string[]

  const [patientRows, leadRows, roomRows] = await Promise.all([
    patientIds.length
      ? db
          .select({ id: patients.id, name: patients.name, phone: patients.phone })
          .from(patients)
          .where(inArray(patients.id, patientIds))
      : Promise.resolve([]),
    leadIds.length
      ? db
          .select({ id: leads.id, name: leads.name, phone: leads.phone })
          .from(leads)
          .where(inArray(leads.id, leadIds))
      : Promise.resolve([]),
    roomIds.length
      ? db.select({ id: rooms.id, name: rooms.name }).from(rooms).where(inArray(rooms.id, roomIds))
      : Promise.resolve([]),
  ])

  const patientById = new Map(patientRows.map((p) => [p.id, p]))
  const leadById = new Map(leadRows.map((l) => [l.id, l]))
  const roomById = new Map(roomRows.map((r) => [r.id, r.name]))

  const slots: AgendaSlot[] = todays.map((a) => {
    const person = (a.patientId && patientById.get(a.patientId)) || (a.leadId && leadById.get(a.leadId)) || null
    return {
      id: a.id,
      time: brTime(new Date(a.startAt)),
      endTime: brTime(new Date(a.endAt)),
      patientName: person?.name || a.title || 'Sem paciente vinculado',
      patientPhone: person?.phone || null,
      type: a.type,
      typeLabel: APPOINTMENT_TYPE_LABELS[a.type] ?? a.type,
      status: a.status,
      statusLabel: APPOINTMENT_STATUS_LABELS[a.status] ?? a.status,
      room: a.roomId ? roomById.get(a.roomId) ?? a.room : a.room,
      notes: a.notes,
      isPaid: a.isPaid,
    }
  })

  const confirmed = slots.filter((s) => s.status === 'confirmed').length
  const doctorName = doctor?.name || 'Doutor(a)'
  const dateLabel = brLongDate(anchor)

  const markdown = renderMarkdown({ doctorName, dateLabel, slots, confirmed })

  return {
    doctorId,
    doctorName,
    date: target,
    dateLabel,
    slots,
    total: slots.length,
    confirmed,
    markdown,
    whatsappText: toWhatsappText(markdown),
  }
}

function renderMarkdown(input: {
  doctorName: string
  dateLabel: string
  slots: AgendaSlot[]
  confirmed: number
}): string {
  const { doctorName, dateLabel, slots, confirmed } = input
  const header = `### 🩺 Sua agenda de hoje\n*${doctorName}* — ${dateLabel}`

  if (slots.length === 0) {
    return `${header}\n\nNenhuma consulta agendada para hoje. Bom descanso! ☕`
  }

  const lines = slots.map((s) => {
    const extras = [s.typeLabel, s.statusLabel, s.room ? `Sala ${s.room}` : null]
      .filter(Boolean)
      .join(' · ')
    return `- *${s.time}* — ${s.patientName}\n  ${extras}`
  })

  const resumo =
    `**Total:** ${slots.length} ${slots.length === 1 ? 'atendimento' : 'atendimentos'}` +
    (confirmed > 0 ? ` · ${confirmed} confirmado${confirmed === 1 ? '' : 's'}` : '')

  return `${header}\n\n${resumo}\n\n${lines.join('\n')}`
}

export interface DeliverResult {
  ok: boolean
  error?: string
  skipped?: 'sem-numero' | 'sem-agenda'
}

/**
 * Envia a agenda do médico no WhatsApp dele e registra em whatsapp_messages.
 *
 * `skipEmpty` evita mandar "nenhuma consulta" todo dia para quem não atende
 * diariamente — o cron usa true, o botão "enviar agora" usa false (é um teste).
 */
export async function deliverDoctorAgenda(opts: {
  doctorId: string
  number: string
  date?: string
  skipEmpty?: boolean
}): Promise<DeliverResult> {
  const number = waNumber(opts.number || '')
  if (!number) return { ok: false, skipped: 'sem-numero', error: 'Número de WhatsApp não configurado.' }

  const agenda = await buildDoctorAgenda(opts.doctorId, opts.date)
  if (opts.skipEmpty && agenda.total === 0) return { ok: true, skipped: 'sem-agenda' }

  try {
    const resp = await sendEvolutionText(number, agenda.whatsappText)
    await db.insert(whatsappMessages).values({
      type: 'daily_agenda',
      targetNumber: number.slice(0, 20),
      message: agenda.whatsappText,
      status: 'sent',
      evolutionResponse: (resp as unknown) ?? null,
      sentAt: new Date(),
    })
    return { ok: true }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    // Registra a falha também: sem isso um número errado some silenciosamente.
    await db
      .insert(whatsappMessages)
      .values({
        type: 'daily_agenda',
        targetNumber: number.slice(0, 20),
        message: agenda.whatsappText,
        status: 'failed',
        evolutionResponse: { error },
      })
      .catch(() => {})
    return { ok: false, error }
  }
}
