'use client'

// A folha do relatório: o que aparece aqui é exatamente o que sai no PDF.
// Largura fixa de uma A4 (210mm) na tela e na impressão — o gráfico mede o
// mesmo tamanho nos dois e não precisa redesenhar quando a impressão abre.
import { cn } from '@/lib/utils'
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from '@/lib/constants'
import {
  LEAD_CHANNELS,
  LEAD_CHANNEL_COLORS,
  LEAD_CHANNEL_HINTS,
  LEAD_CHANNEL_LABELS,
} from '@/lib/leadChannels'
import {
  formatDayMonth,
  type LeadReport,
  type ReportCount,
  type ReportRange,
} from '@/lib/leadReport'
import { ChannelSeriesChart } from './ChannelSeriesChart'

const NUM = new Intl.NumberFormat('pt-BR')
const DEC = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const FULL_DATE = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const STAMP = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Cor única da lista de situação: série só, sem legenda — o título nomeia. */
const STATUS_BAR_COLOR = '#021541'

function pct(share: number): string {
  if (share > 0 && share < 0.01) return '<1%'
  return `${Math.round(share * 100)}%`
}

const noon = (day: string) => new Date(`${day}T15:00:00.000Z`)

function rangeLabel(r: ReportRange): string {
  if (r.days === 1) return FULL_DATE.format(noon(r.from))
  return `${FULL_DATE.format(noon(r.from))} a ${FULL_DATE.format(noon(r.to))}`
}

const shortRange = (r: ReportRange) =>
  r.days === 1 ? formatDayMonth(r.from) : `${formatDayMonth(r.from)} a ${formatDayMonth(r.to)}`

function Section({
  title,
  subtitle,
  children,
  className,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('break-inside-avoid', className)}>
      <h2 className="text-[13px] font-bold text-[#021541]">{title}</h2>
      {subtitle && <p className="mt-0.5 text-[11px] text-[#718096]">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

interface BarItem {
  key: string
  label: string
  total: number
  share?: number
  color: string
}

/** Barras horizontais finas com o número ao lado — a tabela já embutida no gráfico. */
function BarList({ items }: { items: BarItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.total))
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex items-baseline gap-2 text-xs">
            <span className="truncate text-[#4A5568]">{item.label}</span>
            <span className="ml-auto shrink-0 font-bold tabular-nums text-[#021541]">
              {NUM.format(item.total)}
            </span>
            {item.share !== undefined && (
              <span className="w-9 shrink-0 text-right tabular-nums text-[#718096]">
                {pct(item.share)}
              </span>
            )}
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-[#021541]/[0.06]">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.total / max) * 100}%`, background: item.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Delta({ report }: { report: LeadReport }) {
  const { deltaPct, range, total } = report.previous
  const base = `vs. ${shortRange(range)} (${NUM.format(total)})`
  if (deltaPct === null) {
    return (
      <p className="text-xs text-[#718096]">Sem leads no período anterior ({shortRange(range)})</p>
    )
  }
  const rounded = Math.round(deltaPct)
  if (rounded === 0) return <p className="text-xs text-[#718096]">Estável {base}</p>
  const up = rounded > 0
  return (
    <p
      className={cn(
        'flex items-center gap-1 text-xs font-bold',
        up ? 'text-[#006300]' : 'text-[#B42318]'
      )}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden>
        {up ? 'trending_up' : 'trending_down'}
      </span>
      {up ? '+' : '−'}
      {Math.abs(rounded)}%<span className="font-medium text-[#718096]">{base}</span>
    </p>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-[#f5f6f8] px-4 py-3">
      <p className="text-[11px] font-semibold text-[#718096]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#021541]">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-[#718096]">{hint}</p>}
    </div>
  )
}

const countItems = (list: ReportCount[], color: string, total: number): BarItem[] =>
  list.map((c) => ({ key: c.name, label: c.name, total: c.total, share: c.total / total, color }))

interface Props {
  report: LeadReport
  clinicName: string
  generatedAt: string
}

export function LeadReportView({ report, clinicName, generatedAt }: Props) {
  const channels = report.channel ? [report.channel] : LEAD_CHANNELS
  const isEmpty = report.total === 0
  const unit = report.series.granularity === 'day' ? 'dia' : 'mês'

  return (
    <article className="report-paper mx-auto w-full max-w-[210mm] rounded-3xl bg-white px-5 py-7 shadow-[0_2px_24px_rgba(2,21,65,0.06)] sm:px-[12mm] sm:py-[12mm] print:rounded-none print:px-[12mm] print:py-0 print:shadow-none">
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(2,21,65,0.08)] pb-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#00BCE4]">
            {clinicName}
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-[#021541]">
            Relatório de captação de leads
          </h1>
          <p className="mt-1 text-sm text-[#4A5568]">
            {rangeLabel(report.range)} · {report.range.days}{' '}
            {report.range.days === 1 ? 'dia' : 'dias'}
          </p>
        </div>
        {report.channel && (
          <span className="flex items-center gap-1.5 rounded-full bg-[#f5f6f8] px-3 py-1.5 text-xs font-bold text-[#021541]">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: LEAD_CHANNEL_COLORS[report.channel] }}
            />
            Canal: {LEAD_CHANNEL_LABELS[report.channel]}
          </span>
        )}
      </header>

      {/* Número principal + indicadores */}
      <div className="grid grid-cols-1 gap-4 border-b border-[rgba(2,21,65,0.08)] py-6 md:grid-cols-[1.1fr_2fr] md:items-center">
        <div>
          <p className="text-xs font-semibold text-[#718096]">Leads recebidos</p>
          <p className="text-[56px] font-bold leading-none tracking-tight text-[#021541]">
            {NUM.format(report.total)}
          </p>
          <div className="mt-2">
            <Delta report={report} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <Kpi label="Média por dia" value={DEC.format(report.perDay)} />
          <Kpi
            label="Agendaram consulta"
            value={NUM.format(report.scheduled.total)}
            hint={isEmpty ? undefined : `${pct(report.scheduled.share)} dos leads`}
          />
          <Kpi
            label="Viraram pacientes"
            value={NUM.format(report.patients.total)}
            hint={isEmpty ? undefined : `${pct(report.patients.share)} dos leads`}
          />
        </div>
      </div>

      {isEmpty ? (
        <p className="py-12 text-center text-sm text-[#718096]">
          Nenhum lead chegou neste período.
        </p>
      ) : (
        <div className="space-y-7 pt-6">
          {/* Canais */}
          {!report.channel && (
            <Section title="Leads por canal">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {report.byChannel.map((c) => (
                  <div
                    key={c.channel}
                    className="rounded-2xl border border-[rgba(2,21,65,0.08)] px-4 py-3"
                  >
                    <p className="flex items-center gap-2 text-xs font-bold text-[#021541]">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: LEAD_CHANNEL_COLORS[c.channel] }}
                      />
                      {LEAD_CHANNEL_LABELS[c.channel]}
                    </p>
                    <p className="mt-1.5 flex items-baseline gap-2">
                      <span className="text-[28px] font-bold leading-none text-[#021541]">
                        {NUM.format(c.total)}
                      </span>
                      <span className="text-sm font-semibold text-[#718096]">{pct(c.share)}</span>
                    </p>
                    <div className="mt-2.5 h-1.5 rounded-full bg-[#021541]/[0.06]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${c.share * 100}%`,
                          background: LEAD_CHANNEL_COLORS[c.channel],
                        }}
                      />
                    </div>
                    <p className="mt-2 text-[10.5px] leading-snug text-[#718096]">
                      {LEAD_CHANNEL_HINTS[c.channel]}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Evolução no tempo — um dia só não tem evolução para mostrar */}
          {report.range.days > 1 && (
            <Section title={`Leads por ${unit}`}>
              {channels.length > 1 && (
                <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
                  {channels.map((c) => (
                    <span
                      key={c}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-[#4A5568]"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-[3px]"
                        style={{ background: LEAD_CHANNEL_COLORS[c] }}
                      />
                      {LEAD_CHANNEL_LABELS[c]}
                    </span>
                  ))}
                </div>
              )}
              <ChannelSeriesChart
                points={report.series.points}
                granularity={report.series.granularity}
                channels={channels}
              />
            </Section>
          )}

          <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
            <div className="space-y-7">
              <Section title="Origem detalhada">
                <BarList
                  items={report.bySource.map((s) => ({
                    key: s.source,
                    label: LEAD_SOURCE_LABELS[s.source] ?? s.source,
                    total: s.total,
                    share: s.share,
                    color: LEAD_CHANNEL_COLORS[s.channel],
                  }))}
                />
              </Section>
              {report.bySpecialty.length > 0 && (
                <Section
                  title="Por interesse"
                  subtitle="Especialidade ou botão por onde o lead chegou"
                >
                  <BarList items={countItems(report.bySpecialty, STATUS_BAR_COLOR, report.total)} />
                </Section>
              )}
            </div>
            <Section
              title="Situação atual dos leads"
              subtitle="Etapa do funil em que cada lead está hoje"
            >
              <BarList
                items={report.byStatus.map((s) => ({
                  key: s.status,
                  label: LEAD_STATUS_LABELS[s.status] ?? s.status,
                  total: s.total,
                  share: s.total / report.total,
                  color: STATUS_BAR_COLOR,
                }))}
              />
            </Section>
          </div>
        </div>
      )}

      {/* Rodapé */}
      <footer className="mt-8 break-inside-avoid border-t border-[rgba(2,21,65,0.08)] pt-4 text-[10.5px] leading-relaxed text-[#718096]">
        <p>
          {LEAD_CHANNELS.map((c, i) => (
            <span key={c}>
              {i > 0 && ' · '}
              <strong className="text-[#4A5568]">{LEAD_CHANNEL_LABELS[c]}</strong>:{' '}
              {LEAD_CHANNEL_HINTS[c]}
            </span>
          ))}
        </p>
        <p className="mt-1">Gerado em {STAMP.format(new Date(generatedAt))}</p>
      </footer>
    </article>
  )
}
