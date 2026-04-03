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

      <div className="bg-[#1c2026] rounded-xl p-6">
        <h3 className="text-sm font-bold text-[#dfe2eb] mb-4">Leads por Canal — Últimas 4 Semanas</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={CHART_DATA}>
            <XAxis dataKey="semana" tick={{ fontSize: 11, fill: '#bec9c9' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#bec9c9' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#31353c', border: 'none', borderRadius: '12px', color: '#dfe2eb', fontSize: '12px' }}
              cursor={{ fill: 'rgba(97,216,221,0.05)' }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#bec9c9' }} />
            <Bar dataKey="google" name="Google Ads" fill="#61d8dd" radius={[4, 4, 0, 0]} />
            <Bar dataKey="meta" name="Meta Ads" fill="#e6c364" radius={[4, 4, 0, 0]} />
            <Bar dataKey="organico" name="Orgânico" fill="#d3bbff" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function AdPlatformCard({ title, platform, icon }: { title: string; platform: typeof MOCK_GOOGLE; icon: string }) {
  const pct = Math.min(Math.round((platform.spent / platform.budget) * 100), 100)
  return (
    <div className="bg-[#1c2026] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#61d8dd]/60" style={{ fontSize: '20px' }}>{icon}</span>
          <h3 className="text-sm font-bold text-[#dfe2eb]">{title}</h3>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          platform.status === 'Ativo' ? 'bg-[#61d8dd]/10 text-[#61d8dd]' : 'bg-[#31353c] text-[#bec9c9]'
        }`}>
          {platform.status}
        </span>
      </div>
      <div className="flex justify-between items-end mb-2">
        <span className="text-xs text-[#bec9c9]">Budget: <span className="font-technical font-bold text-[#dfe2eb]">{formatCurrency(platform.budget)}</span></span>
        <span className="font-technical text-xs text-[#61d8dd] font-bold">{formatCurrency(platform.spent)} ({pct}%)</span>
      </div>
      <div className="h-1.5 bg-[#31353c] rounded-full overflow-hidden mb-5">
        <div className="h-full bg-gradient-to-r from-[#006e72] to-[#61d8dd] rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left pb-2 text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider">Campanha</th>
            <th className="text-right pb-2 text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider">Leads</th>
            <th className="text-right pb-2 text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider">CPL</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#3e4949]/20">
          {platform.campaigns.map((c) => (
            <tr key={c.name}>
              <td className="py-2">
                <p className="font-medium text-[#dfe2eb]">{c.name}</p>
                <span className={`text-[9px] font-bold uppercase ${c.status === 'Ativo' ? 'text-[#61d8dd]' : 'text-[#bec9c9]'}`}>
                  {c.status}
                </span>
              </td>
              <td className="text-right py-2 font-technical font-bold text-[#dfe2eb]">{c.leads}</td>
              <td className="text-right py-2 font-technical text-[#e6c364]">{formatCurrency(c.cpl)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
