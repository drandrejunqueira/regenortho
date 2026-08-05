'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getInitials, timeAgo } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { LEAD_SOURCE_LABELS } from '@/lib/constants'
import type { Lead } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  new: '#00BCD4',
  contacted: '#d97706',
  scheduled: '#7c3aed',
  attended: '#0097a7',
  active_patient: '#16a34a',
  lost: '#dc2626',
}

interface Props {
  lead: Lead
  onClick: () => void
  onSchedule: (lead: Lead) => void
}

export function LeadCard({ lead, onClick, onSchedule }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { lead },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const avatarColor = STATUS_COLORS[lead.status] ?? '#00BCD4'

  function openWhatsApp(e: React.MouseEvent) {
    e.stopPropagation()
    const phone = lead.phone.replace(/\D/g, '')
    window.open(`https://wa.me/55${phone}`, '_blank')
  }

  function openSchedule(e: React.MouseEvent) {
    e.stopPropagation()
    onSchedule(lead)
  }

  // @container: as colunas agora encolhem junto com a tela, então o card mede a
  // si mesmo para decidir o que ainda cabe (ver os rótulos dos botões abaixo).
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="@container bg-white rounded-xl p-3 border border-[rgba(2,21,65,0.08)] shadow-[0_2px_8px_rgba(2,21,65,0.06)] hover:border-[#00BCE4]/30 hover:shadow-[0_4px_16px_rgba(2,21,65,0.08)] transition-all cursor-grab group"
    >
      {/* Header — o nome fica com a linha inteira; o "há quanto tempo" desce
          para a linha da origem, onde sobra espaço mesmo na coluna estreita. */}
      <div className="flex items-start gap-2.5 mb-2.5">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 select-none"
          style={{ backgroundColor: `${avatarColor}20`, color: avatarColor }}
        >
          {getInitials(lead.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#021541] truncate">{lead.name}</p>
          {lead.specialty && (
            <p className="text-xs text-[#718096] truncate">{lead.specialty}</p>
          )}
        </div>
      </div>

      {/* Origem + tempo */}
      <div className="flex items-center gap-2 mb-2">
        <span className="bg-[rgba(0,188,228,0.08)] text-[#00BCE4] text-[10px] px-2 py-1 rounded-full font-medium min-w-0 truncate">
          {LEAD_SOURCE_LABELS[lead.source] ?? lead.source}
        </span>
        <span className="font-technical text-[10px] text-[#718096] shrink-0 ml-auto">
          {timeAgo(lead.createdAt)}
        </span>
      </div>

      {/* Queixa */}
      {lead.complaint && (
        <p className="text-xs text-[#718096] truncate mb-2.5">{lead.complaint}</p>
      )}

      {/* Tags */}
      {lead.tags && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {lead.tags.map((tag) => (
            <span
              key={tag}
              className="bg-[rgba(2,21,65,0.04)] text-[#021541]/75 text-[9px] px-2 py-0.5 rounded-full font-semibold border border-[rgba(2,21,65,0.06)]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={openWhatsApp}
          className="flex items-center justify-center gap-1.5 p-1.5 rounded-lg bg-[rgba(2,21,65,0.04)] text-[#16a34a] hover:bg-[rgba(22,163,74,0.08)] transition-all flex-1 min-w-0 text-xs font-medium"
          aria-label="Abrir WhatsApp"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chat</span>
          <span className="hidden @[175px]:inline truncate">WhatsApp</span>
        </button>
        <button
          onClick={openSchedule}
          className="flex items-center justify-center gap-1.5 p-1.5 rounded-lg bg-[rgba(0,188,228,0.08)] text-[#00BCE4] hover:bg-[rgba(0,188,228,0.15)] transition-all flex-1 min-w-0 text-xs font-medium"
          aria-label="Agendar"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>calendar_today</span>
          <span className="hidden @[175px]:inline truncate">Agendar</span>
        </button>
      </div>
    </div>
  )
}
