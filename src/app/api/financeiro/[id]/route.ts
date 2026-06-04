import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { transactions } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { logActivity } from '@/lib/db/logger'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'

const updateSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  date: z.string().optional(),
  isPaid: z.boolean().optional(),
  paidAt: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'financial:edit')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() }
  if (parsed.data.isPaid && !parsed.data.paidAt) updateData.paidAt = new Date()

  const [updated] = await db.update(transactions)
    .set(updateData)
    .where(eq(transactions.id, id))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })

  // Registra no log de auditoria
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
  await logActivity({
    userId: session.user.id,
    userName: session.user.name || session.user.email || null,
    action: 'financial:edit',
    module: 'financial',
    targetId: updated.id,
    targetName: `R$ ${parseFloat(updated.amount).toFixed(2)} - ${updated.description}`,
    ip,
    details: {
      type: updated.type,
      category: updated.category,
      isPaid: updated.isPaid
    }
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'financial:delete')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  // Get details before deleting for logs
  const txData = await db.query.transactions.findFirst({
    where: eq(transactions.id, id)
  })

  if (!txData) {
    return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })
  }

  await db.delete(transactions).where(eq(transactions.id, id))

  // Registra no log de auditoria
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
  await logActivity({
    userId: session.user.id,
    userName: session.user.name || session.user.email || null,
    action: 'financial:delete',
    module: 'financial',
    targetId: id,
    targetName: `R$ ${parseFloat(txData.amount).toFixed(2)} - ${txData.description}`,
    ip,
    details: {
      type: txData.type,
      category: txData.category
    }
  })

  return NextResponse.json({ success: true })
}
