import { formatCurrency } from '@/lib/utils'

const MASK = '•••••'

interface FinanceiroCardProps {
  income: number
  expenses: number
  netResult: number
  revenueGoal?: number
  hidden?: boolean
}

export function FinanceiroCard({ income, expenses, netResult, revenueGoal = 25000, hidden = false }: FinanceiroCardProps) {
  const progress = Math.min(Math.round((income / revenueGoal) * 100), 100)
  const isPositive = netResult >= 0
  const fmt = (v: number) => (hidden ? MASK : formatCurrency(v))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#f5f6f8] rounded-xl p-3">
          <p className="text-[10px] font-bold text-[#718096] uppercase tracking-wider mb-1">Receita</p>
          <p className="font-technical text-sm font-bold text-[#00BCE4]">{fmt(income)}</p>
        </div>
        <div className="bg-[#f5f6f8] rounded-xl p-3">
          <p className="text-[10px] font-bold text-[#718096] uppercase tracking-wider mb-1">Despesas</p>
          <p className="font-technical text-sm font-bold text-red-500">{fmt(expenses)}</p>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold text-[#718096] uppercase tracking-wider mb-1">Resultado Líquido</p>
        <p className={`font-technical text-2xl font-bold ${isPositive ? 'text-[#00BCE4]' : 'text-red-500'}`}>
          {hidden ? MASK : `${isPositive ? '' : '-'}${formatCurrency(Math.abs(netResult))}`}
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">Meta do Mês</span>
          <span className="font-technical text-xs font-bold text-[#021541]">{hidden ? '–' : `${progress}%`}</span>
        </div>
        <div className="h-1.5 bg-[#f5f6f8] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#00BCE4] to-[#021541] rounded-full transition-all"
            style={{ width: hidden ? '0%' : `${progress}%` }}
          />
        </div>
        <p className="font-technical text-[10px] text-[#718096] mt-1">
          Meta: {hidden ? MASK : formatCurrency(revenueGoal)}
        </p>
      </div>
    </div>
  )
}
