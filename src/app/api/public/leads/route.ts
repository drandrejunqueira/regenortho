import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const publicLeadSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  phone: z.string().min(8, 'Telefone inválido'),
  email: z.string().email().optional().or(z.literal('')),
  complaint: z.string().optional(),
  utmSource: z.string().optional(),
  utmCampaign: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Dados não informados' }, { status: 400 })
    }

    const parsed = publicLeadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const [lead] = await db.insert(leads).values({
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      complaint: parsed.data.complaint || null,
      source: 'google_ads', // Default source for landing pages
      status: 'new',       // Standard new lead
      utmSource: parsed.data.utmSource || null,
      utmCampaign: parsed.data.utmCampaign || null,
      specialty: 'Articulações e Dor',
    }).returning()

    return NextResponse.json({ ok: true, id: lead.id }, { status: 201 })
  } catch (error) {
    console.error('[public/leads] Error creating lead:', error)
    return NextResponse.json({ error: 'Erro interno ao processar lead' }, { status: 500 })
  }
}
