import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { leads, leadInteractions } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { logActivity } from '@/lib/db/logger'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'

const updateLeadSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(8).optional(),
  email: z.string().email().nullable().optional(),
  status: z.enum(['new', 'contacted', 'scheduled', 'attended', 'active_patient', 'lost']).optional(),
  source: z.enum(['google_ads', 'meta_ads', 'instagram_organic', 'facebook_organic', 'google_organic', 'referral', 'whatsapp', 'other']).optional(),
  specialty: z.string().nullable().optional(),
  complaint: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lostReason: z.string().nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
})

const interactionSchema = z.object({
  type: z.enum(['call', 'whatsapp', 'email', 'note']),
  content: z.string().min(1),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'leads:view')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, id),
    with: {
      assignedTo: { columns: { id: true, name: true } },
      interactions: { orderBy: (i, { desc }) => [desc(i.createdAt)] },
    },
  })

  if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
  return NextResponse.json({ data: lead })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'leads:edit')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  const body = await req.json()
  const parsed = updateLeadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const [updated] = await db.update(leads)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(leads.id, id))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

  // Registra no log de auditoria
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
  await logActivity({
    userId: session.user.id,
    userName: session.user.name || session.user.email || null,
    action: 'lead:edit',
    module: 'leads',
    targetId: updated.id,
    targetName: updated.name,
    ip,
    details: {
      status: updated.status,
      phone: updated.phone
    }
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'leads:delete')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  // Get lead details before deletion for logs
  const leadData = await db.query.leads.findFirst({
    where: eq(leads.id, id)
  })

  if (!leadData) {
    return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
  }

  await db.delete(leads).where(eq(leads.id, id))

  // Registra no log de auditoria
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
  await logActivity({
    userId: session.user.id,
    userName: session.user.name || session.user.email || null,
    action: 'lead:delete',
    module: 'leads',
    targetId: id,
    targetName: leadData.name,
    ip,
    details: {
      phone: leadData.phone,
      source: leadData.source
    }
  })

  return NextResponse.json({ success: true })
}
