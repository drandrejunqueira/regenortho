'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { KanbanBoard } from '@/components/leads/KanbanBoard'
import { NewLeadDialog } from '@/components/leads/NewLeadDialog'
import {
  LeadFilters,
  EMPTY_FILTERS,
  countActiveFilters,
  type LeadFilterState,
  type PersonOption,
  type TagOption,
} from '@/components/leads/LeadFilters'
import type { Lead } from '@/types'
import { toast } from 'sonner'

// Digitar dispara uma busca por tecla sem isto. O filtro roda no servidor agora,
// então cada tecla seria uma consulta ao banco.
const SEARCH_DEBOUNCE_MS = 350

function buildQuery(f: LeadFilterState): string {
  const params = new URLSearchParams()
  if (f.search.trim()) params.set('search', f.search.trim())
  // Repetido, não separado por vírgula: nome de tag pode conter vírgula.
  f.tags.forEach((t) => params.append('tag', t))
  if (f.source) params.set('source', f.source)
  if (f.assignedTo) params.set('assignedTo', f.assignedTo)
  // Sempre explícito: sem `period` a rota cai no contrato antigo e carrega o
  // funil inteiro, que é justamente o que o recorte evita.
  params.set('period', f.period)
  if (f.period === 'custom') {
    if (f.from) params.set('from', f.from)
    if (f.to) params.set('to', f.to)
  }
  return params.toString()
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [filters, setFilters] = useState<LeadFilterState>(EMPTY_FILTERS)
  const [tags, setTags] = useState<TagOption[]>([])
  const [people, setPeople] = useState<PersonOption[]>([])
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  // A rota devolve no máximo `meta.limit` cards. Sem este aviso o corte é
  // invisível e os leads mais antigos parecem ter sumido do funil.
  const [truncated, setTruncated] = useState(false)

  // Só a busca textual precisa de espera; mexer num select deve responder na hora.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filters.search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [filters.search])

  const query = buildQuery({ ...filters, search: debouncedSearch })

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads?${query}`)
      if (res.ok) {
        const { data, meta } = await res.json()
        setLeads(data)
        setTruncated(Boolean(meta?.truncated))
      } else {
        // Sem isto, uma falha deixava o quadro vazio sem nenhuma explicação.
        toast.error('Não foi possível carregar os leads. Recarregue a página.')
      }
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  // Vocabulário de tags e lista de responsáveis vêm do servidor, não dos leads
  // carregados: uma tag usada só num lead fora da página apareceria no filtro.
  const loadOptions = useCallback(async () => {
    const [tagsRes, peopleRes] = await Promise.allSettled([
      fetch('/api/tags'),
      fetch('/api/usuarios?assignable=1'),
    ])
    if (tagsRes.status === 'fulfilled' && tagsRes.value.ok) {
      const { data } = await tagsRes.value.json()
      setTags(data)
    }
    if (peopleRes.status === 'fulfilled' && peopleRes.value.ok) {
      const { data } = await peopleRes.value.json()
      setPeople(data)
    }
  }, [])

  useEffect(() => { loadOptions() }, [loadOptions])

  const activeCount = countActiveFilters(filters)
  const isFiltered = activeCount > 0

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

      <LeadFilters value={filters} onChange={setFilters} tags={tags} people={people} />

      {truncated && !loading && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-[#F5A623]/30 bg-[#F5A623]/[0.08] px-4 py-2.5">
          <span className="material-symbols-outlined text-[#B26A00]" style={{ fontSize: '18px' }}>
            filter_list
          </span>
          <p className="text-xs font-semibold text-[#021541]">
            Há mais leads do que cabe no quadro. Estreite o período ou refine os filtros
            para ver os mais antigos.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[#718096] text-sm">
          <span className="material-symbols-outlined animate-spin mr-2" style={{ fontSize: '18px' }}>refresh</span>
          Carregando leads...
        </div>
      ) : leads.length === 0 && isFiltered ? (
        // Quadro vazio com filtro ativo é ambíguo — sem esta mensagem parece que
        // a clínica não tem lead nenhum.
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <span className="material-symbols-outlined text-[#718096]/40" style={{ fontSize: '40px' }}>
            filter_alt_off
          </span>
          <p className="text-sm font-semibold text-[#021541]">Nenhum lead com esses filtros</p>
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="text-xs font-bold text-[#00BCE4] hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <KanbanBoard initialLeads={leads} onRefresh={fetchLeads} />
        </div>
      )}

      <NewLeadDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onCreated={() => { fetchLeads(); loadOptions() }}
      />
    </div>
  )
}
