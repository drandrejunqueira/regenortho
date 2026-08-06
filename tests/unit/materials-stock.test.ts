import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      materialBatches: { findMany: vi.fn() },
      materials: { findFirst: vi.fn() },
    },
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
}))

import { db } from '@/lib/db'
import { darBaixaEstoque, darEntradaEstoque, recomputeStockFromBatches } from '@/lib/materials-stock'

// Captura cada chamada a db.update em ordem, para inspecionar o `.set(...)`
// que cada uma recebeu (o mock de db.update não persiste nada de verdade).
function spyUpdates(results: unknown[] = []) {
  const calls: ReturnType<typeof chain>[] = []
  let i = 0
  ;(db.update as unknown as Mock).mockImplementation(() => {
    const c = chain(results[i])
    i += 1
    calls.push(c)
    return c
  })
  return calls
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('recomputeStockFromBatches', () => {
  it('sem lotes e sem zerarSemLotes: não mexe no material, devolve null', async () => {
    ;(db.query.materialBatches.findMany as unknown as Mock).mockResolvedValue([])
    const result = await recomputeStockFromBatches('mat-1')
    expect(result).toBeNull()
    expect(db.update).not.toHaveBeenCalled()
  })

  it('sem lotes com zerarSemLotes: zera o estoque e marca out_of_stock', async () => {
    ;(db.query.materialBatches.findMany as unknown as Mock).mockResolvedValue([])
    ;(db.query.materials.findFirst as unknown as Mock).mockResolvedValue({ minimumStock: 5 })
    const updates = spyUpdates([undefined])

    const result = await recomputeStockFromBatches('mat-1', true)
    expect(result).toBe(0)
    expect(updates[0].set).toHaveBeenCalledWith(
      expect.objectContaining({ currentStock: 0, status: 'out_of_stock' }),
    )
  })

  it('soma as quantidades dos lotes e recalcula o status', async () => {
    ;(db.query.materialBatches.findMany as unknown as Mock).mockResolvedValue([
      { quantity: 3 }, { quantity: 7 },
    ])
    ;(db.query.materials.findFirst as unknown as Mock).mockResolvedValue({ minimumStock: 5 })
    const updates = spyUpdates([undefined])

    const result = await recomputeStockFromBatches('mat-1')
    expect(result).toBe(10)
    expect(updates[0].set).toHaveBeenCalledWith(expect.objectContaining({ currentStock: 10, status: 'ok' }))
  })

  it('material não encontrado usa mínimo padrão 5 para calcular o status', async () => {
    ;(db.query.materialBatches.findMany as unknown as Mock).mockResolvedValue([{ quantity: 4 }])
    ;(db.query.materials.findFirst as unknown as Mock).mockResolvedValue(undefined)
    const updates = spyUpdates([undefined])

    const result = await recomputeStockFromBatches('mat-1')
    expect(result).toBe(4)
    // 4 <= 5 (mínimo padrão) => critical
    expect(updates[0].set).toHaveBeenCalledWith(expect.objectContaining({ status: 'critical' }))
  })
})

describe('darBaixaEstoque', () => {
  it('quantidade zero ou negativa não mexe no estoque, só devolve o saldo atual', async () => {
    ;(db.query.materials.findFirst as unknown as Mock).mockResolvedValue({ currentStock: 12 })

    expect(await darBaixaEstoque('mat-1', 0)).toBe(12)
    expect(await darBaixaEstoque('mat-1', -3)).toBe(12)
    expect(db.update).not.toHaveBeenCalled()
    expect(db.select).not.toHaveBeenCalled()
  })

  it('material sem saldo conhecido (findFirst vazio) devolve 0 para quantidade não-positiva', async () => {
    ;(db.query.materials.findFirst as unknown as Mock).mockResolvedValue(undefined)
    expect(await darBaixaEstoque('mat-1', 0)).toBe(0)
  })

  it('com lotes, consome no critério FEFO (lote mais próximo do vencimento primeiro)', async () => {
    // temLotes() → count
    ;(db.select as unknown as Mock).mockReturnValueOnce(chain([{ n: 2 }]))
    // lista de lotes ordenada por vencimento (o mock não ordena de verdade — já entra ordenada)
    const lote1 = { id: 'lote-1', quantity: 3, expiresAt: '2026-09-01' }
    const lote2 = { id: 'lote-2', quantity: 10, expiresAt: '2026-12-01' }
    ;(db.select as unknown as Mock).mockReturnValueOnce(chain([lote1, lote2]))

    const updates = spyUpdates([undefined, undefined, undefined]) // 2 baixas de lote + 1 update agregado do recompute
    ;(db.query.materialBatches.findMany as unknown as Mock).mockResolvedValue([
      { quantity: 0 }, { quantity: 8 },
    ])
    ;(db.query.materials.findFirst as unknown as Mock).mockResolvedValue({ minimumStock: 5 })

    const result = await darBaixaEstoque('mat-1', 5)

    // consome os 3 do lote-1 inteiro, depois 2 do lote-2 — nada sobra para o resto.
    expect(updates[0].set).toHaveBeenCalledWith(expect.objectContaining({ quantity: 0 }))
    expect(updates[1].set).toHaveBeenCalledWith(expect.objectContaining({ quantity: 8 }))
    expect(result).toBe(8) // saldo pós-recompute: 0 + 8
  })

  it('sem lotes, debita a coluna direto e recalcula o status', async () => {
    ;(db.select as unknown as Mock).mockReturnValueOnce(chain([{ n: 0 }])) // temLotes → false
    const updates = spyUpdates([
      [{ currentStock: 2, minimumStock: 5 }], // update com GREATEST + .returning()
      undefined, // update de status
    ])

    const result = await darBaixaEstoque('mat-1', 8)
    expect(result).toBe(2)
    // 2 <= 5 => critical — e esse update de status era o bug histórico esquecido.
    expect(updates[1].set).toHaveBeenCalledWith(expect.objectContaining({ status: 'critical' }))
  })

  it('sem lotes e material não encontrado no update devolve 0', async () => {
    ;(db.select as unknown as Mock).mockReturnValueOnce(chain([{ n: 0 }]))
    spyUpdates([[]]) // .returning() devolve array vazio → destructure [m] = undefined

    const result = await darBaixaEstoque('mat-1', 8)
    expect(result).toBe(0)
  })
})

describe('darEntradaEstoque', () => {
  it('quantidade zero ou negativa não mexe no estoque', async () => {
    ;(db.query.materials.findFirst as unknown as Mock).mockResolvedValue({ currentStock: 20 })
    expect(await darEntradaEstoque('mat-1', 0)).toBe(20)
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })

  it('material já controlado por lote: cria um novo lote e recalcula o saldo', async () => {
    ;(db.select as unknown as Mock).mockReturnValueOnce(chain([{ n: 1 }])) // temLotes → true
    const insertChain = chain(undefined)
    ;(db.insert as unknown as Mock).mockReturnValue(insertChain)
    const updates = spyUpdates([undefined])
    ;(db.query.materialBatches.findMany as unknown as Mock).mockResolvedValue([{ quantity: 15 }])
    ;(db.query.materials.findFirst as unknown as Mock).mockResolvedValue({ minimumStock: 5 })

    const result = await darEntradaEstoque('mat-1', 15, { batchNumber: 'L-001', expiresAt: '2027-01-01' })

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ materialId: 'mat-1', batchNumber: 'L-001', expiresAt: '2027-01-01', quantity: 15 }),
    )
    expect(result).toBe(15)
    expect(updates[0].set).toHaveBeenCalledWith(expect.objectContaining({ currentStock: 15 }))
  })

  it('material sem controle por lote, mas a entrada informa lote: passa a criar lotes', async () => {
    ;(db.select as unknown as Mock).mockReturnValueOnce(chain([{ n: 0 }])) // temLotes → false
    const insertChain = chain(undefined)
    ;(db.insert as unknown as Mock).mockReturnValue(insertChain)
    spyUpdates([undefined])
    ;(db.query.materialBatches.findMany as unknown as Mock).mockResolvedValue([{ quantity: 5 }])
    ;(db.query.materials.findFirst as unknown as Mock).mockResolvedValue({ minimumStock: 5 })

    await darEntradaEstoque('mat-1', 5, { batchNumber: 'L-999' })
    expect(insertChain.values).toHaveBeenCalled()
  })

  it('sem lotes e sem info de lote: credita a coluna direto e recalcula o status', async () => {
    ;(db.select as unknown as Mock).mockReturnValueOnce(chain([{ n: 0 }]))
    const updates = spyUpdates([
      [{ currentStock: 20, minimumStock: 5 }],
      undefined,
    ])

    const result = await darEntradaEstoque('mat-1', 12)
    expect(result).toBe(20)
    expect(db.insert).not.toHaveBeenCalled()
    // 20 > 5*1.5 => ok
    expect(updates[1].set).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok' }))
  })
})
