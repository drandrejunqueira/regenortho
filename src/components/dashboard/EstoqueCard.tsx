import type { Material } from '@/types'

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  ok: { bg: 'bg-[#61d8dd]/10', text: 'text-[#61d8dd]', label: 'OK' },
  low: { bg: 'bg-[#e6c364]/10', text: 'text-[#e6c364]', label: 'Baixo' },
  critical: { bg: 'bg-[#ffb4ab]/10', text: 'text-[#ffb4ab]', label: 'Crítico' },
  out_of_stock: { bg: 'bg-[#ffb4ab]/10', text: 'text-[#ffb4ab]', label: 'Zerado' },
}

export function EstoqueCard({ materials }: { materials: Material[] }) {
  if (!materials.length) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-[#bec9c9]">
        <span className="material-symbols-outlined text-[32px] mb-2 opacity-30">inventory_2</span>
        <p className="text-sm">Todos os itens em níveis normais</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {materials.map((mat) => {
        const isCritical = mat.status === 'critical' || mat.status === 'out_of_stock'
        const style = STATUS_STYLES[mat.status] ?? STATUS_STYLES.ok

        return (
          <li key={mat.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {isCritical && (
                <span className="material-symbols-outlined text-[#ffb4ab] shrink-0" style={{ fontSize: '14px' }}>
                  warning
                </span>
              )}
              <span className="text-sm font-medium text-[#dfe2eb] truncate">{mat.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-technical text-[10px] text-[#bec9c9]">
                {mat.currentStock}/{mat.minimumStock * 2} {mat.unit}
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${style.bg} ${style.text}`}>
                {style.label}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
