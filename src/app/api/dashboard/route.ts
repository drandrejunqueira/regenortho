import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { leads, appointments, transactions, materials, monthlyGoals } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextResponse } from 'next/server'
import { and, gte, lte, eq, count, sum, sql } from 'drizzle-orm'
import type { UserRole } from '@/types'

function getPeriod(now: Date) {
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(now.getDate() - 6)
  return {
    now,
    startOfMonth: new Date(now.getFullYear(), now.getMonth(), 1),
    endOfMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
    startOfLastMonth: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    endOfLastMonth: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
    todayStart: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    todayEnd: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
    sevenDaysAgo,
  }
}

type Period = ReturnType<typeof getPeriod>

function buildChart(period: Period, values: Record<string, number>, revenue = false) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(period.sevenDaysAgo)
    day.setDate(day.getDate() + i)
    const date = day.toISOString().split('T')[0]
    return {
      date,
      label: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', {
        weekday: 'short',
        ...(revenue ? { day: 'numeric' as const } : {}),
      }),
      value: values[date] ?? 0,
    }
  })
}

async function loadLeadMetrics(period: Period) {
  const [current, previous, conversion] = await Promise.all([
    db
      .select({ count: count() })
      .from(leads)
      .where(
        and(gte(leads.createdAt, period.startOfMonth), lte(leads.createdAt, period.endOfMonth))
      ),
    db
      .select({ count: count() })
      .from(leads)
      .where(
        and(
          gte(leads.createdAt, period.startOfLastMonth),
          lte(leads.createdAt, period.endOfLastMonth)
        )
      ),
    db.select({ status: leads.status, count: count() }).from(leads).groupBy(leads.status),
  ])
  const leadsNow = current[0]?.count ?? 0
  const leadsPrev = previous[0]?.count ?? 0
  const funnel = Object.fromEntries(conversion.map((row) => [row.status, row.count]))
  return {
    leadsThisMonth: leadsNow,
    leadsGrowth: leadsPrev > 0 ? Math.round(((leadsNow - leadsPrev) / leadsPrev) * 100) : 0,
    conversionFunnel: {
      new: funnel['new'] ?? 0,
      contacted: funnel['contacted'] ?? 0,
      scheduled: funnel['scheduled'] ?? 0,
      attended: funnel['attended'] ?? 0,
      active: funnel['active_patient'] ?? 0,
    },
  }
}

async function loadLeadsChart(period: Period) {
  const rows = await db
    .select({ date: sql<string>`DATE(${leads.createdAt})`, count: count() })
    .from(leads)
    .where(gte(leads.createdAt, period.sevenDaysAgo))
    .groupBy(sql`DATE(${leads.createdAt})`)
    .orderBy(sql`DATE(${leads.createdAt})`)
  return buildChart(period, Object.fromEntries(rows.map((row) => [row.date, row.count])))
}

async function loadLeads(period: Period) {
  const [metrics, recentLeads, leadsChart] = await Promise.all([
    loadLeadMetrics(period),
    db.query.leads.findMany({
      limit: 6,
      orderBy: (lead, { desc }) => [desc(lead.createdAt)],
      with: { assignedTo: { columns: { id: true, name: true } } },
    }),
    loadLeadsChart(period),
  ])
  return { ...metrics, recentLeads, leadsChart }
}

async function loadAgenda(period: Period) {
  const todayAppointments = await db.query.appointments.findMany({
    where: and(
      gte(appointments.startAt, period.todayStart),
      lte(appointments.startAt, period.todayEnd)
    ),
    orderBy: (appointment, { asc }) => [asc(appointment.startAt)],
    with: {
      patient: { columns: { id: true, name: true, phone: true } },
      lead: { columns: { id: true, name: true, phone: true } },
    },
  })
  return {
    todayAppointments,
    consultations: todayAppointments.filter(
      (row) => row.type === 'consultation' || row.type === 'return'
    ).length,
    occupancyRate: Math.min(Math.round((todayAppointments.length / 10) * 100), 100),
  }
}

function toCents(amount: string) {
  const [whole, fraction = ''] = amount.replace(/^-/, '').split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return amount.startsWith('-') ? -cents : cents
}

async function loadPaidTotal(period: Period, type: 'income' | 'expense') {
  const result = await db
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, type),
        eq(transactions.isPaid, true),
        gte(transactions.date, period.startOfMonth.toISOString().split('T')[0]),
        lte(transactions.date, period.endOfMonth.toISOString().split('T')[0])
      )
    )
  return toCents(result[0]?.total ?? '0')
}

async function loadRevenueChart(period: Period) {
  const rows = await db
    .select({ date: transactions.date, total: sum(transactions.amount) })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, 'income'),
        eq(transactions.isPaid, true),
        gte(transactions.date, period.sevenDaysAgo.toISOString().split('T')[0]),
        lte(transactions.date, period.now.toISOString().split('T')[0])
      )
    )
    .groupBy(transactions.date)
    .orderBy(transactions.date)
  const values = Object.fromEntries(rows.map((row) => [row.date, Number(row.total ?? '0')]))
  return buildChart(period, values, true)
}

async function loadFinancial(period: Period) {
  const [revenueCents, expenseCents, goals, revenueChart] = await Promise.all([
    loadPaidTotal(period, 'income'),
    loadPaidTotal(period, 'expense'),
    db.query.monthlyGoals.findFirst({
      where: and(
        eq(monthlyGoals.month, period.now.getMonth() + 1),
        eq(monthlyGoals.year, period.now.getFullYear())
      ),
    }),
    loadRevenueChart(period),
  ])
  return {
    revenueCents,
    revenue: revenueCents / 100,
    revenueGoal: Number(goals?.revenueGoal ?? '25000'),
    revenueGrowth: 0,
    financialSummary: {
      income: revenueCents / 100,
      expenses: expenseCents / 100,
      netResult: (revenueCents - expenseCents) / 100,
    },
    revenueChart,
  }
}

function buildKpis(
  leadData: Awaited<ReturnType<typeof loadLeads>> | null,
  agendaData: Awaited<ReturnType<typeof loadAgenda>> | null,
  financialData: Awaited<ReturnType<typeof loadFinancial>> | null
) {
  return {
    leadsThisMonth: leadData?.leadsThisMonth ?? null,
    leadsGrowth: leadData?.leadsGrowth ?? null,
    revenue: financialData?.revenue ?? null,
    revenueGoal: financialData?.revenueGoal ?? null,
    revenueGrowth: financialData?.revenueGrowth ?? null,
    consultations: agendaData?.consultations ?? null,
    occupancyRate: agendaData?.occupancyRate ?? null,
    avgCpl:
      leadData && financialData
        ? financialData.revenueCents > 0 && leadData.leadsThisMonth > 0
          ? Math.round(financialData.revenueCents / leadData.leadsThisMonth / 100)
          : 0
        : null,
  }
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { role, customPermissions } = session.user
  if (
    customPermissions?.length === 0 ||
    !hasPermission(role as UserRole, 'dashboard:view', customPermissions)
  ) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const period = getPeriod(new Date())
  const [leadData, agendaData, financialData, stockAlerts] = await Promise.all([
    hasPermission(role as UserRole, 'leads:view', customPermissions) ? loadLeads(period) : null,
    hasPermission(role as UserRole, 'agenda:view', customPermissions) ? loadAgenda(period) : null,
    hasPermission(role as UserRole, 'financial:view', customPermissions)
      ? loadFinancial(period)
      : null,
    hasPermission(role as UserRole, 'materials:view', customPermissions)
      ? db.query.materials.findMany({
          where: sql`${materials.status} IN ('critical', 'out_of_stock', 'low')`,
          limit: 5,
        })
      : [],
  ])
  return NextResponse.json({
    kpis: buildKpis(leadData, agendaData, financialData),
    recentLeads: leadData?.recentLeads ?? [],
    todayAppointments: agendaData?.todayAppointments ?? [],
    financialSummary: financialData?.financialSummary ?? null,
    stockAlerts,
    conversionFunnel: leadData?.conversionFunnel ?? null,
    revenueChart: financialData?.revenueChart ?? null,
    leadsChart: leadData?.leadsChart ?? null,
  })
}
