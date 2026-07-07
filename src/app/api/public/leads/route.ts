import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { deriveLeadSource } from '@/lib/tracking'

const publicLeadSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
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
      source: deriveLeadSource(t), // derivado da atribuição, não mais hardcoded
      status: 'new',
      utmSource: utmSource || null,
      utmCampaign: utmCampaign || null,
      specialty: p.specialty || 'Articulações e Dor',
    }).returning()

    return NextResponse.json({ ok: true, id: lead.id }, { status: 201 })
  } catch (error) {
    console.error('[public/leads] Error creating lead:', error)
    return NextResponse.json({ error: 'Erro interno ao processar lead' }, { status: 500 })
  }
}
