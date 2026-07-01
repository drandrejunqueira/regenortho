import { NextRequest, NextResponse } from 'next/server'
import { requireSettingsEdit } from '@/lib/apiGuards'
import { evoFetch } from '@/lib/evolution'

export const runtime = 'nodejs'

// Create an Evolution instance (returns the QR code to connect the number).
export async function POST(req: NextRequest) {
  const guard = await requireSettingsEdit()
  if (!guard.ok) return guard.res

  try {
    const body = await req.json().catch(() => ({}))
    const instanceName = String(body?.instanceName || '').trim()
    if (!instanceName) return NextResponse.json({ error: 'Informe o nome da instância.' }, { status: 400 })

    const resp = await evoFetch('/instance/create', {
      method: 'POST',
      body: JSON.stringify({ instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
    })
    return NextResponse.json(resp)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 502 })
  }
}
