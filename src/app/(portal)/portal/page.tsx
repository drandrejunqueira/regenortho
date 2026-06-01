'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AuroraBackground } from '@/components/ui/aurora-background'

interface Patient { id: string; name: string; email: string | null; phone: string; birthDate: string | null; insurance: string | null }
interface Appointment { id: string; type: string; status: string; startAt: string; endAt: string; title: string | null; notes: string | null }
interface Treatment { id: string; name: string; status: string; totalSale: string; installments: number; completedAt: string | null; createdAt: string }
interface ExamOrder { id: string; exams: Array<{ name: string }>; urgency: string; status: string; resultUrl: string | null; resultDate: string | null; validUntil: string | null; createdAt: string }
interface Transaction { id: string; description: string; amount: string; type: string; date: string; isPaid: boolean }

const APPT_TYPE: Record<string, string> = {
  consultation: 'Consulta', prp: 'PRP', bmac: 'BMAC', hyaluronic: 'Hialurônico',
  prolotherapy: 'Proloterapia', surgery: 'Cirurgia', return: 'Retorno', block: 'Bloqueio',
}
const APPT_STATUS_COLOR: Record<string, string> = {
  scheduled: '#61d8dd', confirmed: '#a8d5a2', attended: '#a8d5a2',
  no_show: '#ffb4ab', rescheduled: '#e6c364', cancelled: '#ffb4ab',
}
const APPT_STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendado', confirmed: 'Confirmado', attended: 'Realizado',
  no_show: 'Não compareceu', rescheduled: 'Reagendado', cancelled: 'Cancelado',
}
const TREAT_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: '#bec9c9' },
  approved: { label: 'Aprovado', color: '#e6c364' },
  in_progress: { label: 'Em andamento', color: '#61d8dd' },
  completed: { label: 'Concluído', color: '#a8d5a2' },
  cancelled: { label: 'Cancelado', color: '#ffb4ab' },
}
const EXAM_STATUS: Record<string, string> = {
  issued: 'Emitido', scheduled: 'Agendado', collected: 'Coletado',
  result_available: 'Resultado disponível', archived: 'Arquivado',
}

const BRL = (v: string | number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
const fDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')
const fDateTime = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

const TABS = [
  { id: 'agenda',     label: 'Agenda',      icon: 'calendar_today' },
  { id: 'tratamentos', label: 'Tratamentos', icon: 'vaccines' },
  { id: 'exames',     label: 'Exames',      icon: 'biotech' },
  { id: 'pagamentos', label: 'Pagamentos',  icon: 'payments' },
]

function PortalContent() {
  const params = useSearchParams()
  const token = params.get('token')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [exams, setExams] = useState<ExamOrder[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [activeTab, setActiveTab] = useState('agenda')

  useEffect(() => {
    if (!token) { setError('Link de acesso inválido'); setLoading(false); return }
    fetch(`/api/portal/me?token=${token}`)
      .then(r => r.json())
      .then(({ data, error: err }) => {
        if (err) throw new Error(err)
        setPatient(data.patient)
        setAppointments(data.appointments)
        setTreatments(data.treatments)
        setExams(data.exams)
        setTransactions(data.transactions)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  if (!token) return (
    <AuroraBackground className="!h-screen">
      <div className="relative z-10 text-center py-12 px-4 max-w-lg w-full">
        <div className="w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center mx-auto mb-8 shadow-2xl">
          <span className="material-symbols-outlined text-[#61d8dd]" style={{ fontSize: '48px' }}>person_pin</span>
        </div>
        <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Área do Paciente</h1>
        <p className="text-white/70 text-sm mb-10 max-w-xs mx-auto leading-relaxed">
          Para acessar sua área e consultar seus tratamentos e <span className="text-[#61d8dd] font-bold">cashback</span>, utilize o link enviado via WhatsApp.
        </p>
        
        <div className="bg-black/40 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl border border-white/10 space-y-6 text-left">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Não recebeu seu link?</p>
          <div className="space-y-4">
            {[
              { icon: 'chat', color: '#25d366', label: 'Solicitar via WhatsApp', desc: 'Receba seu link instantaneamente' },
              { icon: 'phone', color: '#61d8dd', label: 'Central de Atendimento', desc: 'Ligue para (12) 98176-7896' },
            ].map(item => (
              <a key={item.label} href="https://wa.me/5512981767896" className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-white/5 group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined" style={{ fontSize: '22px', color: item.color }}>{item.icon}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{item.label}</p>
                  <p className="text-xs text-white/50">{item.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-6">
          <a href="/site" className="inline-flex items-center gap-2 text-xs font-bold text-white/40 hover:text-white uppercase tracking-widest transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
            Voltar ao site institucional
          </a>
          
          <div className="flex items-center gap-4 text-[9px] uppercase tracking-[0.3em] text-white/20">
             <span>SJC</span>
             <div className="w-1 h-1 rounded-full bg-white/20" />
             <span>São Paulo</span>
          </div>
        </div>
      </div>
    </AuroraBackground>
  )

  if (loading) return (
    <div className="text-center py-16">
      <div className="w-10 h-10 rounded-full border-2 border-[#61d8dd] border-t-transparent animate-spin mx-auto" />
      <p className="text-sm text-[#bec9c9] mt-4">Carregando seus dados...</p>
    </div>
  )

  if (error || !patient) return (
    <div className="text-center py-16">
      <span className="material-symbols-outlined text-[#ffb4ab]" style={{ fontSize: '48px' }}>error</span>
      <p className="text-base font-bold text-[#dfe2eb] mt-4">Acesso inválido</p>
      <p className="text-sm text-[#bec9c9] mt-2">{error ?? 'Token não encontrado'}</p>
      <p className="text-xs text-[#bec9c9]/60 mt-4">Solicite um novo link de acesso na clínica.</p>
      <a href="/site" className="inline-flex items-center gap-2 mt-6 text-sm text-[#bec9c9] hover:text-[#dfe2eb]">
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
        Voltar ao site
      </a>
    </div>
  )

  const upcoming = appointments.filter(a => new Date(a.startAt) >= new Date() && !['cancelled', 'no_show'].includes(a.status))
  const past = appointments.filter(a => new Date(a.startAt) < new Date() || ['attended', 'no_show'].includes(a.status))

  return (
    <div className="space-y-5">
      {/* Patient header */}
      <div className="bg-[#1c2026] rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#006e72] to-[#61d8dd] flex items-center justify-center text-[#003739] font-bold text-xl select-none shrink-0">
            {patient.name.charAt(0)}
          </div>
          <div>
            <p className="text-base font-bold text-[#dfe2eb]">{patient.name}</p>
            <p className="text-sm text-[#bec9c9]">{patient.phone}{patient.email ? ` · ${patient.email}` : ''}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#3e4949]/20 text-center">
          <div>
            <p className="text-lg font-bold text-[#61d8dd]">{upcoming.length}</p>
            <p className="text-[10px] text-[#bec9c9] uppercase tracking-wider">Próximas consultas</p>
          </div>
          <div>
            <p className="text-lg font-bold text-[#e6c364]">{treatments.length}</p>
            <p className="text-[10px] text-[#bec9c9] uppercase tracking-wider">Tratamentos</p>
          </div>
          <div>
            <p className="text-lg font-bold text-[#a8d5a2]">{exams.length}</p>
            <p className="text-[10px] text-[#bec9c9] uppercase tracking-wider">Exames</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1c2026] rounded-xl p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === tab.id ? 'bg-[#31353c] text-[#dfe2eb]' : 'text-[#bec9c9]/60 hover:text-[#dfe2eb]'}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Agenda */}
      {activeTab === 'agenda' && (
        <div className="space-y-4">
          {upcoming.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider mb-2">Próximas consultas</p>
              <div className="space-y-2">
                {upcoming.map(a => (
                  <div key={a.id} className="bg-[#1c2026] rounded-xl p-4 border-l-4" style={{ borderColor: APPT_STATUS_COLOR[a.status] ?? '#61d8dd' }}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-[#dfe2eb]">{a.title ?? APPT_TYPE[a.type] ?? a.type}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: APPT_STATUS_COLOR[a.status] ?? '#61d8dd', background: `${APPT_STATUS_COLOR[a.status] ?? '#61d8dd'}18` }}>
                        {APPT_STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    </div>
                    <p className="text-sm text-[#bec9c9] mt-1">{fDateTime(a.startAt)}</p>
                    {a.notes && <p className="text-xs text-[#bec9c9]/70 mt-1">{a.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider mb-2">Histórico</p>
              <div className="space-y-2">
                {past.slice(0, 10).map(a => (
                  <div key={a.id} className="bg-[#1c2026] rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[#dfe2eb]">{APPT_TYPE[a.type] ?? a.type}</p>
                      <p className="text-xs text-[#bec9c9] mt-0.5">{fDate(a.startAt)}</p>
                    </div>
                    <span className="text-[10px] text-[#bec9c9]">{APPT_STATUS_LABEL[a.status] ?? a.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {appointments.length === 0 && (
            <div className="bg-[#1c2026] rounded-xl py-12 text-center">
              <span className="material-symbols-outlined text-[#bec9c9]/20" style={{ fontSize: '40px' }}>calendar_today</span>
              <p className="text-sm text-[#bec9c9] mt-3">Nenhum agendamento</p>
            </div>
          )}
        </div>
      )}

      {/* Tratamentos */}
      {activeTab === 'tratamentos' && (
        <div className="space-y-3">
          {treatments.length === 0 ? (
            <div className="bg-[#1c2026] rounded-xl py-12 text-center">
              <span className="material-symbols-outlined text-[#bec9c9]/20" style={{ fontSize: '40px' }}>vaccines</span>
              <p className="text-sm text-[#bec9c9] mt-3">Nenhum tratamento</p>
            </div>
          ) : treatments.map(t => {
            const cfg = TREAT_STATUS[t.status]
            return (
              <div key={t.id} className="bg-[#1c2026] rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#dfe2eb]">{t.name}</p>
                    <p className="text-xs text-[#bec9c9] mt-0.5">{fDate(t.createdAt)}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ color: cfg.color, background: `${cfg.color}18` }}>
                    {cfg.label}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#3e4949]/20">
                  <p className="text-sm font-bold text-[#61d8dd]">{BRL(t.totalSale)}</p>
                  {t.installments > 1 && <p className="text-xs text-[#bec9c9]">{t.installments}x de {BRL(Number(t.totalSale) / t.installments)}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Exames */}
      {activeTab === 'exames' && (
        <div className="space-y-3">
          {exams.length === 0 ? (
            <div className="bg-[#1c2026] rounded-xl py-12 text-center">
              <span className="material-symbols-outlined text-[#bec9c9]/20" style={{ fontSize: '40px' }}>biotech</span>
              <p className="text-sm text-[#bec9c9] mt-3">Nenhum pedido de exame</p>
            </div>
          ) : exams.map(ex => (
            <div key={ex.id} className="bg-[#1c2026] rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-[#dfe2eb]">{ex.exams.map(e => e.name).join(', ')}</p>
                <span className="text-[10px] text-[#bec9c9] shrink-0">{EXAM_STATUS[ex.status] ?? ex.status}</span>
              </div>
              <p className="text-xs text-[#bec9c9] mt-1">{fDate(ex.createdAt)}</p>
              {ex.resultUrl && (
                <a href={ex.resultUrl} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-2 text-xs text-[#61d8dd] bg-[#61d8dd]/10 px-3 py-2 rounded-lg hover:bg-[#61d8dd]/20">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                  Ver resultado {ex.resultDate ? `— ${fDate(ex.resultDate)}` : ''}
                </a>
              )}
              {!ex.resultUrl && ex.validUntil && (
                <p className="text-[11px] text-[#bec9c9]/60 mt-2">Válido até: {fDate(ex.validUntil)}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagamentos */}
      {activeTab === 'pagamentos' && (
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <div className="bg-[#1c2026] rounded-xl py-12 text-center">
              <span className="material-symbols-outlined text-[#bec9c9]/20" style={{ fontSize: '40px' }}>payments</span>
              <p className="text-sm text-[#bec9c9] mt-3">Nenhum registro financeiro</p>
            </div>
          ) : transactions.map(tx => (
            <div key={tx.id} className="bg-[#1c2026] rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-[#dfe2eb]">{tx.description}</p>
                <p className="text-xs text-[#bec9c9] mt-0.5">{fDate(tx.date)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${tx.type === 'income' ? 'text-[#a8d5a2]' : 'text-[#ffb4ab]'}`}>{BRL(tx.amount)}</p>
                <p className={`text-[10px] font-bold ${tx.isPaid ? 'text-[#a8d5a2]' : 'text-[#e6c364]'}`}>{tx.isPaid ? 'Pago' : 'Pendente'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PortalPage() {
  return (
    <Suspense fallback={<p className="text-center py-16 text-sm text-[#bec9c9]">Carregando...</p>}>
      <PortalContent />
    </Suspense>
  )
}
