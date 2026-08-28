import { db } from '@/lib/db'
import { leads, sanitizeTrackingData } from '@/lib/db/schema'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { deriveLeadSource } from '@/lib/tracking'
import { notify } from '@/lib/notifications'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { LEAD_SOURCE_LABELS } from '@/lib/constants'
import { PERSON_NAME_RE } from '@/lib/promptSafety'

const publicLeadSchema = z.object({
  // O nome é persistido e depois entra no contexto da IA do bot do WhatsApp.
  // Nome de pessoa não precisa de quebra de linha nem de `=`.
  name: z.string().min(2, 'Nome obrigatório').max(120).regex(PERSON_NAME_RE, 'Nome inválido'),
  phone: z.string().min(8, 'Telefone inválido'),
  email: z.string().email().optional().or(z.literal('')),
  complaint: z.string().optional(),
  specialty: z.string().optional(),
  utmSource: z.string().optional(),
  utmCampaign: z.string().optional(),
  tracking: z.record(z.string(), z.string()).optional(),
})

export async function POST(req: NextRequest) {
  try {
    // Endpoint público: sem limite, um script enche o CRM de lead falso.
    const ip = getClientIp(req)
    const rl = rateLimit(`lead:${ip}`, 5, 10 * 60 * 1000)
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde alguns minutos.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Dados não informados' }, { status: 400 })
    }

    const parsed = publicLeadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const p = parsed.data
    // Prefer o objeto completo de tracking; cai para os campos utm avulsos (compat).
    const t = p.tracking ?? { utm_source: p.utmSource ?? '', utm_campaign: p.utmCampaign ?? '' }
    const utmSource = (t.utm_source || p.utmSource || '').slice(0, 100)
    const utmCampaign = (t.utm_campaign || p.utmCampaign || '').slice(0, 100)

    const [lead] = await db.insert(leads).values({
      name: p.name,
      phone: p.phone,
      email: p.email || null,
      complaint: p.complaint || null,
      source: deriveLeadSource(t, t.referrer), // derivado da atribuição, não mais hardcoded
      status: 'new',
      utmSource: utmSource || null,
      utmCampaign: utmCampaign || null,
      // Atribuição completa (fbclid/gclid/medium/content/referrer). Passa pelo
      // sanitizador porque o corpo é público: chave fora da allowlist e valor
      // gigante não podem virar carga arbitrária no jsonb.
      trackingData: sanitizeTrackingData(t),
      specialty: p.specialty || 'Articulações e Dor',
    }).returning()

    await notify({
      type: 'lead_new',
      title: `Novo lead: ${lead.name}`,
      body: `${lead.specialty ?? 'Sem especialidade'} • ${lead.phone} • ${LEAD_SOURCE_LABELS[lead.source] ?? lead.source}`,
      link: '/leads',
      entityId: lead.id,
      priority: 'high',
    })

    return NextResponse.json({ ok: true, id: lead.id }, { status: 201 })
  } catch (error) {
    console.error('[public/leads] Error creating lead:', error)
    return NextResponse.json({ error: 'Erro interno ao processar lead' }, { status: 500 })
  }
}
