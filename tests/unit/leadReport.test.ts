import { describe, expect, it } from 'vitest'
import { channelOfSource } from '@/lib/leadChannels'
import {
  buildLeadReport,
  monthShortcuts,
  previousRange,
  rangeBounds,
  resolveReportRange,
  type ReportLeadRow,
  type ReportRange,
} from '@/lib/leadReport'
import { parseReportFilters, reportApiQuery, reportPageQuery } from '@/lib/leadReportFilters'

// 15/10/2026 às 09h em Brasília.
const NOW = new Date('2026-10-15T12:00:00.000Z')

function row(over: Partial<ReportLeadRow> = {}): ReportLeadRow {
  return {
    source: 'google_ads',
    status: 'new',
    createdAt: new Date('2026-10-10T15:00:00.000Z'),
    specialty: null,
    ...over,
  }
}

const OCT_1_TO_15: ReportRange = { from: '2026-10-01', to: '2026-10-15', days: 15 }

describe('channelOfSource', () => {
  it('agrupa as origens nos três canais', () => {
    expect(channelOfSource('google_organic')).toBe('google')
    expect(channelOfSource('meta_ads')).toBe('instagram')
    expect(channelOfSource('facebook_organic')).toBe('instagram')
    expect(channelOfSource('whatsapp')).toBe('outros')
  })

  it('origem desconhecida cai em outros em vez de sumir do total', () => {
    expect(channelOfSource('tiktok_ads')).toBe('outros')
  })
})

describe('resolveReportRange', () => {
  it('7 dias termina hoje e conta o dia corrente', () => {
    expect(resolveReportRange('7d', null, null, NOW)).toEqual({
      ok: true,
      range: { from: '2026-10-09', to: '2026-10-15', days: 7 },
    })
  })

  it('preset ignora datas soltas na query', () => {
    const r = resolveReportRange('today', '2020-01-01', '2030-01-01', NOW)
    expect(r).toEqual({ ok: true, range: { from: '2026-10-15', to: '2026-10-15', days: 1 } })
  })

  it('personalizado usa as datas escolhidas', () => {
    expect(resolveReportRange('custom', '2026-09-01', '2026-09-30', NOW)).toEqual({
      ok: true,
      range: { from: '2026-09-01', to: '2026-09-30', days: 30 },
    })
  })

  it('recusa "Tudo": sem janela fechada não há período anterior', () => {
    expect(resolveReportRange('all', null, null, NOW).ok).toBe(false)
  })

  it('recusa personalizado incompleto, invertido ou maior que um ano', () => {
    expect(resolveReportRange('custom', '2026-09-01', null, NOW).ok).toBe(false)
    expect(resolveReportRange('custom', '2026-09-30', '2026-09-01', NOW).ok).toBe(false)
    expect(resolveReportRange('custom', '2025-01-01', '2026-06-30', NOW).ok).toBe(false)
    expect(resolveReportRange('custom', '01/09/2026', '2026-09-30', NOW).ok).toBe(false)
  })
})

describe('previousRange / rangeBounds', () => {
  it('período anterior tem o mesmo tamanho e termina na véspera', () => {
    expect(previousRange(OCT_1_TO_15)).toEqual({ from: '2026-09-16', to: '2026-09-30', days: 15 })
  })

  it('bordas cobrem o dia inteiro em horário de Brasília', () => {
    const { start, end } = rangeBounds(OCT_1_TO_15)
    expect(start.toISOString()).toBe('2026-10-01T03:00:00.000Z')
    expect(end.toISOString()).toBe('2026-10-16T02:59:59.999Z')
  })
})

describe('monthShortcuts', () => {
  it('este mês vai do dia 1 até hoje; mês passado é o mês inteiro', () => {
    expect(monthShortcuts(NOW)).toEqual({
      thisMonth: { from: '2026-10-01', to: '2026-10-15' },
      lastMonth: { from: '2026-09-01', to: '2026-09-30' },
    })
  })

  it('em janeiro o mês passado é dezembro do ano anterior', () => {
    expect(monthShortcuts(new Date('2027-01-10T12:00:00.000Z')).lastMonth).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    })
  })
})

describe('buildLeadReport', () => {
  const rows = [
    row({ source: 'google_ads', status: 'scheduled', specialty: 'Joelho' }),
    row({ source: 'google_organic', status: 'active_patient' }),
    row({ source: 'meta_ads', status: 'lost', specialty: '  ' }),
    row({ source: 'instagram_organic', status: 'attended' }),
    row({ source: 'whatsapp', status: 'new', specialty: 'Joelho' }),
  ]

  it('totaliza por canal na ordem fixa, com participação', () => {
    const r = buildLeadReport(rows, OCT_1_TO_15, 4)
    expect(r.total).toBe(5)
    expect(r.byChannel).toEqual([
      { channel: 'google', total: 2, share: 0.4 },
      { channel: 'instagram', total: 2, share: 0.4 },
      { channel: 'outros', total: 1, share: 0.2 },
    ])
  })

  it('canal sem lead aparece com zero em vez de sumir', () => {
    const r = buildLeadReport([row()], OCT_1_TO_15, 0)
    expect(r.byChannel.map((c) => c.total)).toEqual([1, 0, 0])
  })

  it('compara com o período anterior', () => {
    expect(buildLeadReport(rows, OCT_1_TO_15, 4).previous.deltaPct).toBe(25)
    expect(buildLeadReport(rows, OCT_1_TO_15, 0).previous.deltaPct).toBeNull()
  })

  it('"agendaram" conta quem está em agendado, compareceu ou paciente', () => {
    const r = buildLeadReport(rows, OCT_1_TO_15, 0)
    expect(r.scheduled).toEqual({ total: 3, share: 0.6 })
    expect(r.patients).toEqual({ total: 1, share: 0.2 })
  })

  it('situação lista todas as etapas do funil na ordem, mesmo vazias', () => {
    const r = buildLeadReport([row({ status: 'contacted' })], OCT_1_TO_15, 0)
    expect(r.byStatus.map((s) => s.status)).toEqual([
      'new',
      'contacted',
      'scheduled',
      'attended',
      'active_patient',
      'lost',
    ])
    expect(r.byStatus[1].total).toBe(1)
  })

  it('série diária cobre todos os dias, com zero nos dias sem lead', () => {
    const r = buildLeadReport(rows, OCT_1_TO_15, 0)
    expect(r.series.granularity).toBe('day')
    expect(r.series.points).toHaveLength(15)
    const dia10 = r.series.points.find((p) => p.key === '2026-10-10')
    expect(dia10).toMatchObject({ google: 2, instagram: 2, outros: 1, total: 5 })
    expect(r.series.points[0]).toMatchObject({ key: '2026-10-01', total: 0 })
  })

  it('lead das 22h de Brasília conta no próprio dia, não no seguinte', () => {
    // 01:00 UTC do dia 06 = 22:00 de 05/10 em Brasília.
    const r = buildLeadReport(
      [row({ createdAt: new Date('2026-10-06T01:00:00.000Z') })],
      OCT_1_TO_15,
      0
    )
    expect(r.series.points.find((p) => p.key === '2026-10-05')?.total).toBe(1)
    expect(r.series.points.find((p) => p.key === '2026-10-06')?.total).toBe(0)
  })

  it('períodos longos agrupam a série por mês', () => {
    const range: ReportRange = { from: '2026-01-01', to: '2026-06-30', days: 181 }
    const r = buildLeadReport([row({ createdAt: new Date('2026-03-15T15:00:00.000Z') })], range, 0)
    expect(r.series.granularity).toBe('month')
    expect(r.series.points.map((p) => p.key)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
    ])
    expect(r.series.points[2].total).toBe(1)
  })

  it('interesse ignora vazios e ordena por volume', () => {
    const r = buildLeadReport(rows, OCT_1_TO_15, 0)
    expect(r.bySpecialty).toEqual([{ name: 'Joelho', total: 2 }])
  })

  it('a cauda dos interesses vira "Outras"', () => {
    const many = Array.from({ length: 10 }, (_, i) => row({ specialty: `e${i}` }))
    const r = buildLeadReport(many, OCT_1_TO_15, 0)
    expect(r.bySpecialty).toHaveLength(8)
    expect(r.bySpecialty.at(-1)).toEqual({ name: 'Outras', total: 3 })
  })
})

describe('filtros da tela', () => {
  it('abre no mesmo recorte do CRM e troca "Tudo" por 30 dias', () => {
    expect(parseReportFilters({ period: '7d', channel: 'google' })).toEqual({
      preset: '7d',
      from: '',
      to: '',
      channel: 'google',
    })
    expect(parseReportFilters({ period: 'all' }).preset).toBe('30d')
    expect(parseReportFilters({ channel: 'tiktok' }).channel).toBe('')
  })

  it('atalho de mês vira datas fechadas na API, mas fica como preset na URL', () => {
    const f = parseReportFilters({ period: 'lastMonth' })
    expect(reportApiQuery(f, NOW)).toBe('period=custom&from=2026-09-01&to=2026-09-30')
    expect(reportPageQuery(f)).toBe('period=lastMonth')
  })

  it('personalizado sem as duas datas não dispara requisição', () => {
    expect(
      reportApiQuery(parseReportFilters({ period: 'custom', from: '2026-10-01' }), NOW)
    ).toBeNull()
  })
})
