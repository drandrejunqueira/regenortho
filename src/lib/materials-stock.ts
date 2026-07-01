import { db } from '@/lib/db'
import { materials, materialBatches } from '@/lib/db/schema'
import { computeStockStatus } from '@/lib/utils'
import { eq } from 'drizzle-orm'

/**
 * Recalcula o estoque de um material a partir dos seus lotes.
 * Só sobrescreve o estoque quando existe ao menos um lote — assim
 * materiais controlados apenas por movimentações manuais não são zerados.
 * Retorna o estoque resultante.
 */
export async function recomputeStockFromBatches(materialId: string): Promise<number | null> {
  const batches = await db.query.materialBatches.findMany({
    where: eq(materialBatches.materialId, materialId),
  })

  if (batches.length === 0) return null

  const total = batches.reduce((sum, b) => sum + (b.quantity ?? 0), 0)

  const material = await db.query.materials.findFirst({
    where: eq(materials.id, materialId),
    columns: { minimumStock: true },
  })
  const min = material?.minimumStock ?? 5

  await db
    .update(materials)
    .set({ currentStock: total, status: computeStockStatus(total, min), updatedAt: new Date() })
    .where(eq(materials.id, materialId))

  return total
}
