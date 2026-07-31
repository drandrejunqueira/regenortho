'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { KanbanBoard } from '@/components/leads/KanbanBoard'
import { NewLeadDialog } from '@/components/leads/NewLeadDialog'
import type { Lead } from '@/types'
import { toast } from 'sonner'

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchLeads = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/leads?${params}`)
      if (res.ok) {
        const { data } = await res.json()
        setLeads(data)
      } else {
        // Sem isto, uma falha deixava o quadro vazio sem nenhuma explicação.
        toast.error('Não foi possível carregar os leads. Recarregue a página.')
      }
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  // Extrair todas as tags únicas dos leads carregados
  const allTags = Array.from(
    new Set(leads.flatMap((lead) => lead.tags ?? []))
  ).sort()

  // Filtragem de tags client-side para resposta instantânea.
  // useMemo é necessário: sem ele este array tem identidade nova a cada render,
  // o efeito de sincronização do KanbanBoard dispara e devolve o card à coluna
  // antiga logo depois de um arraste bem-sucedido.
  const filteredLeads = useMemo(
    () => leads.filter((lead) => {
      if (!selectedTag) return true
      return lead.tags && lead.tags.includes(selectedTag)
    }),
    [leads, selectedTag]
  )

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="CRM de Leads"
        description="Gerencie o funil de leads da clínica"
        action={
          <button
            onClick={() => setNewDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#021541] text-white text-sm font-bold hover:bg-[#032170] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Novo Lead
          </button>
        }
      />

      {/* Barra de Filtros */}
      <div className="mb-4 flex items-center gap-3">
        {/* Busca por Texto */}
        <div className="relative flex-1 max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" style={{ fontSize: '18px' }}>search</span>
          <input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.10)] rounded-full pl-10 pr-4 py-2.5 text-sm text-[#021541] placeholder:text-[#718096] focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30"
          />
        </div>

        {/* Filtro por Tags */}
        <div className="relative">
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="bg-[#f5f6f8] border border-[rgba(2,21,65,0.10)] rounded-full pl-4 pr-10 py-2.5 text-sm text-[#021541] focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30 cursor-pointer appearance-none font-medium min-w-[150px]"
          >
            <option value="">Todas as Tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#718096] pointer-events-none select-none" style={{ fontSize: '18px' }}>arrow_drop_down</span>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[#718096] text-sm">
          <span className="material-symbols-outlined animate-spin mr-2" style={{ fontSize: '18px' }}>refresh</span>
          Carregando leads...
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <KanbanBoard initialLeads={filteredLeads} onRefresh={fetchLeads} />
        </div>
      )}

      <NewLeadDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onCreated={fetchLeads}
      />
    </div>
  )
}
