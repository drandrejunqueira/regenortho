import { NextRequest, NextResponse } from 'next/server'
import { recordEvents } from '@/lib/db/queries/analytics'
import { getConfig } from '@/lib/db/queries/configuracoes'

export const runtime = 'nodejs'

const TIPOS_VALIDOS = new Set(['pageview', 'click', 'search', 'outbound', 'scroll'])

function detectarDevice(ua: string): string {
  const s = ua.toLowerCase()
  if (/tablet|ipad|playbook|silk/.test(s)) return 'tablet'
  if (/mobile|iphone|ipod|android.*mobile|blackberry|opera mini/.test(s)) return 'mobile'
  return 'desktop'
}

function limita(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (!t) return null
  return t.slice(0, max)
}

export async function POST(req: NextRequest) {
  try {
    // Respeita o flag de liga/desliga
    const ativo = await getConfig('tracking_ativo')
    if (ativo === 'false') {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })

    // Aceita um único evento ou um lote { events: [...] }
    const raw = Array.isArray(body.events) ? body.events : [body]
    if (raw.length === 0 || raw.length > 50) {
      return NextResponse.json({ error: 'Lote inválido' }, { status: 400 })
    }

    const ua = req.headers.get('user-agent') ?? ''
    const device = detectarDevice(ua)
    const pais = req.headers.get('x-vercel-ip-country') ?? null

    const events = raw
      .filter((e: any) => e && TIPOS_VALIDOS.has(e.tipo) && typeof e.path === 'string')
      .map((e: any) => ({
        tipo:      e.tipo as string,
        path:      limita(e.path, 512)!,
        referrer:  limita(e.referrer, 512),
        rotulo:    limita(e.rotulo, 256),
        sessionId: limita(e.sessionId, 64),
        device,
        pais,
        meta:      e.meta && typeof e.meta === 'object' ? e.meta : null,
      }))

    if (events.length === 0) {
      return NextResponse.json({ error: 'Nenhum evento válido' }, { status: 400 })
    }

    await recordEvents(events)
    return NextResponse.json({ ok: true, recorded: events.length })
  } catch (error) {
    console.error('[track] Error:', error)
    return NextResponse.json({ error: 'Falha ao registrar evento' }, { status: 500 })
  }
}
