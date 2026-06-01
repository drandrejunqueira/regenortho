'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface DataPoint {
  date: string
  label: string
  value: number
}

interface Props {
  data: DataPoint[]
}

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(2,21,65,0.08)', borderRadius: '12px', color: '#021541', padding: '8px 12px', boxShadow: '0 4px 12px rgba(2,21,65,0.08)' }}>
      <p style={{ fontSize: '11px', color: '#718096', marginBottom: '2px' }}>{label}</p>
      <p style={{ fontSize: '14px', fontWeight: 700, color: '#00BCE4' }}>{BRL(payload[0].value)}</p>
    </div>
  )
}

export function RevenueChart({ data }: Props) {
  const hasData = data.some((d) => d.value > 0)
  const maxVal = Math.max(...data.map((d) => d.value), 100)

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00BCE4" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#00BCE4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(2,21,65,0.06)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#718096' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#718096' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => (v === 0 ? '0' : `${(v / 1000).toFixed(0)}k`)}
          domain={[0, Math.ceil(maxVal * 1.25)]}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: 'rgba(0,188,228,0.2)', strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#00BCE4"
          strokeWidth={2}
          fill="url(#revenueGrad)"
          dot={hasData ? { fill: '#00BCE4', strokeWidth: 0, r: 4 } : false}
          activeDot={{ r: 6, fill: '#00BCE4', stroke: '#ffffff', strokeWidth: 2 }}
          isAnimationActive
          animationBegin={0}
          animationDuration={900}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
