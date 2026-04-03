import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string | number
  delta?: number
  accent?: 'teal' | 'gold' | 'error' | 'tertiary' | 'green' | 'red' | 'blue'
  icon?: string | React.ComponentType<{ className?: string }> // material symbol name or legacy Lucide component
}

const ACCENT_COLORS: Record<string, { border: string; icon: string }> = {
  teal: { border: 'border-[#61d8dd]', icon: 'text-[#61d8dd]/40' },
  gold: { border: 'border-[#e6c364]', icon: 'text-[#e6c364]/40' },
  error: { border: 'border-[#ffb4ab]', icon: 'text-[#ffb4ab]/40' },
  tertiary: { border: 'border-[#d3bbff]', icon: 'text-[#d3bbff]/40' },
  // Legacy accent names mapped to new system
  green: { border: 'border-[#4ade80]', icon: 'text-[#4ade80]/40' },
  red: { border: 'border-[#ffb4ab]', icon: 'text-[#ffb4ab]/40' },
  blue: { border: 'border-[#61d8dd]', icon: 'text-[#61d8dd]/40' },
}

export function KpiCard({ title, value, delta, accent = 'teal', icon }: KpiCardProps) {
  const colors = ACCENT_COLORS[accent] ?? ACCENT_COLORS.teal
  const isStringIcon = typeof icon === 'string'

  return (
    <div className={cn('bg-[#1c2026] border-t-2 p-5 rounded-xl', colors.border)}>
      <div className="flex justify-between items-start mb-4">
        <p className="text-[11px] font-bold text-[#bec9c9] uppercase tracking-wider">{title}</p>
        {icon && isStringIcon && (
          <span className={cn('material-symbols-outlined text-[22px]', colors.icon)}>
            {icon as string}
          </span>
        )}
        {icon && !isStringIcon && (() => {
          const IconComponent = icon as React.ComponentType<{ className?: string }>
          return <IconComponent className={cn('w-5 h-5', colors.icon)} />
        })()}
      </div>
      <div className="flex items-baseline gap-3">
        <span className="font-technical text-3xl font-bold text-[#dfe2eb]">{value}</span>
        {delta !== undefined && delta !== 0 && (
          <span className={cn('text-xs font-medium flex items-center gap-0.5', delta > 0 ? 'text-[#61d8dd]' : 'text-[#ffb4ab]')}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
              {delta > 0 ? 'trending_up' : 'trending_down'}
            </span>
            {Math.abs(delta)}%
          </span>
        )}
      </div>
    </div>
  )
}
