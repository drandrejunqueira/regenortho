import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num)
}

export function formatDate(date: string | Date): string {
  // Strings no formato "YYYY-MM-DD" são datas-calendário (sem horário). new Date()
  // as interpreta como UTC meia-noite, deslocando -1 dia em fusos negativos (GMT-3).
  // Parseamos manualmente como data local para exibir o dia correto.
  if (typeof date === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
    if (m) {
      const [, y, mo, d] = m
      return new Date(Number(y), Number(mo) - 1, Number(d)).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    }
  }
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Data YYYY-MM-DD no fuso da clínica.
 *
 * `toISOString().split('T')[0]` devolve a data em UTC: depois das 21h (BRT) já
 * é o dia seguinte, então lançamentos do fim da noite entravam no financeiro
 * com a data adiantada em um dia.
 */
export function toDateBR(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date)
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('')
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'agora mesmo'
  if (diffMins < 60) return `há ${diffMins} min`
  if (diffHours < 24) return `há ${diffHours}h`
  if (diffDays === 1) return 'ontem'
  if (diffDays < 7) return `há ${diffDays} dias`
  return formatDate(d)
}

export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
}

export function computeStockStatus(current: number, minimum: number): 'ok' | 'low' | 'critical' | 'out_of_stock' {
  if (current === 0) return 'out_of_stock'
  if (current <= minimum) return 'critical'
  if (current <= minimum * 1.5) return 'low'
  return 'ok'
}


