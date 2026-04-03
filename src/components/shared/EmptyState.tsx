import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: string | React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  const isString = typeof icon === 'string'
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      {icon && (
        <div className="w-12 h-12 rounded-full bg-[#1c2026] flex items-center justify-center mb-4">
          {isString ? (
            <span className="material-symbols-outlined text-[#bec9c9]" style={{ fontSize: '24px' }}>{icon as string}</span>
          ) : (() => {
            const Icon = icon as React.ComponentType<{ className?: string }>
            return <Icon className="w-6 h-6 text-[#bec9c9]" />
          })()}
        </div>
      )}
      <h3 className="text-sm font-medium text-[#dfe2eb] mb-1">{title}</h3>
      {description && <p className="text-sm text-[#bec9c9] max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
