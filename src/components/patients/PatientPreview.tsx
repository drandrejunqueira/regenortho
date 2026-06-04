'use client'

import { useState, useRef } from 'react'

interface PatientPreviewProps {
  patient: any
  children: React.ReactNode
}

export default function PatientPreview({ patient, children }: PatientPreviewProps) {
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setVisible(true)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setVisible(false)
    }, 200)
  }

  // Cálculos financeiros client-side em tempo real
  const todayStr = new Date().toISOString().split('T')[0]
  const transactions = patient.transactions || []
  
  const totalPaid = transactions
    .filter((t: any) => t.type === 'income' && t.isPaid)
    .reduce((acc: number, t: any) => acc + parseFloat(t.amount || '0'), 0)

  const totalPending = transactions
    .filter((t: any) => t.type === 'income' && !t.isPaid)
    .reduce((acc: number, t: any) => acc + parseFloat(t.amount || '0'), 0)

  const totalOverdue = transactions
    .filter((t: any) => t.type === 'income' && !t.isPaid && t.dueDate && t.dueDate < todayStr)
    .reduce((acc: number, t: any) => acc + parseFloat(t.amount || '0'), 0)

  // Consultas
  const appointments = patient.appointments || []
  const pastAppts = appointments
    .filter((a: any) => new Date(a.startAt) < new Date() && a.status !== 'cancelled')
    .sort((a: any, b: any) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
  
  const futureAppts = appointments
    .filter((a: any) => new Date(a.startAt) >= new Date() && a.status !== 'cancelled')
    .sort((a: any, b: any) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  
  const lastAppt = pastAppts[0]
  const nextAppt = futureAppts[0]

  // Formata BRL
  const BRL = (v: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  }

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="cursor-pointer hover:text-[#00BCE4] hover:underline font-semibold text-[#021541]">
        {children}
      </span>

      {visible && (
        <div 
          className="absolute z-50 bottom-full left-0 mb-3 w-80 bg-white border border-[rgba(2,21,65,0.08)] rounded-2xl shadow-[0_10px_30px_rgba(2,21,65,0.12)] p-4 text-xs space-y-3 pointer-events-auto transition-all animate-in fade-in slide-in-from-bottom-2 duration-200"
          onMouseEnter={() => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setVisible(true) }}
          onMouseLeave={() => setVisible(false)}
        >
          {/* Header com foto/iniciais e contato básico */}
          <div className="flex items-center gap-3 pb-2.5 border-b border-[rgba(2,21,65,0.06)]">
            <div className="w-11 h-11 rounded-full bg-[#f5f6f8] flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden border border-[rgba(2,21,65,0.06)]">
              {patient.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={patient.photoUrl} alt={patient.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#021541] to-[#032170] flex items-center justify-center">
                  {patient.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[#021541] text-sm leading-tight truncate">{patient.name}</p>
              <p className="text-[10px] text-[#718096] mt-0.5 truncate">
                {patient.city || 'Sem cidade'} • {patient.phone}
              </p>
            </div>
          </div>

          {/* Resumo Financeiro (Pago, A vencer, Atrasado/Devendo) */}
          <div className="space-y-1.5">
            <p className="text-[9px] font-bold text-[#718096] uppercase tracking-wider">Situação Financeira</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-emerald-500/5 rounded-xl p-2 text-center border border-emerald-500/10">
                <p className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wider">Pago</p>
                <p className="font-technical text-emerald-700 font-bold mt-0.5 truncate">{BRL(totalPaid)}</p>
              </div>
              <div className="bg-amber-500/5 rounded-xl p-2 text-center border border-amber-500/10">
                <p className="text-[9px] font-semibold text-amber-600 uppercase tracking-wider">A Vencer</p>
                <p className="font-technical text-amber-700 font-bold mt-0.5 truncate">{BRL(totalPending - totalOverdue)}</p>
              </div>
              <div className="bg-rose-500/5 rounded-xl p-2 text-center border border-rose-500/10">
                <p className="text-[9px] font-semibold text-rose-600 uppercase tracking-wider">Atrasado</p>
                <p className="font-technical text-rose-700 font-bold mt-0.5 truncate">{BRL(totalOverdue)}</p>
              </div>
            </div>
          </div>

          {/* Última e Próxima Consulta */}
          <div className="space-y-2 pt-2 border-t border-[rgba(2,21,65,0.06)]">
            <p className="text-[9px] font-bold text-[#718096] uppercase tracking-wider">Agenda do Paciente</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[#718096] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[#718096]" style={{ fontSize: '13px' }}>history</span>
                  Última consulta:
                </span>
                <span className="font-technical text-[#021541] font-medium">
                  {lastAppt 
                    ? new Date(lastAppt.startAt).toLocaleDateString('pt-BR') 
                    : 'Nenhuma'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#718096] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '13px' }}>event</span>
                  Próxima consulta:
                </span>
                <span className="font-technical text-[#00BCE4] font-bold">
                  {nextAppt 
                    ? `${new Date(nextAppt.startAt).toLocaleDateString('pt-BR')} ${new Date(nextAppt.startAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Nenhuma'}
                </span>
              </div>
            </div>
          </div>

          {/* Últimos Tratamentos */}
          {patient.treatments && patient.treatments.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[rgba(2,21,65,0.06)]">
              <p className="text-[9px] font-bold text-[#718096] uppercase tracking-wider">Tratamentos Recentes</p>
              <div className="space-y-1">
                {patient.treatments.slice(0, 2).map((t: any) => (
                  <div key={t.id} className="flex justify-between items-center bg-[#f5f6f8]/60 p-1.5 rounded-lg border border-[rgba(2,21,65,0.02)]">
                    <span className="text-[#021541] truncate max-w-[170px] font-medium">{t.name}</span>
                    <span className="font-technical text-[#718096] font-bold">{BRL(parseFloat(t.totalSale))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
