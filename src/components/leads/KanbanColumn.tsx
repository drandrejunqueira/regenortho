'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { LeadCard } from './LeadCard'
import { cn } from '@/lib/utils'
import type { Lead, LeadStatus } from '@/types'

const COLUMN_CONFIG: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: 'Novo', color: '#00BCD4' },
  contacted: { label: 'Em Atendimento', color: '#d97706' },
  scheduled: { label: 'Agendado', color: '#7c3aed' },
  attended: { label: 'Compareceu', color: '#0097a7' },
  active_patient: { label: 'Paciente Ativo', color: '#16a34a' },
  lost: { label: 'Perdido', color: '#dc2626' },
}

interface Props {
  status: LeadStatus
  leads: Lead[]
  onLeadClick: (lead: Lead) => void
}

export function KanbanColumn({ status, leads, onLeadClick }: Props) {
  const config = COLUMN_CONFIG[status]
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex flex-col w-[280px] min-w-[280px] shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 mb-2">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: config.color }}
        />
        <span className="text-xs font-bold uppercase tracking-wider text-[#021541] flex-1">
          {config.label}
        </span>
        <span
          className="font-technical text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: `${config.color}1a`,
            color: config.color,
          }}
        >
          {leads.length}
        </span>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-3 min-h-32 rounded-xl p-2 transition-colors',
          isOver ? 'bg-[rgba(0,188,228,0.06)]' : 'bg-[rgba(2,21,65,0.02)]'
        )}
      >
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead)} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
