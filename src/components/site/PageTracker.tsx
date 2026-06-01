'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const SID_KEY = 'twix_sid'

function getSessionId(): string {
  try {
    let sid = localStorage.getItem(SID_KEY)
    if (!sid) {
      sid = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
      localStorage.setItem(SID_KEY, sid)
    }
    return sid
  } catch {
    return 'anon'
  }
}

type TrackPayload = { tipo: string; path: string; referrer?: string | null; rotulo?: string | null; meta?: Record<string, unknown> | null }

function send(events: TrackPayload[]) {
  if (events.length === 0) return
  const sessionId = getSessionId()
  const body = JSON.stringify({ events: events.map(e => ({ ...e, sessionId })) })
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))
    } else {
      fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })
    }
  } catch {
    /* silencioso — tracking nunca deve quebrar a navegação */
  }
}

export function PageTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastPath = useRef<string | null>(null)

  // Pageview em cada navegação
  useEffect(() => {
    const qs = searchParams.toString()
    const fullPath = qs ? `${pathname}?${qs}` : pathname
    if (lastPath.current === fullPath) return
    lastPath.current = fullPath
    send([{ tipo: 'pageview', path: fullPath, referrer: document.referrer || null }])
  }, [pathname, searchParams])

  // Delegação de cliques + expõe window.twixTrack para eventos manuais (ex: busca)
  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      const target = (ev.target as HTMLElement)?.closest('a, button, [data-track]') as HTMLElement | null
      if (!target) return

      const path = window.location.pathname
      const explicit = target.getAttribute('data-track')
      const anchor = target.closest('a') as HTMLAnchorElement | null

      // Link externo → outbound
      if (anchor?.href) {
        try {
          const url = new URL(anchor.href, window.location.origin)
          if (url.origin !== window.location.origin) {
            send([{ tipo: 'outbound', path, rotulo: url.href }])
            return
          }
        } catch { /* ignore */ }
      }

      const rotulo = (explicit || target.getAttribute('aria-label') || target.textContent || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 120)
      if (rotulo) send([{ tipo: 'click', path, rotulo }])
    }

    document.addEventListener('click', onClick, { capture: true })

    // API global para tracking manual
    ;(window as any).twixTrack = (tipo: string, rotulo?: string, meta?: Record<string, unknown>) =>
      send([{ tipo, path: window.location.pathname, rotulo: rotulo ?? null, meta: meta ?? null }])

    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [])

  return null
}
