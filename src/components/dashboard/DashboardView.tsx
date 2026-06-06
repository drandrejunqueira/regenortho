'use client'

import { useState, useEffect } from 'react'
import { KpiCard } from './KpiCard'
import { FunnelChart } from './FunnelChart'
import { RecentLeads } from './RecentLeads'
import { AgendaHoje } from './AgendaHoje'
import { FinanceiroCard } from './FinanceiroCard'
import { EstoqueCard } from './EstoqueCard'
import { RevenueChart } from './RevenueChart'
import { LeadsBarChart } from './LeadsBarChart'
import { formatCurrency } from '@/lib/utils'

const MASK = '•••••'

interface DashboardViewProps {
  criticalCount: number
  income: number
  expenses: number
  netResult: number
  revenueGoal: number
  leadsNow: number
  todayApts: Parameters<typeof AgendaHoje>[0]['appointments']
  revenueChart: Array<{ date: string; label: string; value: number }>
  leadsChart: Array<{ date: string; label: string; value: number }>
  funnelData: { new: number; contacted: number; scheduled: number; attended: number; active: number }
  recentLeads: Parameters<typeof RecentLeads>[0]['leads']
  stockAlerts: Parameters<typeof EstoqueCard>[0]['materials']
  hasFinancialPermission: boolean
  hasMaterialsPermission: boolean
}

const CARD = 'bg-white rounded-xl border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)]'
const CARD_INNER = `${CARD} p-5`
const HEAD_ICON = 'material-symbols-outlined'

export function DashboardView({
  criticalCount,
  income,
  expenses,
  netResult,
  revenueGoal,
  leadsNow,
  todayApts,
  revenueChart,
  leadsChart,
  funnelData,
  recentLeads,
  stockAlerts,
  hasFinancialPermission,
  hasMaterialsPermission,
}: DashboardViewProps) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    setHidden(localStorage.getItem('dashboard_privacy') === 'on')
  }, [])

  function toggleHidden() {
    const next = !hidden
    setHidden(next)
    localStorage.setItem('dashboard_privacy', next ? 'on' : 'off')
  }

  const fmt = (v: number) => (hidden ? MASK : formatCurrency(v))

  return (
    <div className="space-y-6">
      {/* Stock alert banner */}
      {criticalCount > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderLeft: '4px solid #ef4444' }}
        >
          <span className={HEAD_ICON} style={{ fontSize: '18px' }}>warning</span>
          <span>
            {criticalCount} {criticalCount === 1 ? 'item crítico' : 'itens críticos'} no estoque —{' '}
            <a href="/materiais" className="underline underline-offset-2 hover:text-[#c0392b] transition-colors">
              ver materiais
            </a>
          </span>
        </div>
      )}

      {/* KPIs */}
      <div className="space-y-2">
        <div className="flex justify-end">
          <button
            onClick={toggleHidden}
            title={hidden ? 'Mostrar valores' : 'Ocultar valores'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#718096] hover:text-[#021541] hover:bg-[rgba(2,21,65,0.05)] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              {hidden ? 'visibility_off' : 'visibility'}
            </span>
            {hidden ? 'Mostrar valores' : 'Ocultar valores'}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Leads este mês" value={leadsNow} accent="cyan" icon="group_add" />
          <KpiCard title="Faturamento" value={fmt(income)} accent="gold" icon="payments" />
          <KpiCard title="Consultas hoje" value={todayApts.length} accent="cyan" icon="calendar_month" />
          <KpiCard
            title="Resultado líquido"
            value={fmt(netResult)}
            accent={netResult >= 0 ? 'cyan' : 'error'}
            icon="trending_up"
          />
        </div>
      </div>

      {/* Charts */}
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
          <FunnelChart data={funnelData} />
        </div>
        <div className={CARD_INNER}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-[#021541] uppercase tracking-wider">Agenda de Hoje</h2>
            <span className={`${HEAD_ICON} text-[#00BCD4]/40`} style={{ fontSize: '18px' }}>calendar_today</span>
          </div>
          <AgendaHoje appointments={todayApts} />
        </div>
      </div>

      {/* Leads recentes + Financeiro + Estoque */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`md:col-span-2 ${CARD_INNER}`}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-[#021541] uppercase tracking-wider">Leads Recentes</h2>
            <span className={`${HEAD_ICON} text-[#00BCD4]/40`} style={{ fontSize: '18px' }}>group</span>
          </div>
          <RecentLeads leads={recentLeads} />
        </div>

        <div className="space-y-4">
          {hasFinancialPermission && (
            <div className={CARD_INNER}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[#021541] uppercase tracking-wider">Financeiro do Mês</h2>
                <span className={`${HEAD_ICON} text-[#e6c364]/40`} style={{ fontSize: '18px' }}>payments</span>
              </div>
              <FinanceiroCard
                income={income}
                expenses={expenses}
                netResult={netResult}
                revenueGoal={revenueGoal}
                hidden={hidden}
              />
            </div>
          )}
          {hasMaterialsPermission && (
            <div className={CARD_INNER}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[#021541] uppercase tracking-wider">Alertas de Estoque</h2>
                <span className={`${HEAD_ICON} text-[#ffb4ab]/40`} style={{ fontSize: '18px' }}>inventory_2</span>
              </div>
              <EstoqueCard materials={stockAlerts} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
