import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { materials, stockMovements } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  supplier: z.string().nullable().optional(),
  supplierContact: z.string().nullable().optional(),
  unitCost: z.string().nullable().optional(),
  minimumStock: z.number().int().min(0).optional(),
  expiresAt: z.string().nullable().optional(),
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

  const [updated] = await db.update(materials)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(materials.id, id))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })
  return NextResponse.json({ data: updated })
}
