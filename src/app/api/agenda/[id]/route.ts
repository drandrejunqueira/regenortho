import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { appointments } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'

const updateSchema = z.object({
  status: z.enum(['scheduled', 'confirmed', 'attended', 'no_show', 'rescheduled', 'cancelled']).optional(),
  type: z.enum(['consultation', 'prp', 'bmac', 'hyaluronic', 'prolotherapy', 'surgery', 'return', 'block']).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  notes: z.string().nullable().optional(),
  room: z.string().nullable().optional(),
  confirmedAt: z.string().datetime().nullable().optional(),
  reminderSent: z.boolean().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'agenda:edit')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() }
  if (parsed.data.startAt) updateData.startAt = new Date(parsed.data.startAt)
  if (parsed.data.endAt) updateData.endAt = new Date(parsed.data.endAt)
  if (parsed.data.confirmedAt) updateData.confirmedAt = new Date(parsed.data.confirmedAt)

  const [updated] = await db.update(appointments)
    .set(updateData)
    .where(eq(appointments.id, id))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
  return NextResponse.json({ data: updated })
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'agenda:delete')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  await db.delete(appointments).where(eq(appointments.id, id))
  return NextResponse.json({ success: true })
}
