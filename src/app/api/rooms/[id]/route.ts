import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { rooms } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'

const updateSchema = z.object({
  name: z.string().min(1, 'Nome da sala é obrigatório').optional(),
  color: z.string().min(4, 'Cor inválida').max(7, 'Cor inválida').optional(),
  isActive: z.boolean().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'settings:edit')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  try {
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const [updated] = await db.update(rooms)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(rooms.id, id))
      .returning()

    if (!updated) return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })
    return NextResponse.json({ data: updated })
  } catch (err: any) {
    console.error(`[PATCH /api/rooms/${id}] error:`, err)
    return NextResponse.json({ error: 'Erro no banco de dados', details: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'settings:edit')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  try {
    const [deleted] = await db.delete(rooms)
      .where(eq(rooms.id, id))
      .returning()

    if (!deleted) return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })
    return NextResponse.json({ success: true, data: deleted })
  } catch (err: any) {
    console.error(`[DELETE /api/rooms/${id}] error:`, err)
    return NextResponse.json({ error: 'Erro no banco de dados', details: err.message }, { status: 500 })
  }
}
