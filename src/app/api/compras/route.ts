import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { purchaseOrders, purchaseOrderItems } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'

const itemSchema = z.object({
  materialId: z.string().uuid(),
  quantity:   z.number().int().positive(),
  unitCost:   z.number().nonnegative(),
  notes:      z.string().optional(),
})

const createSchema = z.object({
  supplier:     z.string().min(1).max(255),
  orderDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes:        z.string().optional().nullable(),
  items:        z.array(itemSchema).min(1, 'Adicione ao menos 1 item'),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'materials:view', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const rows = await db.query.purchaseOrders.findMany({
    orderBy: [desc(purchaseOrders.createdAt)],
    with: {
      items: { with: { material: { columns: { id: true, name: true, unit: true, unitCost: true } } } },
      createdBy: { columns: { id: true, name: true } },
    },
  })

  return NextResponse.json({ data: rows })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'materials:create', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { supplier, orderDate, expectedDate, notes, items } = parsed.data
  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0)

  const [order] = await db
    .insert(purchaseOrders)
    .values({
      supplier,
      orderDate,
      expectedDate:  expectedDate ?? null,
      notes:         notes ?? null,
      totalAmount:   String(totalAmount.toFixed(2)),
      createdById:   session.user.id,
    })
    .returning()

  await db.insert(purchaseOrderItems).values(
    items.map((item) => ({
      purchaseOrderId: order.id,
      materialId:      item.materialId,
      quantity:        item.quantity,
      unitCost:        String(item.unitCost.toFixed(2)),
      total:           String((item.quantity * item.unitCost).toFixed(2)),
      notes:           item.notes ?? null,
    }))
  )

  const full = await db.query.purchaseOrders.findFirst({
    where: eq(purchaseOrders.id, order.id),
    with: {
      items: { with: { material: { columns: { id: true, name: true, unit: true, unitCost: true } } } },
    },
  })

  return NextResponse.json({ data: full }, { status: 201 })
}
