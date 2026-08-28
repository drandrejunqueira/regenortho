import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { examOrders } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { logActivity } from '@/lib/db/logger'
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

  // Registra no log de auditoria: vincular um resultado altera dado clínico do paciente e
  // precisa de rastro de quem fez. Só os campos alterados vão em `details` — o conteúdo do
  // laudo em si fica fora da tabela de log.
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
  await logActivity({
    userId: session.user.id,
    userName: session.user.name || session.user.email || null,
    action: 'exame:edit',
    module: 'exames',
    targetId: updated.id,
    targetName: updated.exams.map(e => e.name).join(', '),
    ip,
    details: {
      patientId: updated.patientId,
      status: updated.status,
      hasResult: Boolean(updated.resultUrl),
      fields: Object.keys(updates)
    }
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'exams:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const [archived] = await db.update(examOrders).set({ status: 'archived' }).where(eq(examOrders.id, id)).returning()

  // Registra no log de auditoria. Só registra o que existiu de fato: um id inválido não
  // arquiva nada e não deve virar rastro de exclusão.
  if (archived) {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    await logActivity({
      userId: session.user.id,
      userName: session.user.name || session.user.email || null,
      action: 'exame:delete',
      module: 'exames',
      targetId: archived.id,
      targetName: archived.exams.map(e => e.name).join(', '),
      ip,
      details: {
        patientId: archived.patientId,
        urgency: archived.urgency
      }
    })
  }

  return NextResponse.json({ ok: true })
}
