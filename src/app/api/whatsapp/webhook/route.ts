// Inbound Evolution webhook (group messages) — PUBLIC route (no session).
// Guarded by the shared wa_webhook_token in the URL. Mirrors MotoFix's webhook:
// process BEFORE responding (on Vercel, responding first freezes the function and
// the reply never gets sent), then always ACK 200 to avoid a retry storm.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getConfig } from '@/lib/db/queries/configuracoes'
import {
  parseWebhookMessage,
  shouldProcess,
  looksLikeBotReply,
  resolveText,
  dispatchGroupMessage,
  sendGroupMessage,
} from '@/lib/whatsappBot'
import { secretEquals } from '@/lib/secrets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handle(body: any, token: string): Promise<void> {
  const secret = await getConfig('wa_webhook_token')
  // Fail-closed: with no configured token, reject everything instead of processing
  // forged payloads (which could leak patient PII / prontuário into the WhatsApp group).
  if (!secret || !secretEquals(token, secret)) return

  const msg = parseWebhookMessage(body)
  if (!msg) return
  // NOTE: we do NOT ignore fromMe — staff write in the group with the connected
  // number, so commands arrive as fromMe. Our own reply echoes are dropped by
  // shouldProcess (id marked on send) + looksLikeBotReply below.
  if (!shouldProcess(msg)) return

  const enabled = (await getConfig('wa_bot_enabled')) === '1'
  const groupJid = await getConfig('wa_bot_group_jid')
  if (!enabled || !groupJid || groupJid !== msg.groupJid) return

  if (!msg.isAudio && looksLikeBotReply(msg.text)) return

  const { text, fromAudio } = await resolveText(msg)
  if (!text) {
    if (fromAudio) {
      await sendGroupMessage(msg.groupJid, '🎙️ Não consegui entender o áudio. Pode repetir ou enviar por texto?')
    }
    return
  }

  const reply = await dispatchGroupMessage(text)
  if (reply) {
    const prefix = fromAudio ? `🎙️ Entendi: "${text}"\n\n` : ''
    await sendGroupMessage(msg.groupJid, prefix + reply)
  }
}

export async function POST(req: NextRequest) {
  try {
    // Preferência por header: query string vaza para access log, Referer e cache
    // de proxy. A query segue aceita como fallback porque a URL já está
    // registrada na Evolution — derrubar isso sem migrar quebraria o bot em
    // produção. Remover o fallback depende de reconfigurar o webhook lá.
    const token =
      req.headers.get('x-webhook-token') ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
      new URL(req.url).searchParams.get('token') ||
      ''
    const body = await req.json().catch(() => null)
    await handle(body, token)
  } catch (err) {
    console.error('[whatsappBot] webhook erro:', err instanceof Error ? err.message : err)
  }
  return NextResponse.json({ ok: true }) // respond LAST (always 200)
}
