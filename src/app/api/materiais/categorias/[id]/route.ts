import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { materialCategories } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'materials:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const patch: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() }
  if (typeof patch.name === 'string') patch.name = (patch.name as string).trim()

  const [updated] = await db
    .update(materialCategories)
    .set(patch)
    .where(eq(materialCategories.id, id))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 })
  return NextResponse.json({ data: updated })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'materials:delete', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  // Subcategorias são removidas em cascata pela FK (parent_id ON DELETE CASCADE).
  // Materiais vinculados têm category_id/subcategory_id zerados (ON DELETE SET NULL).
  try {
    const [deleted] = await db
      .delete(materialCategories)
      .where(eq(materialCategories.id, id))
      .returning()
    if (!deleted) return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 })
  } catch (error) {
    console.error('Erro ao excluir categoria:', error)
    return NextResponse.json({ error: 'Não foi possível excluir a categoria.' }, { status: 409 })
  }

  return NextResponse.json({ success: true })
}
