'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Lead } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  lead: Lead | null
  onScheduled: () => void
}

interface Doctor {
  id: string
  name: string
  role: string
  isActive: boolean
}

interface Room {
  id: string
  name: string
  color: string
  isActive: boolean
}

interface PaymentMethod {
  id: string
  name: string
  type: string
  isActive: boolean
}

const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/40 focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'

export function ScheduleLeadDialog({ open, onOpenChange, lead, onScheduled }: Props) {
  const [loading, setLoading] = useState(false)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])

  const [selectedDoctor, setSelectedDoctor] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [duration, setDuration] = useState('60')
  const [roomId, setRoomId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  // Faturamento
  const [isPaid, setIsPaid] = useState(false)
  const [price, setPrice] = useState('350.00')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [paymentTiming, setPaymentTiming] = useState<'antecipado' | 'no_ato'>('no_ato')
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid'>('pending')
  const [paymentReceiptUrl, setPaymentReceiptUrl] = useState('')

  // Carregar dados auxiliares
  useEffect(() => {
    if (!open) return

    // Carregar Médicos
    fetch('/api/usuarios?role=doctor')
      .then(r => r.json())
      .then(res => {
        if (res.data) {
          // A rota já devolve apenas médicos ativos, com projeção mínima —
          // filtrar por `role` aqui zeraria a lista, porque o campo não vem.
          const docs = res.data
          setDoctors(docs)
          if (docs.length > 0) setSelectedDoctor(docs[0].id)
        }
      })
      .catch(() => {})

    // Carregar Salas
    fetch('/api/rooms')
      .then(r => r.json())
      .then(res => {
        if (res.data) setRooms(res.data.filter((r: any) => r.isActive !== false))
      })
      .catch(() => {})

    // Carregar Formas de Pagamento
    fetch('/api/configuracoes/pagamentos')
      .then(r => r.json())
      .then(res => {
        if (res.data) setPaymentMethods(res.data.filter((pm: any) => pm.isActive !== false))
      })
      .catch(() => {})

    // Reset formulário
    const now = new Date()
    now.setMinutes(0, 0, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    const formattedNow = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    setStartAt(formattedNow)
    setDuration('60')
    setRoomId(null)
    setNotes('')
    setIsPaid(false)
    setPrice('350.00')
    setPaymentMethodId('')
    setPaymentTiming('no_ato')
    setPaymentStatus('pending')
    setPaymentReceiptUrl('')
  }, [open])

  // Recalcular término (endAt)
  useEffect(() => {
    if (!startAt) return
    const startDate = new Date(startAt)
    if (isNaN(startDate.getTime())) return
    const endDate = new Date(startDate.getTime() + Number(duration) * 60000)
    
    const pad = (n: number) => String(n).padStart(2, '0')
    const formatted = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`
    setEndAt(formatted)
  }, [startAt, duration])

  async function handleSchedule() {
    if (!lead) return
    if (!startAt) {
      toast.error('Informe a data e horário de início da consulta.')
      return
    }
    if (isPaid && !paymentMethodId) {
      toast.error('Selecione uma forma de pagamento para a consulta paga.')
      return
    }

    setLoading(true)
    try {
      let patientId = lead.patientId

      // 1. Converter lead em paciente se ainda não tiver patientId
      if (!patientId) {
        const patientRes = await fetch('/api/pacientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            notes: `Convertido do CRM Lead. Queixa: ${lead.complaint || 'Não informada'}`
          })
        })
        const patientData = await patientRes.json()
        if (!patientRes.ok) throw new Error(patientData.error || 'Erro ao criar paciente')
        patientId = patientData.data.id

        // Vincular lead ao paciente recém-criado
        const updateLeadRes = await fetch(`/api/leads/${lead.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId,
            convertedAt: new Date().toISOString(),
            status: 'scheduled'
          })
        })
        if (!updateLeadRes.ok) throw new Error('Erro ao vincular paciente ao lead')
      } else {
        // Se já tiver patientId, apenas atualiza o status do lead para scheduled
        const updateLeadRes = await fetch(`/api/leads/${lead.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'scheduled' })
        })
        if (!updateLeadRes.ok) throw new Error('Erro ao atualizar status do lead')
      }

      // 2. Criar o agendamento
      const selectedRoom = roomId ? rooms.find(r => r.id === roomId) : null
      const agendaRes = await fetch('/api/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'consultation',
          doctorId: selectedDoctor || null,
          patientId,
          leadId: lead.id,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          roomId: roomId || null,
          room: selectedRoom ? selectedRoom.name : '',
          title: `Consulta: ${lead.name}`,
          notes: notes || '',
          isPaidConsultation: isPaid,
          consultationPrice: isPaid ? price : null,
          paymentMethodId: isPaid ? paymentMethodId : null,
          paymentTiming: isPaid ? paymentTiming : null,
          paymentStatus: isPaid ? paymentStatus : null,
          paymentReceiptUrl: (isPaid && paymentTiming === 'antecipado') ? (paymentReceiptUrl || null) : null
        })
      })
      const agendaData = await agendaRes.json()
      if (!agendaRes.ok) throw new Error(agendaData.error || 'Erro ao agendar consulta')

      toast.success('Consulta agendada e paciente cadastrado com sucesso!')
      onScheduled()
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || 'Ocorreu um erro no agendamento.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border border-[rgba(2,21,65,0.10)] shadow-[0_8px_40px_rgba(2,21,65,0.12)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#021541] font-bold">Agendar Consulta do Paciente</DialogTitle>
          <p className="text-xs text-[#718096]">Agende a consulta do lead <strong>{lead?.name}</strong>. Isso criará sua ficha de paciente automaticamente.</p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Médico */}
          <div className="space-y-1.5">
            <label className={labelCls}>Médico responsável *</label>
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
            </div>
          </div>

          {/* Duração */}
          <div className="space-y-1.5">
            <label className={labelCls}>Duração estimada</label>
            <div className="flex flex-wrap gap-1.5">
              {[
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

          {/* Sala */}
          {rooms.length > 0 && (
            <div className="space-y-1.5">
              <label className={labelCls}>Sala</label>
              <div className="flex flex-wrap gap-1.5">
                {rooms.map(r => (
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
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
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

          {/* Início */}
          <div className="space-y-1.5">
            <label className={labelCls}>Data e Hora de Início *</label>
            <input
              type="datetime-local"
              value={startAt}
              onChange={e => setStartAt(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Faturamento da Consulta */}
          <div className="border border-[rgba(2,21,65,0.08)] rounded-xl p-3 bg-slate-50 space-y-3">
            <p className="text-[10px] font-bold text-[#021541] uppercase tracking-wider">Faturamento da Consulta</p>
            
            <div className="flex gap-1 bg-[#e2e8f0] p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setIsPaid(false)}
                className={cn(
                  'flex-1 py-1 rounded-md text-xs font-medium transition-all border-0 cursor-pointer',
                  !isPaid ? 'bg-white text-[#021541] shadow-sm' : 'text-[#718096] bg-transparent'
                )}
              >
                Gratuita / Retorno
              </button>
              <button
                type="button"
                onClick={() => setIsPaid(true)}
                className={cn(
                  'flex-1 py-1 rounded-md text-xs font-medium transition-all border-0 cursor-pointer',
                  isPaid ? 'bg-white text-[#021541] shadow-sm' : 'text-[#718096] bg-transparent'
                )}
              >
                Paga
              </button>
            </div>

            {isPaid && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className={labelCls}>Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
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
                      placeholder="Link ou código..."
                      value={paymentReceiptUrl}
                      onChange={e => setPaymentReceiptUrl(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <label className={labelCls}>Observações</label>
            <textarea
              placeholder="Notas adicionais sobre a consulta..."
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className={cn(inputCls, 'resize-none')}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] hover:text-[#021541] bg-[#f5f6f8] hover:bg-[rgba(2,21,65,0.06)] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSchedule}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#021541] to-[#032170] text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>refresh</span>
                Agendando...
              </>
            ) : (
              'Agendar Consulta'
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
