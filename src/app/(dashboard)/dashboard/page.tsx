import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/permissions'
import { DashboardView } from '@/components/dashboard/DashboardView'
import type { UserRole } from '@/types'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const role = session.user.role as UserRole
  if (!hasPermission(role, 'dashboard:view')) redirect('/login')

  const { db } = await import('@/lib/db')
  const { leads, appointments, transactions, materials, monthlyGoals } = await import('@/lib/db/schema')
  const { and, gte, lte, eq, count, sum, sql } = await import('drizzle-orm')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(now.getDate() - 6)

  const [
    leadsThisMonthRes,
    recentLeads,
    todayApts,
    incomeRes,
    expenseRes,
    stockAlertsRes,
    funnelRes,
    goalsRes,
    revenueByDay,
    leadsByDay,
  ] = await Promise.all([
    db.select({ count: count() }).from(leads)
      .where(and(gte(leads.createdAt, startOfMonth), lte(leads.createdAt, endOfMonth))),

    db.query.leads.findMany({
      limit: 6,
      orderBy: (l, { desc }) => [desc(l.createdAt)],
      with: { assignedTo: { columns: { id: true, name: true } } },
    }),

    db.query.appointments.findMany({
      where: and(gte(appointments.startAt, todayStart), lte(appointments.startAt, todayEnd)),
      orderBy: (a, { asc }) => [asc(a.startAt)],
      with: {
        patient: { columns: { id: true, name: true, phone: true } },
        lead: { columns: { id: true, name: true, phone: true } },
      },
    }),

    db.select({ total: sum(transactions.amount) }).from(transactions)
      .where(and(
        eq(transactions.type, 'income'),
        gte(transactions.date, startOfMonth.toISOString().split('T')[0]),
        lte(transactions.date, endOfMonth.toISOString().split('T')[0]),
      )),

    db.select({ total: sum(transactions.amount) }).from(transactions)
      .where(and(
        eq(transactions.type, 'expense'),
        gte(transactions.date, startOfMonth.toISOString().split('T')[0]),
        lte(transactions.date, endOfMonth.toISOString().split('T')[0]),
      )),

    db.query.materials.findMany({
      where: sql`${materials.status} IN ('critical', 'out_of_stock', 'low')`,
      limit: 5,
    }),

    db.select({ status: leads.status, count: count() }).from(leads).groupBy(leads.status),

    db.query.monthlyGoals.findFirst({
      where: and(
        eq(monthlyGoals.month, now.getMonth() + 1),
        eq(monthlyGoals.year, now.getFullYear()),
      ),
    }),

    db.select({
      date: transactions.date,
      total: sum(transactions.amount),
    }).from(transactions)
      .where(and(
        eq(transactions.type, 'income'),
        gte(transactions.date, sevenDaysAgo.toISOString().split('T')[0]),
        lte(transactions.date, now.toISOString().split('T')[0]),
      ))
      .groupBy(transactions.date)
      .orderBy(transactions.date),

    db.select({
      date: sql<string>`DATE(${leads.createdAt})`,
      cnt: count(),
    }).from(leads)
      .where(gte(leads.createdAt, sevenDaysAgo))
      .groupBy(sql`DATE(${leads.createdAt})`)
      .orderBy(sql`DATE(${leads.createdAt})`),
  ])

  const chartDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sevenDaysAgo)
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })
  const revenueMap = Object.fromEntries(revenueByDay.map((r) => [r.date, parseFloat(r.total ?? '0')]))
  const leadsMap = Object.fromEntries(leadsByDay.map((r) => [r.date, r.cnt]))

  const revenueChart = chartDays.map((date) => ({
    date,
    label: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }),
    value: revenueMap[date] ?? 0,
  }))
  const leadsChart = chartDays.map((date) => ({
    date,
    label: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }),
    value: leadsMap[date] ?? 0,
  }))

  const income = parseFloat(incomeRes[0]?.total ?? '0')
  const expenses = parseFloat(expenseRes[0]?.total ?? '0')
  const revenueGoal = parseFloat(goalsRes?.revenueGoal ?? '25000')
  const leadsNow = leadsThisMonthRes[0]?.count ?? 0
  const funnelMap = Object.fromEntries(funnelRes.map((r) => [r.status, r.count]))
  const criticalCount = stockAlertsRes.filter((m) => m.status === 'critical' || m.status === 'out_of_stock').length
  const netResult = income - expenses

  return (
    <DashboardView
      criticalCount={criticalCount}
      income={income}
      expenses={expenses}
      netResult={netResult}
      revenueGoal={revenueGoal}
      leadsNow={leadsNow}
      todayApts={todayApts as never}
      revenueChart={revenueChart}
      leadsChart={leadsChart}
      funnelData={{
        new: funnelMap['new'] ?? 0,
        contacted: funnelMap['contacted'] ?? 0,
        scheduled: funnelMap['scheduled'] ?? 0,
        attended: funnelMap['attended'] ?? 0,
        active: funnelMap['active_patient'] ?? 0,
      }}
      recentLeads={recentLeads as never}
      stockAlerts={stockAlertsRes as never}
      hasFinancialPermission={hasPermission(role, 'financial:view')}
      hasMaterialsPermission={hasPermission(role, 'materials:view')}
    />
  )
}
