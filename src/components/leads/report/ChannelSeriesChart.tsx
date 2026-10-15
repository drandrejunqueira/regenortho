'use client'

// Colunas empilhadas por canal ao longo do período. Cor fixa por canal (nunca
// por ranking) e sem animação: o PDF é tirado logo depois de carregar e uma
// barra no meio da transição sairia cortada na impressão.
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LEAD_CHANNEL_COLORS, LEAD_CHANNEL_LABELS, type LeadChannel } from '@/lib/leadChannels'
import { formatDayMonth, type ReportSeriesPoint } from '@/lib/leadReport'

const AXIS_TICK = { fontSize: 11, fill: '#718096' }
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function formatSeriesKey(key: string, granularity: 'day' | 'month'): string {
  if (granularity === 'day') return formatDayMonth(key)
  const [y, m] = key.split('-')
  return `${MONTHS[Number(m) - 1]}/${y.slice(2)}`
}

interface Props {
  points: ReportSeriesPoint[]
  granularity: 'day' | 'month'
  channels: readonly LeadChannel[]
}

function SeriesTooltip({
  active,
  payload,
  label,
  granularity,
  channels,
}: Omit<Props, 'points'> & {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: unknown }>
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload as ReportSeriesPoint | undefined
  if (!point) return null
  return (
    <div
      className="rounded-xl bg-white px-3 py-2.5 text-xs"
      style={{ border: '1px solid rgba(2,21,65,0.10)', boxShadow: '0 8px 24px rgba(2,21,65,0.12)' }}
    >
      <p className="mb-1.5 font-bold text-[#021541]">
        {formatSeriesKey(String(label), granularity)}
      </p>
      {channels.map((c) => (
        <p key={c} className="flex items-center gap-2 text-[#4A5568]">
          <span className="h-2 w-2 rounded-full" style={{ background: LEAD_CHANNEL_COLORS[c] }} />
          {LEAD_CHANNEL_LABELS[c]}
          <span className="ml-auto pl-4 font-bold tabular-nums text-[#021541]">{point[c]}</span>
        </p>
      ))}
      {channels.length > 1 && (
        <p className="mt-1.5 flex border-t border-[rgba(2,21,65,0.08)] pt-1.5 font-bold text-[#021541]">
          Total <span className="ml-auto tabular-nums">{point.total}</span>
        </p>
      )}
    </div>
  )
}

export function ChannelSeriesChart({ points, granularity, channels }: Props) {
  const top = channels[channels.length - 1]

  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart
        data={points}
        margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
        barCategoryGap="22%"
      >
        <CartesianGrid vertical={false} stroke="#e8eaef" />
        <XAxis
          dataKey="key"
          tickFormatter={(k: string) => formatSeriesKey(k, granularity)}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: '#cbd2dc' }}
          interval="preserveStartEnd"
          minTickGap={14}
        />
        <YAxis
          allowDecimals={false}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          content={({ active, payload, label }) => (
            <SeriesTooltip
              active={active}
              payload={payload}
              label={label}
              granularity={granularity}
              channels={channels}
            />
          )}
          cursor={{ fill: 'rgba(2,21,65,0.04)' }}
        />
        {channels.map((c) => (
          <Bar
            key={c}
            dataKey={c}
            name={LEAD_CHANNEL_LABELS[c]}
            stackId="leads"
            fill={LEAD_CHANNEL_COLORS[c]}
            // Traço na cor do fundo = o vão de 2px entre segmentos empilhados.
            stroke="#ffffff"
            strokeWidth={1}
            maxBarSize={24}
            radius={c === top ? [4, 4, 0, 0] : 0}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
