import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { materialBatches, materials } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { recomputeStockFromBatches } from '@/lib/materials-stock'
import { NextRequest, NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'

const createSchema = z.object({
  batchNumber: z.string().max(100).nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  quantity: z.number().int().min(0).default(0),
  notes: z.string().nullable().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'materials:view', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  const data = await db.query.materialBatches.findMany({
    where: eq(materialBatches.materialId, id),
    orderBy: (b) => [asc(b.expiresAt)],
  })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'materials:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  const material = await db.query.materials.findFirst({ where: eq(materials.id, id) })
  if (!material) return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const [batch] = await db
    .insert(materialBatches)
    .values({
      materialId: id,
      batchNumber: parsed.data.batchNumber?.trim() || null,
      expiresAt: parsed.data.expiresAt || null,
      quantity: parsed.data.quantity ?? 0,
      notes: parsed.data.notes?.trim() || null,
    })
    .returning()

  await recomputeStockFromBatches(id)
  return NextResponse.json({ data: batch }, { status: 201 })
}
