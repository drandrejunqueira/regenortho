'use client'

import { useEffect } from 'react'
import { useClinicSettings } from '@/hooks/useClinicSettings'

/**
 * Injeta um <link rel="icon"> dinâmico no <head> quando há um ícone
 * configurado nas settings da clínica (headerImageUrl = ícone/favicon).
 * Deve ser incluído no root layout ou no layout do site.
 */
export default function DynamicFavicon() {
  const clinic = useClinicSettings()

  useEffect(() => {
    if (!clinic.headerImageUrl) return

    // Remove favicons anteriores adicionados dinamicamente
    document.querySelectorAll('link[data-dynamic-favicon]').forEach((el) => el.remove())

    const link = document.createElement('link')
    link.rel = 'icon'
    link.href = clinic.headerImageUrl
    link.setAttribute('data-dynamic-favicon', 'true')

    // Tenta inferir o type pelo nome do arquivo
    const ext = clinic.headerImageUrl.split('.').pop()?.toLowerCase()
    if (ext === 'svg') link.type = 'image/svg+xml'
    else if (ext === 'ico') link.type = 'image/x-icon'
    else if (ext === 'png') link.type = 'image/png'

    document.head.appendChild(link)
  }, [clinic.headerImageUrl])

  return null
}
