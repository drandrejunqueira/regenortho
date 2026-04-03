'use client'

import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

const LEADS_MENSAL = [
  { mes: 'Nov', leads: 28 },
  { mes: 'Dez', leads: 32 },
  { mes: 'Jan', leads: 24 },
  { mes: 'Fev', leads: 35 },
  { mes: 'Mar', leads: 41 },
  { mes: 'Abr', leads: 38 },
]

const FATURAMENTO_MENSAL = [
  { mes: 'Nov', valor: 18500 },
  { mes: 'Dez', valor: 22000 },
  { mes: 'Jan', valor: 15800 },
  { mes: 'Fev', valor: 24500 },
  { mes: 'Mar', valor: 28000 },
  { mes: 'Abr', valor: 21500 },
]

const ORIGEM_LEADS = [
  { name: 'Google Ads', value: 38 },
  { name: 'Meta Ads', value: 28 },
  { name: 'Indicação', value: 18 },
  { name: 'Orgânico', value: 12 },
  { name: 'Outros', value: 4 },
]

const CHART_COLORS = ['#61d8dd', '#e6c364', '#d3bbff', '#4ade80', '#ffb4ab']

const tooltipStyle = {
  contentStyle: { background: '#31353c', border: 'none', borderRadius: '12px', color: '#dfe2eb', fontSize: '12px' },
  cursor: { fill: 'rgba(97,216,221,0.05)' },
}

const axisStyle = { tick: { fontSize: 11, fill: '#bec9c9' }, axisLine: false as const, tickLine: false as const }

export default function RelatoriosPage() {
  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Análise completa do desempenho da clínica"
        action={
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c2026] text-[#bec9c9] text-sm font-medium hover:text-[#dfe2eb] hover:bg-[#262a31] transition-colors border border-[#3e4949]/30"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>print</span>
            Exportar PDF
          </button>
        }
      />

      <Tabs defaultValue="geral">
        <TabsList className="bg-[#1c2026] rounded-xl p-1 mb-4">
          {['geral', 'leads', 'financeiro'].map((v) => (
            <TabsTrigger
              key={v}
              value={v}
              className="data-[state=active]:bg-[#31353c] data-[state=active]:text-[#dfe2eb] text-[#bec9c9] rounded-lg capitalize font-medium text-sm"
            >
              {v === 'geral' ? 'Geral' : v === 'leads' ? 'Leads' : 'Financeiro'}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="geral" className="mt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#1c2026] rounded-xl p-6">
              <h3 className="text-sm font-bold text-[#dfe2eb] mb-4">Leads por Mês (6 meses)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={LEADS_MENSAL}>
                  <XAxis dataKey="mes" {...axisStyle} />
                  <YAxis {...axisStyle} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="leads" name="Leads" fill="#61d8dd" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-[#1c2026] rounded-xl p-6">
              <h3 className="text-sm font-bold text-[#dfe2eb] mb-4">Faturamento Mensal (R$)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={FATURAMENTO_MENSAL}>
                  <XAxis dataKey="mes" {...axisStyle} />
                  <YAxis {...axisStyle} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip {...tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
                  <Line type="monotone" dataKey="valor" name="Faturamento" stroke="#61d8dd" strokeWidth={2.5} dot={{ r: 4, fill: '#61d8dd', strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-[#1c2026] rounded-xl p-6">
              <h3 className="text-sm font-bold text-[#dfe2eb] mb-4">Origem dos Leads</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={ORIGEM_LEADS}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {ORIGEM_LEADS.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-[#1c2026] rounded-xl p-6">
              <h3 className="text-sm font-bold text-[#dfe2eb] mb-4">Insights do Mês</h3>
              <ul className="space-y-3 text-sm">
                {[
                  { icon: 'trending_up', color: 'text-[#61d8dd]', text: 'Taxa de conversão de leads está em 18% — acima da média de 15%' },
                  { icon: 'warning', color: 'text-[#e6c364]', text: 'CPL do Google Ads subiu 12% este mês — revisar segmentação' },
                  { icon: 'trending_up', color: 'text-[#61d8dd]', text: 'Procedimentos PRP geraram 38% da receita total' },
                  { icon: 'info', color: 'text-[#d3bbff]', text: 'Indicações representam 18% dos leads — incentivar programa de indicação' },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={`material-symbols-outlined mt-0.5 shrink-0 ${item.color}`} style={{ fontSize: '16px' }}>{item.icon}</span>
                    <span className="text-[#bec9c9]">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leads" className="mt-0">
          <div className="bg-[#1c2026] rounded-xl p-6">
            <h3 className="text-sm font-bold text-[#dfe2eb] mb-4">Evolução de Leads</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={LEADS_MENSAL}>
                <XAxis dataKey="mes" {...axisStyle} />
                <YAxis {...axisStyle} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="leads" name="Leads" fill="#61d8dd" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="financeiro" className="mt-0">
          <div className="bg-[#1c2026] rounded-xl p-6">
            <h3 className="text-sm font-bold text-[#dfe2eb] mb-4">Evolução do Faturamento</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={FATURAMENTO_MENSAL}>
                <XAxis dataKey="mes" {...axisStyle} />
                <YAxis {...axisStyle} tickFormatter={(v) => `R$${v / 1000}k`} />
                <Tooltip {...tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
                <Line type="monotone" dataKey="valor" name="Faturamento" stroke="#61d8dd" strokeWidth={2.5} dot={{ r: 4, fill: '#61d8dd', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
