import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { materialCategories } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'
import type { MaterialCategory } from '@/types'

const createSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(120),
  parentId: z.string().uuid().nullable().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'materials:view')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const rows = await db.query.materialCategories.findMany({
    orderBy: (c) => [asc(c.sortOrder), asc(c.name)],
  })

  // Monta árvore de 2 níveis (categoria → subcategorias)
  const roots: MaterialCategory[] = rows
    .filter((r) => !r.parentId)
    .map((r) => ({
      ...r,
      createdAt: r.createdAt?.toISOString?.() ?? undefined,
      children: rows
        .filter((c) => c.parentId === r.id)
        .map((c) => ({ ...c, createdAt: c.createdAt?.toISOString?.() ?? undefined })),
    }))

  return NextResponse.json({ data: roots, flat: rows })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'materials:edit')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const [category] = await db
    .insert(materialCategories)
    .values({
      name: parsed.data.name.trim(),
      parentId: parsed.data.parentId ?? null,
    })
    .returning()

  return NextResponse.json({ data: category }, { status: 201 })
}
