import { APPOINTMENT_TYPE_LABELS } from '@/lib/constants'
import type { Appointment } from '@/types'

export function AgendaHoje({ appointments }: { appointments: Appointment[] }) {
  if (!appointments.length) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-[#718096]">
        <span className="material-symbols-outlined text-[32px] mb-2 opacity-30">calendar_today</span>
        <p className="text-sm">Sem agendamentos hoje</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {appointments.map((apt) => {
        const patientName = apt.patient?.name ?? apt.lead?.name ?? apt.title ?? 'Sem nome'
        const start = new Date(apt.startAt)
        const timeStr = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        const isCompleted = start < new Date()

        return (
          <li key={apt.id} className={`flex items-start gap-3 ${isCompleted ? 'opacity-50' : ''}`}>
            <div className="flex flex-col items-center">
              <span className="font-technical text-xs text-[#c9a227] font-bold w-10 text-center shrink-0">
                {timeStr}
              </span>
            </div>
            <div className="flex-1 min-w-0 border-l-2 border-[#00BCE4] pl-3">
              <p className="text-sm font-bold text-[#021541] truncate">{patientName}</p>
              <p className="text-xs text-[#718096]">{APPOINTMENT_TYPE_LABELS[apt.type]}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
