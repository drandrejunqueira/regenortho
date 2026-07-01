import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { materialBatches } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { recomputeStockFromBatches } from '@/lib/materials-stock'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'

const updateSchema = z.object({
  batchNumber: z.string().max(100).nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  quantity: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
})

type Params = { params: Promise<{ id: string; batchId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'materials:edit')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id, batchId } = await params

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (parsed.data.batchNumber !== undefined) patch.batchNumber = parsed.data.batchNumber?.trim() || null
  if (parsed.data.expiresAt !== undefined) patch.expiresAt = parsed.data.expiresAt || null
  if (parsed.data.quantity !== undefined) patch.quantity = parsed.data.quantity
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes?.trim() || null

  const [updated] = await db
    .update(materialBatches)
    .set(patch)
    .where(and(eq(materialBatches.id, batchId), eq(materialBatches.materialId, id)))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })

  await recomputeStockFromBatches(id)
  return NextResponse.json({ data: updated })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'materials:edit')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id, batchId } = await params

  const [deleted] = await db
    .delete(materialBatches)
    .where(and(eq(materialBatches.id, batchId), eq(materialBatches.materialId, id)))
    .returning()

  if (!deleted) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })

  await recomputeStockFromBatches(id)
  return NextResponse.json({ success: true })
}
