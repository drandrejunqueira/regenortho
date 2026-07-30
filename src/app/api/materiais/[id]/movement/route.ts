import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { materials, stockMovements } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'
import { computeStockStatus } from '@/lib/utils'

const schema = z.object({
  type: z.enum(['in', 'out']),
  quantity: z.number().int().positive('Quantidade deve ser positiva'),
  reason: z.string().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'materials:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const material = await db.query.materials.findFirst({ where: eq(materials.id, id) })
  if (!material) return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })

  const newStock = parsed.data.type === 'in'
    ? material.currentStock + parsed.data.quantity
    : material.currentStock - parsed.data.quantity

  if (newStock < 0) {
    return NextResponse.json({ error: 'Estoque insuficiente para saída' }, { status: 400 })
  }

  const newStatus = computeStockStatus(newStock, material.minimumStock)

  await db.insert(stockMovements).values({
    materialId: id,
    type: parsed.data.type,
    quantity: parsed.data.quantity,
    reason: parsed.data.reason,
    userId: session.user.id,
  })

  const [updated] = await db.update(materials)
    .set({ currentStock: newStock, status: newStatus, updatedAt: new Date() })
    .where(eq(materials.id, id))
    .returning()

  return NextResponse.json({ data: updated }, { status: 201 })
}
