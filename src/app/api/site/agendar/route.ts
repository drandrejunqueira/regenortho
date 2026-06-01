import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { leads, clinicSettings } from '@/lib/db/schema'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { sendAndLog, tplNewLead } from '@/lib/whatsapp'

const schema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().min(8).max(30),
  email: z.string().email().optional().or(z.literal('')),
  procedure: z.string().min(1).max(255),
  message: z.string().max(1000).optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data

  // Create lead in CRM
  const [lead] = await db.insert(leads).values({
    name: d.name,
    phone: d.phone,
    email: d.email || null,
    status: 'new',
    source: 'other',
    specialty: d.procedure,
    complaint: d.message || null,
  }).returning()

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
