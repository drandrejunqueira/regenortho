import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { transactions, bankAccounts } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { logActivity } from '@/lib/db/logger'
import { NextRequest, NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'

const updateSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  date: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  isPaid: z.boolean().optional(),
  paidAt: z.string().datetime().nullable().optional(),
  paymentMethodId: z.string().uuid().nullable().optional(),
  bankAccountId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
})

type Params = { params: Promise<{ id: string }> }

/**
 * Ajusta o saldo da conta bancária quando os dados de um recebimento pago mudam.
 * Reverte a contribuição antiga (se paga e vinculada) e aplica a nova, de forma
 * que o saldo permaneça consistente mesmo trocando conta/valor/status.
 */
async function reconcileBalance(
  before: { isPaid: boolean; bankAccountId: string | null; amount: string },
  after: { isPaid: boolean; bankAccountId: string | null; amount: string },
) {
  if (before.isPaid && before.bankAccountId) {
    await db.update(bankAccounts)
      .set({ currentBalance: sql`current_balance - ${before.amount}`, updatedAt: new Date() })
      .where(eq(bankAccounts.id, before.bankAccountId))
  }
  if (after.isPaid && after.bankAccountId) {
    await db.update(bankAccounts)
      .set({ currentBalance: sql`current_balance + ${after.amount}`, updatedAt: new Date() })
      .where(eq(bankAccounts.id, after.bankAccountId))
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'financial:edit')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  const existing = await db.query.transactions.findFirst({ where: eq(transactions.id, id) })
  if (!existing) return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })

  // Recebimentos gerados por conclusão de tratamento só podem ser alterados por admin
  if (existing.treatmentId && session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem alterar recebimentos de tratamento' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() }
  const willBePaid = parsed.data.isPaid ?? existing.isPaid
  if (willBePaid && !existing.isPaid && parsed.data.paidAt === undefined) updateData.paidAt = new Date()
  if (parsed.data.isPaid === false) updateData.paidAt = null

  const [updated] = await db.update(transactions)
    .set(updateData)
    .where(eq(transactions.id, id))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })

  // Mantém o saldo das contas bancárias coerente após a edição
  await reconcileBalance(
    { isPaid: existing.isPaid, bankAccountId: existing.bankAccountId, amount: existing.amount },
    { isPaid: updated.isPaid, bankAccountId: updated.bankAccountId, amount: updated.amount },
  )

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

  // Recebimentos gerados por conclusão de tratamento só podem ser excluídos por admin
  if (txData.treatmentId && session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem excluir recebimentos de tratamento' }, { status: 403 })
  }

  // Estorna o saldo da conta se o recebimento estava pago e vinculado a uma conta
  if (txData.isPaid && txData.bankAccountId) {
    await db.update(bankAccounts)
      .set({ currentBalance: sql`current_balance - ${txData.amount}`, updatedAt: new Date() })
      .where(eq(bankAccounts.id, txData.bankAccountId))
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
