/**
 * Janelas de tempo do CRM de Leads.
 *
 * O quadro carregava o funil inteiro de uma vez e o servidor cortava em 200 sem
 * avisar: a partir do 201º card os mais antigos sumiam da tela e a recepção
 * achava que tinham sido excluídos. Recortar por período mantém a consulta leve
 * e, junto com `meta.truncated`, deixa visível quando ainda há lead fora da
 * janela — em vez de esconder em silêncio.
 */
import { toDateBR } from '@/lib/utils'

export const LEAD_PERIODS = ['today', '7d', '15d', '30d', 'custom', 'all'] as const
export type LeadPeriod = (typeof LEAD_PERIODS)[number]

/** Preset da tela. `all` fica de fora: é escolha explícita, não padrão. */
export const DEFAULT_LEAD_PERIOD: LeadPeriod = '30d'

export const LEAD_PERIOD_LABELS: Record<LeadPeriod, string> = {
  today: 'Hoje',
  '7d': '7 dias',
  '15d': '15 dias',
  '30d': '30 dias',
  custom: 'Personalizado',
  all: 'Tudo',
}

/** Dias corridos de cada preset, contando o dia de hoje. */
const PERIOD_DAYS: Partial<Record<LeadPeriod, number>> = {
  today: 1,
  '7d': 7,
  '15d': 15,
  '30d': 30,
}

export function isLeadPeriod(value: string | null | undefined): value is LeadPeriod {
  return !!value && (LEAD_PERIODS as readonly string[]).includes(value)
}

/**
 * Período da query string.
 *
 * O `fallback` existe porque cliente e servidor querem padrões diferentes: a
 * tela abre em 30 dias, mas a rota sem `period` precisa honrar `from`/`to`
 * soltos — era o contrato antes deste filtro existir.
 */
export function parseLeadPeriod(
  value: string | null | undefined,
  fallback: LeadPeriod = 'custom',
): LeadPeriod {
  return isLeadPeriod(value) ? value : fallback
}

export interface LeadDateRange {
  from: string
  to: string
}

/**
 * Janela YYYY-MM-DD no fuso da clínica para um preset de dias.
 *
 * Devolve null para `custom` e `all`, que não têm janela própria: o primeiro usa
 * as datas escolhidas na tela, o segundo não recorta nada.
 *
 * A aritmética é ancorada ao meio-dia UTC do dia corrente em São Paulo. Somar
 * dias sobre um `Date` no fuso local erraria a borda para quem operasse de outro
 * fuso, e o meio-dia deixa 12h de folga contra qualquer offset.
 */
export function resolveLeadPeriodRange(
  period: LeadPeriod,
  now: Date = new Date(),
): LeadDateRange | null {
  const days = PERIOD_DAYS[period]
  if (!days) return null

  const to = toDateBR(now)
  const anchor = new Date(`${to}T12:00:00.000Z`)
  anchor.setUTCDate(anchor.getUTCDate() - (days - 1))
  return { from: anchor.toISOString().slice(0, 10), to }
}
