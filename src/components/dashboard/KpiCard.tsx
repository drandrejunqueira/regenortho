import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string | number
  delta?: number
  accent?: 'cyan' | 'gold' | 'error' | 'tertiary' | 'green' | 'navy' | 'teal'
  icon?: string | React.ComponentType<{ className?: string }>
}

const ACCENT_COLORS: Record<string, { border: string; icon: string; bg: string }> = {
  cyan:     { border: 'border-t-[#00BCE4]', icon: 'text-[#00BCE4]',  bg: 'rgba(0,188,228,0.07)' },
  teal:     { border: 'border-t-[#00BCE4]', icon: 'text-[#00BCE4]',  bg: 'rgba(0,188,228,0.07)' },
  gold:     { border: 'border-t-[#e6c364]', icon: 'text-[#c9a227]',  bg: 'rgba(230,195,100,0.08)' },
  error:    { border: 'border-t-[#ef4444]', icon: 'text-[#ef4444]',  bg: 'rgba(239,68,68,0.07)' },
  tertiary: { border: 'border-t-[#7c3aed]', icon: 'text-[#7c3aed]',  bg: 'rgba(124,58,237,0.07)' },
  navy:     { border: 'border-t-[#021541]', icon: 'text-[#021541]/50', bg: 'rgba(2,21,65,0.04)' },
  green:    { border: 'border-t-[#16a34a]', icon: 'text-[#16a34a]',  bg: 'rgba(22,163,74,0.07)' },
  red:      { border: 'border-t-[#ef4444]', icon: 'text-[#ef4444]',  bg: 'rgba(239,68,68,0.07)' },
}

export function KpiCard({ title, value, delta, accent = 'cyan', icon }: KpiCardProps) {
  const colors = ACCENT_COLORS[accent] ?? ACCENT_COLORS.cyan
  const isStringIcon = typeof icon === 'string'

  return (
    <div
      className={cn(
        'border-t-2 p-5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 cursor-default',
        colors.border,
      )}
      style={{
        background: '#ffffff',
        border: '1px solid rgba(2,21,65,0.06)',
        borderTopWidth: '2px',
        boxShadow: '0 2px 12px rgba(2,21,65,0.04)',
      }}
    >
      <div className="flex justify-between items-start mb-4">
        <p
          className="text-[10px] font-bold text-[#021541]/45 uppercase tracking-wider leading-snug pr-2"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          {title}
        </p>
        {icon && isStringIcon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: colors.bg }}
          >
            <span className={cn('material-symbols-outlined', colors.icon)} style={{ fontSize: '18px' }}>
              {icon as string}
            </span>
          </div>
        )}
        {icon && !isStringIcon && (() => {
          const IconComponent = icon as React.ComponentType<{ className?: string }>
          return (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: colors.bg }}>
              <IconComponent className={cn('w-4 h-4', colors.icon)} />
            </div>
          )
        })()}
      </div>
      <div className="flex items-baseline gap-3">
        <span
          className="text-3xl font-bold text-[#021541]"
          style={{ fontFamily: 'Noto Serif, serif' }}
        >
          {value}
        </span>
        {delta !== undefined && delta !== 0 && (
          <span className={cn(
            'text-xs font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full',
            delta > 0
              ? 'text-[#16a34a] bg-[rgba(22,163,74,0.08)]'
              : 'text-[#ef4444] bg-[rgba(239,68,68,0.08)]'
          )}>
            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
              {delta > 0 ? 'trending_up' : 'trending_down'}
            </span>
            {Math.abs(delta)}%
          </span>
        )}
      </div>
    </div>
  )
}
