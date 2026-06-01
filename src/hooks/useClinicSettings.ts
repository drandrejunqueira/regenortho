'use client'

import { useState, useEffect } from 'react'

export interface ClinicBranding {
  name: string | null
  logoUrl: string | null
  headerImageUrl: string | null
  primaryColor: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
}

const DEFAULT: ClinicBranding = {
  name: 'REGENORTHO',
  logoUrl: null,
  headerImageUrl: null,
  primaryColor: '#00BCD4',
  phone: null,
  whatsapp: null,
  email: null,
  address: null,
  city: null,
  state: null,
}

/**
 * Retorna as configurações públicas de branding da clínica.
 * Pode ser usado tanto no site público quanto no painel admin.
 *
 * @param authenticated - Se true, usa /api/configuracoes/sistema (autenticado).
 *                        Se false (padrão), usa /api/site/config (público).
 */
export function useClinicSettings(authenticated = false): ClinicBranding {
  const [data, setData] = useState<ClinicBranding>(DEFAULT)

  useEffect(() => {
    const url = authenticated ? '/api/configuracoes/sistema' : '/api/site/config'
    fetch(url)
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) setData({ ...DEFAULT, ...data })
      })
      .catch(() => {/* silencioso — usa defaults */})
  }, [authenticated])

  return data
}
