import { describe, expect, it } from 'vitest'
import { EMPTY_FILTERS, countActiveFilters, type LeadFilterState } from '@/components/leads/LeadFilters'

// O contador alimenta o rótulo "Limpar (N)" e a decisão de mostrar o estado
// vazio "nenhum lead com esses filtros". Errar aqui esconde o botão que tira o
// usuário de um quadro vazio.
describe('countActiveFilters', () => {
  const withFilters = (patch: Partial<LeadFilterState>): LeadFilterState => ({
    ...EMPTY_FILTERS,
    ...patch,
  })

  it('sem filtro nenhum devolve zero', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0)
  })

  it('busca só de espaços não conta como filtro ativo', () => {
    expect(countActiveFilters(withFilters({ search: '   ' }))).toBe(0)
  })

  it('cada tag selecionada conta separadamente', () => {
    expect(countActiveFilters(withFilters({ tags: ['Convênio', 'Urgente'] }))).toBe(2)
  })

  it('período personalizado conta como um só filtro, mesmo com as duas pontas preenchidas', () => {
    expect(
      countActiveFilters(withFilters({ period: 'custom', from: '2026-08-01', to: '2026-08-31' })),
    ).toBe(1)
    expect(countActiveFilters(withFilters({ period: 'custom', from: '2026-08-01' }))).toBe(1)
  })

  it('o preset padrão de 30 dias não conta como filtro ativo', () => {
    // Se contasse, o quadro abriria com "Limpar (1)" sem o usuário ter mexido em
    // nada — e limpar devolveria exatamente o mesmo recorte.
    expect(countActiveFilters(withFilters({ period: '30d' }))).toBe(0)
  })

  it('cada preset diferente do padrão conta como um filtro', () => {
    for (const period of ['today', '7d', '15d', 'all'] as const) {
      expect(countActiveFilters(withFilters({ period }))).toBe(1)
    }
  })

  it('personalizado sem datas não conta — não recorta nada', () => {
    expect(countActiveFilters(withFilters({ period: 'custom' }))).toBe(0)
  })

  it('personalizado não soma duas vezes o recorte de tempo', () => {
    // O preset e as datas descrevem o MESMO filtro na cabeça do usuário.
    expect(countActiveFilters(withFilters({ period: 'custom', from: '2026-08-01' }))).toBe(1)
  })

  it('soma filtros de tipos diferentes', () => {
    const f = withFilters({
      search: 'maria',
      tags: ['Urgente'],
      source: 'google_ads',
      assignedTo: 'none',
      period: 'custom',
      from: '2026-08-01',
    })
    expect(countActiveFilters(f)).toBe(5)
  })
})
