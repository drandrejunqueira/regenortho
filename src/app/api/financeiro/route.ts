import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { transactions } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { logActivity } from '@/lib/db/logger'
import { NextRequest, NextResponse } from 'next/server'
import { and, gte, lte, eq, desc, sql } from 'drizzle-orm'
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
  if (!hasPermission(session.user.role as UserRole, 'financial:view', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const isPaid = searchParams.get('isPaid')
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  // A aba Financeiro da ficha do paciente já chamava com ?patientId=..., mas o
  // filtro não existia — mostrava lançamentos de todos os pacientes da clínica.
  const patientId = searchParams.get('patientId')

  const conditions = []
  if (type) conditions.push(eq(transactions.type, type as 'income' | 'expense'))
  if (isPaid !== null) conditions.push(eq(transactions.isPaid, isPaid === 'true'))
  if (start) conditions.push(gte(transactions.date, start))
  if (end) conditions.push(lte(transactions.date, end))
  if (patientId) conditions.push(eq(transactions.patientId, patientId))

  const where = conditions.length ? and(...conditions) : undefined

  // Os KPIs eram somados no cliente sobre a lista já cortada em 100 linhas: a
  // partir do 101º lançamento "Receita total" e "Resultado líquido" ficavam
  // silenciosamente errados. Os totais agora vêm agregados do banco, sem limite.
  const [data, [totais]] = await Promise.all([
    db.query.transactions.findMany({
      where,
      orderBy: [desc(transactions.date)],
      with: { patient: { columns: { id: true, name: true } } },
      limit: 100,
    }),
    db
      .select({
        receitas: sql<string>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)`,
        despesas: sql<string>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end), 0)`,
        recebido: sql<string>`coalesce(sum(case when ${transactions.type} = 'income' and ${transactions.isPaid} then ${transactions.amount} else 0 end), 0)`,
        aReceber: sql<string>`coalesce(sum(case when ${transactions.type} = 'income' and not ${transactions.isPaid} then ${transactions.amount} else 0 end), 0)`,
        total: sql<number>`count(*)::int`,
      })
      .from(transactions)
      .where(where),
  ])

  return NextResponse.json({
    data,
    totais: {
      receitas: Number(totais.receitas),
      despesas: Number(totais.despesas),
      recebido: Number(totais.recebido),
      aReceber: Number(totais.aReceber),
      total: totais.total,
      // Quantos lançamentos ficaram de fora da listagem.
      naoListados: Math.max(0, totais.total - data.length),
    },
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'financial:create', session.user.customPermissions)) {
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
