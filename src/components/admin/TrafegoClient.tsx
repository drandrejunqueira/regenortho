'use client'

import { useState } from 'react'
import {
  TrendingUp, Users, Target, MousePointer, Globe, Search,
  ExternalLink, Calendar, ChevronRight, AlertCircle, Link2,
  TrendingDown, CheckCircle2, ListFilter, Activity
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, CartesianGrid
} from 'recharts'
import { formatCurrency, cn } from '@/lib/utils'

interface Lead {
  id: string
  name: string
  phone: string
  email: string | null
  status: string
  source: string
  createdAt: string
  utmCampaign: string | null
}

interface Props {
  googleStatus: {
    conectado: boolean
    email: string | null
    gscSite: string | null
    ga4Property: string | null
  }
  leads: Lead[]
  firstPartyStats: {
    pageviews: number
    clicks: number
    visitantes: number
    conversao: number
  }
  chartData: { data: string; visitas: number; leads: number }[]
  gscData: {
    totalClicks: number
    totalImpressions: number
    ctrMedio: number
    posicaoMedia: number
    topQueries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[]
  } | null
  ga4Data: {
    usuariosAtivos: number
    sessoes: number
    pageviews: number
    duracaoMedia: number
    canais: { canal: string; sessoes: number }[]
  } | null
}

export function TrafegoClient({
  googleStatus,
  leads,
  firstPartyStats,
  chartData,
  gscData,
  ga4Data
}: Props) {
  const [filterSource, setFilterSource] = useState<'all' | 'google_ads' | 'meta_ads'>('all')

  const filteredLeads = leads.filter(l => {
    if (filterSource === 'all') return true
    return l.source === filterSource
  })

  // Calculations
  const totalLeads = leads.length
  const googleLeadsCount = leads.filter(l => l.source === 'google_ads').length
  const metaLeadsCount = leads.filter(l => l.source === 'meta_ads').length

  const fmtDate = (d: string) => {
    const [, m, dia] = d.split('-')
    return `${dia}/${m}`
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(2,21,65,0.06)] pb-5">
        <div>
          <h2 className="text-xl font-bold text-[#021541] flex items-center gap-2">
            <Activity className="size-5 text-[#00BCE4]" />
            Tráfego Pago & Captação de Leads
          </h2>
          <p className="text-[#718096] text-xs mt-0.5">
            Métricas integradas do Google Ads, Analytics (GA4) e Leads reais convertidos no site.
          </p>
        </div>

        {/* Status da Conexão */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white border border-[rgba(2,21,65,0.06)] shadow-sm">
          <span className={cn(
            "w-2.5 h-2.5 rounded-full shrink-0",
            googleStatus.conectado ? "bg-green-500 animate-pulse" : "bg-amber-500"
          )} />
          <span className="text-xs font-semibold text-[#021541]">
            Google APIs: {googleStatus.conectado ? 'Conectado' : 'Sem Conexão'}
          </span>
          {!googleStatus.conectado && (
            <a
              href="/configuracoes/site"
              className="text-[10px] font-bold text-[#00BCE4] hover:underline uppercase tracking-wider ml-1"
            >
              Conectar
            </a>
          )}
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Visitantes Únicos */}
        <div className="rounded-xl border border-[rgba(2,21,65,0.06)] bg-white p-5 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-bold text-[#718096] uppercase tracking-wider block">Visitantes na LP</span>
            <span className="flex items-center justify-center size-8 rounded-lg bg-[rgba(0,188,228,0.08)] text-[#00BCE4]">
              <Users className="size-4.5" />
            </span>
          </div>
          <h3 className="text-2xl font-extrabold text-[#021541] tracking-tight">
            {firstPartyStats.visitantes.toLocaleString('pt-BR')}
          </h3>
          <p className="text-[10px] text-[#718096] mt-1">
            Visualizações na Landing Page: <strong className="text-[#021541] font-semibold">{firstPartyStats.pageviews}</strong>
          </p>
        </div>

        {/* KPI 2: Total de Leads convertidos */}
        <div className="rounded-xl border border-[rgba(2,21,65,0.06)] bg-white p-5 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-bold text-[#718096] uppercase tracking-wider block">Leads Capturados</span>
            <span className="flex items-center justify-center size-8 rounded-lg bg-[rgba(2,21,65,0.04)] text-[#021541]">
              <Target className="size-4.5" />
            </span>
          </div>
          <h3 className="text-2xl font-extrabold text-[#021541] tracking-tight">
            {totalLeads}
          </h3>
          <p className="text-[10px] text-[#718096] mt-1">
            Google Ads: <strong className="text-[#021541] font-semibold">{googleLeadsCount}</strong> · Meta Ads: <strong className="text-[#021541] font-semibold">{metaLeadsCount}</strong>
          </p>
        </div>

        {/* KPI 3: Taxa de Conversão */}
        <div className="rounded-xl border border-[rgba(2,21,65,0.06)] bg-white p-5 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-bold text-[#718096] uppercase tracking-wider block">Taxa de Conversão</span>
            <span className="flex items-center justify-center size-8 rounded-lg bg-[rgba(0,188,228,0.08)] text-[#00BCE4]">
              <TrendingUp className="size-4.5" />
            </span>
          </div>
          <h3 className="text-2xl font-extrabold text-[#00BCE4] tracking-tight">
            {firstPartyStats.conversao.toFixed(1)}%
          </h3>
          <p className="text-[10px] text-[#718096] mt-1">
            Total de cliques em formulários: <strong className="text-[#021541] font-semibold">{firstPartyStats.clicks}</strong>
          </p>
        </div>

        {/* KPI 4: Google Organic Clicks */}
        <div className="rounded-xl border border-[rgba(2,21,65,0.06)] bg-white p-5 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-bold text-[#718096] uppercase tracking-wider block">Cliques no Google (SEO)</span>
            <span className="flex items-center justify-center size-8 rounded-lg bg-green-50 text-green-600">
              <MousePointer className="size-4.5" />
            </span>
          </div>
          <h3 className="text-2xl font-extrabold text-[#021541] tracking-tight">
            {gscData ? gscData.totalClicks.toLocaleString('pt-BR') : '—'}
          </h3>
          <p className="text-[10px] text-[#718096] mt-1">
            Impressões totais: <strong className="text-[#021541] font-semibold">{gscData ? gscData.totalImpressions.toLocaleString('pt-BR') : '—'}</strong>
          </p>
        </div>
      </div>

      {/* GRÁFICO HISTÓRICO 30 DIAS */}
      <div className="rounded-2xl border border-[rgba(2,21,65,0.06)] bg-white p-5 md:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-sm font-bold text-[#021541]">Desempenho da Landing Page e Leads</h3>
            <p className="text-xs text-[#718096] mt-0.5">Visitas únicas e conversões diárias rastreadas nos últimos 30 dias.</p>
          </div>
        </div>

        {chartData.length === 0 ? (
          <p className="text-[#718096] text-xs py-12 text-center">Nenhum evento registrado nos últimos 30 dias.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="visitasGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00BCE4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00BCE4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#021541" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#021541" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} />
                <XAxis dataKey="data" tickFormatter={fmtDate} fontSize={10} stroke="#718096" tickLine={false} axisLine={false} />
                <YAxis fontSize={10} stroke="#718096" allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip
                  labelFormatter={(lbl) => `Dia: ${lbl}`}
                  contentStyle={{ background: '#ffffff', border: '1px solid rgba(2,21,65,0.08)', borderRadius: '12px', fontSize: '11px', boxShadow: '0 4px 15px rgba(2,21,65,0.06)' }}
                />
                <Area type="monotone" dataKey="visitas" name="Visitas Únicas" stroke="#00BCE4" strokeWidth={2.5} fill="url(#visitasGrad)" />
                <Area type="monotone" dataKey="leads" name="Leads Gerados" stroke="#021541" strokeWidth={2} fill="url(#leadsGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* DADOS DETALHADOS GOOGLE INTEGRATION */}
      {googleStatus.conectado && (ga4Data || gscData) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* SEARCH CONSOLE KEYWORDS */}
          {gscData && (
            <div className="rounded-2xl border border-[rgba(2,21,65,0.06)] bg-white p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#021541] flex items-center gap-2">
                <Search className="size-4 text-[#00BCE4]" />
                Palavras-chave de Destaque (Google SEO)
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[rgba(2,21,65,0.05)] text-[10px] font-bold text-[#718096] uppercase tracking-wider">
                      <th className="pb-2">Consulta</th>
                      <th className="pb-2 text-right">Cliques</th>
                      <th className="pb-2 text-right">Impressões</th>
                      <th className="pb-2 text-right">CTR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(2,21,65,0.03)] text-[#021541]">
                    {gscData.topQueries.slice(0, 7).map(q => (
                      <tr key={q.query} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 font-medium">{q.query}</td>
                        <td className="py-2.5 text-right font-mono font-bold">{q.clicks}</td>
                        <td className="py-2.5 text-right font-mono text-[#718096]">{q.impressions}</td>
                        <td className="py-2.5 text-right font-mono text-[#00BCE4] font-semibold">{(q.ctr * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* GA4 TRAFFIC SOURCES */}
          {ga4Data && (
            <div className="rounded-2xl border border-[rgba(2,21,65,0.06)] bg-white p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#021541] flex items-center gap-2">
                <Globe className="size-4 text-[#00BCE4]" />
                Origens de Tráfego e Canais (GA4)
              </h3>

              <div className="space-y-3.5">
                {ga4Data.canais.map(c => {
                  const maxSessoes = ga4Data.canais[0]?.sessoes ?? 1
                  const pct = Math.max(5, Math.round((c.sessoes / maxSessoes) * 100))
                  return (
                    <div key={c.canal} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-[#021541]">
                        <span className="capitalize">{c.canal.replace(/_/g, ' ')}</span>
                        <span className="font-mono">{c.sessoes} sessões</span>
                      </div>
                      <div className="h-2 bg-[#f5f6f8] rounded-full overflow-hidden">
                        <div className="h-full bg-[#00BCE4] rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CRM LEADS LISTING */}
      <div className="rounded-2xl border border-[rgba(2,21,65,0.06)] bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-[#021541]">Lista de Conversões do Tráfego Pago</h3>
            <p className="text-xs text-[#718096] mt-0.5">Histórico recente de leads capturados pelas Landing Pages de Google/Meta Ads.</p>
          </div>

          {/* Filtro por Origem */}
          <div className="flex border border-[rgba(2,21,65,0.06)] rounded-lg overflow-hidden bg-[#f5f6f8]">
            <button
              onClick={() => setFilterSource('all')}
              className={cn(
                "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
                filterSource === 'all' ? "bg-[#021541] text-white" : "text-[#718096] hover:text-[#021541]"
              )}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterSource('google_ads')}
              className={cn(
                "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
                filterSource === 'google_ads' ? "bg-[#021541] text-white" : "text-[#718096] hover:text-[#021541]"
              )}
            >
              Google Ads
            </button>
            <button
              onClick={() => setFilterSource('meta_ads')}
              className={cn(
                "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
                filterSource === 'meta_ads' ? "bg-[#021541] text-white" : "text-[#718096] hover:text-[#021541]"
              )}
            >
              Meta Ads
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-[rgba(2,21,65,0.05)] rounded-xl">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-[#f5f6f8] text-[10px] font-bold text-[#718096] uppercase tracking-wider border-b border-[rgba(2,21,65,0.05)]">
                <th className="p-4">Paciente</th>
                <th className="p-4">Contato</th>
                <th className="p-4">Origem</th>
                <th className="p-4">Campanha / UTM</th>
                <th className="p-4">Data</th>
                <th className="p-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(2,21,65,0.04)] text-[#021541]">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-[#718096]">
                    Nenhum lead correspondente encontrado na base de dados.
                  </td>
                </tr>
              ) : (
                filteredLeads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold">{lead.name}</td>
                    <td className="p-4 font-mono">{lead.phone}</td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                        lead.source === 'google_ads'
                          ? "bg-[rgba(0,188,228,0.1)] text-[#00BCE4]"
                          : "bg-[rgba(2,21,65,0.06)] text-[#021541]"
                      )}>
                        {lead.source.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-[#718096]">{lead.utmCampaign || 'Orgânico / Direto'}</td>
                    <td className="p-4 text-[#718096]">{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="p-4 text-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                        lead.status === 'new' ? "bg-blue-100 text-blue-700" :
                        lead.status === 'contacted' ? "bg-amber-100 text-amber-700" :
                        lead.status === 'converted' ? "bg-green-100 text-green-700" :
                        "bg-gray-100 text-gray-700"
                      )}>
                        {lead.status === 'new' ? 'Novo' :
                         lead.status === 'contacted' ? 'Contato' :
                         lead.status === 'converted' ? 'Convertido' : lead.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
