import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { examOrders } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

const updateSchema = z.object({
  status: z.enum(['issued', 'scheduled', 'collected', 'result_available', 'archived']).optional(),
  resultUrl: z.string().url().optional().nullable(),
  resultDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'exams:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updates: Record<string, unknown> = {}
  const d = parsed.data
  if (d.status !== undefined) updates.status = d.status
  if (d.resultUrl !== undefined) updates.resultUrl = d.resultUrl
  if (d.resultDate !== undefined) updates.resultDate = d.resultDate
  if (d.notes !== undefined) updates.notes = d.notes

  const [updated] = await db.update(examOrders).set(updates).where(eq(examOrders.id, id)).returning()
  if (!updated) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'exams:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  await db.update(examOrders).set({ status: 'archived' }).where(eq(examOrders.id, id))
  return NextResponse.json({ ok: true })
}
