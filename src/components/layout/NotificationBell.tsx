'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { timeAgo } from '@/lib/utils'
import { playNotificationChime } from '@/lib/sound'

const POLL_MS = 30_000

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  priority: string
  createdAt: string
  isRead: boolean
}

const TYPE_ICONS: Record<string, string> = {
  lead_new: 'person_add',
  appointment_new: 'event_available',
  appointment_cancelled: 'event_busy',
  treatment_new: 'medical_services',
  treatment_status: 'timeline',
  stock_low: 'inventory_2',
  system: 'info',
}

const TYPE_COLORS: Record<string, string> = {
  lead_new: '#00BCE4',
  appointment_new: '#7c3aed',
  appointment_cancelled: '#dc2626',
  treatment_new: '#16a34a',
  treatment_status: '#d97706',
  stock_low: '#dc2626',
  system: '#718096',
}

export function NotificationBell() {
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [canPush, setCanPush] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  // Guarda o último id visto para alertar só quando chega algo realmente novo —
  // sem isso o som tocaria a cada ciclo de polling.
  const lastSeenId = useRef<string | null>(null)
  const isFirstLoad = useRef(true)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const json: { data: NotificationItem[]; unreadCount: number } = await res.json()
      setItems(json.data)
      setUnread(json.unreadCount)

      const newest = json.data[0]
      const previousId = lastSeenId.current
      lastSeenId.current = newest?.id ?? null

      // No primeiro carregamento não alerta: seriam avisos antigos. Precisa
      // rodar mesmo com a lista vazia, senão o primeiro aviso da tabela seria
      // tratado como "carga inicial" e entraria mudo.
      if (isFirstLoad.current) {
        isFirstLoad.current = false
        return
      }
      if (newest && newest.id !== previousId && !newest.isRead) alertUser(newest)
    } catch {
      /* rede instável não pode quebrar o topo do sistema */
    }
  }, [])

  function alertUser(n: NotificationItem) {
    playNotificationChime()
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const push = new Notification(n.title, {
          body: n.body ?? undefined,
          icon: '/favicon.ico',
          tag: n.id,
        })
        push.onclick = () => {
          window.focus()
          if (n.link) router.push(n.link)
          push.close()
        }
      }
    } catch {
      /* navegador sem suporte a Notification */
    }
  }

  useEffect(() => {
    if ('Notification' in window) setCanPush(Notification.permission !== 'granted')
    fetchNotifications()
    const id = setInterval(fetchNotifications, POLL_MS)
    // Ao voltar para a aba, atualiza na hora em vez de esperar o próximo ciclo.
    const onVisible = () => { if (document.visibilityState === 'visible') fetchNotifications() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchNotifications])

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  async function enablePush() {
    try {
      const permission = await Notification.requestPermission()
      setCanPush(permission !== 'granted')
      if (permission === 'granted') playNotificationChime()
    } catch {
      /* usuário bloqueou — nada a fazer */
    }
  }

  async function markRead(payload: { id?: string; all?: boolean }) {
    // Atualização otimista: o sino responde na hora, o servidor confirma depois.
    setItems((prev) =>
      prev.map((n) => (payload.all || n.id === payload.id ? { ...n, isRead: true } : n))
    )
    setUnread((prev) => (payload.all ? 0 : Math.max(0, prev - 1)))
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      fetchNotifications()
    }
  }

  function openItem(n: NotificationItem) {
    if (!n.isRead) markRead({ id: n.id })
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-[#021541]/40 hover:text-[#021541] hover:bg-[#021541]/5 transition-colors"
        aria-label={unread > 0 ? `Notificações (${unread} não lidas)` : 'Notificações'}
        aria-expanded={open}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
          notifications
        </span>
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ background: '#00BCE4', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden z-50"
          style={{
            background: '#ffffff',
            border: '1px solid rgba(2,21,65,0.08)',
            boxShadow: '0 12px 40px rgba(2,21,65,0.14)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(2,21,65,0.07)' }}
          >
            <span
              className="text-[11px] font-bold uppercase tracking-widest text-[#021541]"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              Notificações
            </span>
            {unread > 0 && (
              <button
                onClick={() => markRead({ all: true })}
                className="text-[10px] font-semibold text-[#00BCE4] hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {canPush && (
            <button
              onClick={enablePush}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-[11px] font-semibold text-[#021541] hover:bg-[#021541]/[0.03] transition-colors"
              style={{ background: 'rgba(0,188,228,0.06)' }}
            >
              <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '16px' }}>
                notifications_active
              </span>
              Ativar alertas na área de trabalho
            </button>
          )}

          <div className="max-h-[380px] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-[#718096]">
                Nenhuma notificação por aqui.
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[#021541]/[0.03] transition-colors"
                  style={{
                    borderBottom: '1px solid rgba(2,21,65,0.05)',
                    background: n.isRead ? 'transparent' : 'rgba(0,188,228,0.04)',
                  }}
                >
                  <span
                    className="material-symbols-outlined shrink-0 mt-0.5"
                    style={{ fontSize: '18px', color: TYPE_COLORS[n.type] ?? '#718096' }}
                  >
                    {TYPE_ICONS[n.type] ?? 'info'}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-[#021541] truncate">
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="block text-[11px] text-[#718096] line-clamp-2">{n.body}</span>
                    )}
                    <span className="block font-technical text-[10px] text-[#718096] mt-0.5">
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                  {!n.isRead && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00BCE4] shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
