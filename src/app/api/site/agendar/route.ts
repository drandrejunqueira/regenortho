import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { leads, clinicSettings } from '@/lib/db/schema'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { sendAndLog, tplNewLead } from '@/lib/whatsapp'
import { deriveLeadSource } from '@/lib/tracking'
import { notify } from '@/lib/notifications'
import { LEAD_SOURCE_LABELS } from '@/lib/constants'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const schema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().min(8).max(30),
  email: z.string().email().optional().or(z.literal('')),
  procedure: z.string().min(1).max(255),
  message: z.string().max(1000).optional(),
  tracking: z.record(z.string(), z.string()).optional(),
})

export async function POST(req: NextRequest) {
  // Endpoint público: sem limite, um script enche o CRM de lead falso.
  const ip = getClientIp(req)
  const rl = rateLimit(`lead:${ip}`, 5, 10 * 60 * 1000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data
  const t = d.tracking ?? {}

  // Create lead in CRM, preserving campaign attribution when present.
  const [lead] = await db.insert(leads).values({
    name: d.name,
    phone: d.phone,
    email: d.email || null,
    status: 'new',
    source: deriveLeadSource(t, t.referrer),
    specialty: d.procedure,
    complaint: d.message || null,
    utmSource: t.utm_source ? t.utm_source.slice(0, 100) : null,
    utmCampaign: t.utm_campaign ? t.utm_campaign.slice(0, 100) : null,
  }).returning()

  await notify({
    type: 'lead_new',
    title: `Novo lead: ${lead.name}`,
    body: `${d.procedure} • ${d.phone} • ${LEAD_SOURCE_LABELS[lead.source] ?? lead.source}`,
    link: '/leads',
    entityId: lead.id,
    priority: 'high',
  })

  // Send WhatsApp notification to clinic
  try {
    const [settings] = await db.select({
      notifyNewLeadNumber: clinicSettings.notifyNewLeadNumber,
    }).from(clinicSettings).where(eq(clinicSettings.id, 1))

    if (settings?.notifyNewLeadNumber) {
      const msg = tplNewLead(d.name, d.phone, `Site — ${d.procedure}`)
      await sendAndLog('lead_notification', settings.notifyNewLeadNumber, msg)
    }
  } catch { /* non-blocking */ }

  return NextResponse.json({ ok: true, leadId: lead.id }, { status: 201 })
}
