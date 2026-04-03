import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/permissions'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { FunnelChart } from '@/components/dashboard/FunnelChart'
import { RecentLeads } from '@/components/dashboard/RecentLeads'
import { AgendaHoje } from '@/components/dashboard/AgendaHoje'
import { FinanceiroCard } from '@/components/dashboard/FinanceiroCard'
import { EstoqueCard } from '@/components/dashboard/EstoqueCard'
import { formatCurrency } from '@/lib/utils'
import type { UserRole } from '@/types'

async function getDashboardData() {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const session = await auth()
    if (!session) return null

    const res = await fetch(`${baseUrl}/api/dashboard`, {
      cache: 'no-store',
      headers: { Cookie: `next-auth.session-token=${session}` },
    })

    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const role = session.user.role as UserRole
  if (!hasPermission(role, 'dashboard:view')) redirect('/login')

  // Busca dados diretamente via DB para Server Component
  const { db } = await import('@/lib/db')
  const { leads, appointments, transactions, materials, monthlyGoals } = await import('@/lib/db/schema')
  const { and, gte, lte, eq, count, sum, sql } = await import('drizzle-orm')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  const [
    leadsThisMonthRes,
    recentLeads,
    todayApts,
    incomeRes,
    expenseRes,
    stockAlertsRes,
    funnelRes,
    goalsRes,
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
  ])

  const income = parseFloat(incomeRes[0]?.total ?? '0')
  const expenses = parseFloat(expenseRes[0]?.total ?? '0')
  const revenueGoal = parseFloat(goalsRes?.revenueGoal ?? '25000')
  const leadsNow = leadsThisMonthRes[0]?.count ?? 0
  const funnelMap = Object.fromEntries(funnelRes.map((r) => [r.status, r.count]))
  const criticalCount = stockAlertsRes.filter((m) => m.status === 'critical' || m.status === 'out_of_stock').length
  const netResult = income - expenses

  return (
    <div className="space-y-6">
      {/* Alerta de estoque crítico */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#93000a]/20 border-l-4 border-[#ffb4ab] rounded-r-xl text-sm font-medium text-[#ffb4ab]">
          <span className="material-symbols-outlined shrink-0" style={{ fontSize: '18px' }}>warning</span>
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
        <KpiCard
          title="Leads este mês"
          value={leadsNow}
          delta={0}
          accent="teal"
          icon="group_add"
        />
        <KpiCard
          title="Faturamento"
          value={formatCurrency(income)}
          accent="gold"
          icon="payments"
        />
        <KpiCard
          title="Consultas hoje"
          value={todayApts.length}
          accent="teal"
          icon="calendar_month"
        />
        <KpiCard
          title="Resultado líquido"
          value={formatCurrency(netResult)}
          accent={netResult >= 0 ? 'teal' : 'error'}
          icon="trending_up"
        />
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Funil de conversão */}
        <div className="md:col-span-2 bg-[#1c2026] rounded-xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-[#dfe2eb] uppercase tracking-wider">
              Funil de Conversão de Leads
            </h2>
            <span className="material-symbols-outlined text-[#61d8dd]/40" style={{ fontSize: '18px' }}>leaderboard</span>
          </div>
          <FunnelChart data={{
            new: funnelMap['new'] ?? 0,
            contacted: funnelMap['contacted'] ?? 0,
            scheduled: funnelMap['scheduled'] ?? 0,
            attended: funnelMap['attended'] ?? 0,
            active: funnelMap['active_patient'] ?? 0,
          }} />
        </div>

        {/* Agenda hoje */}
        <div className="bg-[#1c2026] rounded-xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-[#dfe2eb] uppercase tracking-wider">Agenda de Hoje</h2>
            <span className="material-symbols-outlined text-[#61d8dd]/40" style={{ fontSize: '18px' }}>calendar_today</span>
          </div>
          <AgendaHoje appointments={todayApts as unknown as Parameters<typeof AgendaHoje>[0]['appointments']} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Leads recentes */}
        <div className="md:col-span-2 bg-[#1c2026] rounded-xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-[#dfe2eb] uppercase tracking-wider">Leads Recentes</h2>
            <span className="material-symbols-outlined text-[#61d8dd]/40" style={{ fontSize: '18px' }}>group</span>
          </div>
          <RecentLeads leads={recentLeads as unknown as Parameters<typeof RecentLeads>[0]['leads']} />
        </div>

        {/* Financeiro + Estoque */}
        <div className="space-y-4">
          {hasPermission(role, 'financial:view') && (
            <div className="bg-[#1c2026] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[#dfe2eb] uppercase tracking-wider">Financeiro do Mês</h2>
                <span className="material-symbols-outlined text-[#e6c364]/40" style={{ fontSize: '18px' }}>payments</span>
              </div>
              <FinanceiroCard
                income={income}
                expenses={expenses}
                netResult={netResult}
                revenueGoal={revenueGoal}
              />
            </div>
          )}

          {hasPermission(role, 'materials:view') && (
            <div className="bg-[#1c2026] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[#dfe2eb] uppercase tracking-wider">Alertas de Estoque</h2>
                <span className="material-symbols-outlined text-[#ffb4ab]/40" style={{ fontSize: '18px' }}>inventory_2</span>
              </div>
              <EstoqueCard materials={stockAlertsRes as unknown as Parameters<typeof EstoqueCard>[0]['materials']} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
