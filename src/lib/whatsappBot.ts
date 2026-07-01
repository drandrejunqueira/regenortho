// WhatsApp group bot — inbound side (server).
// Receives group messages from the Evolution webhook (messages.upsert), normalizes
// the payload, guards against duplicates/echoes, transcribes voice notes and
// answers in the group. Ported from MotoFix/server/financeBot.ts, adapted to the
// clinic: read-only assistant (daily report + Q&A over real data), single-tenant.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { evoFetch, sendEvolutionText } from '@/lib/evolution'
import { transcribeAudio } from '@/lib/transcribe'
import { callAi } from '@/lib/ai'
import { buildClinicReport } from '@/lib/clinicReport'

export interface IncomingMessage {
  instance: string
  groupJid: string // remoteJid ending in @g.us
  fromMe: boolean
  messageId: string
  text: string
  timestamp: number // epoch seconds
  pushName: string
  isAudio: boolean
  audioMime?: string
  audioBase64?: string
  raw?: any
}

// Extract the text from a Baileys message object (several shapes).
function textFromMessage(message: any): string {
  if (!message) return ''
  return String(
    message.conversation ||
      message.extendedTextMessage?.text ||
      message.imageMessage?.caption ||
      message.videoMessage?.caption ||
      '',
  ).trim()
}

function audioFromMessage(message: any): { mime: string } | null {
  const a = message?.audioMessage
  if (!a) return null
  return { mime: String(a.mimetype || 'audio/ogg') }
}

// Download audio media from Evolution and return base64 + mimetype. Defensive:
// tries the known payload/response shapes across Evolution versions.
export async function downloadAudioBase64(
  instance: string,
  raw: any,
): Promise<{ base64: string; mimetype: string }> {
  try {
    const resp = await evoFetch(`/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`, {
      method: 'POST',
      body: JSON.stringify({ message: raw, convertToMp4: false }),
    })
    const base64 = String(resp?.base64 || resp?.media || resp?.buffer || '')
    const mimetype = String(resp?.mimetype || raw?.message?.audioMessage?.mimetype || 'audio/ogg')
    return { base64, mimetype }
  } catch (e) {
    console.error('[whatsappBot] downloadAudioBase64:', e instanceof Error ? e.message : e)
    return { base64: '', mimetype: '' }
  }
}

// Normalize the Evolution `messages.upsert` webhook payload. `data` may be a
// single object or an array; we take the first message. Returns null when it is
// not a usable group text/audio message.
export function parseWebhookMessage(payload: any): IncomingMessage | null {
  if (!payload) return null
  const instance = String(payload.instance || payload.instanceName || '').trim()
  const raw = payload.data
  const data = Array.isArray(raw) ? raw[0] : raw
  if (!data) return null

  const key = data.key || {}
  const groupJid = String(key.remoteJid || '')
  if (!groupJid.endsWith('@g.us')) return null // groups only

  const text = textFromMessage(data.message)
  const audio = audioFromMessage(data.message)
  if (!text && !audio) return null

  // With webhook base64:true, media arrives inline. Locations vary across versions.
  const audioBase64 = audio
    ? String(data.message?.base64 || data.base64 || data.message?.audioMessage?.base64 || '')
    : ''

  const tsRaw = data.messageTimestamp ?? data.message?.messageTimestamp ?? 0
  const timestamp = Number(tsRaw) || Math.floor(Date.now() / 1000)

  return {
    instance,
    groupJid,
    fromMe: Boolean(key.fromMe),
    messageId: String(key.id || ''),
    text,
    timestamp,
    pushName: String(data.pushName || ''),
    isAudio: Boolean(audio),
    audioMime: audio?.mime,
    audioBase64,
    raw: data,
  }
}

// Resolve the effective text: if audio, download (when needed) and transcribe via
// Groq Whisper. Returns the text ('' when unusable) and whether it came from voice.
export async function resolveText(msg: IncomingMessage): Promise<{ text: string; fromAudio: boolean }> {
  if (msg.text) return { text: msg.text, fromAudio: false }
  if (!msg.isAudio) return { text: '', fromAudio: false }

  let base64 = msg.audioBase64 || ''
  let mime = msg.audioMime || 'audio/ogg'
  if (!base64) {
    const media = await downloadAudioBase64(msg.instance, msg.raw)
    base64 = media.base64
    mime = media.mimetype || mime
  }
  if (!base64) return { text: '', fromAudio: true }
  const text = await transcribeAudio(base64, mime)
  return { text, fromAudio: true }
}

// ── Idempotency / anti-replay ────────────────────────────────

const MAX_AGE_SECONDS = 300 // drop messages older than 5 min (webhook re-deliveries)
const DEDUPE_TTL_MS = 10 * 60 * 1000
const seen = new Map<string, number>() // messageId -> epoch ms

function pruneSeen(now = Date.now()) {
  for (const [id, ts] of seen) if (now - ts > DEDUPE_TTL_MS) seen.delete(id)
}

// Decide whether a message should be processed: drops duplicates (same id) and
// old messages (webhook re-deliveries). Marks as seen when accepted.
export function shouldProcess(msg: IncomingMessage, now = Date.now()): boolean {
  const nowSec = Math.floor(now / 1000)
  if (msg.timestamp && nowSec - msg.timestamp > MAX_AGE_SECONDS) return false
  if (msg.messageId) {
    if (seen.has(msg.messageId)) return false
    pruneSeen(now)
    seen.set(msg.messageId, now)
  }
  return true
}

// Mark a message id as already seen (e.g. the reply the bot itself sent).
export function markSeen(id: string, now = Date.now()): void {
  if (id) seen.set(id, now)
}

// Emoji prefixes of the replies the bot sends. Since staff write in the group with
// the same connected number (fromMe), we must ignore the echoes of our own replies
// to avoid a loop. Human commands never start with these icons.
const BOT_REPLY_PREFIX = /^\s*(📋|📊|✅|🤖|🎙️|⚠️|🤷|📅|💰|🩺|🧲|📦)/u

export function looksLikeBotReply(text: string): boolean {
  return BOT_REPLY_PREFIX.test(text || '')
}

// ── Intent detection ─────────────────────────────────────────

const REPORT_RE =
  /\b(relat[óo]rio|resumo|panorama|fechamento|como (est[áa]|vai)\s+(a\s+)?cl[íi]nica|como estamos|resumo do dia|briefing)\b/i

const QUESTION_TRIGGER_RE =
  /\b(quanto|quantos|quantas|qual|quais|quando|como|tem|houve|faturamento|faturei|receita|despesa|saldo|agenda|consulta|leads?|estoque|tratamento)\b/i

export function isReportRequest(text: string): boolean {
  return REPORT_RE.test(text || '')
}

// ── Dispatch ─────────────────────────────────────────────────

// Full flow of a group message. Returns the reply text, or null when the message
// isn't addressed to the bot (normal chatter) — the webhook then stays silent.
export async function dispatchGroupMessage(text: string): Promise<string | null> {
  const t = (text || '').trim()
  if (!t) return null

  // 1) Explicit request for the clinic report.
  if (isReportRequest(t)) {
    const r = await buildClinicReport({ refine: true })
    return r.whatsappText
  }

  // 2) A question directed to the assistant (ends with '?' or uses a trigger word).
  const directed = t.endsWith('?') || QUESTION_TRIGGER_RE.test(t)
  if (!directed) return null

  const report = await buildClinicReport() // deterministic numbers as context
  const answer = await callAi(
    [
      {
        role: 'system',
        content:
          'Você é o assistente de uma clínica de ortopedia regenerativa. Responda em português, curto e direto, usando SOMENTE os números fornecidos (moeda em R$ brasileiro). Se a pergunta não puder ser respondida com esses dados, diga o que você tem.',
      },
      { role: 'user', content: `Dados atuais da clínica:\n${report.context}\n\nPergunta: ${t}` },
    ],
    { timeoutMs: 15000 },
  )
  if (answer && answer.trim()) return `📊 ${answer.trim()}`

  // No AI engine configured → fall back to the full deterministic report.
  return report.whatsappText
}

// Send a text message to the group and mark our own message id as seen, so the
// webhook echo (fromMe) is dropped by shouldProcess and we don't loop.
export async function sendGroupMessage(jid: string, text: string): Promise<void> {
  try {
    const resp = await sendEvolutionText(jid, text)
    const id = (resp as any)?.key?.id
    if (id) markSeen(String(id))
  } catch (e) {
    console.error('[whatsappBot] sendGroupMessage:', e instanceof Error ? e.message : e)
  }
}
