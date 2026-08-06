'use client'

import { useState, useEffect, useCallback } from 'react'

export interface Profile {
  id: string
  name: string
  email: string
  phone: string | null
  avatar: string | null
  role: string
  dailyAgendaEnabled: boolean
  dailyAgendaWhatsapp: string | null
  dailyAgendaHour: string
}

/**
 * Carrega o perfil do usuário logado direto do banco (inclui a foto base64).
 *
 * A foto NÃO trafega no JWT/cookie de sessão (estouraria o limite de cookie);
 * por isso o avatar é lido por aqui. `refresh()` recarrega após salvar.
 */
export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/perfil')
      if (res.ok) {
        const { data } = await res.json()
        setProfile(data)
      }
    } catch {
      /* silencioso — UI cai para iniciais */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { profile, loading, refresh }
}
