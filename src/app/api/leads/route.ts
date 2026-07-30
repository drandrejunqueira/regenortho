import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { logActivity } from '@/lib/db/logger'
import { NextRequest, NextResponse } from 'next/server'
import { and, gte, lte, eq, ilike, or, desc, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'
import { notify } from '@/lib/notifications'
import { LEAD_SOURCE_LABELS } from '@/lib/constants'

const createLeadSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  phone: z.string().min(8, 'Telefone inválido'),
  // Aceita null: o formulário de Novo Lead envia null quando o campo fica vazio.
  // Sem isso, criar lead sem e-mail devolvia 400 e a tela só dizia "Erro ao criar lead".
  email: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
  source: z.enum(['google_ads', 'meta_ads', 'instagram_organic', 'facebook_organic', 'google_organic', 'referral', 'whatsapp', 'other']).default('other'),
  specialty: z.string().optional(),
  complaint: z.string().optional(),
  notes: z.string().optional(),
  utmSource: z.string().optional(),
  utmCampaign: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'leads:view', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const status = searchParams.get('status')
  const source = searchParams.get('source')

  const conditions = []
  if (search) {
    conditions.push(or(
      ilike(leads.name, `%${search}%`),
      ilike(leads.phone, `%${search}%`),
    ))
  }
  if (status) conditions.push(eq(leads.status, status as 'new' | 'contacted' | 'scheduled' | 'attended' | 'active_patient' | 'lost'))
  if (source) conditions.push(eq(leads.source, source as 'google_ads' | 'meta_ads' | 'instagram_organic' | 'facebook_organic' | 'google_organic' | 'referral' | 'whatsapp' | 'other'))

  const tag = searchParams.get('tag')
  if (tag) {
    conditions.push(sql`${leads.tags} @> ${JSON.stringify([tag])}::jsonb`)
  }

  const data = await db.query.leads.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: [desc(leads.createdAt)],
    with: { assignedTo: { columns: { id: true, name: true } } },
    limit: 200,
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'leads:create', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createLeadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const [lead] = await db.insert(leads).values({
    ...parsed.data,
    email: parsed.data.email || null,
  }).returning()

  // Registra no log de auditoria
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
  await logActivity({
    userId: session.user.id,
    userName: session.user.name || session.user.email || null,
    action: 'lead:create',
    module: 'leads',
    targetId: lead.id,
    targetName: lead.name,
    ip,
    details: {
      source: lead.source,
      phone: lead.phone
    }
  })

  await notify({
    type: 'lead_new',
    title: `Novo lead: ${lead.name}`,
    body: `${lead.phone} • ${LEAD_SOURCE_LABELS[lead.source] ?? lead.source}`,
    link: '/leads',
    entityId: lead.id,
  })

  return NextResponse.json({ data: lead }, { status: 201 })
}
