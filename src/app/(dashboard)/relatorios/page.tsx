'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
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

const CHART_COLORS = ['#00BCE4', '#F59E0B', '#8B5CF6', '#10B981', '#EF4444']

// ── DRE types ─────────────────────────────────────────
interface DREData {
  receitaTratamentos: number
  receitaOutras: number
  receitaBruta: number
  custoMateriais: number
  margemBruta: number
  margemPercent: number
  despesas: Array<{ category: string; total: number }>
  despesasTotal: number
  resultadoOperacional: number
  resultadoPercent: number
}
interface DREResponse {
  dre: DREData
  procedures: Array<{ name: string; count: number; revenue: number; cost: number }>
  monthly: Array<{ month: string; revenue: number; cost: number; expenses: number; result: number }>
  treatmentCount: number
  period: { year: number; month: number | null }
}

const BRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

const EXPENSE_LABELS: Record<string, string> = {
  rent: 'Aluguel', staff: 'Pessoal', marketing: 'Marketing', materials: 'Materiais',
  equipment: 'Equipamentos', utilities: 'Utilitários', insurance: 'Seguros',
  accounting: 'Contabilidade', other_expense: 'Outros',
}

// ── DRE Tab ────────────────────────────────────────────
function DRETab() {
  const [data, setData] = useState<DREResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState<string>('')

  useEffect(() => {
    setLoading(true)
    const qs = month ? `year=${year}&month=${month}` : `year=${year}`
    fetch(`/api/relatorios/dre?${qs}`)
      .then(r => r.json())
      .then(({ data: d }) => { if (d) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [year, month])

  if (loading) return <p className="text-center py-10 text-sm text-[#718096]">Carregando DRE...</p>
  if (!data) return <p className="text-center py-10 text-sm text-[#DC2626]">Erro ao carregar</p>

  const dre = data.dre

  const dreRows = [
    { label: 'Receita de Tratamentos',  value: dre.receitaTratamentos,   indent: 1, positive: true },
    { label: 'Outras Receitas',         value: dre.receitaOutras,         indent: 1, positive: true },
    { label: '(=) Receita Bruta',       value: dre.receitaBruta,          indent: 0, bold: true, accent: 'cyan' },
    { label: '(-) Custo de Materiais',  value: -dre.custoMateriais,       indent: 1, positive: false },
    { label: '(=) Margem Bruta',        value: dre.margemBruta,           indent: 0, bold: true, accent: dre.margemBruta >= 0 ? 'green' : 'red', pct: dre.margemPercent },
    ...dre.despesas.map(d => ({ label: `(-) ${EXPENSE_LABELS[d.category] ?? d.category}`, value: -d.total, indent: 1, positive: false })),
    { label: '(-) Total Despesas',      value: -dre.despesasTotal,        indent: 0, bold: true, positive: false },
    { label: '(=) Resultado Operacional', value: dre.resultadoOperacional, indent: 0, bold: true, accent: dre.resultadoOperacional >= 0 ? 'green' : 'red', pct: dre.resultadoPercent, big: true },
  ]

  function valueColor(row: typeof dreRows[number]): string {
    if ('accent' in row && row.accent) {
      if (row.accent === 'cyan') return 'text-[#00BCE4]'
      if (row.accent === 'green') return 'text-[#059669]'
      if (row.accent === 'red') return 'text-[#DC2626]'
    }
    if ('positive' in row) return row.positive ? 'text-[#059669]' : 'text-[#DC2626]'
    return 'text-[#021541]'
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2 text-sm text-[#021541] focus:outline-none"
        >
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2 text-sm text-[#021541] focus:outline-none"
        >
          <option value="">Ano completo</option>
          {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m, i) => (
            <option key={i+1} value={String(i+1)}>{m}</option>
          ))}
        </select>
        <span className="text-xs text-[#718096] self-center ml-1">{data.treatmentCount} tratamentos concluídos</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* DRE Table */}
        <div className="bg-white rounded-xl border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[rgba(2,21,65,0.06)]">
            <p className="text-sm font-semibold text-[#021541]">Demonstrativo de Resultado (DRE)</p>
          </div>
          <div className="divide-y divide-[rgba(2,21,65,0.05)]">
            {dreRows.map((row, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-5 py-2.5 ${row.big ? 'bg-[rgba(2,21,65,0.02)]' : ''}`}
                style={{ paddingLeft: `${((row.indent ?? 0) * 12) + 20}px` }}
              >
                <p className={`text-sm ${row.bold ? 'font-bold text-[#021541]' : 'text-[#718096]'}`}>{row.label}</p>
                <div className="text-right">
                  <p className={`text-sm ${row.bold ? 'font-bold' : 'font-medium'} ${valueColor(row)}`}>{BRL(row.value)}</p>
                  {'pct' in row && row.pct !== undefined && (
                    <p className={`text-[10px] ${valueColor(row)}`}>{pct(row.pct)} da receita</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Procedures breakdown */}
        <div className="bg-white rounded-xl border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[rgba(2,21,65,0.06)]">
            <p className="text-sm font-semibold text-[#021541]">Receita por Procedimento</p>
          </div>
          {data.procedures.length === 0 ? (
            <p className="text-sm text-[#718096] text-center py-8">Sem dados no período</p>
          ) : (
            <div className="divide-y divide-[rgba(2,21,65,0.05)]">
              {data.procedures.map((p, i) => {
                const margin = p.revenue - p.cost
                const marginPct = p.revenue > 0 ? (margin / p.revenue) * 100 : 0
                return (
                  <div key={i} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-[#021541] font-medium">{p.name}</p>
                      <p className="text-sm font-bold text-[#00BCE4]">{BRL(p.revenue)}</p>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-[#718096]">
                      <span>{p.count}x realizado(s)</span>
                      <span>custo: {BRL(p.cost)}</span>
                      <span className={marginPct >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}>margem: {marginPct.toFixed(0)}%</span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 bg-[rgba(2,21,65,0.06)] rounded-full overflow-hidden">
                      <div className="h-full bg-[#00BCE4] rounded-full" style={{ width: `${Math.min(100, (p.revenue / data.dre.receitaBruta) * 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Monthly chart */}
      {data.monthly.length > 0 && (
        <div className="bg-white rounded-xl border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] p-5">
          <p className="text-sm font-semibold text-[#021541] mb-4">Receita vs Custo Mensal</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.monthly}>
              <CartesianGrid stroke="rgba(2,21,65,0.08)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#718096' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#718096' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid rgba(2,21,65,0.1)', borderRadius: '12px', color: '#021541', fontSize: '12px' }} formatter={(v) => BRL(Number(v))} />
              <Bar dataKey="revenue" name="Receita" fill="#00BCE4" radius={[4,4,0,0]} />
              <Bar dataKey="cost" name="Custo" fill="#EF4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

const tooltipStyle = {
  contentStyle: { background: '#fff', border: '1px solid rgba(2,21,65,0.1)', borderRadius: '12px', color: '#021541', fontSize: '12px' },
  cursor: { fill: 'rgba(2,21,65,0.03)' },
}

const axisStyle = { tick: { fontSize: 11, fill: '#718096' }, axisLine: false as const, tickLine: false as const }

export default function RelatoriosPage() {
  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Análise completa do desempenho da clínica"
        action={
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[#021541] text-sm font-medium border border-[rgba(2,21,65,0.2)] hover:bg-[rgba(2,21,65,0.04)] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>print</span>
            Exportar PDF
          </button>
        }
      />

      <Tabs defaultValue="geral">
        <TabsList className="bg-white border border-[rgba(2,21,65,0.06)] rounded-full p-1 mb-4 flex gap-1 w-fit">
          {[
            { v: 'geral', label: 'Geral' },
            { v: 'leads', label: 'Leads' },
            { v: 'financeiro', label: 'Financeiro' },
            { v: 'dre', label: 'DRE / Balancete' },
          ].map(({ v, label }) => (
            <TabsTrigger
              key={v}
              value={v}
              className="data-[state=active]:bg-[#021541] data-[state=active]:text-white text-[#718096] hover:text-[#021541] rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="geral" className="mt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] p-5 min-h-[200px]">
              <h3 className="text-sm font-semibold text-[#021541] mb-4">Leads por Mês (6 meses)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={LEADS_MENSAL}>
                  <CartesianGrid stroke="rgba(2,21,65,0.08)" vertical={false} />
                  <XAxis dataKey="mes" {...axisStyle} />
                  <YAxis {...axisStyle} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="leads" name="Leads" fill="#00BCE4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] p-5 min-h-[200px]">
              <h3 className="text-sm font-semibold text-[#021541] mb-4">Faturamento Mensal (R$)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={FATURAMENTO_MENSAL}>
                  <CartesianGrid stroke="rgba(2,21,65,0.08)" vertical={false} />
                  <XAxis dataKey="mes" {...axisStyle} />
                  <YAxis {...axisStyle} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip {...tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
                  <Line type="monotone" dataKey="valor" name="Faturamento" stroke="#00BCE4" strokeWidth={2.5} dot={{ r: 4, fill: '#00BCE4', strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] p-5 min-h-[200px]">
              <h3 className="text-sm font-semibold text-[#021541] mb-4">Origem dos Leads</h3>
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

            <div className="bg-white rounded-xl border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] p-5 min-h-[200px]">
              <h3 className="text-sm font-semibold text-[#021541] mb-4">Insights do Mês</h3>
              <ul className="space-y-3 text-sm">
                {[
                  { icon: 'trending_up', color: 'text-[#00BCE4]', text: 'Taxa de conversão de leads está em 18% — acima da média de 15%' },
                  { icon: 'warning', color: 'text-[#D97706]', text: 'CPL do Google Ads subiu 12% este mês — revisar segmentação' },
                  { icon: 'trending_up', color: 'text-[#059669]', text: 'Procedimentos PRP geraram 38% da receita total' },
                  { icon: 'info', color: 'text-[#00BCE4]', text: 'Indicações representam 18% dos leads — incentivar programa de indicação' },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={`material-symbols-outlined mt-0.5 shrink-0 ${item.color}`} style={{ fontSize: '16px' }}>{item.icon}</span>
                    <span className="text-[#718096]">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leads" className="mt-0">
          <div className="bg-white rounded-xl border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] p-5 min-h-[200px]">
            <h3 className="text-sm font-semibold text-[#021541] mb-4">Evolução de Leads</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={LEADS_MENSAL}>
                <CartesianGrid stroke="rgba(2,21,65,0.08)" vertical={false} />
                <XAxis dataKey="mes" {...axisStyle} />
                <YAxis {...axisStyle} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="leads" name="Leads" fill="#00BCE4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="financeiro" className="mt-0">
          <div className="bg-white rounded-xl border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] p-5 min-h-[200px]">
            <h3 className="text-sm font-semibold text-[#021541] mb-4">Evolução do Faturamento</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={FATURAMENTO_MENSAL}>
                <CartesianGrid stroke="rgba(2,21,65,0.08)" vertical={false} />
                <XAxis dataKey="mes" {...axisStyle} />
                <YAxis {...axisStyle} tickFormatter={(v) => `R$${v / 1000}k`} />
                <Tooltip {...tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
                <Line type="monotone" dataKey="valor" name="Faturamento" stroke="#00BCE4" strokeWidth={2.5} dot={{ r: 4, fill: '#00BCE4', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="dre" className="mt-0">
          <DRETab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
