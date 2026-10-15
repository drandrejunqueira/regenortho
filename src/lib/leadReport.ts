/**
 * Relatório de captação de leads — o que a clínica recebe para saber quanto
 * chegou, de onde e o que virou.
 *
 * A agregação é feita em memória sobre as linhas do período (só 4 colunas, no
 * máximo um ano): assim o mesmo código decide o dia-calendário no fuso da
 * clínica para a série e para os totais, sem depender de `date_trunc` no
 * Postgres, que trunca em UTC e joga lead das 21h para o dia seguinte.
 */
import { toDateBR } from '@/lib/utils'
import { resolveLeadPeriodRange, type LeadPeriod } from '@/lib/leadPeriod'
import { LEAD_CHANNELS, channelOfSource, type LeadChannel } from '@/lib/leadChannels'

/** Um ano e um dia de folga: cobre "ano passado" inteiro e mantém a consulta leve. */
export const REPORT_MAX_DAYS = 366

/** Acima disso a série diária vira barras finas demais — agrupa por mês. */
const DAILY_SERIES_MAX_DAYS = 92

const TOP_LIST_SIZE = 8
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Ordem do funil, do primeiro contato ao paciente. */
export const REPORT_STATUS_ORDER = [
  'new',
  'contacted',
  'scheduled',
  'attended',
  'active_patient',
  'lost',
] as const

/** Status de quem chegou a marcar consulta — o lead só avança a partir daí. */
const SCHEDULED_OR_LATER = new Set(['scheduled', 'attended', 'active_patient'])

export interface ReportRange {
  from: string
  to: string
  days: number
}

export interface ReportLeadRow {
  source: string
  status: string
  createdAt: Date
  specialty: string | null
}

export type ChannelCounts = Record<LeadChannel, number>

export interface ReportSeriesPoint extends ChannelCounts {
  key: string
  total: number
}

export interface ReportCount {
  name: string
  total: number
}

export interface LeadReport {
  range: ReportRange
  channel: LeadChannel | null
  total: number
  perDay: number
  previous: { range: ReportRange; total: number; deltaPct: number | null }
  byChannel: Array<{ channel: LeadChannel; total: number; share: number }>
  bySource: Array<{ source: string; channel: LeadChannel; total: number; share: number }>
  byStatus: Array<{ status: string; total: number }>
  scheduled: { total: number; share: number }
  patients: { total: number; share: number }
  bySpecialty: ReportCount[]
  series: { granularity: 'day' | 'month'; points: ReportSeriesPoint[] }
}

// ── Aritmética de dia-calendário (YYYY-MM-DD) ─────────────────────────────
// Ancorada ao meio-dia de Brasília (15:00 UTC): somar dias sobre um Date no
// fuso local erraria a virada para quem operasse de outro fuso, e o meio-dia
// deixa folga de sobra para qualquer offset.

const noonBR = (day: string) => new Date(`${day}T15:00:00.000Z`)

function addDays(day: string, n: number): string {
  const d = noonBR(day)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const diffDays = (a: string, b: string) =>
  Math.round((noonBR(b).getTime() - noonBR(a).getTime()) / 86_400_000)

function monthBounds(day: string): { start: string; end: string } {
  const [y, m] = day.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return {
    start: `${day.slice(0, 7)}-01`,
    end: `${day.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`,
  }
}

/** "06/10" para um YYYY-MM-DD. */
export const formatDayMonth = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`

export type RangeResult = { ok: true; range: ReportRange } | { ok: false; error: string }

/**
 * Janela do relatório. Presets reaproveitam o recorte do CRM; o personalizado
 * exige as duas datas e no máximo um ano. `all` não é aceito: sem janela
 * fechada não há período anterior para comparar.
 */
export function resolveReportRange(
  period: LeadPeriod,
  from: string | null,
  to: string | null,
  now: Date = new Date()
): RangeResult {
  if (period === 'all') return { ok: false, error: 'Escolha um período para o relatório' }

  const preset = resolveLeadPeriodRange(period, now)
  const start = preset?.from ?? from
  const end = preset?.to ?? to

  if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
    return { ok: false, error: 'Informe as datas de início e fim' }
  }
  const days = diffDays(start, end) + 1
  if (days < 1) return { ok: false, error: 'A data inicial é depois da final' }
  if (days > REPORT_MAX_DAYS) {
    return { ok: false, error: `O período máximo é de ${REPORT_MAX_DAYS} dias` }
  }
  return { ok: true, range: { from: start, to: end, days } }
}

/** Período imediatamente anterior, de mesmo tamanho — base da variação. */
export function previousRange(range: ReportRange): ReportRange {
  const to = addDays(range.from, -1)
  return { from: addDays(to, -(range.days - 1)), to, days: range.days }
}

/**
 * Bordas em instante UTC, no mesmo contrato de /api/leads: o dia inteiro em
 * horário de Brasília (UTC-3, sem horário de verão desde 2019).
 */
export function rangeBounds(range: ReportRange): { start: Date; end: Date } {
  return {
    start: new Date(`${range.from}T00:00:00.000-03:00`),
    end: new Date(`${range.to}T23:59:59.999-03:00`),
  }
}

/** Mês corrente até hoje e o mês anterior inteiro — atalhos do relatório mensal. */
export function monthShortcuts(
  now: Date = new Date()
): Record<'thisMonth' | 'lastMonth', { from: string; to: string }> {
  const today = toDateBR(now)
  const current = monthBounds(today)
  const last = monthBounds(addDays(current.start, -1))
  return {
    thisMonth: { from: current.start, to: today },
    lastMonth: { from: last.start, to: last.end },
  }
}

const emptyCounts = (): ChannelCounts => ({ google: 0, instagram: 0, outros: 0 })

const share = (part: number, whole: number) => (whole > 0 ? part / whole : 0)

/** Chaves contíguas da série — dia sem lead aparece como zero, não some do eixo. */
function seriesKeys(range: ReportRange, granularity: 'day' | 'month'): string[] {
  const keys: string[] = []
  if (granularity === 'day') {
    for (let i = 0; i < range.days; i++) keys.push(addDays(range.from, i))
    return keys
  }
  let cursor = monthBounds(range.from).start
  const last = range.to.slice(0, 7)
  while (cursor.slice(0, 7) <= last) {
    keys.push(cursor.slice(0, 7))
    cursor = addDays(monthBounds(cursor).end, 1)
  }
  return keys
}

/** Contagem decrescente; vazios descartados e a cauda somada em "Outras". */
function topCounts(values: Array<string | null>): ReportCount[] {
  const counts = new Map<string, number>()
  for (const raw of values) {
    const name = raw?.trim()
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  const sorted = [...counts.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'))
  if (sorted.length <= TOP_LIST_SIZE) return sorted
  const head = sorted.slice(0, TOP_LIST_SIZE - 1)
  const tail = sorted.slice(TOP_LIST_SIZE - 1).reduce((sum, c) => sum + c.total, 0)
  return [...head, { name: 'Outras', total: tail }]
}

export function buildLeadReport(
  rows: ReportLeadRow[],
  range: ReportRange,
  previousTotal: number,
  channel: LeadChannel | null = null
): LeadReport {
  const total = rows.length
  const granularity = range.days > DAILY_SERIES_MAX_DAYS ? 'month' : 'day'

  const points = new Map<string, ReportSeriesPoint>(
    seriesKeys(range, granularity).map((key) => [key, { key, total: 0, ...emptyCounts() }])
  )
  const channelTotals = emptyCounts()
  const sourceTotals = new Map<string, number>()
  const statusTotals = new Map<string, number>()

  for (const row of rows) {
    const ch = channelOfSource(row.source)
    channelTotals[ch] += 1
    sourceTotals.set(row.source, (sourceTotals.get(row.source) ?? 0) + 1)
    statusTotals.set(row.status, (statusTotals.get(row.status) ?? 0) + 1)

    const day = toDateBR(row.createdAt)
    const point = points.get(granularity === 'day' ? day : day.slice(0, 7))
    // Fora da janela só por borda de fuso no banco — não entra na série, mas
    // continua nos totais, que é o que a consulta efetivamente recortou.
    if (point) {
      point[ch] += 1
      point.total += 1
    }
  }

  const scheduledTotal = rows.filter((r) => SCHEDULED_OR_LATER.has(r.status)).length
  const patientsTotal = statusTotals.get('active_patient') ?? 0

  return {
    range,
    channel,
    total,
    perDay: total / range.days,
    previous: {
      range: previousRange(range),
      total: previousTotal,
      deltaPct: previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null,
    },
    byChannel: LEAD_CHANNELS.map((c) => ({
      channel: c,
      total: channelTotals[c],
      share: share(channelTotals[c], total),
    })),
    bySource: [...sourceTotals.entries()]
      .map(([source, n]) => ({
        source,
        channel: channelOfSource(source),
        total: n,
        share: share(n, total),
      }))
      .sort((a, b) => b.total - a.total),
    byStatus: REPORT_STATUS_ORDER.map((status) => ({
      status,
      total: statusTotals.get(status) ?? 0,
    })),
    scheduled: { total: scheduledTotal, share: share(scheduledTotal, total) },
    patients: { total: patientsTotal, share: share(patientsTotal, total) },
    bySpecialty: topCounts(rows.map((r) => r.specialty)),
    series: { granularity, points: [...points.values()] },
  }
}
