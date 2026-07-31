'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { APPOINTMENT_TYPE_LABELS, APPOINTMENT_STATUS_LABELS } from '@/lib/constants'
import type { Appointment, Room } from '@/types'

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
  google_event: 'bg-[rgba(16,185,129,0.12)] text-[#047857] border-l-2 border-[#10b981]',
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
  const [gcal, setGcal] = useState<{ conectado: boolean; email: string | null; configurado: boolean } | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [defaultStartAt, setDefaultStartAt] = useState('')
  const [defaultEndAt, setDefaultEndAt] = useState('')
  const [finishDialogOpen, setFinishDialogOpen] = useState(false)
  const [quickTreatmentOpen, setQuickTreatmentOpen] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingApt, setDeletingApt] = useState<Appointment | null>(null)

  const loadGcalStatus = useCallback(() => {
    fetch('/api/perfil/google-agenda/status')
      .then((r) => r.json())
      .then(({ data }) => { if (data) setGcal(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/usuarios')
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) {
          setDoctors(data.filter((u: { role: string; googleCalendarId?: string | null; isActive?: boolean }) => 
            u.role === 'doctor' && u.isActive && !!u.googleCalendarId
          ))
        }
      })
      .catch(() => {})
    fetch('/api/rooms')
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) setRooms(data)
      })
      .catch(() => {})
    fetch('/api/configuracoes/pagamentos')
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) setPaymentMethods(data.filter((pm: any) => pm.isActive !== false))
      })
      .catch(() => {})
    fetch('/api/tratamentos/templates')
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) setTemplates(data)
      })
      .catch(() => {})
    loadGcalStatus()

    // Feedback do retorno do OAuth (?gcal=ok|erro|sem_credenciais)
    const params = new URLSearchParams(window.location.search)
    const status = params.get('gcal')
    if (status === 'ok') toast.success('Google Agenda conectada!')
    else if (status === 'sem_credenciais') toast.error('Credenciais do Google não configuradas no servidor')
    else if (status === 'erro') toast.error(`Falha ao conectar: ${params.get('motivo') ?? 'erro'}`)
    if (status) window.history.replaceState({}, '', '/agenda')
  }, [loadGcalStatus])

  async function disconnectGcal() {
    if (!confirm('Desconectar sua Google Agenda? Novos agendamentos deixam de sincronizar.')) return
    const res = await fetch('/api/perfil/google-agenda/disconnect', { method: 'POST' })
    if (res.ok) { toast.success('Google Agenda desconectada'); loadGcalStatus() }
    else toast.error('Erro ao desconectar')
  }

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

  async function handleDrop(e: React.DragEvent, targetDate: Date, targetHour: number) {
    e.preventDefault()
    const aptId = e.dataTransfer.getData('apt-id')
    const dragType = e.dataTransfer.getData('drag-type')
    if (!aptId) return

    const apt = appointments.find(a => a.id === aptId)
    if (!apt) return

    if (apt.type === 'google_event') {
      toast.error('Não é possível modificar compromissos externos do Google')
      return
    }

    if (dragType === 'move') {
      const originalStart = new Date(apt.startAt)
      const originalEnd = new Date(apt.endAt)
      const durationMs = originalEnd.getTime() - originalStart.getTime()

      const newStart = new Date(targetDate)
      newStart.setHours(targetHour)
      newStart.setMinutes(originalStart.getMinutes())
      newStart.setSeconds(0)
      newStart.setMilliseconds(0)

      const newEnd = new Date(newStart.getTime() + durationMs)

      try {
        const res = await fetch(`/api/agenda/${apt.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startAt: newStart.toISOString(),
            endAt: newEnd.toISOString()
          })
        })
        if (!res.ok) throw new Error()
        toast.success('Agendamento movido!')
        fetchAppointments()
      } catch {
        toast.error('Erro ao mover agendamento')
      }
    } else if (dragType === 'resize') {
      const newStart = new Date(apt.startAt)
      const newEnd = new Date(targetDate)
      newEnd.setHours(targetHour + 1)
      newEnd.setMinutes(0)
      newEnd.setSeconds(0)
      newEnd.setMilliseconds(0)

      if (newEnd.getTime() <= newStart.getTime()) {
        toast.error('O horário de término deve ser após o início')
        return
      }

      try {
        const res = await fetch(`/api/agenda/${apt.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endAt: newEnd.toISOString()
          })
        })
        if (!res.ok) throw new Error()
        toast.success('Duração atualizada!')
        fetchAppointments()
      } catch {
        toast.error('Erro ao atualizar duração')
      }
    }
  }

  function handleSlotClick(day: Date, hour: number) {
    const start = new Date(day)
    start.setHours(hour)
    start.setMinutes(0)
    start.setSeconds(0)
    start.setMilliseconds(0)

    const end = new Date(start)
    end.setHours(hour + 1)

    const fmt = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }

    setDefaultStartAt(fmt(start))
    setDefaultEndAt(fmt(end))
    setNewDialog(true)
  }

  function getDayAppointments(day: Date) {
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.startAt)
      return (
        aptDate.getDate() === day.getDate() &&
        aptDate.getMonth() === day.getMonth() &&
        aptDate.getFullYear() === day.getFullYear()
      )
    })
  }

  function calculateAptPosition(apt: Appointment, dayApts: Appointment[]) {
    const start = new Date(apt.startAt)
    const end = new Date(apt.endAt)
    
    const startMins = (start.getHours() - 7) * 60 + start.getMinutes()
    const durationMins = (end.getTime() - start.getTime()) / 60000
    
    const top = startMins * (56 / 60)
    const height = Math.max(35, durationMins * (56 / 60)) // at least 35px height
    
    const sorted = [...dayApts].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    const overlaps = sorted.filter(a => {
      const aStart = new Date(a.startAt).getTime()
      const aEnd = new Date(a.endAt).getTime()
      const startVal = start.getTime()
      const endVal = end.getTime()
      return (aStart < endVal && aEnd > startVal)
    })
    
    const idx = overlaps.findIndex(a => a.id === apt.id)
    const total = overlaps.length
    
    const width = total > 0 ? 100 / total : 100
    const left = idx >= 0 ? idx * width : 0
    
    return {
      top: `${top}px`,
      height: `${height - 2}px`,
      left: `${left}%`,
      width: `${width - 1}%`,
    }
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

  async function updatePaymentStatus(id: string, paymentStatus: 'paid' | 'pending') {
    try {
      const res = await fetch(`/api/agenda/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus }),
      })
      if (!res.ok) throw new Error()
      toast.success('Pagamento da consulta atualizado!')
      setDetailOpen(false)
      fetchAppointments()
    } catch {
      toast.error('Erro ao atualizar pagamento da consulta')
    }
  }

  async function confirmDeleteAppointment() {
    if (!deletingId || !deleteReason.trim()) return
    try {
      const res = await fetch(`/api/agenda/${deletingId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao excluir')
      toast.success('Agendamento excluído com sucesso!')
      setDeleteDialogOpen(false)
      setDeleteReason('')
      setDeletingId(null)
      setDeletingApt(null)
      fetchAppointments()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir agendamento')
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

        {/* Conexão da Google Agenda do usuário logado */}
        <div className="ml-auto flex items-center gap-2">
          {gcal && gcal.configurado && (
            gcal.conectado ? (
              <button
                onClick={disconnectGcal}
                title={`Conectada: ${gcal.email ?? ''} — clique para desconectar`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgba(5,150,105,0.1)] text-[#059669] text-xs font-bold hover:bg-[rgba(5,150,105,0.18)] transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>event_available</span>
                Google Agenda conectada
              </button>
            ) : (
              <a
                href="/api/perfil/google-agenda/connect"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgba(0,188,228,0.08)] text-[#00BCE4] text-xs font-bold hover:bg-[rgba(0,188,228,0.15)] transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>sync</span>
                Conectar minha Google Agenda
              </a>
            )
          )}
        </div>

        {/* Link para o Google Calendar do médico selecionado */}
        {selectedDoctorId !== 'all' && (() => {
          const doc = doctors.find((d) => d.id === selectedDoctorId)
          if (!doc?.googleCalendarId) return null
          const isUrl = doc.googleCalendarId.startsWith('http')
          let embedId = doc.googleCalendarId
          if (isUrl) {
            const match = doc.googleCalendarId.match(/\/ical\/([^/]+)/)
            if (match && match[1]) embedId = decodeURIComponent(match[1])
          }
          const calUrl = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(embedId)}`
          return (
            <a
              href={isUrl ? doc.googleCalendarId : calUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgba(0,188,228,0.08)] text-[#00BCE4] text-xs font-bold hover:bg-[rgba(0,188,228,0.15)] transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
              Google Calendar
            </a>
          )
        })()}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto rounded-xl border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] bg-white">
        <div className="grid min-w-[600px] grid-cols-[56px_repeat(5,_1fr)]">
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

          {/* Horários / Slots de fundo (Coluna 1) */}
          <div className="flex flex-col bg-[#f5f6f8] border-r border-[rgba(2,21,65,0.06)]">
            {HOURS.map((hour) => (
              <div key={hour} className="border-b border-[rgba(2,21,65,0.06)] h-14 flex items-start justify-end pr-2 pt-1">
                <span className="font-technical text-[10px] text-[#718096] font-semibold">{hour}:00</span>
              </div>
            ))}
          </div>

          {/* Colunas dos Dias (Colunas 2-6) */}
          {weekDays.map((day, di) => {
            const isToday = day.toDateString() === new Date().toDateString()
            const dayApts = getDayAppointments(day)
            
            return (
              <div
                key={di}
                className={cn(
                  'relative border-l border-[rgba(2,21,65,0.06)] overflow-hidden',
                  isToday ? 'bg-[rgba(0,188,228,0.01)]' : 'bg-white'
                )}
                style={{ height: `${HOURS.length * 56}px` }}
              >
                {/* Slots de fundo para Clique e Drop */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    onClick={() => handleSlotClick(day, hour)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, day, hour)}
                    className="border-b border-[rgba(2,21,65,0.06)] h-14 hover:bg-[rgba(2,21,65,0.03)] cursor-pointer transition-colors"
                  />
                ))}

                {/* Agendamentos flutuantes absolutely positioned */}
                {dayApts.map((apt) => {
                  const name = apt.patient?.name ?? apt.lead?.name ?? apt.title ?? '—'
                  const { top, height, left, width } = calculateAptPosition(apt, dayApts)
                  const style: React.CSSProperties = {
                    position: 'absolute',
                    top,
                    height,
                    left,
                    width,
                    zIndex: 10,
                  }
                  const hasRoomColor = apt.roomObj && apt.roomObj.color
                  const roomColor = apt.roomObj?.color || '#00BCE4'

                  return (
                    <div
                      key={apt.id}
                      draggable={apt.type !== 'google_event'}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('apt-id', apt.id)
                        e.dataTransfer.setData('drag-type', 'move')
                      }}
                      onClick={() => { setSelectedApt(apt); setDetailOpen(true) }}
                      className={cn(
                        'rounded-lg text-left p-1.5 text-[10px] font-bold border shadow-sm transition-all hover:brightness-95 flex flex-col justify-between cursor-pointer select-none group',
                        !hasRoomColor && (TYPE_COLORS[apt.type] ?? 'bg-[rgba(0,151,167,0.12)] text-[#005b6e] border-[#00BCD4]')
                      )}
                      style={hasRoomColor ? {
                        ...style,
                        backgroundColor: `${roomColor}12`,
                        color: roomColor,
                        borderLeft: `3px solid ${roomColor}`,
                        borderColor: `${roomColor}33`,
                      } : style}
                      title={`${name} (${apt.roomObj?.name || 'Sem sala'})`}
                    >
                      <div className="flex flex-col h-full justify-between overflow-hidden">
                        <div className="truncate">
                          <p className="font-extrabold truncate">{name}</p>
                          
                          {/* Tags: Médico e Pagamento Pendente */}
                          <div className="flex flex-wrap gap-1 mt-0.5 select-none">
                            {apt.doctor && (
                              <span className="bg-slate-500/10 text-slate-700 px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide truncate max-w-[80px]">
                                {apt.doctor.name.split(' ')[0]}
                              </span>
                            )}
                            {apt.type === 'consultation' && apt.isPaidConsultation && apt.paymentStatus === 'pending' && (
                              <span className="bg-rose-500/15 text-rose-600 px-1 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide flex items-center gap-0.5 border border-rose-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                                Pendente
                              </span>
                            )}
                          </div>

                          {apt.roomObj && (
                            <p className="text-[9px] opacity-80 font-normal truncate mt-0.5 flex items-center gap-0.5">
                              <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>meeting_room</span>
                              {apt.roomObj.name}
                            </p>
                          )}
                        </div>

                        {/* Alça inferior para redimensionar (Resize Handle) */}
                        {apt.type !== 'google_event' && (
                          <div
                            draggable={true}
                            onDragStart={(e) => {
                              e.stopPropagation()
                              e.dataTransfer.setData('apt-id', apt.id)
                              e.dataTransfer.setData('drag-type', 'resize')
                            }}
                            className="w-full h-1 bg-black/10 hover:bg-[#00BCE4]/40 rounded-sm mt-1 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            title="Arrastar para aumentar duração"
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Dialog de novo agendamento */}
      <NewAppointmentDialog
        open={newDialog}
        onOpenChange={setNewDialog}
        onCreated={fetchAppointments}
        defaultDoctorId={selectedDoctorId !== 'all' ? selectedDoctorId : undefined}
        doctors={doctors}
        rooms={rooms}
        defaultStartAt={defaultStartAt}
        defaultEndAt={defaultEndAt}
        paymentMethods={paymentMethods}
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
              {selectedApt.doctor && (
                <p className="text-sm text-[#021541]">
                  <span className="text-[#718096]">Médico: </span>Dr(a). {selectedApt.doctor.name}
                </p>
              )}
              {selectedApt.room && (
                <p className="text-sm text-[#021541]">
                  <span className="text-[#718096]">Sala: </span>{selectedApt.room}
                </p>
              )}
              {selectedApt.type === 'consultation' && (
                <div className="border border-[rgba(2,21,65,0.06)] rounded-xl p-3 bg-slate-50 text-xs space-y-1.5">
                  <p className="font-bold text-[#021541]">Informações de Faturamento</p>
                  {selectedApt.isPaidConsultation ? (
                    <>
                      <p><span className="text-[#718096]">Tipo:</span> Paga ({BRL(selectedApt.consultationPrice || '0')})</p>
                      <p><span className="text-[#718096]">Forma:</span> {paymentMethods.find(pm => pm.id === selectedApt.paymentMethodId)?.name || 'Não informada'}</p>
                      <p><span className="text-[#718096]">Momento:</span> {selectedApt.paymentTiming === 'antecipado' ? 'Antecipado' : 'No ato da consulta'}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#718096]">Status:</span>
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                          selectedApt.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        )}>{selectedApt.paymentStatus === 'paid' ? 'Pago' : 'Pendente'}</span>
                      </div>
                      {selectedApt.paymentReceiptUrl && (
                        <p className="truncate"><span className="text-[#718096]">Comprovante:</span> {selectedApt.paymentReceiptUrl}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-[#718096] italic">Consulta Gratuita / Retorno</p>
                  )}
                </div>
              )}
              {selectedApt.notes && <p className="text-sm text-[#718096] italic">{selectedApt.notes}</p>}

              {selectedApt.type !== 'google_event' && (
                <div className="pt-2 border-t border-[rgba(2,21,65,0.06)] flex flex-col gap-2">
                  {selectedApt.patientId && (
                    <button
                      onClick={() => {
                        setQuickTreatmentOpen(true)
                        setDetailOpen(false)
                      }}
                      className="w-full py-2 rounded-xl bg-[rgba(0,188,228,0.08)] text-[#00BCE4] hover:bg-[rgba(0,188,228,0.15)] text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>vaccines</span>
                      Criar Tratamento Rápido
                    </button>
                  )}
                  {selectedApt.type === 'consultation' && selectedApt.isPaidConsultation && selectedApt.paymentStatus === 'pending' && (
                    <button
                      onClick={() => updatePaymentStatus(selectedApt.id, 'paid')}
                      className="w-full py-2 rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>payments</span>
                      Confirmar Recebimento da Consulta
                    </button>
                  )}
                  
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Confirmar', status: 'confirmed', color: 'text-[#00BCE4]' },
                      { label: 'Compareceu', status: 'attended', color: 'text-[#16a34a]' },
                      { label: 'Faltou', status: 'no_show', color: 'text-[#d97706]' },
                      { label: 'Cancelar', status: 'cancelled', color: 'text-[#dc2626]' },
                    ].map((btn) => (
                      <button
                        key={btn.status}
                        onClick={() => {
                          if (btn.status === 'attended' && selectedApt.patientId) {
                            setFinishDialogOpen(true)
                            setDetailOpen(false)
                          } else {
                            updateStatus(selectedApt.id, btn.status)
                          }
                        }}
                        className={cn(
                          'py-2 rounded-xl bg-[#f5f6f8] border border-[rgba(2,21,65,0.06)] text-sm font-medium hover:bg-[rgba(2,21,65,0.04)] transition-colors',
                          btn.color
                        )}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setDeletingId(selectedApt.id)
                      setDeletingApt(selectedApt)
                      setDeleteReason('')
                      setDeleteDialogOpen(true)
                      setDetailOpen(false)
                    }}
                    className="w-full mt-2 py-2 rounded-xl bg-rose-50 hover:bg-rose-100/70 border border-rose-100 text-rose-600 hover:text-rose-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                    Excluir Agendamento
                  </button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <FinalizarConsultaDialog
        open={finishDialogOpen}
        onOpenChange={setFinishDialogOpen}
        appointment={selectedApt}
        paymentMethods={paymentMethods}
        templates={templates}
        onCompleted={fetchAppointments}
      />

      <QuickTreatmentDialog
        open={quickTreatmentOpen}
        onOpenChange={setQuickTreatmentOpen}
        patient={selectedApt?.patient ? { id: selectedApt.patientId!, name: selectedApt.patient.name } : null}
        doctor={selectedApt?.doctor ? { id: selectedApt.doctorId!, name: selectedApt.doctor.name } : null}
        templates={templates}
        onCompleted={fetchAppointments}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm bg-white border border-[rgba(2,21,65,0.06)] p-5">
          <DialogHeader>
            <DialogTitle className="text-[#021541] font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-500">warning</span>
              Excluir Agendamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1.5">
            <p className="text-xs text-[#718096]">
              Tem certeza que deseja excluir o agendamento de <strong className="text-[#021541]">{deletingApt?.patient?.name || deletingApt?.lead?.name || deletingApt?.title || 'Compromisso'}</strong>? Esta ação é irreversível e removerá o evento da Google Agenda.
            </p>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">Motivo da Exclusão *</label>
              <textarea
                rows={3}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Informe o motivo para histórico e auditoria..."
                className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2 text-sm text-[#021541] placeholder:text-[#718096]/60 focus:outline-none focus:ring-2 focus:ring-rose-500/20 resize-none animate-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <button
              onClick={() => { setDeleteDialogOpen(false); setDeletingId(null); setDeletingApt(null) }}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#718096] bg-[#f5f6f8] border border-[rgba(2,21,65,0.08)] hover:bg-[rgba(2,21,65,0.04)] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDeleteAppointment}
              disabled={deleteReason.trim().length < 3}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              Confirmar Exclusão
            </button>
          </DialogFooter>
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

function NewAppointmentDialog({ open, onOpenChange, onCreated, defaultDoctorId, doctors, rooms, defaultStartAt, defaultEndAt, paymentMethods }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void
  defaultDoctorId?: string; doctors: Doctor[]; rooms: Room[]; defaultStartAt?: string; defaultEndAt?: string; paymentMethods: any[]
}) {
  const [loading, setLoading] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState<string>(defaultDoctorId ?? '')
  const [selectedType, setSelectedType] = useState('consultation')
  const [patientId, setPatientId] = useState<string | null>(null)
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [title, setTitle] = useState('')
  const [roomId, setRoomId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [duration, setDuration] = useState('60') // em minutos

  // Faturamento da Consulta
  const [isPaidConsultation, setIsPaidConsultation] = useState(false)
  const [consultationPrice, setConsultationPrice] = useState('350.00')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [paymentTiming, setPaymentTiming] = useState<'antecipado' | 'no_ato'>('no_ato')
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid'>('pending')
  const [paymentReceiptUrl, setPaymentReceiptUrl] = useState('')

  // Atualiza data/hora padrão passados pelo clique na grade
  useEffect(() => {
    if (open) {
      setSelectedDoctor(defaultDoctorId ?? '')
      if (defaultStartAt) setStartAt(defaultStartAt)
      if (defaultEndAt) setEndAt(defaultEndAt)
    } else {
      setSelectedDoctor(defaultDoctorId ?? '')
      setSelectedType('consultation')
      setPatientId(null)
      setStartAt('')
      setEndAt('')
      setTitle('')
      setRoomId(null)
      setNotes('')
      setDuration('60')
      setIsPaidConsultation(false)
      setConsultationPrice('350.00')
      setPaymentMethodId('')
      setPaymentTiming('no_ato')
      setPaymentStatus('pending')
      setPaymentReceiptUrl('')
    }
  }, [open, defaultDoctorId, defaultStartAt, defaultEndAt])

  // Recalcula o horário de término (endAt) quando o início ou a duração muda
  useEffect(() => {
    if (!startAt) return
    const startDate = new Date(startAt)
    if (isNaN(startDate.getTime())) return
    const endDate = new Date(startDate.getTime() + Number(duration) * 60000)
    
    const pad = (n: number) => String(n).padStart(2, '0')
    const formatted = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`
    setEndAt(formatted)
  }, [startAt, duration])

  async function submit() {
    if (!startAt || !endAt) { toast.error('Informe data/hora de início e fim'); return }
    setLoading(true)
    try {
      const selectedRoom = roomId ? rooms.find(r => r.id === roomId) : null
      const res = await fetch('/api/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          doctorId: selectedDoctor || null,
          patientId: patientId || null,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          roomId: roomId || null,
          room: selectedRoom ? selectedRoom.name : '',
          ...(title && { title }),
          ...(notes && { notes }),
          isPaidConsultation: selectedType === 'consultation' ? isPaidConsultation : false,
          consultationPrice: (selectedType === 'consultation' && isPaidConsultation) ? consultationPrice : null,
          paymentMethodId: (selectedType === 'consultation' && isPaidConsultation) ? (paymentMethodId || null) : null,
          paymentTiming: (selectedType === 'consultation' && isPaidConsultation) ? paymentTiming : null,
          paymentStatus: (selectedType === 'consultation' && isPaidConsultation) ? paymentStatus : null,
          paymentReceiptUrl: (selectedType === 'consultation' && isPaidConsultation && paymentTiming === 'antecipado') ? (paymentReceiptUrl || null) : null,
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

  const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/40 focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30'
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

          {/* Faturamento de Consulta (somente se Tipo = Consulta) */}
          {selectedType === 'consultation' && (
            <div className="border border-[rgba(2,21,65,0.08)] rounded-xl p-3 bg-slate-50 space-y-3">
              <p className="text-[10px] font-bold text-[#021541] uppercase tracking-wider">Faturamento da Consulta</p>
              
              <div className="flex gap-1 bg-[#e2e8f0] p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setIsPaidConsultation(false)}
                  className={cn(
                    'flex-1 py-1 rounded-md text-xs font-medium transition-all border-0',
                    !isPaidConsultation ? 'bg-white text-[#021541] shadow-sm' : 'text-[#718096] bg-transparent'
                  )}
                >
                  Gratuita / Retorno
                </button>
                <button
                  type="button"
                  onClick={() => setIsPaidConsultation(true)}
                  className={cn(
                    'flex-1 py-1 rounded-md text-xs font-medium transition-all border-0',
                    isPaidConsultation ? 'bg-white text-[#021541] shadow-sm' : 'text-[#718096] bg-transparent'
                  )}
                >
                  Paga
                </button>
              </div>

              {isPaidConsultation && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className={labelCls}>Valor (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={consultationPrice}
                        onChange={e => setConsultationPrice(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={labelCls}>Forma de Pagamento</label>
                      <select
                        value={paymentMethodId}
                        onChange={e => setPaymentMethodId(e.target.value)}
                        className={inputCls}
                      >
                        <option value="">Selecione...</option>
                        {paymentMethods.map(pm => (
                          <option key={pm.id} value={pm.id}>{pm.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className={labelCls}>Momento</label>
                      <select
                        value={paymentTiming}
                        onChange={e => setPaymentTiming(e.target.value as any)}
                        className={inputCls}
                      >
                        <option value="no_ato">No ato da consulta</option>
                        <option value="antecipado">Antecipado</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className={labelCls}>Status</label>
                      <select
                        value={paymentStatus}
                        onChange={e => setPaymentStatus(e.target.value as any)}
                        className={inputCls}
                      >
                        <option value="pending">Pendente</option>
                        <option value="paid">Pago</option>
                      </select>
                    </div>
                  </div>

                  {paymentTiming === 'antecipado' && (
                    <div className="space-y-1">
                      <label className={labelCls}>Comprovante / Registro (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Link ou código do comprovante..."
                        value={paymentReceiptUrl}
                        onChange={e => setPaymentReceiptUrl(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sala — botões inline */}
          {rooms.length > 0 && (
            <div className="space-y-1.5">
              <label className={labelCls}>Sala</label>
              <div className="flex flex-wrap gap-1.5">
                {rooms.filter(r => r.isActive).map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRoomId(r.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                      roomId === r.id
                        ? 'bg-[rgba(0,188,228,0.08)] text-[#00BCE4] ring-1 ring-[#00BCE4]/30'
                        : 'bg-[#f5f6f8] text-[#718096] hover:text-[#021541] border border-[rgba(2,21,65,0.08)]'
                    )}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/5" style={{ backgroundColor: r.color }} />
                    {r.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setRoomId(null)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    !roomId
                      ? 'bg-[#f5f6f8] text-[#718096] ring-1 ring-[rgba(2,21,65,0.15)] border border-[rgba(2,21,65,0.08)]'
                      : 'bg-[#f5f6f8] text-[#718096]/60 hover:text-[#718096] border border-[rgba(2,21,65,0.06)]'
                  )}
                >
                  Sem sala
                </button>
              </div>
            </div>
          )}

          {/* Tempo/Duração — botões inline */}
          <div className="space-y-1.5">
            <label className={labelCls}>Duração (Tempo)</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: '15m', value: '15' },
                { label: '30m', value: '30' },
                { label: '45m', value: '45' },
                { label: '1h', value: '60' },
                { label: '1h30m', value: '90' },
                { label: '2h', value: '120' },
              ].map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDuration(d.value)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    duration === d.value
                      ? 'bg-[rgba(0,188,228,0.08)] text-[#00BCE4] ring-1 ring-[#00BCE4]/30'
                      : 'bg-[#f5f6f8] text-[#718096] hover:text-[#021541] border border-[rgba(2,21,65,0.08)]'
                  )}
                >
                  {d.label}
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

          {/* Título / obs */}
          <div className="space-y-1.5">
            <label className={labelCls}>Título / motivo (opcional)</label>
            <input placeholder="Ex: Retorno, Avaliação pré-op..." value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Observações</label>
            <input placeholder="Notas adicionais..." value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} />
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

const BRL = (v: string | number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))

// ── Dialog de Finalizar Consulta ─────────────────────────
function FinalizarConsultaDialog({
  open,
  onOpenChange,
  appointment,
  paymentMethods,
  templates,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  appointment: Appointment | null
  paymentMethods: any[]
  templates: any[]
  onCompleted: () => void
}) {
  const [loading, setLoading] = useState(false)
  
  // Financeiro
  const [generateFee, setGenerateFee] = useState(true)
  const [feeAmount, setFeeAmount] = useState('350.00')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [isPaid, setIsPaid] = useState(true)
  
  // Retorno
  const [giveReturnRight, setGiveReturnRight] = useState(true)
  const [returnDays, setReturnDays] = useState('15')
  const [returnEstimatedDate, setReturnEstimatedDate] = useState('')
  
  // Prontuário / Evolução
  const [evolucaoNote, setEvolucaoNote] = useState('')
  
  // Tratamento Rápido
  const [createQuickTreatment, setCreateQuickTreatment] = useState(false)
  const [treatmentName, setTreatmentName] = useState('')
  const [treatmentTemplateId, setTreatmentTemplateId] = useState('')
  const [treatmentPrice, setTreatmentPrice] = useState('1500.00')
  const [treatmentInstallments, setTreatmentInstallments] = useState(1)

  // Reset states on open
  useEffect(() => {
    if (open && appointment) {
      const isReturn = appointment.type === 'return'
      setGenerateFee(!isReturn)
      setFeeAmount('350.00')
      setPaymentMethodId(paymentMethods[0]?.id || '')
      setIsPaid(true)
      
      setGiveReturnRight(!isReturn)
      setReturnDays('15')
      setReturnEstimatedDate('')
      
      setEvolucaoNote('')
      setCreateQuickTreatment(false)
      setTreatmentName('')
      setTreatmentTemplateId('')
      setTreatmentPrice('1500.00')
      setTreatmentInstallments(1)
    }
  }, [open, appointment, paymentMethods])

  // Apply template values if selected
  function applyTemplate(id: string) {
    setTreatmentTemplateId(id)
    const tpl = templates.find(t => t.id === id)
    if (tpl) {
      setTreatmentName(tpl.name)
      setTreatmentPrice(Number(tpl.defaultPrice).toFixed(2))
    }
  }

  async function submit() {
    if (!appointment) return
    setLoading(true)
    // Etapas secundárias que podem falhar sem impedir a finalização da consulta.
    const falhas: string[] = []
    try {
      // 1. Calcular datas de retorno se aplicável
      let returnDeadlineISO: string | null = null
      let returnEstimatedISO: string | null = null
      
      if (giveReturnRight && appointment.type !== 'return') {
        const deadline = new Date()
        deadline.setDate(deadline.getDate() + Number(returnDays))
        returnDeadlineISO = deadline.toISOString()
        
        if (returnEstimatedDate) {
          returnEstimatedISO = new Date(returnEstimatedDate + 'T12:00:00').toISOString()
        }
      }

      // 2. Chamar o PATCH para mudar status para "attended" e gravar dados de retorno
      const patchRes = await fetch(`/api/agenda/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'attended',
          returnDeadline: returnDeadlineISO,
          returnEstimatedAt: returnEstimatedISO,
        })
      })
      if (!patchRes.ok) throw new Error('Erro ao atualizar status do agendamento')

      // 3. Gerar financeiro da consulta se selecionado
      if (generateFee && appointment.type !== 'return') {
        const transRes = await fetch('/api/financeiro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'income',
            category: 'consultation_fee',
            description: `Consulta médica — ${appointment.patient?.name || 'Paciente'}`,
            amount: Number(feeAmount).toFixed(2),
            date: new Date().toISOString().split('T')[0],
            isPaid,
            ...(isPaid && { paidAt: new Date().toISOString() }),
            patientId: appointment.patientId,
            appointmentId: appointment.id,
            paymentMethodId: paymentMethodId || null,
          })
        })
        if (!transRes.ok) falhas.push('cobrança no financeiro')
      }

      // 4. Gravar no Prontuário / Evolução
      if (evolucaoNote.trim()) {
        const recordRes = await fetch('/api/prontuario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: appointment.patientId,
            appointmentId: appointment.id,
            doctorId: appointment.doctorId,
            type: appointment.type === 'return' ? 'retorno' : 'evolucao',
            content: evolucaoNote.trim(),
          })
        })
        if (!recordRes.ok) falhas.push('anotação no prontuário')
      }

      // 5. Iniciar Tratamento Rápido se selecionado
      if (createQuickTreatment && treatmentName.trim()) {
        const treatRes = await fetch('/api/tratamentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: appointment.patientId,
            appointmentId: appointment.id,
            doctorId: appointment.doctorId,
            paymentMethodId: null,
            templateId: treatmentTemplateId || null,
            name: treatmentName.trim(),
            category: 'consultation_fee',
            discount: 0,
            installments: Number(treatmentInstallments),
            items: [{
              type: 'procedure',
              description: treatmentName.trim(),
              quantity: 1,
              unitCost: 0,
              unitPrice: Number(treatmentPrice),
              sortOrder: 0
            }]
          })
        })
        if (!treatRes.ok) falhas.push('plano de tratamento')
      }

      // A consulta em si foi finalizada, mas dizer "sucesso" escondendo que a
      // cobrança ou o prontuário não gravaram fazia o dado sumir sem ninguém ver.
      if (falhas.length > 0) {
        toast.error(
          `Consulta finalizada, mas falhou: ${falhas.join(', ')}. Lance manualmente.`,
          { duration: 10000 }
        )
      } else {
        toast.success('Consulta finalizada com sucesso!')
      }
      onOpenChange(false)
      onCompleted()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao finalizar consulta')
    } finally {
      setLoading(false)
    }
  }

  const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'
  const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2 text-sm text-[#021541] placeholder:text-[#718096]/40 focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border border-[rgba(2,21,65,0.06)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#021541] font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#059669]">check_circle</span>
            Finalizar Consulta — {appointment?.patient?.name || 'Paciente'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {appointment?.type === 'return' ? (
            <div className="p-3 bg-[#00BCE4]/5 border border-[#00BCE4]/20 rounded-xl text-xs text-[#718096] flex items-start gap-2">
              <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '16px' }}>info</span>
              <span>Esta consulta está agendada como **Retorno**. Consultas de retorno não possuem custos ou cobranças financeiras padrão.</span>
            </div>
          ) : (
            <div className="p-3.5 border border-[rgba(2,21,65,0.06)] rounded-xl bg-white space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#021541] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[#059669]" style={{ fontSize: '16px' }}>payments</span>
                  Cobrança da Consulta
                </p>
                <input
                  type="checkbox"
                  checked={generateFee}
                  onChange={(e) => setGenerateFee(e.target.checked)}
                  className="rounded border-[rgba(2,21,65,0.2)] text-[#00BCE4] focus:ring-[#00BCE4]"
                />
              </div>

              {generateFee && (
                <div className="grid grid-cols-2 gap-2.5 pt-1.5">
                  <div className="space-y-1">
                    <label className={labelCls}>Valor Cobrado (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={feeAmount}
                      onChange={(e) => setFeeAmount(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>Forma de Pagamento</label>
                    <select
                      value={paymentMethodId}
                      onChange={(e) => setPaymentMethodId(e.target.value)}
                      className={inputCls}
                    >
                      {paymentMethods.map(pm => (
                        <option key={pm.id} value={pm.id}>{pm.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 flex items-center gap-2 pt-1.5">
                    <input
                      type="checkbox"
                      checked={isPaid}
                      onChange={(e) => setIsPaid(e.target.checked)}
                      id="isPaidCheck"
                      className="rounded border-[rgba(2,21,65,0.2)] text-[#00BCE4] focus:ring-[#00BCE4]"
                    />
                    <label htmlFor="isPaidCheck" className="text-xs font-medium text-[#718096] select-none">
                      Marcar consulta como Paga imediatamente?
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="p-3.5 border border-[rgba(2,21,65,0.06)] rounded-xl bg-white space-y-2">
            <p className="text-xs font-bold text-[#021541] flex items-center gap-1">
              <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '16px' }}>medical_information</span>
              Anotações Clínicas / Prontuário
            </p>
            <textarea
              rows={3}
              value={evolucaoNote}
              onChange={(e) => setEvolucaoNote(e.target.value)}
              placeholder="Descreva a evolução do paciente, queixas, observações ou orientações clínicas..."
              className={inputCls + ' resize-none'}
            />
          </div>

          {appointment?.type !== 'return' && (
            <div className="p-3.5 border border-[rgba(2,21,65,0.06)] rounded-xl bg-white space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#021541] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[#e6c364]" style={{ fontSize: '16px' }}>history</span>
                  Direito a Retorno
                </p>
                <input
                  type="checkbox"
                  checked={giveReturnRight}
                  onChange={(e) => setGiveReturnRight(e.target.checked)}
                  className="rounded border-[rgba(2,21,65,0.2)] text-[#00BCE4] focus:ring-[#00BCE4]"
                />
              </div>

              {giveReturnRight && (
                <div className="grid grid-cols-2 gap-2.5 pt-1.5">
                  <div className="space-y-1">
                    <label className={labelCls}>Prazo de Validade</label>
                    <select
                      value={returnDays}
                      onChange={(e) => setReturnDays(e.target.value)}
                      className={inputCls}
                    >
                      <option value="15">15 dias (padrão)</option>
                      <option value="30">30 dias</option>
                      <option value="45">45 dias</option>
                      <option value="60">60 dias</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>Data Estimada pelo Médico</label>
                    <input
                      type="date"
                      value={returnEstimatedDate}
                      onChange={(e) => setReturnEstimatedDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="p-3.5 border border-[rgba(2,21,65,0.06)] rounded-xl bg-white space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-[#021541] flex items-center gap-1">
                <span className="material-symbols-outlined text-[#8B5CF6]" style={{ fontSize: '16px' }}>vaccines</span>
                Iniciar Plano de Tratamento Rápido
              </p>
              <input
                type="checkbox"
                checked={createQuickTreatment}
                onChange={(e) => setCreateQuickTreatment(e.target.checked)}
                className="rounded border-[rgba(2,21,65,0.2)] text-[#00BCE4] focus:ring-[#00BCE4]"
              />
            </div>

            {createQuickTreatment && (
              <div className="space-y-2.5 pt-1.5">
                {templates.length > 0 && (
                  <div className="space-y-1">
                    <label className={labelCls}>Modelo do Catálogo</label>
                    <select
                      value={treatmentTemplateId}
                      onChange={(e) => applyTemplate(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Personalizado...</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({BRL(t.defaultPrice)})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1">
                  <label className={labelCls}>Nome do Tratamento</label>
                  <input
                    value={treatmentName}
                    onChange={(e) => setTreatmentName(e.target.value)}
                    placeholder="Ex: PRP Joelho, Infiltração..."
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className={labelCls}>Preço Venda (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={treatmentPrice}
                      onChange={(e) => setTreatmentPrice(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>Nº Parcelas</label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={treatmentInstallments}
                      onChange={(e) => setTreatmentInstallments(Number(e.target.value))}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] hover:bg-[rgba(2,21,65,0.04)]"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="px-5 py-2.5 rounded-full text-sm font-bold bg-[#021541] text-white hover:bg-[#032170] disabled:opacity-50"
          >
            {loading ? 'Processando...' : 'Salvar e Finalizar Consulta'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Dialog de Tratamento Rápido ─────────────────────────
function QuickTreatmentDialog({
  open,
  onOpenChange,
  patient,
  doctor,
  templates,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  patient: { id: string; name: string } | null
  doctor: { id: string; name: string } | null
  templates: any[]
  onCompleted: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [treatmentName, setTreatmentName] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [price, setPrice] = useState('1500.00')
  const [installments, setInstallments] = useState(1)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      setTreatmentName('')
      setTemplateId('')
      setPrice('1500.00')
      setInstallments(1)
      setNotes('')
    }
  }, [open])

  function applyTemplate(id: string) {
    setTemplateId(id)
    const tpl = templates.find(t => t.id === id)
    if (tpl) {
      setTreatmentName(tpl.name)
      setPrice(Number(tpl.defaultPrice).toFixed(2))
    }
  }

  async function submit() {
    if (!patient) return
    if (!treatmentName.trim()) { toast.error('Nome do tratamento é obrigatório'); return }
    
    setLoading(true)
    try {
      const res = await fetch('/api/tratamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.id,
          doctorId: doctor?.id || null,
          templateId: templateId || null,
          name: treatmentName.trim(),
          category: 'consultation_fee',
          discount: 0,
          installments: Number(installments),
          notes: notes || null,
          items: [{
            type: 'procedure',
            description: treatmentName.trim(),
            quantity: 1,
            unitCost: 0,
            unitPrice: Number(price),
            sortOrder: 0
          }]
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Tratamento criado com sucesso!')
      onOpenChange(false)
      onCompleted()
    } catch {
      toast.error('Erro ao criar tratamento')
    } finally {
      setLoading(false)
    }
  }

  const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'
  const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2 text-sm text-[#021541] placeholder:text-[#718096]/40 focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border border-[rgba(2,21,65,0.06)]">
        <DialogHeader>
          <DialogTitle className="text-[#021541] font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#00BCE4]">vaccines</span>
            Criar Tratamento Rápido
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label className={labelCls}>Paciente</label>
            <input value={patient?.name || ''} readOnly className={inputCls + ' opacity-60'} />
          </div>

          {templates.length > 0 && (
            <div className="space-y-1">
              <label className={labelCls}>Modelo do Catálogo</label>
              <select
                value={templateId}
                onChange={(e) => applyTemplate(e.target.value)}
                className={inputCls}
              >
                <option value="">Personalizado...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({BRL(t.defaultPrice)})</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className={labelCls}>Nome do Tratamento *</label>
            <input
              value={treatmentName}
              onChange={(e) => setTreatmentName(e.target.value)}
              placeholder="Ex: PRP Joelho Bilateral"
              className={inputCls}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelCls}>Preço Venda (R$)</label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Nº Parcelas</label>
              <input
                type="number"
                min="1"
                max="24"
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
                className={inputCls}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className={labelCls}>Observações</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionais..."
              className={inputCls + ' resize-none'}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] hover:bg-[rgba(2,21,65,0.04)]"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="px-5 py-2.5 rounded-full text-sm font-bold bg-[#021541] text-white hover:bg-[#032170] disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Criar Tratamento'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
