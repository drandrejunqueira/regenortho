// Loaders do dashboard — server side, um por bloco de dados.
// Cada função é independente e falha sozinha: runLoaders() usa allSettled e o
// bloco correspondente mostra erro sem derrubar o resto da tela.
import { and, asc, count, eq, gte, inArray, lt, lte, sql, sum } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  appointments,
  examOrders,
  leads,
  materials,
  monthlyGoals,
  transactions,
  users,
} from '@/lib/db/schema'
import { APPOINTMENT_TYPE_LABELS, LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from '@/lib/constants'
import { addDays, brDay, brTime, dayWindow, diffDays, monthBounds, weekdayShort, dayMonth } from './time'
import type {
  AgendaItem,
  AgendaState,
  LoaderCtx,
  LoaderId,
  LoaderResults,
  ResultMap,
} from './types'

// Meta padrão quando o mês não tem registro em monthly_goals. Mesmo valor que a
// tela antiga usava; a UI avisa que é padrão (metaDefinida = false).
const DEFAULT_REVENUE_GOAL = 25_000
// Sem horário de funcionamento em clinic_settings, a capacidade de agenda é
// estimada em 8h por médico ativo por dia. Quando existir openingHours, troca aqui.
const WORKDAY_MINUTES = 8 * 60
const LEADS_LIMIT = 6
const VENCIDAS_LIMIT = 6
const EXAMES_LIMIT = 8

// Não aparecem em nenhuma agenda do dia.
const HIDDEN_APPOINTMENT_STATUSES = new Set(['cancelled'])

type AppointmentRow = Awaited<ReturnType<typeof fetchAppointments>>[number]

async function fetchAppointments(from: Date, to: Date, doctorId?: string) {
  return db.query.appointments.findMany({
    where: and(
      gte(appointments.startAt, from),
      lte(appointments.startAt, to),
      doctorId ? eq(appointments.doctorId, doctorId) : undefined,
    ),
    orderBy: (a, { asc: ascFn }) => [ascFn(a.startAt)],
    with: {
      patient: { columns: { id: true, name: true, phone: true } },
      lead: { columns: { id: true, name: true, phone: true } },
      doctor: { columns: { id: true, name: true } },
      roomObj: { columns: { id: true, name: true } },
    },
  })
}

function classify(status: string, startMs: number, endMs: number, nowMs: number): AgendaState {
  if (status === 'attended') return 'done'
  if (status === 'no_show') return 'no_show'
  if (status === 'rescheduled') return 'rescheduled'
  if (startMs <= nowMs && nowMs < endMs) return 'now'
  if (endMs <= nowMs) return 'late'
  return status === 'confirmed' ? 'confirmed' : 'unconfirmed'
}

function toAgendaItem(a: AppointmentRow, nowMs: number): AgendaItem {
  const start = new Date(a.startAt)
  const end = new Date(a.endAt)
  const person = a.patient ?? a.lead ?? null
  return {
    id: a.id,
    day: brDay(start),
    time: brTime(start),
    endTime: brTime(end),
    startMs: start.getTime(),
    endMs: end.getTime(),
    personName: person?.name ?? a.title ?? 'Sem paciente vinculado',
    personPhone: person?.phone ?? null,
    patientId: a.patient?.id ?? null,
    leadId: a.lead?.id ?? null,
    doctorName: a.doctor?.name ?? null,
    type: a.type,
    typeLabel: APPOINTMENT_TYPE_LABELS[a.type] ?? a.type,
    status: a.status,
    state: classify(a.status, start.getTime(), end.getTime(), nowMs),
    room: a.roomObj?.name ?? a.room ?? null,
  }
}

function isVisible(a: AppointmentRow): boolean {
  return !HIDDEN_APPOINTMENT_STATUSES.has(a.status) && a.type !== 'block'
}

// ── Agenda ───────────────────────────────────────────────────

async function chegadas(ctx: LoaderCtx): Promise<LoaderResults['chegadas']> {
  const { from, to } = dayWindow(ctx.today)
  const nowMs = ctx.now.getTime()
  const rows = await fetchAppointments(from, to)
  const items = rows
    .filter(isVisible)
    .map((a) => toAgendaItem(a, nowMs))
    .filter((i) => i.day === ctx.today)

  return {
    day: ctx.today,
    items,
    total: items.length,
    porChegar: items.filter((i) => i.state === 'confirmed' || i.state === 'unconfirmed').length,
    confirmados: items.filter((i) => i.status === 'confirmed' || i.status === 'attended').length,
    atendidos: items.filter((i) => i.state === 'done').length,
    semRegistro: items.filter((i) => i.state === 'late').length,
  }
}

async function naoConfirmados(ctx: LoaderCtx): Promise<LoaderResults['naoConfirmados']> {
  const tomorrow = addDays(ctx.today, 1)
  const { from, to } = dayWindow(ctx.today, tomorrow)
  const nowMs = ctx.now.getTime()
  const rows = await fetchAppointments(from, to)
  const items = rows
    .filter((a) => isVisible(a) && a.status === 'scheduled')
    .map((a) => toAgendaItem(a, nowMs))
  return {
    hoje: items.filter((i) => i.day === ctx.today && i.startMs > nowMs),
    amanha: items.filter((i) => i.day === tomorrow),
  }
}

async function minhaAgenda(ctx: LoaderCtx): Promise<LoaderResults['minhaAgenda']> {
  const { from, to } = dayWindow(ctx.today)
  const nowMs = ctx.now.getTime()
  const rows = await fetchAppointments(from, to, ctx.userId)
  const items = rows
    .filter(isVisible)
    .map((a) => toAgendaItem(a, nowMs))
    .filter((i) => i.day === ctx.today)
  const proximo =
    items.find((i) => i.state === 'now') ??
    items.find((i) => i.state === 'confirmed' || i.state === 'unconfirmed') ??
    null
  return {
    day: ctx.today,
    items,
    proximo,
    total: items.length,
    atendidos: items.filter((i) => i.state === 'done').length,
  }
}

async function ocupacao7d(ctx: LoaderCtx): Promise<LoaderResults['ocupacao7d']> {
  const lastDay = addDays(ctx.today, 6)
  const { from, to } = dayWindow(ctx.today, lastDay)
  const [rows, doctorsRes] = await Promise.all([
    fetchAppointments(from, to),
    db.select({ n: count() }).from(users).where(and(eq(users.role, 'doctor'), eq(users.isActive, true))),
  ])
  const doctors = Math.max(1, doctorsRes[0]?.n ?? 0)
  const capacityMinutes = doctors * WORKDAY_MINUTES

  const byDay = new Map<string, { minutes: number; count: number }>()
  for (const a of rows) {
    if (!isVisible(a) || a.status === 'no_show') continue
    const day = brDay(new Date(a.startAt))
    const minutes = Math.max(0, (new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 60_000)
    const acc = byDay.get(day) ?? { minutes: 0, count: 0 }
    byDay.set(day, { minutes: acc.minutes + minutes, count: acc.count + 1 })
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(ctx.today, i)
    const acc = byDay.get(day) ?? { minutes: 0, count: 0 }
    return {
      day,
      label: weekdayShort(day),
      minutes: Math.round(acc.minutes),
      count: acc.count,
      pct: Math.min(100, Math.round((acc.minutes / capacityMinutes) * 100)),
      isToday: day === ctx.today,
    }
  })
  const mediaPct = Math.round(days.reduce((s, d) => s + d.pct, 0) / days.length)
  return { days, capacityMinutes, doctors, mediaPct }
}

// ── Leads ────────────────────────────────────────────────────

async function leadsNovos(ctx: LoaderCtx): Promise<LoaderResults['leadsNovos']> {
  const nowMs = ctx.now.getTime()
  const [totalRes, rows] = await Promise.all([
    db.select({ n: count() }).from(leads).where(eq(leads.status, 'new')),
    db
      .select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        source: leads.source,
        specialty: leads.specialty,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(eq(leads.status, 'new'))
      .orderBy(asc(leads.createdAt))
      .limit(LEADS_LIMIT),
  ])
  return {
    total: totalRes[0]?.n ?? 0,
    items: rows.map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      sourceLabel: LEAD_SOURCE_LABELS[l.source] ?? l.source,
      specialty: l.specialty,
      createdAt: new Date(l.createdAt).toISOString(),
      ageMs: nowMs - new Date(l.createdAt).getTime(),
    })),
  }
}

const FUNNEL_ORDER = ['new', 'contacted', 'scheduled', 'attended', 'active_patient'] as const

async function funilMes(ctx: LoaderCtx): Promise<LoaderResults['funilMes']> {
  const { start, month } = monthBounds(ctx.today)
  const startDate = new Date(`${start}T03:00:00.000Z`) // meia-noite BR
  const rows = await db
    .select({ status: leads.status, n: count() })
    .from(leads)
    .where(gte(leads.createdAt, startDate))
    .groupBy(leads.status)
  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>
  const total = rows.reduce((s, r) => s + r.n, 0)
  const etapas = FUNNEL_ORDER.map((status) => ({
    status,
    label: LEAD_STATUS_LABELS[status] ?? status,
    count: byStatus[status] ?? 0,
  }))
  const chegaramAgendado = etapas.slice(2).reduce((s, e) => s + e.count, 0)
  return {
    month,
    total,
    etapas,
    perdidos: byStatus['lost'] ?? 0,
    taxaAgendamento: total > 0 ? Math.round((chegaramAgendado / total) * 100) : 0,
  }
}

// ── Estoque ──────────────────────────────────────────────────

async function estoque(): Promise<LoaderResults['estoque']> {
  const rows = await db
    .select({
      id: materials.id,
      name: materials.name,
      status: materials.status,
      currentStock: materials.currentStock,
      minimumStock: materials.minimumStock,
      unit: materials.unit,
    })
    .from(materials)
    .where(and(eq(materials.isActive, true), inArray(materials.status, ['critical', 'out_of_stock', 'low'])))
    .orderBy(sql`case ${materials.status} when 'out_of_stock' then 0 when 'critical' then 1 else 2 end`, asc(materials.name))
  const critical = rows.filter((m) => m.status === 'critical' || m.status === 'out_of_stock').length
  return { critical, low: rows.length - critical, items: rows.slice(0, 5) }
}

// ── Exames ───────────────────────────────────────────────────

const EXAM_OPEN_STATUSES = ['issued', 'scheduled', 'collected', 'result_available'] as const

async function exames(ctx: LoaderCtx): Promise<LoaderResults['exames']> {
  const rows = await db.query.examOrders.findMany({
    where: and(eq(examOrders.doctorId, ctx.userId), inArray(examOrders.status, [...EXAM_OPEN_STATUSES])),
    orderBy: (e, { asc: ascFn }) => [ascFn(e.createdAt)],
    with: { patient: { columns: { id: true, name: true } } },
  })
  const items = rows
    .map((e) => ({
      id: e.id,
      patientId: e.patientId,
      patientName: e.patient?.name ?? 'Paciente',
      examNames: (e.exams ?? []).map((x) => x.name),
      urgency: e.urgency,
      status: e.status,
      ageDays: diffDays(brDay(new Date(e.createdAt)), ctx.today),
    }))
    // Resultado disponível vem antes: é o que o médico precisa olhar.
    .sort((a, b) => Number(b.status === 'result_available') - Number(a.status === 'result_available'))
  return {
    aguardando: items.filter((i) => i.status !== 'result_available').length,
    comResultado: items.filter((i) => i.status === 'result_available').length,
    items: items.slice(0, EXAMES_LIMIT),
  }
}

// ── Financeiro ───────────────────────────────────────────────

const dueOrDate = sql<string>`coalesce(${transactions.dueDate}, ${transactions.date})`

async function caixaHoje(ctx: LoaderCtx): Promise<LoaderResults['caixaHoje']> {
  const rows = await db
    .select({ type: transactions.type, total: sum(transactions.amount), n: count() })
    .from(transactions)
    .where(and(eq(transactions.isPaid, true), eq(transactions.date, ctx.today)))
    .groupBy(transactions.type)
  const get = (t: 'income' | 'expense') => rows.find((r) => r.type === t)
  const entrou = Number(get('income')?.total ?? 0)
  const saiu = Number(get('expense')?.total ?? 0)
  return {
    day: ctx.today,
    entrou,
    saiu,
    saldo: entrou - saiu,
    qtdEntradas: get('income')?.n ?? 0,
    qtdSaidas: get('expense')?.n ?? 0,
  }
}

async function vencidas(ctx: LoaderCtx): Promise<LoaderResults['vencidas']> {
  const overdue = and(eq(transactions.type, 'income'), eq(transactions.isPaid, false), lt(dueOrDate, ctx.today))
  const [agg, rows] = await Promise.all([
    db.select({ n: count(), total: sum(transactions.amount) }).from(transactions).where(overdue),
    db.query.transactions.findMany({
      where: overdue,
      orderBy: () => [asc(dueOrDate)],
      limit: VENCIDAS_LIMIT,
      with: { patient: { columns: { id: true, name: true } } },
    }),
  ])
  return {
    total: agg[0]?.n ?? 0,
    soma: Number(agg[0]?.total ?? 0),
    items: rows.map((t) => {
      const due = t.dueDate ?? t.date
      return {
        id: t.id,
        description: t.description,
        amount: Number(t.amount),
        due,
        daysLate: diffDays(due, ctx.today),
        patientId: t.patient?.id ?? null,
        patientName: t.patient?.name ?? null,
        installmentNumber: t.installmentNumber,
        installmentTotal: t.installmentTotal,
      }
    }),
  }
}

async function previstoMes(ctx: LoaderCtx): Promise<LoaderResults['previstoMes']> {
  const mb = monthBounds(ctx.today)
  const income = eq(transactions.type, 'income')
  const [recebidoRes, aVencerRes, vencidoRes, goal] = await Promise.all([
    db.select({ total: sum(transactions.amount) }).from(transactions)
      .where(and(income, eq(transactions.isPaid, true), gte(transactions.date, mb.start), lte(transactions.date, mb.end))),
    db.select({ total: sum(transactions.amount) }).from(transactions)
      .where(and(income, eq(transactions.isPaid, false), gte(dueOrDate, ctx.today), lte(dueOrDate, mb.end))),
    db.select({ total: sum(transactions.amount) }).from(transactions)
      .where(and(income, eq(transactions.isPaid, false), lt(dueOrDate, ctx.today))),
    db.query.monthlyGoals.findFirst({
      where: and(eq(monthlyGoals.month, mb.month), eq(monthlyGoals.year, mb.year)),
    }),
  ])
  const recebido = Number(recebidoRes[0]?.total ?? 0)
  const metaDefinida = goal?.revenueGoal != null
  const meta = metaDefinida ? Number(goal!.revenueGoal) : DEFAULT_REVENUE_GOAL
  const falta = Math.max(0, meta - recebido)
  return {
    month: mb.month,
    year: mb.year,
    recebido,
    aVencer: Number(aVencerRes[0]?.total ?? 0),
    vencido: Number(vencidoRes[0]?.total ?? 0),
    meta,
    metaDefinida,
    daysLeft: mb.daysLeft,
    daysInMonth: mb.daysInMonth,
    ritmoDia: mb.daysLeft > 0 ? falta / mb.daysLeft : falta,
  }
}

async function vencimentos7d(ctx: LoaderCtx): Promise<LoaderResults['vencimentos7d']> {
  const lastDay = addDays(ctx.today, 6)
  const rows = await db
    .select({ day: dueOrDate, total: sum(transactions.amount), n: count() })
    .from(transactions)
    .where(and(
      eq(transactions.type, 'income'),
      eq(transactions.isPaid, false),
      gte(dueOrDate, ctx.today),
      lte(dueOrDate, lastDay),
    ))
    .groupBy(dueOrDate)
  const byDay = new Map(rows.map((r) => [r.day, { value: Number(r.total ?? 0), count: r.n }]))
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(ctx.today, i)
    const acc = byDay.get(day) ?? { value: 0, count: 0 }
    return { day, label: `${weekdayShort(day)} ${dayMonth(day)}`, value: acc.value, count: acc.count, isToday: i === 0 }
  })
  return { days, soma: days.reduce((s, d) => s + d.value, 0) }
}

// ── Registro e execução ──────────────────────────────────────

export const LOADERS: { [K in LoaderId]: (ctx: LoaderCtx) => Promise<LoaderResults[K]> } = {
  chegadas,
  naoConfirmados,
  leadsNovos,
  estoque,
  minhaAgenda,
  exames,
  caixaHoje,
  vencidas,
  previstoMes,
  vencimentos7d,
  funilMes,
  ocupacao7d,
}

/**
 * Roda só os loaders pedidos, em paralelo, e devolve um mapa com sucesso ou
 * erro por chave. Um loader que falha não derruba os outros.
 */
export async function runLoaders(ids: readonly LoaderId[], ctx: LoaderCtx): Promise<ResultMap> {
  const settled = await Promise.allSettled(ids.map((id) => LOADERS[id](ctx)))
  const out: ResultMap = {}
  ids.forEach((id, i) => {
    const r = settled[i]
    if (r.status === 'fulfilled') {
      ;(out as Record<string, unknown>)[id] = { ok: true, data: r.value }
    } else {
      console.error(`[dashboard] loader "${id}" falhou`, r.reason)
      ;(out as Record<string, unknown>)[id] = { ok: false, error: 'Não foi possível carregar este bloco.' }
    }
  })
  return out
}

