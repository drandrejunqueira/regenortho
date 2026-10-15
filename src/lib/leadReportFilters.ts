/**
 * Filtros da tela de relatório de leads.
 *
 * Fica fora do componente porque a página (server) lê a URL para abrir no
 * mesmo recorte do CRM, e função exportada de módulo 'use client' não pode ser
 * chamada no servidor.
 */
import { isLeadChannel, type LeadChannel } from '@/lib/leadChannels'
import { monthShortcuts } from '@/lib/leadReport'

export const REPORT_PRESETS = [
  'today',
  '7d',
  '15d',
  '30d',
  'thisMonth',
  'lastMonth',
  'custom',
] as const
export type ReportPreset = (typeof REPORT_PRESETS)[number]

export const REPORT_PRESET_LABELS: Record<ReportPreset, string> = {
  today: 'Hoje',
  '7d': '7 dias',
  '15d': '15 dias',
  '30d': '30 dias',
  thisMonth: 'Este mês',
  lastMonth: 'Mês passado',
  custom: 'Personalizado',
}

/** Presets que a API resolve sozinha; os de mês viram datas fechadas. */
const API_PRESETS: readonly ReportPreset[] = ['today', '7d', '15d', '30d']

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface ReportFilters {
  preset: ReportPreset
  from: string
  to: string
  channel: LeadChannel | ''
}

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  preset: '30d',
  from: '',
  to: '',
  channel: '',
}

const isPreset = (v: string | undefined): v is ReportPreset =>
  !!v && (REPORT_PRESETS as readonly string[]).includes(v)

const validDate = (v: string | undefined) => (v && DATE_RE.test(v) ? v : '')

/** Lê a URL da página. Valor desconhecido (inclusive o `all` do CRM) cai em 30 dias. */
export function parseReportFilters(params: Record<string, string | undefined>): ReportFilters {
  const preset = isPreset(params.period) ? params.period : DEFAULT_REPORT_FILTERS.preset
  return {
    preset,
    from: preset === 'custom' ? validDate(params.from) : '',
    to: preset === 'custom' ? validDate(params.to) : '',
    channel: isLeadChannel(params.channel) ? params.channel : '',
  }
}

/** Query da URL da página — guarda o preset, para "Este mês" continuar sendo o mês corrente ao recarregar. */
export function reportPageQuery(f: ReportFilters): string {
  const params = new URLSearchParams({ period: f.preset })
  if (f.preset === 'custom') {
    if (f.from) params.set('from', f.from)
    if (f.to) params.set('to', f.to)
  }
  if (f.channel) params.set('channel', f.channel)
  return params.toString()
}

/**
 * Query de /api/leads/relatorio. Devolve null enquanto o personalizado não tem
 * as duas datas — evita uma requisição que só voltaria 400.
 */
export function reportApiQuery(f: ReportFilters, now: Date = new Date()): string | null {
  const params = new URLSearchParams()
  if (API_PRESETS.includes(f.preset)) {
    params.set('period', f.preset)
  } else {
    const dates =
      f.preset === 'custom'
        ? { from: f.from, to: f.to }
        : monthShortcuts(now)[f.preset as 'thisMonth' | 'lastMonth']
    if (!dates.from || !dates.to) return null
    params.set('period', 'custom')
    params.set('from', dates.from)
    params.set('to', dates.to)
  }
  if (f.channel) params.set('channel', f.channel)
  return params.toString()
}
