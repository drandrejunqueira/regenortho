import { formatCurrency } from '@/lib/utils'

interface FinanceiroCardProps {
  income: number
  expenses: number
  netResult: number
  revenueGoal?: number
}

export function FinanceiroCard({ income, expenses, netResult, revenueGoal = 25000 }: FinanceiroCardProps) {
  const progress = Math.min(Math.round((income / revenueGoal) * 100), 100)
  const isPositive = netResult >= 0

  return (
    <div className="space-y-4">
      {/* Receita e Despesa */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#181c22] rounded-xl p-3">
          <p className="text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider mb-1">Receita</p>
          <p className="font-technical text-sm font-bold text-[#61d8dd]">{formatCurrency(income)}</p>
        </div>
        <div className="bg-[#181c22] rounded-xl p-3">
          <p className="text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider mb-1">Despesas</p>
          <p className="font-technical text-sm font-bold text-[#ffb4ab]">{formatCurrency(expenses)}</p>
        </div>
      </div>

      {/* Resultado líquido */}
      <div>
        <p className="text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider mb-1">Resultado Líquido</p>
        <p className={`font-technical text-2xl font-bold ${isPositive ? 'text-[#61d8dd]' : 'text-[#ffb4ab]'}`}>
          {isPositive ? '' : '-'}{formatCurrency(Math.abs(netResult))}
        </p>
      </div>

      {/* Meta de faturamento */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider">Meta do Mês</span>
          <span className="font-technical text-xs font-bold text-[#dfe2eb]">{progress}%</span>
        </div>
        <div className="h-1.5 bg-[#262a31] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#006e72] to-[#61d8dd] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="font-technical text-[10px] text-[#bec9c9] mt-1">
          Meta: {formatCurrency(revenueGoal)}
        </p>
      </div>
    </div>
  )
}
