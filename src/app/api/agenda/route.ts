import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { appointments, patients, leads, transactions } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { syncAppointment } from '@/lib/google/calendar'
import { logActivity } from '@/lib/db/logger'
import { NextRequest, NextResponse } from 'next/server'
import { and, gte, lte, eq, isNull, ne, isNotNull } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'
import { notify } from '@/lib/notifications'
import { APPOINTMENT_TYPE_LABELS } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'

const createSchema = z.object({
  patientId: z.string().uuid().nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  doctorId: z.string().uuid().nullable().optional(),
  type: z.enum(['consultation', 'prp', 'bmac', 'hyaluronic', 'prolotherapy', 'surgery', 'return', 'block']),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  title: z.string().optional(),
  notes: z.string().optional(),
  room: z.string().optional(),
  roomId: z.string().uuid().nullable().optional(),
  isPaidConsultation: z.boolean().optional(),
  consultationPrice: z.string().nullable().optional(),
  paymentMethodId: z.string().uuid().nullable().optional(),
  paymentTiming: z.enum(['antecipado', 'no_ato']).nullable().optional(),
  paymentStatus: z.enum(['pending', 'paid']).nullable().optional(),
  paymentReceiptUrl: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'agenda:view', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const doctorId = searchParams.get('doctorId')
  // A ficha do paciente já chamava com ?patientId=..., mas o filtro não existia
  // aqui — a aba Consultas listava a agenda inteira da clínica.
  const patientId = searchParams.get('patientId')

  const conditions = []
  if (start) conditions.push(gte(appointments.startAt, new Date(start)))
  if (end) conditions.push(lte(appointments.startAt, new Date(end)))
  if (doctorId) conditions.push(eq(appointments.doctorId, doctorId))
  if (patientId) conditions.push(eq(appointments.patientId, patientId))

  const data = await db.query.appointments.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: (a, { asc }) => [asc(a.startAt)],
    // Teto de segurança: sem nenhum filtro isto varria a tabela inteira.
    limit: 1000,
    with: {
      patient: { columns: { id: true, name: true, phone: true } },
      lead: { columns: { id: true, name: true, phone: true } },
      doctor: { columns: { id: true, name: true } },
      roomObj: { columns: { id: true, name: true, color: true } },
    },
  })

  // Se houver datas válidas, tentamos sincronizar eventos externos do Google Calendar
  if (start && end) {
    try {
      const { listGoogleCalendarEvents } = await import('@/lib/google/calendar')
      const { users } = await import('@/lib/db/schema')
      
      let gcalEvents: any[] = []
      
      if (doctorId) {
        gcalEvents = await listGoogleCalendarEvents(doctorId, new Date(start), new Date(end))
      } else {
        // Se for "todos", listamos os eventos externos de todos os médicos cadastrados ativos que têm agenda configurada
        const docs = await db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.role, 'doctor'),
              eq(users.isActive, true),
              isNotNull(users.googleCalendarId),
              ne(users.googleCalendarId, '')
            )
          )
        const lists = await Promise.all(
          docs.map((doc) => listGoogleCalendarEvents(doc.id, new Date(start), new Date(end)))
        )
        gcalEvents = lists.flat()
      }

      // Evita duplicados: Se o evento do Google já foi associado a um agendamento local, não exibimos o externo
      const syncedEventIds = new Set(data.map((apt) => apt.googleEventId).filter(Boolean))
      const filteredGcalEvents = gcalEvents.filter((evt) => !syncedEventIds.has(evt.googleEventId))

      const merged = [
        ...data,
        ...filteredGcalEvents.map((evt) => ({
          ...evt,
          patient: null,
          lead: null,
          doctor: null,
        })),
      ]

      // Ordena por horário de início
      merged.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      return NextResponse.json({ data: merged })
    } catch (e) {
      console.error('[agenda GET] erro ao buscar eventos do Google Calendar:', e)
    }
  }

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'agenda:create', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    let displayName: string | null = null
    if (parsed.data.patientId) {
      const [p] = await db.select({ name: patients.name }).from(patients).where(eq(patients.id, parsed.data.patientId))
      displayName = p?.name ?? null
    } else if (parsed.data.leadId) {
      const [l] = await db.select({ name: leads.name }).from(leads).where(eq(leads.id, parsed.data.leadId))
      displayName = l?.name ?? null
    }

    const [apt] = await db.insert(appointments).values({
      ...parsed.data,
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
      createdById: session.user.id,
    }).returning()

    // Lança financeiro da consulta se marcada como paga
    if (apt.isPaidConsultation && apt.patientId) {
      await db.insert(transactions).values({
        type: 'income',
        category: 'consultation_fee',
        amount: apt.consultationPrice || '0.00',
        description: `Consulta: ${displayName || 'Paciente'}` + (apt.paymentStatus === 'paid' ? ' (Pago)' : ' (A receber)'),
        date: new Date().toISOString().split('T')[0],
        dueDate: apt.startAt.toISOString().split('T')[0],
        isPaid: apt.paymentStatus === 'paid',
        paidAt: apt.paymentStatus === 'paid' ? new Date() : null,
        patientId: apt.patientId,
        appointmentId: apt.id,
        notes: apt.paymentReceiptUrl ? `Comprovante: ${apt.paymentReceiptUrl}` : null,
        createdById: session.user.id,
      })
    }

    // Sincroniza com a Google Agenda do médico (não-bloqueante)
    if (apt.doctorId && apt.status !== 'cancelled') {
      const eventId = await syncAppointment(apt, displayName)
      if (eventId && eventId !== apt.googleEventId) {
        await db.update(appointments).set({ googleEventId: eventId }).where(eq(appointments.id, apt.id))
        apt.googleEventId = eventId
      }
    }

    await notify({
      type: 'appointment_new',
      title: `Novo agendamento: ${displayName || apt.title || 'Compromisso'}`,
      body: `${APPOINTMENT_TYPE_LABELS[apt.type] ?? apt.type} • ${formatDateTime(apt.startAt)}`,
      link: '/agenda',
      entityId: apt.id,
    })

    // Registra no log de auditoria
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    await logActivity({
      userId: session.user.id,
      userName: session.user.name || session.user.email || null,
      action: 'agenda:create',
      module: 'agenda',
      targetId: apt.id,
      targetName: displayName || apt.title || 'Compromisso',
      ip,
      details: {
        title: apt.title,
        startAt: apt.startAt,
        endAt: apt.endAt,
        type: apt.type
      }
    })

    return NextResponse.json({ data: apt }, { status: 201 })
  } catch (err: any) {
    console.error('DB Insert Error:', err)
    return NextResponse.json({ error: 'Erro no banco de dados', details: err.message }, { status: 500 })
  }
}
