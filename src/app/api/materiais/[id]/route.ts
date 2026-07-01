import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { materials, materialCategories } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { computeStockStatus } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  subcategoryId: z.string().uuid().nullable().optional(),
  unit: z.string().min(1).optional(),
  currentStock: z.number().int().min(0).optional(),
  minimumStock: z.number().int().min(0).optional(),
  unitCost: z.string().nullable().optional(),
  laboratory: z.string().nullable().optional(),
  supplier: z.string().nullable().optional(),
  supplierContact: z.string().nullable().optional(),
  batchNumber: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().nullable().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'materials:edit')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const current = await db.query.materials.findFirst({ where: eq(materials.id, id) })
  if (!current) return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })

  const patch: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() }

  // Se a categoria mudou por id e o texto não veio, mantém a coluna `category` coerente.
  if (parsed.data.categoryId !== undefined && parsed.data.category === undefined) {
    if (parsed.data.categoryId) {
      const cat = await db.query.materialCategories.findFirst({
        where: eq(materialCategories.id, parsed.data.categoryId),
        columns: { name: true },
      })
      if (cat) patch.category = cat.name
    }
  }

  // Recalcula o status sempre que estoque ou mínimo forem alterados.
  const nextStock = parsed.data.currentStock ?? current.currentStock
  const nextMin = parsed.data.minimumStock ?? current.minimumStock
  if (parsed.data.currentStock !== undefined || parsed.data.minimumStock !== undefined) {
    patch.status = computeStockStatus(nextStock, nextMin)
  }

  const [updated] = await db
    .update(materials)
    .set(patch)
    .where(eq(materials.id, id))
    .returning()

  return NextResponse.json({ data: updated })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'materials:delete')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  // Lotes e movimentações caem em cascata. Se o material estiver em uso
  // (tratamentos, compras, transações), a FK bloqueia — nesse caso oriente
  // o usuário a inativar em vez de excluir.
  try {
    const [deleted] = await db.delete(materials).where(eq(materials.id, id)).returning()
    if (!deleted) return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })
  } catch (error) {
    console.error('Erro ao excluir material:', error)
    return NextResponse.json(
      {
        error:
          'Este material está vinculado a tratamentos, compras ou lançamentos e não pode ser excluído. Inative-o para ocultá-lo do estoque.',
      },
      { status: 409 }
    )
  }

  return NextResponse.json({ success: true })
}
