import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { materials } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'
import { computeStockStatus } from '@/lib/utils'

const createSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  category: z.string().min(1),
  unit: z.string().min(1),
  currentStock: z.number().int().min(0).default(0),
  minimumStock: z.number().int().min(0).default(5),
  unitCost: z.string().nullable().optional(),
  supplier: z.string().nullable().optional(),
  supplierContact: z.string().nullable().optional(),
  batchNumber: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'materials:view')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const conditions = []
  if (status) conditions.push(eq(materials.status, status as 'ok' | 'low' | 'critical' | 'out_of_stock'))

  const data = await db.query.materials.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: (m, { asc }) => [asc(m.name)],
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'materials:create')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const stock = parsed.data.currentStock ?? 0
  const min = parsed.data.minimumStock ?? 5
  const status = computeStockStatus(stock, min)

  const [material] = await db.insert(materials).values({ ...parsed.data, status }).returning()
  return NextResponse.json({ data: material }, { status: 201 })
}


