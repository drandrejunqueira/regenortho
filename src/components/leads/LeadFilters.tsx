'use client'

// Barra de filtros do CRM. Todo o recorte é feito no servidor — filtrar em
// memória só funcionaria sobre os leads já carregados, escondendo justamente o
// que está fora da primeira página.
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { LEAD_SOURCE_LABELS } from '@/lib/constants'
import {
  DEFAULT_LEAD_PERIOD,
  LEAD_PERIODS,
  LEAD_PERIOD_LABELS,
  type LeadPeriod,
} from '@/lib/leadPeriod'

export interface TagOption {
  id: string
  name: string
  color: string
  isActive: boolean
}

export interface PersonOption {
  id: string
  name: string
}

export interface LeadFilterState {
  search: string
  tags: string[]
  source: string
  assignedTo: string
  period: LeadPeriod
  from: string
  to: string
}

export const EMPTY_FILTERS: LeadFilterState = {
  search: '',
  tags: [],
  source: '',
  assignedTo: '',
  period: DEFAULT_LEAD_PERIOD,
  from: '',
  to: '',
}

export function countActiveFilters(f: LeadFilterState): number {
  // O recorte de tempo conta uma vez só: pelas datas quando é personalizado,
  // pelo preset nos demais casos. Somar os dois marcaria "2" para um único
  // filtro na cabeça do usuário.
  const periodo =
    f.period === 'custom'
      ? (f.from || f.to ? 1 : 0)
      : (f.period !== DEFAULT_LEAD_PERIOD ? 1 : 0)

  return (
    // `trim` para casar com buildQuery, que descarta busca só de espaços: sem
    // isso o botão "Limpar (1)" apareceria sem haver filtro aplicado.
    (f.search.trim() ? 1 : 0) +
    f.tags.length +
    (f.source ? 1 : 0) +
    (f.assignedTo ? 1 : 0) +
    periodo
  )
}

const controlCls =
  'bg-[#f5f6f8] border border-[rgba(2,21,65,0.10)] rounded-full px-4 py-2.5 text-sm text-[#021541] focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30'

interface LeadFiltersProps {
  value: LeadFilterState
  onChange: (next: LeadFilterState) => void
  tags: TagOption[]
  people: PersonOption[]
}

export function LeadFilters({ value, onChange, tags, people }: LeadFiltersProps) {
  const [tagsOpen, setTagsOpen] = useState(false)
  const tagsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tagsOpen) return
    const onClickOutside = (e: MouseEvent) => {
      if (!tagsRef.current?.contains(e.target as Node)) setTagsOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setTagsOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [tagsOpen])

  const set = <K extends keyof LeadFilterState>(key: K, v: LeadFilterState[K]) =>
    onChange({ ...value, [key]: v })

  // Sair do personalizado precisa zerar as datas: senão elas continuariam na
  // query string e voltariam a valer ao reentrar no modo.
  function selectPeriod(period: LeadPeriod) {
    onChange(
      period === 'custom'
        ? { ...value, period }
        : { ...value, period, from: '', to: '' },
    )
  }

  function toggleTag(name: string) {
    const next = value.tags.includes(name)
      ? value.tags.filter((t) => t !== name)
      : [...value.tags, name]
    set('tags', next)
  }

  const activeCount = countActiveFilters(value)
  // Tag desativada no registro some do seletor, mas continua listada enquanto
  // estiver selecionada — senão o usuário não consegue tirar o próprio filtro.
  const visibleTags = tags.filter((t) => t.isActive || value.tags.includes(t.name))

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5">
      {/* Busca */}
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <span
          className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#718096] pointer-events-none"
          style={{ fontSize: '18px' }}
        >
          search
        </span>
        <input
          value={value.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          aria-label="Buscar leads por nome ou telefone"
          className={cn(controlCls, 'w-full pl-10')}
        />
      </div>

      {/* Tags — multisseleção */}
      <div className="relative" ref={tagsRef}>
        <button
          type="button"
          onClick={() => setTagsOpen((v) => !v)}
          aria-expanded={tagsOpen}
          aria-haspopup="listbox"
          className={cn(
            controlCls,
            'flex items-center gap-2 cursor-pointer font-medium',
            value.tags.length && 'border-[#00BCE4] bg-[rgba(0,188,228,0.08)]',
          )}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>sell</span>
          {value.tags.length === 0
            ? 'Tags'
            : value.tags.length === 1
              ? value.tags[0]
              : `${value.tags.length} tags`}
          <span className="material-symbols-outlined text-[#718096]" style={{ fontSize: '18px' }}>
            arrow_drop_down
          </span>
        </button>

        {tagsOpen && (
          <div
            role="listbox"
            aria-label="Filtrar por tags"
            className="absolute left-0 top-[calc(100%+6px)] z-40 w-[260px] max-h-[320px] overflow-y-auto rounded-2xl bg-white p-1.5"
            style={{ border: '1px solid rgba(2,21,65,0.08)', boxShadow: '0 12px 40px rgba(2,21,65,0.14)' }}
          >
            {visibleTags.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-[#718096]">
                Nenhuma tag cadastrada. Crie em Configurações → Tags.
              </p>
            ) : (
              visibleTags.map((tag) => {
                const checked = value.tags.includes(tag.name)
                return (
                  <button
                    key={tag.id}
                    role="option"
                    aria-selected={checked}
                    onClick={() => toggleTag(tag.name)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-[#021541]/[0.04] transition-colors"
                  >
                    <span
                      className={cn(
                        'w-4 h-4 rounded-[5px] border shrink-0 flex items-center justify-center transition-colors',
                        checked ? 'bg-[#00BCE4] border-[#00BCE4]' : 'border-[rgba(2,21,65,0.20)]',
                      )}
                    >
                      {checked && (
                        <span className="material-symbols-outlined text-white" style={{ fontSize: '13px' }}>
                          check
                        </span>
                      )}
                    </span>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tag.color }} />
                    <span className="text-xs font-medium text-[#021541] truncate">{tag.name}</span>
                    {!tag.isActive && (
                      <span className="ml-auto text-[9px] font-bold uppercase text-[#718096] shrink-0">
                        inativa
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Origem */}
      <select
        value={value.source}
        onChange={(e) => set('source', e.target.value)}
        aria-label="Filtrar por origem"
        className={cn(controlCls, 'cursor-pointer font-medium', value.source && 'border-[#00BCE4]')}
      >
        <option value="">Todas as origens</option>
        {Object.entries(LEAD_SOURCE_LABELS).map(([id, label]) => (
          <option key={id} value={id}>{label}</option>
        ))}
      </select>

      {/* Responsável */}
      <select
        value={value.assignedTo}
        onChange={(e) => set('assignedTo', e.target.value)}
        aria-label="Filtrar por responsável"
        className={cn(controlCls, 'cursor-pointer font-medium', value.assignedTo && 'border-[#00BCE4]')}
      >
        <option value="">Todos os responsáveis</option>
        <option value="none">Sem responsável</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {/* Período de entrada — o quadro abre em 30 dias para não carregar o
          funil inteiro; "Tudo" continua disponível para quem precisa do
          histórico completo. */}
      <div
        role="group"
        aria-label="Filtrar por período de entrada"
        className="flex items-center gap-0.5 rounded-full bg-[#f5f6f8] p-1 border border-[rgba(2,21,65,0.10)]"
      >
        {LEAD_PERIODS.map((p) => {
          const selected = value.period === p
          return (
            <button
              key={p}
              type="button"
              onClick={() => selectPeriod(p)}
              aria-pressed={selected}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer',
                selected
                  ? 'bg-[#021541] text-white'
                  : 'text-[#718096] hover:text-[#021541] hover:bg-[#021541]/[0.06]',
              )}
            >
              {LEAD_PERIOD_LABELS[p]}
            </button>
          )
        })}
      </div>

      {value.period === 'custom' && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={value.from}
            max={value.to || undefined}
            onChange={(e) => set('from', e.target.value)}
            aria-label="Entrada a partir de"
            className={cn(controlCls, 'font-technical text-xs', value.from && 'border-[#00BCE4]')}
          />
          <span className="text-xs text-[#718096]">até</span>
          <input
            type="date"
            value={value.to}
            min={value.from || undefined}
            onChange={(e) => set('to', e.target.value)}
            aria-label="Entrada até"
            className={cn(controlCls, 'font-technical text-xs', value.to && 'border-[#00BCE4]')}
          />
        </div>
      )}

      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-bold text-[#718096] hover:text-[#021541] hover:bg-[#021541]/[0.04] transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
          Limpar ({activeCount})
        </button>
      )}
    </div>
  )
}
