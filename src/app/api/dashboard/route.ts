import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { leads, appointments, transactions, materials, monthlyGoals } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextResponse } from 'next/server'
import { and, gte, lte, eq, count, sum, sql } from 'drizzle-orm'
import type { UserRole } from '@/types'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'dashboard:view', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  // KPIs paralelos
  const [
    leadsThisMonth,
    leadsLastMonth,
    recentLeads,
    todayAppointments,
    incomeResult,
    expenseResult,
    stockAlerts,
    conversionData,
    goals,
  ] = await Promise.all([
    // Leads este mês
    db.select({ count: count() }).from(leads)
      .where(and(gte(leads.createdAt, startOfMonth), lte(leads.createdAt, endOfMonth))),

    // Leads mês anterior
    db.select({ count: count() }).from(leads)
      .where(and(gte(leads.createdAt, startOfLastMonth), lte(leads.createdAt, endOfLastMonth))),

    // Leads recentes
    db.query.leads.findMany({
      limit: 6,
      orderBy: (l, { desc }) => [desc(l.createdAt)],
      with: { assignedTo: { columns: { id: true, name: true } } },
    }),

    // Agendamentos de hoje
    db.query.appointments.findMany({
      where: and(gte(appointments.startAt, todayStart), lte(appointments.startAt, todayEnd)),
      orderBy: (a, { asc }) => [asc(a.startAt)],
      with: {
        patient: { columns: { id: true, name: true, phone: true } },
        lead: { columns: { id: true, name: true, phone: true } },
      },
    }),

    // Receita do mês
    db.select({ total: sum(transactions.amount) }).from(transactions)
      .where(and(
        eq(transactions.type, 'income'),
        gte(transactions.date, startOfMonth.toISOString().split('T')[0]),
        lte(transactions.date, endOfMonth.toISOString().split('T')[0]),
      )),

    // Despesas do mês
    db.select({ total: sum(transactions.amount) }).from(transactions)
      .where(and(
        eq(transactions.type, 'expense'),
        gte(transactions.date, startOfMonth.toISOString().split('T')[0]),
        lte(transactions.date, endOfMonth.toISOString().split('T')[0]),
      )),

    // Alertas de estoque
    db.query.materials.findMany({
      where: sql`${materials.status} IN ('critical', 'out_of_stock', 'low')`,
      limit: 5,
    }),

    // Funil de conversão
    db.select({
      status: leads.status,
      count: count(),
    }).from(leads).groupBy(leads.status),

    // Metas do mês
    db.query.monthlyGoals.findFirst({
      where: and(
        eq(monthlyGoals.month, now.getMonth() + 1),
        eq(monthlyGoals.year, now.getFullYear()),
      ),
    }),
  ])

  // 7-day revenue chart
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(now.getDate() - 6)

  const revenueByDay = await db.select({
    date: transactions.date,
    total: sum(transactions.amount),
  }).from(transactions)
  .where(and(
    eq(transactions.type, 'income'),
    gte(transactions.date, sevenDaysAgo.toISOString().split('T')[0]),
    lte(transactions.date, now.toISOString().split('T')[0]),
  ))
  .groupBy(transactions.date)
  .orderBy(transactions.date)

  const leadsByDay = await db.select({
    date: sql<string>`DATE(${leads.createdAt})`,
    count: count(),
  }).from(leads)
  .where(gte(leads.createdAt, sevenDaysAgo))
  .groupBy(sql`DATE(${leads.createdAt})`)
  .orderBy(sql`DATE(${leads.createdAt})`)

  // Build 7-day chart arrays
  const chartDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sevenDaysAgo)
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  const revenueMap = Object.fromEntries(revenueByDay.map(r => [r.date, parseFloat(r.total ?? '0')]))
  const leadsMap = Object.fromEntries(leadsByDay.map(r => [r.date, r.count]))

  const revenueChart = chartDays.map(date => ({
    date,
    label: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }),
    value: revenueMap[date] ?? 0,
  }))

  const leadsChart = chartDays.map(date => ({
    date,
    label: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }),
    value: leadsMap[date] ?? 0,
  }))

  const leadsNow = leadsThisMonth[0]?.count ?? 0
  const leadsPrev = leadsLastMonth[0]?.count ?? 0
  const leadsGrowth = leadsPrev > 0 ? Math.round(((leadsNow - leadsPrev) / leadsPrev) * 100) : 0

  const revenue = parseFloat(incomeResult[0]?.total ?? '0')
  const expenses = parseFloat(expenseResult[0]?.total ?? '0')
  const revenueGoal = parseFloat(goals?.revenueGoal ?? '25000')
  const revenueGrowth = 0 // simplified

  const funnelMap = Object.fromEntries(conversionData.map((r) => [r.status, r.count]))

  const consultations = todayAppointments.filter((a) =>
    a.type === 'consultation' || a.type === 'return'
  ).length

  return NextResponse.json({
    kpis: {
      leadsThisMonth: leadsNow,
      leadsGrowth,
      revenue,
      revenueGoal,
      revenueGrowth,
      consultations,
      occupancyRate: Math.min(Math.round((todayAppointments.length / 10) * 100), 100),
      avgCpl: revenue > 0 && leadsNow > 0 ? Math.round(revenue / leadsNow) : 0,
    },
    recentLeads,
    todayAppointments,
    financialSummary: {
      income: revenue,
      expenses,
      netResult: revenue - expenses,
    },
    stockAlerts,
    conversionFunnel: {
      new: funnelMap['new'] ?? 0,
      contacted: funnelMap['contacted'] ?? 0,
      scheduled: funnelMap['scheduled'] ?? 0,
      attended: funnelMap['attended'] ?? 0,
      active: funnelMap['active_patient'] ?? 0,
    },
    revenueChart,
    leadsChart,
  })
}
