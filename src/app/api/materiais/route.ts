import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { materials, materialCategories, materialBatches } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'
import { computeStockStatus } from '@/lib/utils'

const createSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  category: z.string().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  subcategoryId: z.string().uuid().nullable().optional(),
  unit: z.string().min(1),
  currentStock: z.number().int().min(0).default(0),
  minimumStock: z.number().int().min(0).default(5),
  unitCost: z.string().nullable().optional(),
  laboratory: z.string().nullable().optional(),
  supplier: z.string().nullable().optional(),
  supplierContact: z.string().nullable().optional(),
  batchNumber: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
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

  const rows = await db.query.materials.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: (m, { asc }) => [asc(m.name)],
    with: {
      batches: true,
      categoryRef: { columns: { name: true } },
      subcategoryRef: { columns: { name: true } },
    },
  })

  const data = rows.map(({ categoryRef, subcategoryRef, ...m }) => ({
    ...m,
    categoryName: categoryRef?.name ?? m.category ?? null,
    subcategoryName: subcategoryRef?.name ?? null,
  }))

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

  // A coluna `category` (texto) é obrigatória — se não veio no payload,
  // deriva do nome da categoria selecionada para manter compatibilidade.
  let categoryName = parsed.data.category?.trim() || ''
  if (!categoryName && parsed.data.categoryId) {
    const cat = await db.query.materialCategories.findFirst({
      where: eq(materialCategories.id, parsed.data.categoryId),
      columns: { name: true },
    })
    categoryName = cat?.name ?? 'Outros'
  }
  if (!categoryName) categoryName = 'Outros'

  const [material] = await db
    .insert(materials)
    .values({ ...parsed.data, category: categoryName, status })
    .returning()

  // O lote informado no cadastro também vira uma linha em material_batches —
  // é de lá que a tela de edição lê os lotes. Sem isto o número digitado ficava
  // só na coluna do material e "sumia" ao reabrir o cadastro.
  // A quantidade espelha o estoque inicial, então o total dos lotes continua
  // batendo com currentStock (nada a recalcular).
  if (parsed.data.batchNumber?.trim() || parsed.data.expiresAt) {
    await db.insert(materialBatches).values({
      materialId: material.id,
      batchNumber: parsed.data.batchNumber?.trim() || null,
      expiresAt: parsed.data.expiresAt || null,
      quantity: stock,
    })
  }

  return NextResponse.json({ data: material }, { status: 201 })
}


