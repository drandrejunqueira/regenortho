import { db } from '@/lib/db'
import { materials, materialBatches } from '@/lib/db/schema'
import { computeStockStatus } from '@/lib/utils'
import { and, asc, eq, gt, sql } from 'drizzle-orm'

/**
 * Regra do estoque: quando o material tem lotes, o saldo é DERIVADO da soma
 * deles. Por isso toda entrada e toda saída precisa incidir sobre os lotes —
 * senão o próximo recálculo (que roda a cada criação/edição/exclusão de lote)
 * apagava a baixa do tratamento e a entrada da compra, restaurando um saldo
 * que já tinha sido consumido.
 *
 * Material sem lote continua com o saldo movimentado direto na coluna.
 */

/**
 * Recalcula o estoque de um material a partir dos seus lotes.
 * Só sobrescreve o estoque quando existe ao menos um lote — assim
 * materiais controlados apenas por movimentações manuais não são zerados.
 *
 * `zerarSemLotes` é usado na exclusão do último lote: ali "não há lotes"
 * significa saldo zero, e não "material sem controle por lote". Sem isso o
 * material ficava com o estoque fantasma do lote apagado.
 */
export async function recomputeStockFromBatches(
  materialId: string,
  zerarSemLotes = false,
): Promise<number | null> {
  const batches = await db.query.materialBatches.findMany({
    where: eq(materialBatches.materialId, materialId),
  })

  if (batches.length === 0 && !zerarSemLotes) return null

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

async function temLotes(materialId: string): Promise<boolean> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(materialBatches)
    .where(eq(materialBatches.materialId, materialId))
  return n > 0
}

/**
 * Dá baixa de `quantidade` unidades. Havendo lotes, consome no critério FEFO
 * (primeiro a vencer, primeiro a sair); senão debita a coluna direto.
 * Retorna o saldo resultante.
 */
export async function darBaixaEstoque(materialId: string, quantidade: number): Promise<number> {
  if (quantidade <= 0) return (await saldoAtual(materialId)) ?? 0

  if (await temLotes(materialId)) {
    // FEFO: lote com validade mais próxima sai primeiro. Lote sem validade vai
    // para o fim (nulls last), por não ter urgência conhecida.
    const lotes = await db
      .select()
      .from(materialBatches)
      .where(and(eq(materialBatches.materialId, materialId), gt(materialBatches.quantity, 0)))
      .orderBy(sql`${materialBatches.expiresAt} asc nulls last`, asc(materialBatches.createdAt))

    let restante = quantidade
    for (const lote of lotes) {
      if (restante <= 0) break
      const consumir = Math.min(lote.quantity, restante)
      await db
        .update(materialBatches)
        .set({ quantity: lote.quantity - consumir, updatedAt: new Date() })
        .where(eq(materialBatches.id, lote.id))
      restante -= consumir
    }

    return (await recomputeStockFromBatches(materialId)) ?? 0
  }

  const [m] = await db
    .update(materials)
    .set({ currentStock: sql`GREATEST(0, current_stock - ${quantidade})`, updatedAt: new Date() })
    .where(eq(materials.id, materialId))
    .returning({ currentStock: materials.currentStock, minimumStock: materials.minimumStock })

  if (!m) return 0
  // O status era esquecido nas baixas por tratamento: o material caía abaixo do
  // mínimo e continuava marcado como 'ok' na tela e na lista de compras.
  await db
    .update(materials)
    .set({ status: computeStockStatus(m.currentStock, m.minimumStock) })
    .where(eq(materials.id, materialId))

  return m.currentStock
}

/**
 * Dá entrada de `quantidade` unidades. Havendo lotes, cria um novo lote (a
 * entrada tem número e validade próprios); senão credita a coluna direto.
 */
export async function darEntradaEstoque(
  materialId: string,
  quantidade: number,
  lote?: { batchNumber?: string | null; expiresAt?: string | null },
): Promise<number> {
  if (quantidade <= 0) return (await saldoAtual(materialId)) ?? 0

  if ((await temLotes(materialId)) || lote?.batchNumber || lote?.expiresAt) {
    await db.insert(materialBatches).values({
      materialId,
      batchNumber: lote?.batchNumber?.trim() || null,
      expiresAt: lote?.expiresAt || null,
      quantity: quantidade,
    })
    return (await recomputeStockFromBatches(materialId)) ?? 0
  }

  const [m] = await db
    .update(materials)
    .set({ currentStock: sql`current_stock + ${quantidade}`, updatedAt: new Date() })
    .where(eq(materials.id, materialId))
    .returning({ currentStock: materials.currentStock, minimumStock: materials.minimumStock })

  if (!m) return 0
  await db
    .update(materials)
    .set({ status: computeStockStatus(m.currentStock, m.minimumStock) })
    .where(eq(materials.id, materialId))

  return m.currentStock
}

async function saldoAtual(materialId: string): Promise<number | null> {
  const m = await db.query.materials.findFirst({
    where: eq(materials.id, materialId),
    columns: { currentStock: true },
  })
  return m?.currentStock ?? null
}
