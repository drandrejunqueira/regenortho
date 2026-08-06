import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computeStockStatus,
  formatCurrency,
  formatDate,
  formatDateTime,
  getInitials,
  slugify,
  timeAgo,
  toDateBR,
} from '@/lib/utils'

describe('formatCurrency', () => {
  it('formata número em BRL', () => {
    expect(formatCurrency(1234.5)).toBe('R$ 1.234,50')
  })

  it('aceita string numérica', () => {
    expect(formatCurrency('99.9')).toBe('R$ 99,90')
  })

  it('arredonda centavos corretamente', () => {
    expect(formatCurrency(10.005)).toBe('R$ 10,01')
    expect(formatCurrency(0.1 + 0.2)).toBe('R$ 0,30')
  })

  it('trata zero e negativos', () => {
    expect(formatCurrency(0)).toBe('R$ 0,00')
    expect(formatCurrency(-50)).toBe('-R$ 50,00')
  })
})

describe('formatDate', () => {
  it('data-calendário YYYY-MM-DD não desloca de dia em fuso negativo', () => {
    expect(formatDate('2026-08-06')).toBe('06/08/2026')
  })

  it('aceita objeto Date direto', () => {
    expect(formatDate(new Date(2026, 7, 6))).toBe('06/08/2026')
  })

  it('string ISO com horário usa o parser padrão do Date', () => {
    // Não é uma data-calendário pura (tem T e hora) — cai no branch genérico.
    const d = new Date('2026-08-06T12:00:00.000Z')
    expect(formatDate('2026-08-06T12:00:00.000Z')).toBe(
      d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    )
  })
})

describe('toDateBR', () => {
  it('23:59 UTC do dia 5 ainda é 5 no Brasil (fronteira antes das 03:00 UTC)', () => {
    expect(toDateBR(new Date('2026-08-05T23:59:00.000Z'))).toBe('2026-08-05')
  })

  it('a partir de 03:00 UTC já é o próximo dia no Brasil', () => {
    expect(toDateBR(new Date('2026-08-06T03:00:00.000Z'))).toBe('2026-08-06')
  })

  it('padrão sem argumento usa a data atual', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-06T15:00:00.000Z'))
    expect(toDateBR()).toBe('2026-08-06')
    vi.useRealTimers()
  })
})

describe('formatDateTime', () => {
  it('inclui data e hora formatadas em pt-BR', () => {
    const d = new Date(2026, 7, 6, 14, 30)
    expect(formatDateTime(d)).toBe(
      d.toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      }),
    )
  })
})

describe('getInitials', () => {
  it('pega a inicial das duas primeiras palavras', () => {
    expect(getInitials('Daniel Marques Silva')).toBe('DM')
  })

  it('nome de uma palavra só devolve uma inicial', () => {
    expect(getInitials('Daniel')).toBe('D')
  })

  it('ignora espaços duplicados', () => {
    expect(getInitials('  Daniel   Marques ')).toBe('DM')
  })
})

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-06T12:00:00.000Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('menos de um minuto: "agora mesmo"', () => {
    expect(timeAgo(new Date('2026-08-06T11:59:30.000Z'))).toBe('agora mesmo')
  })

  it('minutos', () => {
    expect(timeAgo(new Date('2026-08-06T11:45:00.000Z'))).toBe('há 15 min')
  })

  it('horas', () => {
    expect(timeAgo(new Date('2026-08-06T08:00:00.000Z'))).toBe('há 4h')
  })

  it('exatamente ontem', () => {
    expect(timeAgo(new Date('2026-08-05T12:00:00.000Z'))).toBe('ontem')
  })

  it('dias (menos de uma semana)', () => {
    expect(timeAgo(new Date('2026-08-02T12:00:00.000Z'))).toBe('há 4 dias')
  })

  it('uma semana ou mais cai para a data formatada', () => {
    expect(timeAgo(new Date('2026-07-30T12:00:00.000Z'))).toBe(formatDate(new Date('2026-07-30T12:00:00.000Z')))
  })
})

describe('slugify', () => {
  it('remove acentos e minusculiza', () => {
    expect(slugify('Ácido Hialurônico')).toBe('acido-hialuronico')
  })

  it('troca espaços por hífen e remove caracteres especiais', () => {
    expect(slugify('Consulta  #1 (retorno)')).toBe('consulta-1-retorno')
  })

  it('colapsa hífens duplicados', () => {
    expect(slugify('a---b')).toBe('a-b')
  })
})

describe('computeStockStatus', () => {
  it('zero é sempre "out_of_stock", mesmo com mínimo zero', () => {
    expect(computeStockStatus(0, 5)).toBe('out_of_stock')
    expect(computeStockStatus(0, 0)).toBe('out_of_stock')
  })

  it('igual ou abaixo do mínimo é "critical"', () => {
    expect(computeStockStatus(5, 5)).toBe('critical')
    expect(computeStockStatus(3, 5)).toBe('critical')
  })

  it('até 1.5x o mínimo é "low"', () => {
    expect(computeStockStatus(7, 5)).toBe('low')
    expect(computeStockStatus(7.5, 5)).toBe('low')
  })

  it('acima de 1.5x o mínimo é "ok"', () => {
    expect(computeStockStatus(8, 5)).toBe('ok')
  })
})
