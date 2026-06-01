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
  new: 'bg-cyan-50 text-cyan-700',
  contacted: 'bg-blue-50 text-blue-700',
  scheduled: 'bg-violet-50 text-violet-700',
  attended: 'bg-green-50 text-green-700',
  active_patient: 'bg-emerald-50 text-emerald-700',
  lost: 'bg-red-50 text-red-600',
}

const APPOINTMENT_STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-cyan-50 text-cyan-700',
  confirmed: 'bg-green-50 text-green-700',
  attended: 'bg-emerald-50 text-emerald-700',
  no_show: 'bg-red-50 text-red-600',
  rescheduled: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-slate-50 text-slate-500',
}

const STOCK_STATUS_COLORS: Record<string, string> = {
  ok: 'bg-cyan-50 text-cyan-700',
  low: 'bg-amber-50 text-amber-700',
  critical: 'bg-red-50 text-red-600',
  out_of_stock: 'bg-red-50 text-red-600',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-violet-50 text-violet-700',
  receptionist: 'bg-cyan-50 text-cyan-700',
  financial: 'bg-green-50 text-green-700',
  doctor: 'bg-violet-50 text-violet-700',
}

const SOURCE_COLORS: Record<string, string> = {
  google_ads: 'bg-cyan-50 text-cyan-700',
  meta_ads: 'bg-violet-50 text-violet-700',
  instagram_organic: 'bg-pink-50 text-pink-700',
  facebook_organic: 'bg-blue-50 text-blue-700',
  google_organic: 'bg-green-50 text-green-700',
  referral: 'bg-amber-50 text-amber-700',
  whatsapp: 'bg-emerald-50 text-emerald-700',
  other: 'bg-slate-50 text-slate-500',
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
  const color = colors[type]?.[value] ?? 'bg-slate-50 text-slate-500'

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
