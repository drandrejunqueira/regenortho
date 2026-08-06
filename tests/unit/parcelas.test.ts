import { describe, expect, it } from 'vitest'
import { vencimentoParcela, vencimentosParcelas } from '@/lib/parcelas'

describe('vencimentoParcela', () => {
  it('soma meses normalmente quando o dia existe no mês alvo', () => {
    const base = new Date(2026, 0, 15) // 15/jan/2026
    expect(vencimentoParcela(base, 1)).toEqual(new Date(2026, 1, 15)) // 15/fev
    expect(vencimentoParcela(base, 2)).toEqual(new Date(2026, 2, 15)) // 15/mar
  })

  it('dia 31 cai no último dia do mês alvo quando ele é mais curto (abril tem 30)', () => {
    const base = new Date(2026, 2, 31) // 31/mar/2026
    expect(vencimentoParcela(base, 1)).toEqual(new Date(2026, 3, 30)) // não vira 1/mai
  })

  it('dia 31 de janeiro cai em 28/fev num ano não-bissexto', () => {
    const base = new Date(2026, 0, 31)
    expect(vencimentoParcela(base, 1)).toEqual(new Date(2026, 1, 28))
  })

  it('dia 31 de janeiro cai em 29/fev num ano bissexto', () => {
    const base = new Date(2028, 0, 31)
    expect(vencimentoParcela(base, 1)).toEqual(new Date(2028, 1, 29))
  })

  it('índice 0 devolve a própria data-base', () => {
    const base = new Date(2026, 4, 10)
    expect(vencimentoParcela(base, 0)).toEqual(base)
  })
})

describe('vencimentosParcelas', () => {
  it('gera uma data por parcela, na ordem', () => {
    const base = new Date(2026, 0, 31)
    const datas = vencimentosParcelas(base, 4)
    expect(datas).toHaveLength(4)
    expect(datas).toEqual([
      new Date(2026, 0, 31),
      new Date(2026, 1, 28), // fev/2026 não é bissexto
      new Date(2026, 2, 31),
      new Date(2026, 3, 30), // abril não tem 31
    ])
  })

  it('total zero devolve lista vazia', () => {
    expect(vencimentosParcelas(new Date(2026, 0, 1), 0)).toEqual([])
  })
})
