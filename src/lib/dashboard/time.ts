// Datas do dashboard, sempre no fuso da clínica.
// O servidor roda em UTC na Vercel: "hoje" calculado com new Date() local
// vira amanhã depois das 21h e joga a agenda para o dia errado.
export const TZ = 'America/Sao_Paulo'

/** Dia-calendário YYYY-MM-DD no fuso da clínica. */
export function brDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
}

/** HH:mm no fuso da clínica. */
export function brTime(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(d)
}

/** Hora cheia (0-23) no fuso da clínica — decide o "bom dia / boa tarde". */
export function brHour(d: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).format(d)
  return Number(h) % 24
}

/** "terça-feira, 6 de setembro" */
export function brLongDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(d)
}

/** Âncora ao meio-dia BR de um dia-calendário (15:00 UTC). */
export function noonOf(day: string): Date {
  return new Date(`${day}T15:00:00.000Z`)
}

/** Soma dias a um YYYY-MM-DD sem passar por fuso local. */
export function addDays(day: string, n: number): string {
  const d = noonOf(day)
  d.setUTCDate(d.getUTCDate() + n)
  return brDay(d)
}

/** "seg", "ter"… para um YYYY-MM-DD. */
export function weekdayShort(day: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short' }).format(noonOf(day)).replace('.', '')
}

/** "06/09" para um YYYY-MM-DD. */
export function dayMonth(day: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' }).format(noonOf(day))
}

/**
 * Janela de busca em UTC que cobre com folga os dias [fromDay, toDay] no fuso BR.
 * O filtro fino por dia-calendário é feito em memória com brDay(), o mesmo
 * método de lib/doctorAgenda.ts — comparar timestamp sem fuso direto no SQL
 * erra a virada do dia.
 */
export function dayWindow(fromDay: string, toDay: string = fromDay): { from: Date; to: Date } {
  const from = new Date(noonOf(fromDay).getTime() - 24 * 3600_000)
  const to = new Date(noonOf(toDay).getTime() + 24 * 3600_000)
  return { from, to }
}

export interface MonthBounds {
  start: string
  end: string
  daysInMonth: number
  /** Dias restantes contando hoje. */
  daysLeft: number
  month: number
  year: number
}

export function monthBounds(day: string): MonthBounds {
  const [y, m, d] = day.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    start: `${y}-${pad(m)}-01`,
    end: `${y}-${pad(m)}-${pad(daysInMonth)}`,
    daysInMonth,
    daysLeft: daysInMonth - d + 1,
    month: m,
    year: y,
  }
}

/** Diferença inteira em dias entre dois YYYY-MM-DD (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((noonOf(b).getTime() - noonOf(a).getTime()) / 86_400_000)
}
