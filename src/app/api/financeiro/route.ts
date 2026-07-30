import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { transactions } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { logActivity } from '@/lib/db/logger'
import { NextRequest, NextResponse } from 'next/server'
import { and, gte, lte, eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'

const createSchema = z.object({
  type: z.enum(['income', 'expense']),
  category: z.enum([
    'consultation_fee', 'prp_procedure', 'bmac_procedure', 'hyaluronic_procedure',
    'surgery_fee', 'other_income', 'rent', 'staff', 'marketing', 'materials',
    'equipment', 'utilities', 'insurance', 'accounting', 'other_expense',
  ]),
  description: z.string().min(1, 'Descrição obrigatória'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  dueDate: z.string().nullable().optional(),
  isPaid: z.boolean().default(false),
  // paidAt e paymentMethodId eram enviados pela tela de Finalizar Consulta e
  // descartados aqui em silêncio — a baixa ficava sem data e sem forma de pagamento.
  paidAt: z.string().datetime().nullable().optional(),
  paymentMethodId: z.string().uuid().nullable().optional(),
  bankAccountId: z.string().uuid().nullable().optional(),
  patientId: z.string().uuid().nullable().optional(),
  appointmentId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'financial:view')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const isPaid = searchParams.get('isPaid')
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  const conditions = []
  if (type) conditions.push(eq(transactions.type, type as 'income' | 'expense'))
  if (isPaid !== null) conditions.push(eq(transactions.isPaid, isPaid === 'true'))
  if (start) conditions.push(gte(transactions.date, start))
  if (end) conditions.push(lte(transactions.date, end))

  const data = await db.query.transactions.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: [desc(transactions.date)],
    with: { patient: { columns: { id: true, name: true } } },
    limit: 100,
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'financial:create')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  // paidAt chega como string ISO e a coluna é timestamp.
  const { paidAt, ...rest } = parsed.data
  const [tx] = await db.insert(transactions).values({
    ...rest,
    paidAt: paidAt ? new Date(paidAt) : null,
    createdById: session.user.id,
  }).returning()

  // Registra no log de auditoria
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
  await logActivity({
    userId: session.user.id,
    userName: session.user.name || session.user.email || null,
    action: 'financial:create',
    module: 'financial',
    targetId: tx.id,
    targetName: `R$ ${parseFloat(tx.amount).toFixed(2)} - ${tx.description}`,
    ip,
    details: {
      type: tx.type,
      category: tx.category,
      isPaid: tx.isPaid
    }
  })

  return NextResponse.json({ data: tx }, { status: 201 })
}
