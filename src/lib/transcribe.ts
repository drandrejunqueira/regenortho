// Audio transcription (voice → text) via Groq Whisper — server side.
// Used by the WhatsApp group bot to understand voice notes sent to the clinic
// group. The key comes from the `configuracoes` KV (`groq_api_key`) with a
// GROQ_API_KEY env fallback. Any failure returns '' — the caller decides the
// fallback and this never throws.
import { getConfig } from '@/lib/db/queries/configuracoes'

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const MODEL = 'whisper-large-v3-turbo' // fast, cheap, strong on pt-BR
const TIMEOUT_MS = 30000

export async function getGroqKey(): Promise<string> {
  return (await getConfig('groq_api_key')) || process.env.GROQ_API_KEY || ''
}

// Guess a file extension from the WhatsApp audio mimetype.
function extFromMime(mimetype: string): string {
  const m = (mimetype || '').toLowerCase()
  if (m.includes('ogg') || m.includes('opus')) return 'ogg'
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3'
  if (m.includes('wav')) return 'wav'
  if (m.includes('m4a') || m.includes('mp4') || m.includes('aac')) return 'm4a'
  if (m.includes('webm')) return 'webm'
  if (m.includes('flac')) return 'flac'
  return 'ogg' // WhatsApp voice notes are usually ogg/opus
}

// Transcribe a base64 audio to Portuguese text using Groq Whisper.
// Returns '' when there is no key, empty audio, or on any error.
export async function transcribeAudio(base64: string, mimetype: string): Promise<string> {
  const key = await getGroqKey()
  if (!key || !base64) return ''

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const buf = Buffer.from(base64, 'base64')
    if (!buf.length) return ''
    const type = mimetype || 'audio/ogg'
    const form = new FormData()
    form.append('file', new Blob([buf], { type }), `audio.${extFromMime(type)}`)
    form.append('model', MODEL)
    form.append('language', 'pt')
    form.append('response_format', 'text')

    const r = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: ctrl.signal,
    })
    if (!r.ok) {
      console.error('[transcribe] groq', r.status, (await r.text().catch(() => '')).slice(0, 200))
      return ''
    }
    return (await r.text()).trim()
  } catch (e) {
    console.error('[transcribe]', e instanceof Error ? e.message : e)
    return ''
  } finally {
    clearTimeout(timer)
  }
}
