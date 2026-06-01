import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/permissions'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { FunnelChart } from '@/components/dashboard/FunnelChart'
import { RecentLeads } from '@/components/dashboard/RecentLeads'
import { AgendaHoje } from '@/components/dashboard/AgendaHoje'
import { FinanceiroCard } from '@/components/dashboard/FinanceiroCard'
import { EstoqueCard } from '@/components/dashboard/EstoqueCard'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { LeadsBarChart } from '@/components/dashboard/LeadsBarChart'
import { formatCurrency } from '@/lib/utils'
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

    // 7-day revenue
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

    // 7-day leads
    db.select({
      date: sql<string>`DATE(${leads.createdAt})`,
      cnt: count(),
    }).from(leads)
      .where(gte(leads.createdAt, sevenDaysAgo))
      .groupBy(sql`DATE(${leads.createdAt})`)
      .orderBy(sql`DATE(${leads.createdAt})`),
  ])

  // Build chart data
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

  const CARD = 'bg-white rounded-xl border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)]'
  const CARD_INNER = `${CARD} p-5`
  const HEAD_ICON = 'material-symbols-outlined'

  return (
    <div className="space-y-6">
      {/* Stock alert banner */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderLeft: '4px solid #ef4444' }}>
          <span className={HEAD_ICON} style={{ fontSize: '18px' }}>warning</span>
          <span>
            {criticalCount} {criticalCount === 1 ? 'item crítico' : 'itens críticos'} no estoque —{' '}
            <a href="/materiais" className="underline underline-offset-2 hover:text-[#ffdad6] transition-colors">
              ver materiais
            </a>
          </span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Leads este mês" value={leadsNow} accent="cyan" icon="group_add" />
        <KpiCard title="Faturamento" value={formatCurrency(income)} accent="gold" icon="payments" />
        <KpiCard title="Consultas hoje" value={todayApts.length} accent="cyan" icon="calendar_month" />
        <KpiCard
          title="Resultado líquido"
          value={formatCurrency(netResult)}
          accent={netResult >= 0 ? 'cyan' : 'error'}
          icon="trending_up"
        />
      </div>

      {/* Animated charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={CARD_INNER}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-[#021541]">Receita — 7 dias</h2>
              <p className="text-[11px] text-[#718096] mt-0.5">Faturamento diário</p>
            </div>
            <span className={`${HEAD_ICON} text-[#00BCD4]/40`} style={{ fontSize: '20px' }}>show_chart</span>
          </div>
          <RevenueChart data={revenueChart} />
        </div>

        <div className={CARD_INNER}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-[#021541]">Leads — 7 dias</h2>
              <p className="text-[11px] text-[#718096] mt-0.5">Novos leads por dia</p>
            </div>
            <span className={`${HEAD_ICON} text-[#e6c364]/40`} style={{ fontSize: '20px' }}>bar_chart</span>
          </div>
          <LeadsBarChart data={leadsChart} />
        </div>
      </div>

      {/* Funnel + Agenda */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`md:col-span-2 ${CARD_INNER}`}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-[#021541] uppercase tracking-wider">
              Funil de Conversão de Leads
            </h2>
            <span className={`${HEAD_ICON} text-[#00BCD4]/40`} style={{ fontSize: '18px' }}>leaderboard</span>
          </div>
          <FunnelChart data={{
            new: funnelMap['new'] ?? 0,
            contacted: funnelMap['contacted'] ?? 0,
            scheduled: funnelMap['scheduled'] ?? 0,
            attended: funnelMap['attended'] ?? 0,
            active: funnelMap['active_patient'] ?? 0,
          }} />
        </div>

        <div className={CARD_INNER}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-[#021541] uppercase tracking-wider">Agenda de Hoje</h2>
            <span className={`${HEAD_ICON} text-[#00BCD4]/40`} style={{ fontSize: '18px' }}>calendar_today</span>
          </div>
          <AgendaHoje appointments={todayApts as unknown as Parameters<typeof AgendaHoje>[0]['appointments']} />
        </div>
      </div>

      {/* Leads recentes + Financeiro + Estoque */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`md:col-span-2 ${CARD_INNER}`}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-[#021541] uppercase tracking-wider">Leads Recentes</h2>
            <span className={`${HEAD_ICON} text-[#00BCD4]/40`} style={{ fontSize: '18px' }}>group</span>
          </div>
          <RecentLeads leads={recentLeads as unknown as Parameters<typeof RecentLeads>[0]['leads']} />
        </div>

        <div className="space-y-4">
          {hasPermission(role, 'financial:view') && (
            <div className={CARD_INNER}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[#021541] uppercase tracking-wider">Financeiro do Mês</h2>
                <span className={`${HEAD_ICON} text-[#e6c364]/40`} style={{ fontSize: '18px' }}>payments</span>
              </div>
              <FinanceiroCard income={income} expenses={expenses} netResult={netResult} revenueGoal={revenueGoal} />
            </div>
          )}

          {hasPermission(role, 'materials:view') && (
            <div className={CARD_INNER}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[#021541] uppercase tracking-wider">Alertas de Estoque</h2>
                <span className={`${HEAD_ICON} text-[#ffb4ab]/40`} style={{ fontSize: '18px' }}>inventory_2</span>
              </div>
              <EstoqueCard materials={stockAlertsRes as unknown as Parameters<typeof EstoqueCard>[0]['materials']} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
