'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface DataPoint {
  date: string
  label: string
  value: number
}

interface Props {
  data: DataPoint[]
}

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
      <p style={{ fontSize: '14px', fontWeight: 700, color: '#021541' }}>
        {payload[0].value} {payload[0].value === 1 ? 'lead' : 'leads'}
      </p>
    </div>
  )
}

export function LeadsBarChart({ data }: Props) {
  const maxVal = Math.max(...data.map((d) => d.value), 1)

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={28}>
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
          allowDecimals={false}
          domain={[0, Math.ceil(maxVal * 1.4)]}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: 'rgba(2,21,65,0.04)', radius: 6 }}
        />
        <Bar
          dataKey="value"
          radius={[6, 6, 0, 0]}
          isAnimationActive
          animationBegin={120}
          animationDuration={750}
          animationEasing="ease-out"
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.value === maxVal && entry.value > 0 ? '#021541' : 'rgba(2,21,65,0.18)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
