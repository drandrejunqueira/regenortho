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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-white rounded-xl p-4 border border-[rgba(2,21,65,0.08)] shadow-[0_2px_8px_rgba(2,21,65,0.06)] hover:border-[#00BCE4]/30 hover:shadow-[0_4px_16px_rgba(2,21,65,0.08)] transition-all cursor-grab group"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 select-none"
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
        <span className="font-technical text-[10px] text-[#718096] shrink-0">
          {timeAgo(lead.createdAt)}
        </span>
      </div>

      {/* Source + complaint */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="bg-[rgba(0,188,228,0.08)] text-[#00BCE4] text-[10px] px-2 py-1 rounded-full font-medium">
          {LEAD_SOURCE_LABELS[lead.source] ?? lead.source}
        </span>
        {lead.complaint && (
          <p className="text-xs text-[#718096] truncate flex-1 text-right">{lead.complaint}</p>
        )}
      </div>

      {/* Tags */}
      {lead.tags && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
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
          className="flex items-center justify-center gap-1.5 p-1.5 rounded-lg bg-[rgba(2,21,65,0.04)] text-[#16a34a] hover:bg-[rgba(22,163,74,0.08)] transition-all flex-1 text-xs font-medium"
          aria-label="Abrir WhatsApp"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chat</span>
          WhatsApp
        </button>
        <button
          onClick={openSchedule}
          className="flex items-center justify-center gap-1.5 p-1.5 rounded-lg bg-[rgba(0,188,228,0.08)] text-[#00BCE4] hover:bg-[rgba(0,188,228,0.15)] transition-all flex-1 text-xs font-medium"
          aria-label="Agendar"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>calendar_today</span>
          Agendar
        </button>
      </div>
    </div>
  )
}
