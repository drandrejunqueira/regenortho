import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { logActivity } from '@/lib/db/logger'
import { NextRequest, NextResponse } from 'next/server'
import { and, gte, lte, eq, ilike, or, desc, sql, isNull } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'
import { notify } from '@/lib/notifications'
import { LEAD_SOURCE_LABELS } from '@/lib/constants'
import { parseLeadPeriod, resolveLeadPeriodRange } from '@/lib/leadPeriod'
import { TAG_NAME_RE } from '@/lib/promptSafety'

/**
 * Teto de cards devolvidos ao quadro.
 *
 * Buscamos um a mais para saber se sobrou lead fora da janela e devolver
 * `meta.truncated` — o corte antigo era silencioso.
 */
const LEADS_LIMIT = 300

const LEAD_STATUSES = ['new', 'contacted', 'scheduled', 'attended', 'active_patient', 'lost'] as const
const LEAD_SOURCES = ['google_ads', 'meta_ads', 'instagram_organic', 'facebook_organic', 'google_organic', 'referral', 'whatsapp', 'other'] as const
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// 40 = o varchar(40) do registro de tags; 20 tags já é mais vocabulário do que a
// clínica usa em um lead.
const TAG_MAX_LEN = 40
const TAGS_MAX = 20

/**
 * A tag acompanha o lead até o contexto da IA que responde no grupo da clínica.
 * Sem o TAG_NAME_RE, uma tag com quebra de linha forja uma linha de instrução
 * dentro do prompt — exatamente o furo que promptSafety.ts existe para fechar.
 * O teto de quantidade impede que uma única requisição encha o jsonb (e o prompt).
 */
const leadTagsSchema = z
  .array(z.string().trim().min(1).max(TAG_MAX_LEN).regex(TAG_NAME_RE, 'Tag inválida'))
  .max(TAGS_MAX, `Máximo de ${TAGS_MAX} tags`)

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
  tags: leadTagsSchema.optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'leads:view', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')

  const conditions = []
  if (search) {
    conditions.push(or(
      ilike(leads.name, `%${search}%`),
      ilike(leads.phone, `%${search}%`),
    ))
  }

  // Validar contra o enum antes de comparar: um valor fora dele faria o Postgres
  // abortar a query inteira com erro de cast, devolvendo 500 em vez de ignorar.
  const status = searchParams.get('status')
  if (status && (LEAD_STATUSES as readonly string[]).includes(status)) {
    conditions.push(eq(leads.status, status as (typeof LEAD_STATUSES)[number]))
  }
  const source = searchParams.get('source')
  if (source && (LEAD_SOURCES as readonly string[]).includes(source)) {
    conditions.push(eq(leads.source, source as (typeof LEAD_SOURCES)[number]))
  }

  // Múltiplas tags com semântica E: o lead precisa ter todas as selecionadas.
  // Uma única cláusula de containment resolve — `@>` aceita o array inteiro.
  const selectedTags = searchParams.getAll('tag').map((t) => t.trim()).filter(Boolean)
  if (selectedTags.length) {
    conditions.push(sql`${leads.tags} @> ${JSON.stringify(selectedTags)}::jsonb`)
  }

  // 'none' filtra os leads sem responsável — é o recorte que a recepção usa para
  // achar o que ninguém pegou ainda.
  const assignedTo = searchParams.get('assignedTo')
  if (assignedTo === 'none') {
    conditions.push(isNull(leads.assignedToId))
  } else if (assignedTo && UUID_RE.test(assignedTo)) {
    conditions.push(eq(leads.assignedToId, assignedTo))
  }

  // Período de entrada. O preset (hoje/7/15/30) manda sobre as datas soltas;
  // `custom` usa as da tela e `all` não recorta nada. Sem `period` na query
  // valem as datas — é o contrato que a tela usava antes deste filtro.
  const period = parseLeadPeriod(searchParams.get('period'))
  const preset = resolveLeadPeriodRange(period)
  const from = period === 'all' ? null : (preset?.from ?? searchParams.get('from'))
  const to = period === 'all' ? null : (preset?.to ?? searchParams.get('to'))

  // `to` é inclusivo: o usuário escolhe "até 06/08" esperando que o dia 06
  // inteiro entre.
  if (from && DATE_RE.test(from)) {
    conditions.push(gte(leads.createdAt, new Date(`${from}T00:00:00.000-03:00`)))
  }
  if (to && DATE_RE.test(to)) {
    conditions.push(lte(leads.createdAt, new Date(`${to}T23:59:59.999-03:00`)))
  }

  const rows = await db.query.leads.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: [desc(leads.createdAt)],
    with: { assignedTo: { columns: { id: true, name: true } } },
    limit: LEADS_LIMIT + 1,
  })

  const truncated = rows.length > LEADS_LIMIT
  const data = truncated ? rows.slice(0, LEADS_LIMIT) : rows

  return NextResponse.json({
    data,
    meta: { period, from, to, limit: LEADS_LIMIT, truncated },
  })
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
