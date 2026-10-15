// Evolution API (WhatsApp / Baileys) integration — server side.
// Shared helpers used by the WhatsApp panel, the daily-report cron and the group
// bot. Reads credentials from clinicSettings (single-tenant, id = 1), falling back
// to environment variables. User-facing error strings are Portuguese on purpose.
import { db } from '@/lib/db'
import { clinicSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getConfig } from '@/lib/db/queries/configuracoes'

export interface EvolutionConfig {
  serverUrl: string
  apiKey: string
  instance: string
}

// Layered resolution so the operator can configure everything in one place:
// clinicSettings (existing system settings) → configuracoes KV (WhatsApp tab) → env.
export async function getEvolutionConfig(): Promise<EvolutionConfig> {
  const [c] = await db
    .select({
      url: clinicSettings.evolutionApiUrl,
      key: clinicSettings.evolutionApiKey,
      instance: clinicSettings.evolutionInstance,
    })
    .from(clinicSettings)
    .where(eq(clinicSettings.id, 1))

  const [kvUrl, kvKey, kvInstance] = await Promise.all([
    getConfig('evolution_api_url'),
    getConfig('evolution_api_key'),
    getConfig('evolution_instance'),
  ])

  return {
    serverUrl: (c?.url || kvUrl || process.env.EVOLUTION_SERVER_URL || '').replace(/\/$/, ''),
    apiKey: c?.key || kvKey || process.env.EVOLUTION_API_KEY || '',
    instance: c?.instance || kvInstance || '',
  }
}

// Error body shapes Evolution returns across versions (all optional).
interface EvolutionErrorBody {
  response?: { message?: string | string[] }
  message?: string | string[]
  error?: string | string[]
}

// Low-level fetch against the Evolution server. Throws (Portuguese message) when
// unconfigured or when the API returns a non-2xx, normalizing the several error
// shapes Evolution returns across versions. The JSON shape varies per endpoint and
// version, so `T` is the caller's view of it (default: untyped object fields).
export async function evoFetch<T = Record<string, unknown>>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { serverUrl, apiKey } = await getEvolutionConfig()
  if (!serverUrl || !apiKey) {
    throw new Error('Configure a URL e a chave da Evolution API em Configurações → WhatsApp.')
  }

  const r = await fetch(`${serverUrl}${path}`, {
    ...init,
    headers: { apikey: apiKey, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const json: unknown = await r.json().catch(() => ({}))
  if (!r.ok) {
    const err = json as EvolutionErrorBody | null | undefined
    const msg =
      err?.response?.message || err?.message || err?.error || `Falha na Evolution (${r.status})`
    throw new Error(Array.isArray(msg) ? msg.join('; ') : String(msg))
  }
  return json as T
}

// Normalize a BR phone number to the WhatsApp format (DDI 55 + digits).
export function waNumber(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('55') ? digits : `55${digits}`
}

// Response of /message/sendText; `key.id` is the WhatsApp message id.
export interface EvolutionSendTextResponse {
  key?: { id?: string }
  [field: string]: unknown
}

// Send a text message to a phone number OR a group JID. Unlike sendWhatsApp in
// lib/whatsapp.ts, this preserves JIDs (e.g. 12036@g.us) instead of stripping
// non-digits, so it works for both group broadcasts and DMs. Uses the configured
// instance and returns the raw Evolution response (incl. key.id).
export async function sendEvolutionText(
  target: string,
  text: string,
): Promise<EvolutionSendTextResponse> {
  const { instance } = await getEvolutionConfig()
  if (!instance) throw new Error('Instância do WhatsApp não configurada.')
  const number = target.includes('@') ? target : waNumber(target)
  return evoFetch<EvolutionSendTextResponse>(`/message/sendText/${encodeURIComponent(instance)}`, {
    method: 'POST',
    body: JSON.stringify({ number, text }),
  })
}

export interface EvolutionGroup {
  id: string
  subject: string
  size: number
}

// Raw group as returned by /group/fetchAllGroups (field names vary by version).
interface EvolutionRawGroup {
  id?: string
  jid?: string
  subject?: string
  name?: string
  size?: number
  participants?: unknown[]
}

// List the groups of the connected number, normalized to { id, subject, size }.
// Used in the settings UI so the operator can pick the clinic's WhatsApp group.
export async function fetchGroups(instance: string): Promise<EvolutionGroup[]> {
  const resp = await evoFetch<EvolutionRawGroup[] | { groups?: EvolutionRawGroup[] } | null>(
    `/group/fetchAllGroups/${encodeURIComponent(instance)}?getParticipants=false`,
  )
  const list = Array.isArray(resp) ? resp : resp?.groups || []
  return list
    .map((g: EvolutionRawGroup | null) => ({
      id: String(g?.id || g?.jid || ''),
      subject: String(g?.subject || g?.name || g?.id || ''),
      size: Number(g?.size || g?.participants?.length || 0),
    }))
    .filter((g: EvolutionGroup) => g.id)
}
