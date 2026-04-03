'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { APPOINTMENT_TYPE_LABELS, APPOINTMENT_STATUS_LABELS } from '@/lib/constants'
import type { Appointment } from '@/types'

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7–19
const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']

const TYPE_COLORS: Record<string, string> = {
  consultation: 'bg-[#006e72]/80 text-[#80f4f9] border-l-2 border-[#61d8dd]',
  return: 'bg-[#004f52]/80 text-[#80f4f9] border-l-2 border-[#61d8dd]/60',
  prp: 'bg-[#785d00]/80 text-[#fdd977] border-l-2 border-[#e6c364]',
  bmac: 'bg-[#785d00]/80 text-[#fdd977] border-l-2 border-[#e6c364]',
  hyaluronic: 'bg-[#785d00]/80 text-[#fdd977] border-l-2 border-[#e6c364]',
  prolotherapy: 'bg-[#785d00]/80 text-[#fdd977] border-l-2 border-[#e6c364]',
  surgery: 'bg-[#744bbf]/80 text-[#e9daff] border-l-2 border-[#d3bbff]',
  block: 'bg-[#93000a]/40 text-[#ffb4ab] border-l-2 border-[#ffb4ab]',
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

export default function AgendaPage() {
  const [baseDate, setBaseDate] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [newDialog, setNewDialog] = useState(false)
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const weekDays = getWeekDays(baseDate)
  const weekStart = weekDays[0]
  const weekEnd = weekDays[4]

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const start = weekStart.toISOString()
      const end = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59).toISOString()
      const res = await fetch(`/api/agenda?start=${start}&end=${end}`)
      if (res.ok) {
        const { data } = await res.json()
        setAppointments(data)
      }
    } finally {
      setLoading(false)
    }
  }, [weekStart.toISOString()])

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
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-[#006e72] to-[#61d8dd] text-[#003739] text-sm font-bold hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Novo Agendamento
          </button>
        }
      />

      {/* Week nav */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={prevWeek}
          className="p-2 rounded-xl bg-[#1c2026] text-[#bec9c9] hover:text-[#61d8dd] transition-colors"
          aria-label="Semana anterior"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
        </button>
        <button
          onClick={todayFn}
          className="px-3 py-1.5 rounded-xl bg-[#1c2026] text-sm font-medium text-[#bec9c9] hover:text-[#61d8dd] transition-colors"
        >
          Hoje
        </button>
        <button
          onClick={nextWeek}
          className="p-2 rounded-xl bg-[#1c2026] text-[#bec9c9] hover:text-[#61d8dd] transition-colors"
          aria-label="Próxima semana"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
        </button>
        <span className="text-sm font-medium text-[#dfe2eb] capitalize">{formatMonthYear()}</span>
        {loading && (
          <span className="material-symbols-outlined text-[#bec9c9] animate-spin" style={{ fontSize: '18px' }}>refresh</span>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto rounded-xl bg-[#1c2026]">
        <div className="grid min-w-[600px]" style={{ gridTemplateColumns: '56px repeat(5, 1fr)' }}>
          {/* Header dias */}
          <div className="bg-[#262a31] h-10 border-b border-[#3e4949]/20" />
          {weekDays.map((day, i) => {
            const isToday = day.toDateString() === new Date().toDateString()
            return (
              <div
                key={i}
                className={cn(
                  'border-b border-l border-[#3e4949]/20 h-10 flex flex-col items-center justify-center text-xs font-medium bg-[#262a31]',
                  isToday && 'text-[#61d8dd]'
                )}
              >
                <span className="text-[#bec9c9] text-[10px] uppercase tracking-wider">{DAYS[i]}</span>
                <span className={cn('text-sm font-bold font-technical', isToday ? 'text-[#61d8dd]' : 'text-[#dfe2eb]')}>
                  {day.getDate()}
                </span>
              </div>
            )
          })}

          {/* Linhas de horário */}
          {HOURS.map((hour) => (
            <>
              <div key={`t-${hour}`} className="border-b border-[#3e4949]/20 h-14 flex items-start justify-end pr-2 pt-1">
                <span className="font-technical text-[10px] text-[#e6c364] font-bold">{hour}:00</span>
              </div>
              {weekDays.map((day, di) => {
                const slotApts = getAptForSlot(day, hour)
                return (
                  <div key={`s-${hour}-${di}`} className="border-b border-l border-[#3e4949]/20 h-14 p-0.5 relative">
                    {slotApts.map((apt) => {
                      const name = apt.patient?.name ?? apt.lead?.name ?? apt.title ?? '—'
                      return (
                        <button
                          key={apt.id}
                          onClick={() => { setSelectedApt(apt); setDetailOpen(true) }}
                          className={cn(
                            'absolute inset-0.5 rounded-lg text-left px-1.5 text-[10px] font-bold truncate',
                            TYPE_COLORS[apt.type] ?? 'bg-[#006e72]/80 text-[#80f4f9]'
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
      <NewAppointmentDialog open={newDialog} onOpenChange={setNewDialog} onCreated={fetchAppointments} />

      {/* Modal de detalhe */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-sm bg-[#1c2026] border-[#3e4949]/20">
          <DialogHeader>
            <DialogTitle className="text-[#dfe2eb] font-bold">
              {selectedApt?.patient?.name ?? selectedApt?.lead?.name ?? selectedApt?.title ?? 'Agendamento'}
            </DialogTitle>
          </DialogHeader>
          {selectedApt && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-[#006e72]/20 text-[#61d8dd] text-[10px] font-bold uppercase tracking-wider">
                  {APPOINTMENT_TYPE_LABELS[selectedApt.type]}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-[#31353c] text-[#bec9c9] text-[10px] font-bold uppercase tracking-wider">
                  {APPOINTMENT_STATUS_LABELS[selectedApt.status]}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#bec9c9]">
                <span className="material-symbols-outlined text-[#61d8dd]/60" style={{ fontSize: '16px' }}>schedule</span>
                <span className="font-technical">
                  {new Date(selectedApt.startAt).toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
              {selectedApt.room && (
                <p className="text-sm text-[#dfe2eb]">
                  <span className="text-[#bec9c9]">Sala: </span>{selectedApt.room}
                </p>
              )}
              {selectedApt.notes && <p className="text-sm text-[#bec9c9] italic">{selectedApt.notes}</p>}

              <div className="grid grid-cols-2 gap-2 pt-2">
                {[
                  { label: 'Confirmar', status: 'confirmed', color: 'text-[#61d8dd]' },
                  { label: 'Compareceu', status: 'attended', color: 'text-[#4ade80]' },
                  { label: 'Faltou', status: 'no_show', color: 'text-[#e6c364]' },
                  { label: 'Cancelar', status: 'cancelled', color: 'text-[#ffb4ab]' },
                ].map((btn) => (
                  <button
                    key={btn.status}
                    onClick={() => updateStatus(selectedApt.id, btn.status)}
                    className={cn(
                      'py-2 rounded-xl bg-[#262a31] text-sm font-medium hover:bg-[#31353c] transition-colors',
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

function NewAppointmentDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    type: 'consultation',
    startAt: '',
    endAt: '',
    title: '',
    room: '',
    notes: '',
  })

  async function submit() {
    if (!form.startAt || !form.endAt) { toast.error('Informe data/hora de início e fim'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(),
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Agendamento criado')
      onOpenChange(false)
      onCreated()
      setForm({ type: 'consultation', startAt: '', endAt: '', title: '', room: '', notes: '' })
    } catch {
      toast.error('Erro ao criar agendamento')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-[#31353c] border-none rounded-xl px-3 py-2.5 text-sm text-[#dfe2eb] placeholder:text-[#bec9c9]/40 focus:outline-none focus:ring-2 focus:ring-[#61d8dd]/30'
  const labelCls = 'text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#1c2026] border-[#3e4949]/20">
        <DialogHeader>
          <DialogTitle className="text-[#dfe2eb] font-bold">Novo Agendamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className={labelCls}>Tipo</label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v ?? 'consultation' })}>
              <SelectTrigger className="bg-[#31353c] border-none rounded-xl text-sm text-[#dfe2eb] h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#31353c] border-[#3e4949]/30">
                {Object.entries(APPOINTMENT_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-[#dfe2eb] text-sm">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className={labelCls}>Início *</label>
              <input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Fim *</label>
              <input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Título / Paciente</label>
            <input placeholder="Nome do paciente ou título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Sala</label>
            <input placeholder="Consultório 1, Sala de Procedimentos..." value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Observações</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls + ' resize-none'} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={() => onOpenChange(false)} disabled={loading} className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#bec9c9] bg-[#31353c] hover:bg-[#262a31] transition-colors">
            Cancelar
          </button>
          <button onClick={submit} disabled={loading} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#006e72] to-[#61d8dd] text-[#003739] hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
