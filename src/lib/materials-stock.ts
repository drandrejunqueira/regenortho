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
 * Resultado de uma baixa.
 *
 * `faltou > 0` é o sinal de que o armário não tinha o que o tratamento
 * consumiu. Antes a função devolvia só o saldo e o excedente era descartado em
 * silêncio (o loop FEFO zerava os lotes e ignorava o resto; sem lotes, o
 * `GREATEST(0, ...)` clampava): a rota respondia sucesso como se a baixa
 * tivesse saído inteira e a divergência do estoque físico só aparecia no dia em
 * que faltasse insumo no procedimento.
 */
export interface ResultadoBaixa {
  /** Saldo do material depois da baixa. */
  saldo: number
  /** Unidades que realmente saíram do estoque. */
  baixado: number
  /** Unidades pedidas que não tinham lastro — 0 quando havia saldo. */
  faltou: number
}

/**
 * Converte a quantidade do item (numeric(8,3), a tela aceita passo 0,001) nas
 * unidades inteiras que as colunas de estoque comportam (`current_stock`,
 * `material_batches.quantity` e `stock_movements.quantity` são `integer`).
 *
 * Arredonda PARA CIMA de propósito: "0,4 frasco" arredondado para o mais
 * próximo virava 0 — o frasco saía do armário e nada era registrado. Frasco
 * aberto pela metade já deixou a prateleira; errar para cima mantém o saldo
 * conservador, errar para baixo faz o insumo sumir do sistema.
 */
export function unidadesDeBaixa(quantidade: number): number {
  if (!Number.isFinite(quantidade) || quantidade <= 0) return 0
  // toFixed(3) corta o ruído de ponto flutuante (2.0000000000000004 → 2) para
  // que uma quantidade já inteira não vire uma unidade a mais no ceil.
  return Math.ceil(Number(quantidade.toFixed(3)))
}

/**
 * Dá baixa de `quantidade` unidades. Havendo lotes, consome no critério FEFO
 * (primeiro a vencer, primeiro a sair); senão debita a coluna direto.
 * Devolve saldo resultante, quanto saiu de fato e quanto faltou.
 */
export async function darBaixaEstoque(materialId: string, quantidade: number): Promise<ResultadoBaixa> {
  const unidades = unidadesDeBaixa(quantidade)
  if (unidades <= 0) {
    return { saldo: (await saldoAtual(materialId)) ?? 0, baixado: 0, faltou: 0 }
  }

  if (await temLotes(materialId)) {
    // FEFO: lote com validade mais próxima sai primeiro. Lote sem validade vai
    // para o fim (nulls last), por não ter urgência conhecida.
    const lotes = await db
      .select()
      .from(materialBatches)
      .where(and(eq(materialBatches.materialId, materialId), gt(materialBatches.quantity, 0)))
      .orderBy(sql`${materialBatches.expiresAt} asc nulls last`, asc(materialBatches.createdAt))

    let restante = unidades
    for (const lote of lotes) {
      if (restante <= 0) break
      const consumir = Math.min(lote.quantity, restante)
      await db
        .update(materialBatches)
        .set({ quantity: lote.quantity - consumir, updatedAt: new Date() })
        .where(eq(materialBatches.id, lote.id))
      restante -= consumir
    }

    // O que sobrou em `restante` são unidades que os lotes não cobriram.
    return {
      saldo: (await recomputeStockFromBatches(materialId)) ?? 0,
      baixado: unidades - restante,
      faltou: restante,
    }
  }

  // Saldo anterior lido antes do UPDATE: o `GREATEST(0, ...)` impede estoque
  // negativo, mas também apaga o rastro de quanto ficou faltando.
  const antes = (await saldoAtual(materialId)) ?? 0

  const [m] = await db
    .update(materials)
    .set({ currentStock: sql`GREATEST(0, current_stock - ${unidades})`, updatedAt: new Date() })
    .where(eq(materials.id, materialId))
    .returning({ currentStock: materials.currentStock, minimumStock: materials.minimumStock })

  if (!m) return { saldo: 0, baixado: 0, faltou: unidades }
  // O status era esquecido nas baixas por tratamento: o material caía abaixo do
  // mínimo e continuava marcado como 'ok' na tela e na lista de compras.
  await db
    .update(materials)
    .set({ status: computeStockStatus(m.currentStock, m.minimumStock) })
    .where(eq(materials.id, materialId))

  const baixado = Math.max(0, antes - m.currentStock)
  return { saldo: m.currentStock, baixado, faltou: Math.max(0, unidades - baixado) }
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
