'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { APPOINTMENT_TYPE_LABELS, APPOINTMENT_STATUS_LABELS } from '@/lib/constants'
import type { Appointment } from '@/types'

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7–19
const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']

const TYPE_COLORS: Record<string, string> = {
  consultation: 'bg-[rgba(0,151,167,0.12)] text-[#005b6e] border-l-2 border-[#00BCD4]',
  return: 'bg-[rgba(0,91,110,0.10)] text-[#005b6e] border-l-2 border-[#00BCD4]',
  prp: 'bg-[rgba(230,195,100,0.15)] text-[#7a6000] border-l-2 border-[#e6c364]',
  bmac: 'bg-[rgba(230,195,100,0.15)] text-[#7a6000] border-l-2 border-[#e6c364]',
  hyaluronic: 'bg-[rgba(230,195,100,0.15)] text-[#7a6000] border-l-2 border-[#e6c364]',
  prolotherapy: 'bg-[rgba(230,195,100,0.15)] text-[#7a6000] border-l-2 border-[#e6c364]',
  surgery: 'bg-[rgba(120,75,191,0.12)] text-[#5b3a9e] border-l-2 border-[#d3bbff]',
  block: 'bg-[rgba(147,0,10,0.08)] text-[#93000a] border-l-2 border-[#ffb4ab]',
}

function getWeekDays(baseDate: Date) {
  const day = baseDate.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(baseDate)
  monday.setDate(baseDate.getDate() + diff)
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

interface Doctor { id: string; name: string; googleCalendarId: string | null }

export default function AgendaPage() {
  const [baseDate, setBaseDate] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [newDialog, setNewDialog] = useState(false)
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all')

  useEffect(() => {
    fetch('/api/usuarios')
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) setDoctors(data.filter((u: { role: string }) => u.role === 'doctor'))
      })
      .catch(() => {})
  }, [])

  const weekDays = getWeekDays(baseDate)
  const weekStart = weekDays[0]
  const weekEnd = weekDays[4]

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const start = weekStart.toISOString()
      const end = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59).toISOString()
      const doctorParam = selectedDoctorId !== 'all' ? `&doctorId=${selectedDoctorId}` : ''
      const res = await fetch(`/api/agenda?start=${start}&end=${end}${doctorParam}`)
      if (res.ok) {
        const { data } = await res.json()
        setAppointments(data)
      }
    } finally {
      setLoading(false)
    }
  }, [weekStart.toISOString(), selectedDoctorId])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  function getAptForSlot(dayDate: Date, hour: number) {
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.startAt)
      return (
        aptDate.getDate() === dayDate.getDate() &&
        aptDate.getMonth() === dayDate.getMonth() &&
        aptDate.getHours() === hour
      )
    })
  }

  async function updateStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/agenda/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      toast.success('Status atualizado')
      setDetailOpen(false)
      fetchAppointments()
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  const prevWeek = () => { const d = new Date(baseDate); d.setDate(d.getDate() - 7); setBaseDate(d) }
  const nextWeek = () => { const d = new Date(baseDate); d.setDate(d.getDate() + 7); setBaseDate(d) }
  const todayFn = () => setBaseDate(new Date())
  const formatMonthYear = () => weekStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Agenda"
        description="Visualize e gerencie os agendamentos"
        action={
          <button
            onClick={() => setNewDialog(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#021541] text-white text-sm font-bold hover:bg-[#032170] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Novo Agendamento
          </button>
        }
      />

      {/* Seletor de médico + nav */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Filtro de médico */}
        <div className="flex items-center gap-1 bg-white border border-[rgba(2,21,65,0.06)] rounded-xl p-1">
          <button
            onClick={() => setSelectedDoctorId('all')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
              selectedDoctorId === 'all'
                ? 'bg-[rgba(0,188,228,0.08)] text-[#00BCE4]'
                : 'text-[#718096] hover:text-[#021541]'
            )}
          >
            Todos
          </button>
          {doctors.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setSelectedDoctorId(doc.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                selectedDoctorId === doc.id
                  ? 'bg-[rgba(0,188,228,0.08)] text-[#00BCE4]'
                  : 'text-[#718096] hover:text-[#021541]'
              )}
            >
              {doc.name.split(' ')[0]}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-[rgba(2,21,65,0.10)]" />

        <button
          onClick={prevWeek}
          className="p-2 rounded-xl bg-white border border-[rgba(2,21,65,0.06)] text-[#718096] hover:text-[#00BCE4] transition-colors"
          aria-label="Semana anterior"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
        </button>
        <button
          onClick={todayFn}
          className="px-3 py-1.5 rounded-xl bg-white border border-[rgba(2,21,65,0.06)] text-sm font-medium text-[#718096] hover:text-[#00BCE4] transition-colors"
        >
          Hoje
        </button>
        <button
          onClick={nextWeek}
          className="p-2 rounded-xl bg-white border border-[rgba(2,21,65,0.06)] text-[#718096] hover:text-[#00BCE4] transition-colors"
          aria-label="Próxima semana"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
        </button>
        <span className="text-sm font-medium text-[#021541] capitalize">{formatMonthYear()}</span>
        {loading && (
          <span className="material-symbols-outlined text-[#718096] animate-spin" style={{ fontSize: '18px' }}>refresh</span>
        )}

        {/* Link para o Google Calendar do médico selecionado */}
        {selectedDoctorId !== 'all' && (() => {
          const doc = doctors.find((d) => d.id === selectedDoctorId)
          if (!doc?.googleCalendarId) return null
          const calUrl = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(doc.googleCalendarId.replace(/\/ical\/.*/, '').replace('https://calendar.google.com/calendar/ical/', '').split('/')[0])}`
          return (
            <a
              href={doc.googleCalendarId}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgba(0,188,228,0.08)] text-[#00BCE4] text-xs font-bold hover:bg-[rgba(0,188,228,0.15)] transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
              Google Calendar
            </a>
          )
        })()}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto rounded-xl border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] bg-white">
        <div className="grid min-w-[600px]" style={{ gridTemplateColumns: '56px repeat(5, 1fr)' }}>
          {/* Header dias */}
          <div className="bg-white h-10 border-b border-[rgba(2,21,65,0.06)]" />
          {weekDays.map((day, i) => {
            const isToday = day.toDateString() === new Date().toDateString()
            return (
              <div
                key={i}
                className={cn(
                  'border-b border-l border-[rgba(2,21,65,0.06)] h-10 flex flex-col items-center justify-center text-xs font-medium',
                  isToday ? 'bg-[rgba(0,188,228,0.04)]' : 'bg-white'
                )}
              >
                <span className="text-[#718096] text-[10px] uppercase tracking-wider">{DAYS[i]}</span>
                <span className={cn('text-sm font-bold font-technical', isToday ? 'text-[#00BCE4]' : 'text-[#021541]')}>
                  {day.getDate()}
                </span>
              </div>
            )
          })}

          {/* Linhas de horário */}
          {HOURS.map((hour) => (
            <>
              <div key={`t-${hour}`} className="border-b border-[rgba(2,21,65,0.06)] h-14 flex items-start justify-end pr-2 pt-1 bg-[#f5f6f8]">
                <span className="font-technical text-[10px] text-[#718096] font-semibold">{hour}:00</span>
              </div>
              {weekDays.map((day, di) => {
                const isToday = day.toDateString() === new Date().toDateString()
                const slotApts = getAptForSlot(day, hour)
                return (
                  <div
                    key={`s-${hour}-${di}`}
                    className={cn(
                      'border-b border-l border-[rgba(2,21,65,0.06)] h-14 p-0.5 relative',
                      isToday ? 'bg-[rgba(0,188,228,0.02)]' : 'bg-white'
                    )}
                  >
                    {slotApts.map((apt) => {
                      const name = apt.patient?.name ?? apt.lead?.name ?? apt.title ?? '—'
                      return (
                        <button
                          key={apt.id}
                          onClick={() => { setSelectedApt(apt); setDetailOpen(true) }}
                          className={cn(
                            'absolute inset-0.5 rounded-lg text-left px-1.5 text-[10px] font-bold truncate',
                            TYPE_COLORS[apt.type] ?? 'bg-[rgba(0,151,167,0.12)] text-[#005b6e]'
                          )}
                          title={name}
                        >
                          {name}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </>
          ))}
        </div>
      </div>

      {/* Dialog de novo agendamento */}
      <NewAppointmentDialog
        open={newDialog}
        onOpenChange={setNewDialog}
        onCreated={fetchAppointments}
        defaultDoctorId={selectedDoctorId !== 'all' ? selectedDoctorId : undefined}
        doctors={doctors}
      />

      {/* Modal de detalhe */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-sm bg-white border border-[rgba(2,21,65,0.06)]">
          <DialogHeader>
            <DialogTitle className="text-[#021541] font-bold">
              {selectedApt?.patient?.name ?? selectedApt?.lead?.name ?? selectedApt?.title ?? 'Agendamento'}
            </DialogTitle>
          </DialogHeader>
          {selectedApt && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-[rgba(0,188,228,0.1)] text-[#00BCE4] text-[10px] font-bold uppercase tracking-wider">
                  {APPOINTMENT_TYPE_LABELS[selectedApt.type]}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-[rgba(2,21,65,0.05)] text-[#718096] text-[10px] font-bold uppercase tracking-wider">
                  {APPOINTMENT_STATUS_LABELS[selectedApt.status]}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#718096]">
                <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '16px' }}>schedule</span>
                <span className="font-technical">
                  {new Date(selectedApt.startAt).toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
              {selectedApt.room && (
                <p className="text-sm text-[#021541]">
                  <span className="text-[#718096]">Sala: </span>{selectedApt.room}
                </p>
              )}
              {selectedApt.notes && <p className="text-sm text-[#718096] italic">{selectedApt.notes}</p>}

              <div className="grid grid-cols-2 gap-2 pt-2">
                {[
                  { label: 'Confirmar', status: 'confirmed', color: 'text-[#00BCE4]' },
                  { label: 'Compareceu', status: 'attended', color: 'text-[#16a34a]' },
                  { label: 'Faltou', status: 'no_show', color: 'text-[#d97706]' },
                  { label: 'Cancelar', status: 'cancelled', color: 'text-[#dc2626]' },
                ].map((btn) => (
                  <button
                    key={btn.status}
                    onClick={() => updateStatus(selectedApt.id, btn.status)}
                    className={cn(
                      'py-2 rounded-xl bg-[#f5f6f8] border border-[rgba(2,21,65,0.06)] text-sm font-medium hover:bg-[rgba(2,21,65,0.04)] transition-colors',
                      btn.color
                    )}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Patient picker with search + quick create ────────────
function PatientPicker({ value, onChange }: { value: string | null; onChange: (id: string | null, name: string | null) => void }) {
  const [allPatients, setAllPatients] = useState<{ id: string; name: string; phone: string }[]>([])
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')

  useEffect(() => {
    fetch('/api/pacientes?limit=300').then(r => r.json()).then(res => {
      if (res.data) setAllPatients(res.data)
    }).catch(() => {})
  }, [])

  const filtered = search.trim()
    ? allPatients.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.phone.includes(search)
      )
    : allPatients.slice(0, 8)

  const selectedPatient = value ? allPatients.find(p => p.id === value) : null

  async function createAndSelect() {
    if (!newName.trim() || !newPhone.trim()) { toast.error('Nome e telefone obrigatórios'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/pacientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), phone: newPhone.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Paciente cadastrado!')
      setAllPatients(p => [data.data, ...p])
      onChange(data.data.id, data.data.name)
      setShowCreate(false)
      setSearch('')
      setNewName('')
      setNewPhone('')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao cadastrar')
    } finally { setCreating(false) }
  }

  const inputBase = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096] focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30'

  if (selectedPatient) {
    return (
      <div className="flex items-center gap-2 bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#0097a7] to-[#00BCE4] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
          {selectedPatient.name.charAt(0)}
        </div>
        <span className="flex-1 text-sm text-[#021541] font-medium">{selectedPatient.name}</span>
        <button onClick={() => onChange(null, null)} className="text-[#718096] hover:text-[#dc2626] transition-colors">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" style={{ fontSize: '16px' }}>search</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#021541] placeholder:text-[#718096] focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30"
        />
      </div>

      {!showCreate ? (
        <div className="bg-white border border-[rgba(2,21,65,0.06)] rounded-xl overflow-hidden max-h-44 overflow-y-auto">
          {filtered.length === 0 && search ? (
            <p className="text-xs text-[#718096] px-3 py-2 italic">Nenhum paciente encontrado</p>
          ) : filtered.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onChange(p.id, p.name); setSearch('') }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[rgba(2,21,65,0.03)] transition-colors text-left"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#0097a7] to-[#00BCE4] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                {p.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-[#021541] truncate">{p.name}</p>
                <p className="text-[10px] text-[#718096]">{p.phone}</p>
              </div>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[#00BCE4] hover:bg-[rgba(0,188,228,0.05)] transition-colors border-t border-[rgba(2,21,65,0.06)]"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person_add</span>
            Cadastrar novo paciente
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[rgba(2,21,65,0.06)] rounded-xl p-3 space-y-2">
          <p className="text-[10px] font-bold text-[#00BCE4] uppercase tracking-wider">Novo paciente rápido</p>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome completo *" className={inputBase} autoFocus />
          <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Telefone *" className={inputBase} />
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-lg text-xs text-[#718096] bg-[#f5f6f8] border border-[rgba(2,21,65,0.08)] hover:bg-[rgba(2,21,65,0.04)]">
              Cancelar
            </button>
            <button type="button" onClick={createAndSelect} disabled={creating} className="flex-1 py-2 rounded-lg text-xs font-bold bg-gradient-to-br from-[#0097a7] to-[#00BCE4] text-white hover:opacity-90 disabled:opacity-50">
              {creating ? 'Salvando...' : 'Criar e vincular'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NewAppointmentDialog({ open, onOpenChange, onCreated, defaultDoctorId, doctors }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void
  defaultDoctorId?: string; doctors: Doctor[]
}) {
  const [loading, setLoading] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState<string>(defaultDoctorId ?? '')
  const [selectedType, setSelectedType] = useState('consultation')
  const [patientId, setPatientId] = useState<string | null>(null)
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [title, setTitle] = useState('')
  const [room, setRoom] = useState('')
  const [notes, setNotes] = useState('')
  useEffect(() => {
    if (open) setSelectedDoctor(defaultDoctorId ?? '')
    else {
      setSelectedDoctor(defaultDoctorId ?? '')
      setSelectedType('consultation')
      setPatientId(null)
      setStartAt('')
      setEndAt('')
      setTitle('')
      setRoom('')
      setNotes('')
    }
  }, [open, defaultDoctorId])

  async function submit() {
    if (!startAt || !endAt) { toast.error('Informe data/hora de início e fim'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          doctorId: selectedDoctor || null,
          patientId: patientId || null,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          ...(title && { title }),
          ...(room && { room }),
          ...(notes && { notes }),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao criar agendamento')
        return
      }
      toast.success('Agendamento criado!')
      onOpenChange(false)
      onCreated()
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096] focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30'
  const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border border-[rgba(2,21,65,0.06)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#021541] font-bold">Novo Agendamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">

          {/* Médico — botões inline (sem Select UUID bug) */}
          {doctors.length > 0 && (
            <div className="space-y-1.5">
              <label className={labelCls}>Médico</label>
              <div className="flex flex-wrap gap-1.5">
                {doctors.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDoctor(d.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      selectedDoctor === d.id
                        ? 'bg-[rgba(0,188,228,0.08)] text-[#00BCE4] ring-1 ring-[#00BCE4]/30'
                        : 'bg-[#f5f6f8] text-[#718096] hover:text-[#021541] border border-[rgba(2,21,65,0.08)]'
                    )}
                  >
                    {d.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedDoctor('')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    !selectedDoctor
                      ? 'bg-[#f5f6f8] text-[#718096] ring-1 ring-[rgba(2,21,65,0.15)] border border-[rgba(2,21,65,0.08)]'
                      : 'bg-[#f5f6f8] text-[#718096]/60 hover:text-[#718096] border border-[rgba(2,21,65,0.06)]'
                  )}
                >
                  Sem médico
                </button>
              </div>
            </div>
          )}

          {/* Tipo — botões inline */}
          <div className="space-y-1.5">
            <label className={labelCls}>Tipo</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(APPOINTMENT_TYPE_LABELS).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelectedType(k)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    selectedType === k
                      ? 'bg-[rgba(0,188,228,0.08)] text-[#00BCE4] ring-1 ring-[#00BCE4]/30'
                      : 'bg-[#f5f6f8] text-[#718096] hover:text-[#021541] border border-[rgba(2,21,65,0.08)]'
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className={labelCls}>Início *</label>
              <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Fim *</label>
              <input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Paciente — busca + cadastro rápido */}
          <div className="space-y-1.5">
            <label className={labelCls}>Paciente</label>
            <PatientPicker
              value={patientId}
              onChange={(id) => setPatientId(id)}
            />
          </div>

          {/* Título / sala / obs */}
          <div className="space-y-1.5">
            <label className={labelCls}>Título / motivo (opcional)</label>
            <input placeholder="Ex: Retorno, Avaliação pré-op..." value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className={labelCls}>Sala</label>
              <input placeholder="Consultório 1..." value={room} onChange={e => setRoom(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Observações</label>
              <input placeholder="Notas adicionais..." value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={() => onOpenChange(false)} disabled={loading} className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] border border-[rgba(2,21,65,0.08)] hover:bg-[rgba(2,21,65,0.04)] transition-colors">
            Cancelar
          </button>
          <button onClick={submit} disabled={loading} className="px-4 py-2 rounded-full text-sm font-bold bg-[#021541] text-white hover:bg-[#032170] transition-colors disabled:opacity-50">
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
