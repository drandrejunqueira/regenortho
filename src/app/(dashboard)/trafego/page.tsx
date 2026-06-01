'use client'

import { PageHeader } from '@/components/shared/PageHeader'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatCurrency } from '@/lib/utils'

const MOCK_GOOGLE = {
  status: 'Ativo',
  budget: 2000,
  spent: 1250,
  campaigns: [
    { name: 'PRP Joelho SJC', status: 'Ativo', budget: 800, spent: 510, clicks: 142, leads: 18, cpl: 28.3 },
    { name: 'Coluna Lombar', status: 'Ativo', budget: 700, spent: 430, clicks: 98, leads: 12, cpl: 35.8 },
    { name: 'BMAC Ortopedia', status: 'Pausado', budget: 500, spent: 310, clicks: 76, leads: 8, cpl: 38.8 },
  ],
}

const MOCK_META = {
  status: 'Ativo',
  budget: 1500,
  spent: 980,
  campaigns: [
    { name: 'Leads - Ortopedia SP', status: 'Ativo', budget: 800, spent: 540, clicks: 320, leads: 22, cpl: 24.5 },
    { name: 'Remarketing Pacientes', status: 'Ativo', budget: 400, spent: 280, clicks: 180, leads: 9, cpl: 31.1 },
    { name: 'Story - PRP', status: 'Ativo', budget: 300, spent: 160, clicks: 95, leads: 5, cpl: 32.0 },
  ],
}

const CHART_DATA = [
  { semana: 'S1', google: 12, meta: 15, organico: 4 },
  { semana: 'S2', google: 18, meta: 22, organico: 6 },
  { semana: 'S3', google: 14, meta: 18, organico: 5 },
  { semana: 'S4', google: 20, meta: 19, organico: 7 },
]

export default function TrafegoPage() {
  const totalLeads = MOCK_GOOGLE.campaigns.reduce((s, c) => s + c.leads, 0) + MOCK_META.campaigns.reduce((s, c) => s + c.leads, 0)
  const totalSpent = MOCK_GOOGLE.spent + MOCK_META.spent
  const avgCpl = totalLeads > 0 ? totalSpent / totalLeads : 0

  return (
    <div>
      <PageHeader
        title="Tráfego Pago"
        description="Monitoramento de campanhas Google Ads e Meta Ads"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total de leads" value={totalLeads} accent="teal" icon="group_add" />
        <KpiCard title="Investimento total" value={formatCurrency(totalSpent)} accent="gold" icon="payments" />
        <KpiCard title="CPL médio" value={formatCurrency(avgCpl)} accent="teal" icon="ads_click" />
        <KpiCard title="Budget total" value={formatCurrency(MOCK_GOOGLE.budget + MOCK_META.budget)} accent="tertiary" icon="account_balance_wallet" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <AdPlatformCard title="Google Ads" platform={MOCK_GOOGLE} icon="search" />
        <AdPlatformCard title="Meta Ads" platform={MOCK_META} icon="camera_alt" />
      </div>

      <div className="bg-white rounded-xl border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] p-5">
        <h3 className="text-sm font-bold text-[#021541] mb-4">Leads por Canal — Últimas 4 Semanas</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={CHART_DATA}>
            <XAxis dataKey="semana" tick={{ fontSize: 11, fill: '#718096' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#718096' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#ffffff', border: '1px solid rgba(2,21,65,0.08)', borderRadius: '12px', color: '#021541', fontSize: '12px', boxShadow: '0 4px 20px rgba(2,21,65,0.1)' }}
              cursor={{ fill: 'rgba(2,21,65,0.03)' }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#718096' }} />
            <Bar dataKey="google" name="Google Ads" fill="#00BCE4" radius={[4, 4, 0, 0]} />
            <Bar dataKey="meta" name="Meta Ads" fill="#021541" radius={[4, 4, 0, 0]} />
            <Bar dataKey="organico" name="Orgânico" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function AdPlatformCard({ title, platform, icon }: { title: string; platform: typeof MOCK_GOOGLE; icon: string }) {
  const pct = Math.min(Math.round((platform.spent / platform.budget) * 100), 100)
  return (
    <div className="bg-white rounded-xl border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[rgba(0,188,228,0.08)] flex items-center justify-center">
            <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '18px' }}>{icon}</span>
          </div>
          <h3 className="text-sm font-bold text-[#021541]">{title}</h3>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          platform.status === 'Ativo'
            ? 'bg-[rgba(0,188,228,0.1)] text-[#00BCE4]'
            : 'bg-[rgba(2,21,65,0.06)] text-[#718096]'
        }`}>
          {platform.status}
        </span>
      </div>
      <div className="flex justify-between items-end mb-2">
        <span className="text-xs text-[#718096]">Budget: <span className="font-bold text-[#021541]">{formatCurrency(platform.budget)}</span></span>
        <span className="text-xs text-[#00BCE4] font-bold">{formatCurrency(platform.spent)} ({pct}%)</span>
      </div>
      <div className="h-1.5 bg-[rgba(2,21,65,0.06)] rounded-full overflow-hidden mb-5">
        <div className="h-full bg-gradient-to-r from-[#0097a7] to-[#00BCE4] rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[rgba(2,21,65,0.06)]">
            <th className="text-left pb-2 text-[10px] font-bold text-[#718096] uppercase tracking-wider">Campanha</th>
            <th className="text-right pb-2 text-[10px] font-bold text-[#718096] uppercase tracking-wider">Leads</th>
            <th className="text-right pb-2 text-[10px] font-bold text-[#718096] uppercase tracking-wider">CPL</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgba(2,21,65,0.05)]">
          {platform.campaigns.map((c) => (
            <tr key={c.name} className="hover:bg-[rgba(2,21,65,0.015)] transition-colors">
              <td className="py-2.5">
                <p className="font-semibold text-[#021541]">{c.name}</p>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${c.status === 'Ativo' ? 'text-[#00BCE4]' : 'text-[#718096]'}`}>
                  {c.status}
                </span>
              </td>
              <td className="text-right py-2.5 font-bold text-[#021541]">{c.leads}</td>
              <td className="text-right py-2.5 font-semibold text-[#D97706]">{formatCurrency(c.cpl)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
