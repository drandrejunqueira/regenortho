import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import {
  purchaseOrders, purchaseOrderItems,
  materials, stockMovements, transactions,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'

const itemSchema = z.object({
  materialId: z.string().uuid(),
  quantity:   z.number().int().positive(),
  unitCost:   z.number().nonnegative(),
  notes:      z.string().optional().nullable(),
})

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action:       z.literal('update'),
    supplier:     z.string().min(1).max(255).optional(),
    orderDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    notes:        z.string().nullable().optional(),
    items:        z.array(itemSchema).min(1).optional(),
  }),
  z.object({ action: z.literal('send') }),
  z.object({
    action:       z.literal('receive'),
    receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  z.object({ action: z.literal('cancel') }),
])

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'materials:view', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const order = await db.query.purchaseOrders.findFirst({
    where: eq(purchaseOrders.id, id),
    with: {
      items: { with: { material: { columns: { id: true, name: true, unit: true, unitCost: true } } } },
      createdBy: { columns: { id: true, name: true } },
    },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: order })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'materials:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const order = await db.query.purchaseOrders.findFirst({
    where: eq(purchaseOrders.id, id),
    with: { items: true },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const data = parsed.data

  if (data.action === 'update') {
    if (order.status !== 'draft') return NextResponse.json({ error: 'Apenas rascunhos podem ser editados' }, { status: 409 })

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.supplier     !== undefined) updates.supplier     = data.supplier
    if (data.orderDate    !== undefined) updates.orderDate    = data.orderDate
    if (data.expectedDate !== undefined) updates.expectedDate = data.expectedDate ?? null
    if (data.notes        !== undefined) updates.notes        = data.notes ?? null

    if (data.items) {
      const total = data.items.reduce((s, i) => s + i.quantity * i.unitCost, 0)
      updates.totalAmount = String(total.toFixed(2))
      await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id))
      await db.insert(purchaseOrderItems).values(
        data.items.map((item) => ({
          purchaseOrderId: id,
          materialId:      item.materialId,
          quantity:        item.quantity,
          unitCost:        String(item.unitCost.toFixed(2)),
          total:           String((item.quantity * item.unitCost).toFixed(2)),
          notes:           item.notes ?? null,
        }))
      )
    }

    await db.update(purchaseOrders)
      .set(updates as Parameters<typeof db.update>[0] extends infer T ? never : never)
      .where(eq(purchaseOrders.id, id))
  }

  if (data.action === 'send') {
    if (order.status !== 'draft') return NextResponse.json({ error: 'Pedido já foi enviado ou encerrado' }, { status: 409 })
    await db.update(purchaseOrders).set({ status: 'ordered', updatedAt: new Date() }).where(eq(purchaseOrders.id, id))
  }

  if (data.action === 'receive') {
    // 'receive' credita estoque E lança uma despesa paga no financeiro, então
    // exige também permissão financeira além de materials:edit.
    if (!hasPermission(session.user.role as UserRole, 'financial:create', session.user.customPermissions)) {
      return NextResponse.json({ error: 'Sem permissão para lançar a despesa do recebimento' }, { status: 403 })
    }
    if (order.status !== 'ordered' && order.status !== 'draft') {
      return NextResponse.json({ error: 'Pedido não pode ser recebido neste status' }, { status: 409 })
    }

    const receivedDate = data.receivedDate ?? new Date().toISOString().slice(0, 10)

    for (const item of order.items) {
      await db.insert(stockMovements).values({
        materialId: item.materialId,
        type:       'in',
        quantity:   item.quantity,
        reason:     `Compra — ${order.supplier}`,
        userId:     session.user.id,
      })

      const mat = await db.query.materials.findFirst({ where: eq(materials.id, item.materialId) })
      if (mat) {
        await db.update(materials).set({
          currentStock: mat.currentStock + item.quantity,
          unitCost:     item.unitCost,
          supplier:     order.supplier,
          updatedAt:    new Date(),
        }).where(eq(materials.id, item.materialId))
      }
    }

    const [tx] = await db.insert(transactions).values({
      type:        'expense',
      category:    'materials',
      description: `Compra de materiais — ${order.supplier}`,
      amount:      order.totalAmount,
      date:        receivedDate,
      isPaid:      true,
      paidAt:      new Date(),
      notes:       order.notes ?? null,
      createdById: session.user.id,
    }).returning()

    await db.update(purchaseOrders).set({
      status:        'received',
      receivedDate,
      transactionId: tx.id,
      updatedAt:     new Date(),
    }).where(eq(purchaseOrders.id, id))
  }

  if (data.action === 'cancel') {
    if (order.status === 'received') return NextResponse.json({ error: 'Pedidos recebidos não podem ser cancelados' }, { status: 409 })
    await db.update(purchaseOrders).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(purchaseOrders.id, id))
  }

  const updated = await db.query.purchaseOrders.findFirst({
    where: eq(purchaseOrders.id, id),
    with: {
      items: { with: { material: { columns: { id: true, name: true, unit: true, unitCost: true } } } },
      createdBy: { columns: { id: true, name: true } },
    },
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'materials:delete', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const order = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, id) })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.status !== 'draft') return NextResponse.json({ error: 'Apenas rascunhos podem ser excluídos' }, { status: 409 })

  await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id))
  return NextResponse.json({ success: true })
}
