'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getInitials, timeAgo } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { LEAD_SOURCE_LABELS } from '@/lib/constants'
import type { Lead } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  new: '#61d8dd',
  contacted: '#e6c364',
  scheduled: '#d3bbff',
  attended: '#006e72',
  active_patient: '#4ade80',
  lost: '#ffb4ab',
}

interface Props {
  lead: Lead
  onClick: () => void
}

export function LeadCard({ lead, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { lead },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const avatarColor = STATUS_COLORS[lead.status] ?? '#61d8dd'

  function openWhatsApp(e: React.MouseEvent) {
    e.stopPropagation()
    const phone = lead.phone.replace(/\D/g, '')
    window.open(`https://wa.me/55${phone}`, '_blank')
  }

  function openSchedule(e: React.MouseEvent) {
    e.stopPropagation()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-[#1c2026] rounded-2xl p-4 border border-[#3e4949]/5 hover:border-[#61d8dd]/20 transition-all cursor-grab group"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 select-none"
          style={{ backgroundColor: `${avatarColor}33`, color: avatarColor }}
        >
          {getInitials(lead.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#dfe2eb] truncate">{lead.name}</p>
          {lead.specialty && (
            <p className="text-xs text-[#dfe2eb]/50 truncate">{lead.specialty}</p>
          )}
        </div>
        <span className="font-technical text-[10px] text-[#e6c364] font-bold shrink-0">
          {timeAgo(lead.createdAt)}
        </span>
      </div>

      {/* Source + complaint */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="bg-[#31353c] text-[10px] px-2 py-1 rounded-md text-[#dfe2eb]/60">
          {LEAD_SOURCE_LABELS[lead.source] ?? lead.source}
        </span>
        {lead.complaint && (
          <p className="text-xs text-[#dfe2eb]/50 truncate flex-1 text-right">{lead.complaint}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={openWhatsApp}
          className="flex items-center justify-center gap-1.5 p-1.5 rounded-lg bg-[#31353c] text-[#61d8dd]/60 hover:text-[#61d8dd] hover:bg-[#61d8dd]/10 transition-all flex-1 text-xs font-medium"
          aria-label="Abrir WhatsApp"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chat</span>
          WhatsApp
        </button>
        <button
          onClick={openSchedule}
          className="flex items-center justify-center gap-1.5 p-1.5 rounded-lg bg-[#31353c] text-[#61d8dd]/60 hover:text-[#61d8dd] hover:bg-[#61d8dd]/10 transition-all flex-1 text-xs font-medium"
          aria-label="Agendar"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>calendar_today</span>
          Agendar
        </button>
      </div>
    </div>
  )
}
