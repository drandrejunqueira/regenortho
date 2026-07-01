import { NextRequest, NextResponse } from 'next/server'
import { requireSettingsEdit } from '@/lib/apiGuards'
import { evoFetch } from '@/lib/evolution'
import { getConfig, setConfig } from '@/lib/db/queries/configuracoes'
import { randomBytes } from 'crypto'

export const runtime = 'nodejs'

// Public base URL of this app (for the webhook target Evolution posts to).
function publicBaseUrl(req: NextRequest): string {
  const env = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '')
  if (env) return env
  const proto = (req.headers.get('x-forwarded-proto') || 'https').split(',')[0]
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  return `${proto}://${host}`
}

// Point the Evolution webhook of this instance at our inbound endpoint. Listens to
// MESSAGES_UPSERT (incl. group messages) and ensures groups are NOT ignored
// (groupsIgnore:false — otherwise Evolution delivers no group messages at all).
export async function POST(req: NextRequest, { params }: { params: { name: string } }) {
  const guard = await requireSettingsEdit()
  if (!guard.ok) return guard.res

  const name = params.name
  try {
    // Ensure a shared webhook token exists (guards the public inbound route).
    let token = await getConfig('wa_webhook_token')
    if (!token) {
      token = randomBytes(16).toString('hex')
      await setConfig('wa_webhook_token', token, 'Token que protege a URL do webhook do WhatsApp')
    }
    const url = `${publicBaseUrl(req)}/api/whatsapp/webhook?token=${encodeURIComponent(token)}`

    // Defensive: don't fail the webhook registration if /settings/set differs by version.
    await evoFetch(`/settings/set/${encodeURIComponent(name)}`, {
      method: 'POST',
      body: JSON.stringify({
        settings: {
          groupsIgnore: false,
          rejectCall: false,
          alwaysOnline: false,
          readMessages: false,
          readStatus: false,
          syncFullHistory: false,
        },
      }),
    }).catch((e) => console.error('[whatsappBot] settings/set:', e instanceof Error ? e.message : e))

    const resp = await evoFetch(`/webhook/set/${encodeURIComponent(name)}`, {
      method: 'POST',
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url,
          // Correct key is webhookByEvents (false => Evolution posts straight to {url}).
          webhookByEvents: false,
          // base64:true => images/audio arrive inline in the payload (no second fetch).
          base64: true,
          events: ['MESSAGES_UPSERT'],
        },
      }),
    })
    return NextResponse.json({ ok: true, url, response: resp })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 502 })
  }
}
