'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { KanbanBoard } from '@/components/leads/KanbanBoard'
import { NewLeadDialog } from '@/components/leads/NewLeadDialog'
import type { Lead } from '@/types'

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [search, setSearch] = useState('')
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
      }
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="CRM de Leads"
        description="Gerencie o funil de leads da clínica"
        action={
          <button
            onClick={() => setNewDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#021541] text-white text-sm font-bold hover:bg-[#032170] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Novo Lead
          </button>
        }
      />

      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" style={{ fontSize: '18px' }}>search</span>
          <input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.10)] rounded-full pl-10 pr-4 py-2.5 text-sm text-[#021541] placeholder:text-[#718096] focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[#718096] text-sm">
          <span className="material-symbols-outlined animate-spin mr-2" style={{ fontSize: '18px' }}>refresh</span>
          Carregando leads...
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <KanbanBoard initialLeads={leads} onRefresh={fetchLeads} />
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
