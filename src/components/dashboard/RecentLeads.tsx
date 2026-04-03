import { getInitials, timeAgo } from '@/lib/utils'
import { LEAD_SOURCE_LABELS } from '@/lib/constants'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { Lead } from '@/types'
import Link from 'next/link'

export function RecentLeads({ leads }: { leads: Lead[] }) {
  if (!leads.length) {
    return (
      <p className="text-sm text-[#bec9c9] py-4 text-center">Nenhum lead recente</p>
    )
  }

  return (
    <div className="divide-y divide-[#3e4949]/10">
      {leads.map((lead) => (
        <Link
          key={lead.id}
          href="/leads"
          className="flex items-center gap-3 py-3 hover:bg-[#262a31]/50 px-1 -mx-1 rounded-lg transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-[#006e72] flex items-center justify-center text-[#dfe2eb] font-bold text-sm shrink-0 select-none">
            {getInitials(lead.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#dfe2eb] truncate">{lead.name}</p>
            <p className="text-xs text-[#bec9c9] truncate">
              {lead.specialty ?? LEAD_SOURCE_LABELS[lead.source]}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <StatusBadge type="lead_source" value={lead.source} />
            <span className="font-technical text-[10px] text-[#e6c364] font-bold">{timeAgo(lead.createdAt)}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}
