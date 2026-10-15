// Alerta de SLA de leads — rota PÚBLICA, protegida por CRON_SECRET.
// Roda a cada 15 min pelo GitHub Actions (.github/workflows/crons.yml) — o plano
// Hobby da Vercel não aceita cron mais frequente que diário. Lead que continua
// "new" há mais de 15 min gera um aviso no WhatsApp da recepção
// (notify_new_lead_number) e recebe a tag "sla-15min" — a tag é a trava de duplicidade e fica visível no Kanban, então a
// equipe enxerga na hora quais leads furaram o SLA. Só alerta em horário
// comercial: um lead que entra de madrugada é cobrado às 8h, não às 3h.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clinicSettings, leads } from '@/lib/db/schema'
import { and, asc, eq, gt, lt, sql } from 'drizzle-orm'
import { brHourMinute } from '@/lib/doctorAgenda'
import { sendEvolutionText } from '@/lib/evolution'
import { rateLimit } from '@/lib/rate-limit'
import { secretEquals } from '@/lib/secrets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SLA_MINUTES = 15
const SLA_TAG = 'sla-15min'
const BUSINESS_HOURS = { start: '08:00', end: '20:00' }
const CRON_CALLS_PER_MINUTE = 2
// Rajada máxima por execução: a Evolution é um gateway único e a Meta pune
// sequências longas de mensagens idênticas.
const MAX_ALERTS_PER_RUN = 10
// Lead com mais de 24h em "new" é backlog, não SLA: cobrar de novo só gera ruído.
const MAX_AGE_HOURS = 24

const SOURCE_LABEL: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  instagram_organic: 'Instagram',
  facebook_organic: 'Facebook',
  google_organic: 'Google (orgânico)',
  referral: 'Indicação',
  whatsapp: 'WhatsApp',
  other: 'Outro',
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authz = req.headers.get('authorization') || ''
  if (!secret || !secretEquals(authz, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const rl = rateLimit('cron:leads-sla', CRON_CALLS_PER_MINUTE, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Muitas chamadas. Tente novamente em instantes.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const url = new URL(req.url)
  // `force` ignora o horário comercial — só para teste fora de produção.
  const force = url.searchParams.get('force') === '1' && process.env.VERCEL_ENV !== 'production'
  const nowHour = brHourMinute()
  if (!force && (nowHour < BUSINESS_HOURS.start || nowHour > BUSINESS_HOURS.end)) {
    return NextResponse.json({ ok: true, skipped: 'fora do horário comercial', hour: nowHour })
  }

  const [settings] = await db
    .select({ notifyNumber: clinicSettings.notifyNewLeadNumber })
    .from(clinicSettings)
    .where(eq(clinicSettings.id, 1))
  const target = settings?.notifyNumber?.trim()
  if (!target) {
    return NextResponse.json({ ok: true, skipped: 'notify_new_lead_number não configurado' })
  }

  const cutoff = new Date(Date.now() - SLA_MINUTES * 60_000)
  const oldest = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60_000)
  const overdue = await db
    .select({
      id: leads.id,
      name: leads.name,
      phone: leads.phone,
      source: leads.source,
      specialty: leads.specialty,
      createdAt: leads.createdAt,
      tags: leads.tags,
    })
    .from(leads)
    .where(
      and(
        eq(leads.status, 'new'),
        lt(leads.createdAt, cutoff),
        gt(leads.createdAt, oldest),
        // jsonb `?` = "array contém a string": leads já avisados ficam de fora.
        sql`NOT (COALESCE(${leads.tags}, '[]'::jsonb) ? ${SLA_TAG})`,
      ),
    )
    .orderBy(asc(leads.createdAt))
    .limit(MAX_ALERTS_PER_RUN)

  const results: Array<{ lead: string; ok: boolean; error?: string }> = []

  // Sequencial de propósito (mesma razão do cron da agenda).
  for (const lead of overdue) {
    const minutes = Math.round((Date.now() - lead.createdAt.getTime()) / 60_000)
    const text =
      `⏰ *Lead sem contato há ${minutes} min*\n\n` +
      `👤 *${lead.name}*\n` +
      `📱 ${lead.phone}\n` +
      `📌 ${lead.specialty || 'Sem especialidade'} · ${SOURCE_LABEL[lead.source] || lead.source}\n\n` +
      `Meta: primeiro contato em até ${SLA_MINUTES} min. Abra o CRM e mova o lead para "Contatado".`

    try {
      await sendEvolutionText(target, text)
      await db
        .update(leads)
        .set({ tags: [...(lead.tags || []), SLA_TAG] })
        .where(eq(leads.id, lead.id))
      results.push({ lead: lead.name, ok: true })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.error('[cron/leads-sla] falha ao alertar lead', lead.id, error)
      results.push({ lead: lead.name, ok: false, error })
    }
  }

  return NextResponse.json({ ok: true, hour: nowHour, overdue: overdue.length, results })
}
