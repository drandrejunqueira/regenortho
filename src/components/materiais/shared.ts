'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MaterialCategory } from '@/types'

export const inputCls =
  'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/60 focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30'
export const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'

/**
 * Carrega as categorias de materiais (árvore de 2 níveis) e expõe helpers.
 * Compartilhado entre a página de estoque, os diálogos e a tela de configurações.
 */
export function useMaterialCategories() {
  const [tree, setTree] = useState<MaterialCategory[]>([])
  const [flat, setFlat] = useState<MaterialCategory[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/materiais/categorias')
      if (res.ok) {
        const { data, flat } = await res.json()
        setTree(data ?? [])
        setFlat(flat ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const roots = tree.filter((c) => c.isActive)
  const subcategoriesOf = (categoryId: string | null | undefined) =>
    categoryId ? flat.filter((c) => c.parentId === categoryId && c.isActive) : []

  return { tree, flat, roots, subcategoriesOf, loading, reload }
}
