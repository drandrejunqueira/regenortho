'use client'

interface FunnelData {
  new: number
  contacted: number
  scheduled: number
  attended: number
  active: number
}

export function FunnelChart({ data }: { data: FunnelData }) {
  const steps = [
    { label: 'Leads', value: data.new, color: '#00BCE4' },
    { label: 'Contato', value: data.contacted, color: '#00BCE4' },
    { label: 'Agendados', value: data.scheduled, color: '#00BCE4' },
    { label: 'Compareceram', value: data.attended, color: '#00BCE4' },
    { label: 'Ativos', value: data.active, color: '#00BCE4' },
  ]
  const max = Math.max(...steps.map(s => s.value), 1)

  return (
    <div className="flex items-end justify-between gap-2 py-2">
      {steps.map((step, i) => {
        const pct = Math.round((step.value / max) * 100)
        const convRate = i > 0 && steps[i - 1].value > 0
          ? Math.round((step.value / steps[i - 1].value) * 100)
          : null
        return (
          <div key={step.label} className="flex-1 text-center group flex flex-col items-center">
            {convRate !== null ? (
              <p className="font-technical text-[10px] text-[#00BCE4] font-bold mb-2">{convRate}%</p>
            ) : (
              <p className="text-[10px] mb-2 opacity-0">-</p>
            )}
            <p className="font-technical text-2xl font-bold text-[#021541] mb-1">{step.value}</p>
            <p className="text-[10px] uppercase tracking-widest text-[#718096] font-bold mb-3">{step.label}</p>
            <div
              className="h-2 w-full bg-[#00BCE4] rounded-full"
              style={{ opacity: step.label === 'Ativos' ? 1 : 0.3 + (pct / max) * 0.5 }}
            ></div>
          </div>
        )
      })}
    </div>
  )
}
