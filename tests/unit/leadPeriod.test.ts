import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LEAD_PERIOD,
  isLeadPeriod,
  parseLeadPeriod,
  resolveLeadPeriodRange,
} from '@/lib/leadPeriod'

// A janela decide QUAIS leads o quadro carrega. Errar a borda por um dia esconde
// os leads de hoje (se o fim ficar em ontem) ou infla a consulta sem necessidade.
describe('resolveLeadPeriodRange', () => {
  const meioDia = new Date('2026-08-28T12:00:00.000Z') // 09h BRT

  it('hoje é uma janela de um dia só', () => {
    expect(resolveLeadPeriodRange('today', meioDia)).toEqual({
      from: '2026-08-28',
      to: '2026-08-28',
    })
  })

  it('os presets contam o dia de hoje dentro da janela', () => {
    // 7 dias = hoje + os 6 anteriores. Contar 7 para trás daria 8 dias na tela.
    expect(resolveLeadPeriodRange('7d', meioDia)).toEqual({
      from: '2026-08-22',
      to: '2026-08-28',
    })
    expect(resolveLeadPeriodRange('15d', meioDia)).toEqual({
      from: '2026-08-14',
      to: '2026-08-28',
    })
    expect(resolveLeadPeriodRange('30d', meioDia)).toEqual({
      from: '2026-07-30',
      to: '2026-08-28',
    })
  })

  it('a janela atravessa a virada do mês', () => {
    expect(resolveLeadPeriodRange('7d', new Date('2026-09-02T12:00:00.000Z'))).toEqual({
      from: '2026-08-27',
      to: '2026-09-02',
    })
  })

  it('usa o dia da clínica, não o dia em UTC', () => {
    // 23h de 28/08 em BRT já é 29/08 em UTC. Ancorar em UTC empurraria a janela
    // um dia para frente e o lead cadastrado agora cairia fora dela.
    const noiteBRT = new Date('2026-08-29T02:00:00.000Z')
    expect(resolveLeadPeriodRange('today', noiteBRT)).toEqual({
      from: '2026-08-28',
      to: '2026-08-28',
    })
  })

  it('custom e all não têm janela própria', () => {
    // `custom` usa as datas da tela; `all` não recorta. Devolver uma janela aqui
    // sobrescreveria a escolha do usuário.
    expect(resolveLeadPeriodRange('custom', meioDia)).toBeNull()
    expect(resolveLeadPeriodRange('all', meioDia)).toBeNull()
  })
})

describe('parseLeadPeriod', () => {
  it('aceita os presets conhecidos', () => {
    expect(parseLeadPeriod('today')).toBe('today')
    expect(parseLeadPeriod('30d')).toBe('30d')
    expect(parseLeadPeriod('all')).toBe('all')
  })

  it('cai no fallback com valor ausente ou desconhecido', () => {
    // O fallback padrão é `custom` para que uma query sem `period` continue
    // honrando `from`/`to` — contrato anterior ao filtro de tempo.
    expect(parseLeadPeriod(null)).toBe('custom')
    expect(parseLeadPeriod('90d')).toBe('custom')
    expect(parseLeadPeriod('')).toBe('custom')
    expect(parseLeadPeriod(undefined, DEFAULT_LEAD_PERIOD)).toBe('30d')
  })

  it('isLeadPeriod rejeita valor fora do conjunto', () => {
    expect(isLeadPeriod('7d')).toBe(true)
    expect(isLeadPeriod('7')).toBe(false)
    expect(isLeadPeriod(null)).toBe(false)
  })
})
