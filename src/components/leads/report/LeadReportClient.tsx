'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  LEAD_CHANNELS,
  LEAD_CHANNEL_COLORS,
  LEAD_CHANNEL_HINTS,
  LEAD_CHANNEL_LABELS,
  type LeadChannel,
} from '@/lib/leadChannels'
import {
  REPORT_PRESETS,
  REPORT_PRESET_LABELS,
  reportApiQuery,
  reportPageQuery,
  type ReportFilters,
  type ReportPreset,
} from '@/lib/leadReportFilters'
import type { LeadReport } from '@/lib/leadReport'
import { LeadReportView } from './LeadReportView'

interface ReportResponse {
  data: LeadReport
  meta: { clinicName: string; generatedAt: string }
}

const controlCls =
  'bg-[#f5f6f8] border border-[rgba(2,21,65,0.10)] rounded-full px-4 py-2 text-xs text-[#021541] focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30'

const segmentCls = (selected: boolean) =>
  cn(
    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer',
    selected
      ? 'bg-[#021541] text-white'
      : 'text-[#718096] hover:text-[#021541] hover:bg-[#021541]/[0.06]'
  )

/** Nome do PDF: o navegador sugere o título da aba ao salvar. */
function pdfTitle(res: ReportResponse): string {
  const { from, to } = res.data.range
  const channel = res.data.channel ? ` - ${LEAD_CHANNEL_LABELS[res.data.channel]}` : ''
  return `Relatório de leads - ${res.meta.clinicName}${channel} - ${from} a ${to}`
}

export function LeadReportClient({ initial }: { initial: ReportFilters }) {
  const [filters, setFilters] = useState<ReportFilters>(initial)
  const [result, setResult] = useState<ReportResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const apiQuery = reportApiQuery(filters)

  // A URL acompanha o recorte: recarregar ou mandar o link abre o mesmo relatório.
  useEffect(() => {
    window.history.replaceState(null, '', `?${reportPageQuery(filters)}`)
  }, [filters])

  useEffect(() => {
    if (!apiQuery) return
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)
    fetch(`/api/leads/relatorio?${apiQuery}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error(body?.error ?? 'Não foi possível gerar o relatório.')
        setResult(body as ReportResponse)
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return
        setError(e instanceof Error ? e.message : 'Não foi possível gerar o relatório.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [apiQuery])

  function selectPreset(preset: ReportPreset) {
    // Entrar no personalizado parte do intervalo que já está na tela, em vez de
    // abrir com datas vazias e um relatório em branco.
    const seed = preset === 'custom' && result ? result.data.range : { from: '', to: '' }
    setFilters((f) => ({ ...f, preset, from: seed.from, to: seed.to }))
  }

  function selectChannel(channel: LeadChannel | '') {
    setFilters((f) => ({ ...f, channel }))
  }

  function handlePrint() {
    if (!result) return
    const previous = document.title
    document.title = pdfTitle(result)
    window.print()
    document.title = previous
  }

  const canPrint = !!result && !isLoading && !error

  return (
    <div className="pb-10">
      <div className="print:hidden">
        <Link
          href="/leads"
          className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-[#718096] hover:text-[#021541]"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
            arrow_back
          </span>
          CRM de Leads
        </Link>
        <PageHeader
          title="Relatório de leads"
          description="Escolha o período e o canal. O PDF sai igual à folha abaixo."
          action={
            <button
              type="button"
              onClick={handlePrint}
              disabled={!canPrint}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#021541] text-white text-sm font-bold hover:bg-[#032170] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                picture_as_pdf
              </span>
              Baixar PDF
            </button>
          }
        />

        <div className="mb-5 flex flex-wrap items-center gap-2.5">
          <div
            role="group"
            aria-label="Período do relatório"
            className="flex flex-wrap items-center gap-0.5 rounded-[20px] bg-[#f5f6f8] p-1 border border-[rgba(2,21,65,0.10)]"
          >
            {REPORT_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => selectPreset(p)}
                aria-pressed={filters.preset === p}
                className={segmentCls(filters.preset === p)}
              >
                {REPORT_PRESET_LABELS[p]}
              </button>
            ))}
          </div>

          {filters.preset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                aria-label="Relatório a partir de"
                className={cn(controlCls, 'font-technical')}
              />
              <span className="text-xs text-[#718096]">até</span>
              <input
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                aria-label="Relatório até"
                className={cn(controlCls, 'font-technical')}
              />
            </div>
          )}

          <div
            role="group"
            aria-label="Canal do relatório"
            className="flex items-center gap-0.5 rounded-full bg-[#f5f6f8] p-1 border border-[rgba(2,21,65,0.10)]"
          >
            {(['', ...LEAD_CHANNELS] as const).map((c) => (
              <button
                key={c || 'todos'}
                type="button"
                onClick={() => selectChannel(c)}
                aria-pressed={filters.channel === c}
                title={c ? LEAD_CHANNEL_HINTS[c] : 'Todos os canais'}
                className={segmentCls(filters.channel === c)}
              >
                {c && (
                  <span
                    aria-hidden
                    className="w-2 h-2 rounded-full"
                    style={{ background: LEAD_CHANNEL_COLORS[c] }}
                  />
                )}
                {c ? LEAD_CHANNEL_LABELS[c] : 'Todos os canais'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!apiQuery ? (
        <p className="py-16 text-center text-sm text-[#718096] print:hidden">
          Escolha a data inicial e a final para gerar o relatório.
        </p>
      ) : error ? (
        <div className="py-16 text-center print:hidden">
          <p className="text-sm font-semibold text-[#B42318]">{error}</p>
        </div>
      ) : !result ? (
        <p className="flex items-center justify-center py-16 text-sm text-[#718096] print:hidden">
          <span
            className="material-symbols-outlined animate-spin mr-2"
            style={{ fontSize: '18px' }}
          >
            refresh
          </span>
          Gerando relatório...
        </p>
      ) : (
        <div className={cn('transition-opacity', isLoading && 'opacity-50')} aria-busy={isLoading}>
          <LeadReportView
            report={result.data}
            clinicName={result.meta.clinicName}
            generatedAt={result.meta.generatedAt}
          />
        </div>
      )}
    </div>
  )
}
