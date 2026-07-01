// LLM access — server side. Centralizes provider config and the HTTP call used by
// the clinic-report refinement and the WhatsApp group bot. Config lives in the
// `configuracoes` KV table (same keys the glossário generator already uses), so
// there is a single place to configure the AI engine for the whole app.
//
// Any failure (missing config, timeout, HTTP error, empty body) returns '' — the
// caller is responsible for the deterministic fallback and must never break.
import { getConfig } from '@/lib/db/queries/configuracoes'

const AI_TIMEOUT_MS = 20000

const PROVIDER_BASES: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
  deepseek: 'https://api.deepseek.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  anthropic: '__anthropic__',
}

export interface AiConfig {
  provider: string
  model: string
  apiKey: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CallOptions {
  json?: boolean
  timeoutMs?: number
  config?: AiConfig
}

// Reads the configured provider/model/key from `configuracoes`. Mirrors the
// resolution used by admin/glossario/gerar-conteudo (provider-specific key with a
// generic `ia_api_key` fallback).
export async function getAiConfig(): Promise<AiConfig> {
  const [providerRaw, model] = await Promise.all([getConfig('ia_motor_nome'), getConfig('ia_modelo')])
  const provider = (providerRaw || '').toLowerCase()

  let apiKey = ''
  if (provider === 'gemini') {
    apiKey = (await getConfig('gemini_api_key')) || (await getConfig('ia_api_key')) || ''
  } else if (provider === 'openai') {
    apiKey = (await getConfig('openai_api_key')) || (await getConfig('ia_api_key')) || ''
  } else if (provider === 'openrouter') {
    apiKey = (await getConfig('openrouter_api_key')) || (await getConfig('ia_api_key')) || ''
  } else {
    apiKey = (await getConfig('ia_api_key')) || ''
  }

  return { provider, model: model || '', apiKey }
}

async function callOpenAiCompatible(
  baseUrl: string,
  cfg: AiConfig,
  messages: ChatMessage[],
  json: boolean | undefined,
  signal: AbortSignal,
): Promise<string> {
  const body: Record<string, unknown> = { model: cfg.model, max_tokens: 2048, messages }
  if (json) body.response_format = { type: 'json_object' }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
      'HTTP-Referer': 'https://regenortho.com.br',
      'X-Title': 'REGENORTHO',
    },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) return ''
  const data = (await res.json()) as any
  return (data?.choices?.[0]?.message?.content || '').trim()
}

async function callAnthropic(
  cfg: AiConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<string> {
  // Anthropic keeps `system` out of the messages array.
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n')
  const rest = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }))

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: cfg.model, max_tokens: 2048, system: system || undefined, messages: rest }),
    signal,
  })
  if (!res.ok) return ''
  const data = (await res.json()) as any
  return (data?.content?.[0]?.text || '').trim()
}

// Chat completion across providers. Returns '' on any failure.
export async function callAi(messages: ChatMessage[], opts: CallOptions = {}): Promise<string> {
  const cfg = opts.config ?? (await getAiConfig())
  if (!cfg.provider || !cfg.model || !cfg.apiKey) return ''

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? AI_TIMEOUT_MS)
  try {
    if (cfg.provider === 'anthropic') return await callAnthropic(cfg, messages, ctrl.signal)
    const base = PROVIDER_BASES[cfg.provider] ?? `https://api.${cfg.provider}.com/v1`
    return await callOpenAiCompatible(base, cfg, messages, opts.json, ctrl.signal)
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

// Strips <think> blocks and returns the first {...} JSON object from a model reply.
export function cleanJsonResponse(text: string): string {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) return cleaned.substring(start, end + 1)
  return cleaned
}
