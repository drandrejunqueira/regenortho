import { cn } from '@/lib/utils'
import {
  LEAD_STATUS_LABELS,
  LEAD_SOURCE_LABELS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
  STOCK_STATUS_LABELS,
  ROLE_LABELS,
} from '@/lib/constants'

const LEAD_STATUS_COLORS: Record<string, string> = {
  new: 'bg-[#61d8dd]/10 text-[#61d8dd]',
  contacted: 'bg-[#e6c364]/10 text-[#e6c364]',
  scheduled: 'bg-[#d3bbff]/10 text-[#d3bbff]',
  attended: 'bg-[#006e72]/20 text-[#61d8dd]',
  active_patient: 'bg-[#4ade80]/10 text-[#4ade80]',
  lost: 'bg-[#ffb4ab]/10 text-[#ffb4ab]',
}

const APPOINTMENT_STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-[#61d8dd]/10 text-[#61d8dd]',
  confirmed: 'bg-[#4ade80]/10 text-[#4ade80]',
  attended: 'bg-[#006e72]/20 text-[#61d8dd]',
  no_show: 'bg-[#ffb4ab]/10 text-[#ffb4ab]',
  rescheduled: 'bg-[#e6c364]/10 text-[#e6c364]',
  cancelled: 'bg-[#dfe2eb]/10 text-[#bec9c9]',
}

const STOCK_STATUS_COLORS: Record<string, string> = {
  ok: 'bg-[#61d8dd]/10 text-[#61d8dd]',
  low: 'bg-[#e6c364]/10 text-[#e6c364]',
  critical: 'bg-[#ffb4ab]/10 text-[#ffb4ab]',
  out_of_stock: 'bg-[#ffb4ab]/10 text-[#ffb4ab]',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-[#d3bbff]/10 text-[#d3bbff]',
  receptionist: 'bg-[#61d8dd]/10 text-[#61d8dd]',
  financial: 'bg-[#4ade80]/10 text-[#4ade80]',
  doctor: 'bg-[#d3bbff]/10 text-[#d3bbff]',
}

const SOURCE_COLORS: Record<string, string> = {
  google_ads: 'bg-[#61d8dd]/10 text-[#61d8dd]',
  meta_ads: 'bg-[#d3bbff]/10 text-[#d3bbff]',
  instagram_organic: 'bg-[#ffb4ab]/10 text-[#ffb4ab]',
  facebook_organic: 'bg-[#61d8dd]/10 text-[#61d8dd]',
  google_organic: 'bg-[#4ade80]/10 text-[#4ade80]',
  referral: 'bg-[#e6c364]/10 text-[#e6c364]',
  whatsapp: 'bg-[#4ade80]/10 text-[#4ade80]',
  other: 'bg-[#dfe2eb]/10 text-[#bec9c9]',
}

interface StatusBadgeProps {
  type: 'lead_status' | 'lead_source' | 'appointment_status' | 'appointment_type' | 'stock_status' | 'role'
  value: string
  className?: string
  pulse?: boolean
}

export function StatusBadge({ type, value, className, pulse }: StatusBadgeProps) {
  const labels: Record<string, Record<string, string>> = {
    lead_status: LEAD_STATUS_LABELS,
    lead_source: LEAD_SOURCE_LABELS,
    appointment_status: APPOINTMENT_STATUS_LABELS,
    appointment_type: APPOINTMENT_TYPE_LABELS,
    stock_status: STOCK_STATUS_LABELS,
    role: ROLE_LABELS,
  }

  const colors: Record<string, Record<string, string>> = {
    lead_status: LEAD_STATUS_COLORS,
    lead_source: SOURCE_COLORS,
    appointment_status: APPOINTMENT_STATUS_COLORS,
    appointment_type: {},
    stock_status: STOCK_STATUS_COLORS,
    role: ROLE_COLORS,
  }

  const label = labels[type]?.[value] ?? value
  const color = colors[type]?.[value] ?? 'bg-[#dfe2eb]/10 text-[#bec9c9]'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold',
        color,
        pulse && 'animate-pulse',
        className
      )}
    >
      {label}
    </span>
  )
}
