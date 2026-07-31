'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ImageUploader from '@/components/shared/ImageUploader'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────
interface Patient {
  id: string; name: string; email: string | null; phone: string; cpf: string | null
  birthDate: string | null; gender: string | null; address: string | null; city: string | null
  insurance: string | null; insuranceNum: string | null; notes: string | null
  photoUrl: string | null; internalNotes: string | null
  isActive: boolean; nps: number | null; createdAt: string
}
interface Appointment {
  id: string; type: string; status: string; startAt: string; endAt: string
  title: string | null; notes: string | null; doctor: { id: string; name: string } | null
}
interface Treatment {
  id: string; name: string; status: string; totalSale: string; totalCost: string
  installments: number; completedAt: string | null; createdAt: string
  items: Array<{ description: string; quantity: string; unitPrice: string }>
  doctor: { name: string } | null
}
interface ExamOrder {
  id: string; urgency: string; status: string
  exams: Array<{ name: string; tuss_code?: string }>
  hypothesis: string | null; createdAt: string; resultUrl: string | null
  resultDate: string | null; validUntil: string | null
  doctor: { name: string } | null
}
interface ClinicalRecord { id: string; type: string; content: string; createdAt: string; doctor?: { name: string } | null }
interface Transaction { id: string; description: string; amount: string; type: string; date: string; dueDate?: string | null; isPaid: boolean }
interface Doctor { id: string; name: string }

// ── Constants ────────────────────────────────────────────
const APPT_TYPE: Record<string, string> = {
  consultation: 'Consulta', prp: 'PRP', bmac: 'BMAC', hyaluronic: 'Hialurônico',
  prolotherapy: 'Proloterapia', surgery: 'Cirurgia', return: 'Retorno', block: 'Bloqueio',
}
const APPT_STATUS_COLOR: Record<string, string> = {
  scheduled: '#00BCD4', confirmed: '#a8d5a2', attended: '#a8d5a2',
  no_show: '#ffb4ab', rescheduled: '#e6c364', cancelled: '#ffb4ab',
}
const APPT_STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendado', confirmed: 'Confirmado', attended: 'Compareceu',
  no_show: 'Faltou', rescheduled: 'Remarcado', cancelled: 'Cancelado',
}
const TREATMENT_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: '#94A3B8' },
  approved: { label: 'Aprovado', color: '#e6c364' },
  in_progress: { label: 'Em andamento', color: '#00BCD4' },
  completed: { label: 'Concluído', color: '#a8d5a2' },
  cancelled: { label: 'Cancelado', color: '#ffb4ab' },
}
const EXAM_URGENCY: Record<string, { label: string; color: string }> = {
  routine: { label: 'Rotina', color: '#94A3B8' },
  urgent: { label: 'Urgente', color: '#e6c364' },
  emergency: { label: 'Emergência', color: '#ffb4ab' },
}
const EXAM_STATUS: Record<string, string> = {
  issued: 'Emitido', scheduled: 'Agendado', collected: 'Coletado',
  result_available: 'Resultado disponível', archived: 'Arquivado',
}
const RECORD_TYPES = ['anamnese', 'evolucao', 'prescricao', 'laudo', 'cirurgia', 'retorno', 'outro']
const RECORD_TYPE_LABEL: Record<string, string> = {
  anamnese: 'Anamnese', evolucao: 'Evolução', prescricao: 'Prescrição',
  laudo: 'Laudo', cirurgia: 'Cirurgia', retorno: 'Retorno', outro: 'Outro',
}

const BRL = (v: string | number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
const fDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')
const fDateTime = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096] focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)] focus:border-[#00BCE4]'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'

const TABS = [
  { id: 'timeline',    label: 'Timeline',    icon: 'timeline' },
  { id: 'prontuario',  label: 'Prontuário',  icon: 'medical_information' },
  { id: 'consultas',   label: 'Consultas',   icon: 'calendar_today' },
  { id: 'tratamentos', label: 'Tratamentos', icon: 'vaccines' },
  { id: 'exames',      label: 'Exames',      icon: 'biotech' },
  { id: 'financeiro',  label: 'Financeiro',  icon: 'payments' },
  { id: 'dados',       label: 'Dados',       icon: 'person' },
  { id: 'portal',      label: 'Portal',      icon: 'person_pin' },
]

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ color, background: `${color}18` }}>
      {label}
    </span>
  )
}

// ── Novo Registro Clínico ────────────────────────────────
function NovoRegistroDialog({ open, onOpenChange, patientId, doctors, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void
  patientId: string; doctors: Doctor[]; onCreated: () => void
}) {
  const [form, setForm] = useState({ type: 'evolucao', content: '', doctorId: '' })
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!form.content.trim()) { toast.error('Conteúdo é obrigatório'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/prontuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, ...form, doctorId: form.doctorId || null }),
      })
      if (!res.ok) throw new Error()
      toast.success('Registro salvo!')
      onOpenChange(false)
      setForm({ type: 'evolucao', content: '', doctorId: '' })
      onCreated()
    } catch { toast.error('Erro ao salvar registro') } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)]">
        <DialogHeader>
          <DialogTitle className="text-[#021541] font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '18px' }}>note_add</span>
            Novo Registro Clínico
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Tipo de registro</label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v ?? 'evolucao' }))}>
                <SelectTrigger className="bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl text-sm text-[#021541] h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border border-[rgba(2,21,65,0.08)]">
                  {RECORD_TYPES.map(t => (
                    <SelectItem key={t} value={t} className="text-[#021541] text-sm">{RECORD_TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {doctors.length > 0 && (
              <div className="space-y-1.5">
                <label className={labelCls}>Médico</label>
                <Select value={form.doctorId} onValueChange={v => setForm(p => ({ ...p, doctorId: v ?? '' }))}>
                  <SelectTrigger className="bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl text-sm text-[#021541] h-10">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-[rgba(2,21,65,0.08)]">
                    {doctors.map(d => (
                      <SelectItem key={d.id} value={d.id} className="text-[#021541] text-sm">{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Conteúdo do registro *</label>
            <textarea
              rows={6}
              value={form.content}
              onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              placeholder="Descreva o registro clínico, evolução, observações médicas, prescrições..."
              className={inputCls + ' resize-none'}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={() => onOpenChange(false)} disabled={loading} className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] hover:bg-[rgba(2,21,65,0.06)] transition-colors">
            Cancelar
          </button>
          <button onClick={submit} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#0097a7] to-[#00BCE4] text-white hover:opacity-90 disabled:opacity-50">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Novo Exame ───────────────────────────────────────────
function NovoExameDialog({ open, onOpenChange, patientId, doctors, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void
  patientId: string; doctors: Doctor[]; onCreated: () => void
}) {
  const [form, setForm] = useState({
    doctorId: '', hypothesis: '', cid10: '', urgency: 'routine', exams: [{ name: '', tuss_code: '' }],
  })
  const [loading, setLoading] = useState(false)

  function addExam() { setForm(p => ({ ...p, exams: [...p.exams, { name: '', tuss_code: '' }] })) }
  function removeExam(i: number) { setForm(p => ({ ...p, exams: p.exams.filter((_, idx) => idx !== i) })) }
  function setExam(i: number, field: 'name' | 'tuss_code', val: string) {
    setForm(p => ({ ...p, exams: p.exams.map((e, idx) => idx === i ? { ...e, [field]: val } : e) }))
  }

  async function submit() {
    const validExams = form.exams.filter(e => e.name.trim())
    if (validExams.length === 0) { toast.error('Adicione pelo menos 1 exame'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/exames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          doctorId: form.doctorId || null,
          hypothesis: form.hypothesis || null,
          cid10: form.cid10 || null,
          urgency: form.urgency,
          exams: validExams,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Pedido de exame criado!')
      onOpenChange(false)
      setForm({ doctorId: '', hypothesis: '', cid10: '', urgency: 'routine', exams: [{ name: '', tuss_code: '' }] })
      onCreated()
    } catch { toast.error('Erro ao criar pedido') } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white border-[rgba(2,21,65,0.08)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#021541] font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-[#e6c364]" style={{ fontSize: '18px' }}>biotech</span>
            Pedido de Exames
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {doctors.length > 0 && (
              <div className="space-y-1.5">
                <label className={labelCls}>Médico solicitante</label>
                <Select value={form.doctorId} onValueChange={v => setForm(p => ({ ...p, doctorId: v ?? '' }))}>
                  <SelectTrigger className="bg-[#f5f6f8] border-none rounded-xl text-sm text-[#021541] h-10">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#f5f6f8] border-[rgba(2,21,65,0.10)]">
                    {doctors.map(d => (
                      <SelectItem key={d.id} value={d.id} className="text-[#021541] text-sm">{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <label className={labelCls}>Urgência</label>
              <Select value={form.urgency} onValueChange={v => setForm(p => ({ ...p, urgency: v ?? 'routine' }))}>
                <SelectTrigger className="bg-[#f5f6f8] border-none rounded-xl text-sm text-[#021541] h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#f5f6f8] border-[rgba(2,21,65,0.10)]">
                  <SelectItem value="routine" className="text-[#021541] text-sm">Rotina</SelectItem>
                  <SelectItem value="urgent" className="text-[#021541] text-sm">Urgente</SelectItem>
                  <SelectItem value="emergency" className="text-[#021541] text-sm">Emergência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Hipótese diagnóstica</label>
              <input value={form.hypothesis} onChange={e => setForm(p => ({ ...p, hypothesis: e.target.value }))} placeholder="Ex: Gonartrose bilateral" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>CID-10</label>
              <input value={form.cid10} onChange={e => setForm(p => ({ ...p, cid10: e.target.value }))} placeholder="Ex: M17.1" className={inputCls} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={labelCls}>Exames solicitados</label>
              <button onClick={addExam} className="flex items-center gap-1 text-xs text-[#00BCD4] hover:text-[#b2ebf2] font-medium">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
                Adicionar exame
              </button>
            </div>
            {form.exams.map((ex, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={ex.name}
                  onChange={e => setExam(i, 'name', e.target.value)}
                  placeholder={`Exame ${i + 1} (ex: Hemograma completo)`}
                  className={inputCls + ' flex-1'}
                />
                <input
                  value={ex.tuss_code}
                  onChange={e => setExam(i, 'tuss_code', e.target.value)}
                  placeholder="Código TUSS"
                  className="w-28 bg-[#f5f6f8] border-none rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/40 focus:outline-none focus:ring-2 focus:ring-[#00BCD4]/30"
                />
                {form.exams.length > 1 && (
                  <button onClick={() => removeExam(i)} className="p-2 text-[#ffb4ab] hover:bg-[#ffb4ab]/10 rounded-lg transition-colors">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={() => onOpenChange(false)} disabled={loading} className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] hover:bg-[#f5f6f8] transition-colors">
            Cancelar
          </button>
          <button onClick={submit} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#021541] to-[#032170] text-white hover:opacity-90 disabled:opacity-50">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span>
            {loading ? 'Salvando...' : 'Criar pedido'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Novo Tratamento ──────────────────────────────────────
function NovoTratamentoDialog({ open, onOpenChange, patientId, doctors, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void
  patientId: string; doctors: Doctor[]; onCreated: () => void
}) {
  const [form, setForm] = useState({ name: '', doctorId: '', notes: '' })
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!form.name.trim()) { toast.error('Nome do tratamento é obrigatório'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/tratamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          doctorId: form.doctorId || null,
          name: form.name.trim(),
          notes: form.notes || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Tratamento criado!')
      onOpenChange(false)
      setForm({ name: '', doctorId: '', notes: '' })
      onCreated()
    } catch { toast.error('Erro ao criar tratamento') } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border-[rgba(2,21,65,0.08)]">
        <DialogHeader>
          <DialogTitle className="text-[#021541] font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-[#00BCD4]" style={{ fontSize: '18px' }}>vaccines</span>
            Novo Tratamento
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className={labelCls}>Nome do tratamento *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: PRP Joelho Bilateral, Infiltração L4-L5..." className={inputCls} autoFocus />
          </div>
          {doctors.length > 0 && (
            <div className="space-y-1.5">
              <label className={labelCls}>Médico responsável</label>
              <Select value={form.doctorId} onValueChange={v => setForm(p => ({ ...p, doctorId: v ?? '' }))}>
                <SelectTrigger className="bg-[#f5f6f8] border-none rounded-xl text-sm text-[#021541] h-10">
                  <SelectValue placeholder="Selecionar médico" />
                </SelectTrigger>
                <SelectContent className="bg-[#f5f6f8] border-[rgba(2,21,65,0.10)]">
                  {doctors.map(d => (
                    <SelectItem key={d.id} value={d.id} className="text-[#021541] text-sm">{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <label className={labelCls}>Observações</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Indicações, contraindicações, observações do tratamento..."
              className={inputCls + ' resize-none'}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={() => onOpenChange(false)} disabled={loading} className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] hover:bg-[#f5f6f8] transition-colors">
            Cancelar
          </button>
          <button onClick={submit} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#021541] to-[#032170] text-white hover:opacity-90 disabled:opacity-50">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
            {loading ? 'Salvando...' : 'Criar tratamento'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Portal Tab ───────────────────────────────────────────
function PortalTab({ patientId }: { patientId: string }) {
  const [token, setToken] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    setFetching(true)
    fetch(`/api/portal/token?patientId=${patientId}`)
      .then(r => r.json())
      .then(({ data }) => {
        if (data) {
          setToken(data.token)
          setCode(data.code)
          setExpiresAt(data.expiresAt)
        }
      })
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [patientId])

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch('/api/portal/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error()
      setToken(data.token)
      setCode(data.code)
      setExpiresAt(data.expiresAt)
      toast.success('Link e código de acesso gerados!')
    } catch { toast.error('Erro ao gerar link de acesso') } finally { setLoading(false) }
  }

  const link = token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/portal?token=${token}` : null

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-[#00BCD4]" style={{ fontSize: '24px' }}>person_pin</span>
          <div>
            <p className="text-sm font-bold text-[#021541]">Portal do Paciente</p>
            <p className="text-xs text-[#718096]">Gerencie o acesso do paciente para visualizar tratamentos e históricos</p>
          </div>
        </div>
        
        {fetching ? (
          <p className="text-xs text-[#718096] italic">Carregando informações de acesso...</p>
        ) : link ? (
          <div className="space-y-3">
            <div className="bg-[#f5f6f8] rounded-xl p-3 space-y-3">
              <div>
                <p className="text-[10px] text-[#718096] uppercase tracking-wider font-bold mb-1">Link de acesso direto</p>
                <p className="text-xs text-[#00BCD4] break-all font-mono">{link}</p>
              </div>
              
              {code && (
                <div className="pt-3 border-t border-[rgba(2,21,65,0.06)] flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-[#718096] uppercase tracking-wider font-bold">Código de Acesso</p>
                    <p className="text-lg font-bold text-[#021541] tracking-widest font-mono mt-0.5">{code}</p>
                  </div>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(code); toast.success('Código copiado!') }} 
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white text-[#718096] border border-[rgba(2,21,65,0.08)] hover:bg-[#f5f6f8] transition-colors border-0"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>content_copy</span>Copiar código
                  </button>
                </div>
              )}
              
              <p className="text-[11px] text-[#718096]/60 mt-1">Válido até: {expiresAt ? fDateTime(expiresAt) : '—'}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { navigator.clipboard.writeText(link); toast.success('Link copiado!') }} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-[#00BCD4]/10 text-[#00BCD4] hover:bg-[#00BCD4]/20 border-0">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>content_copy</span>Copiar link
              </button>
              <button onClick={generate} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-[#f5f6f8] text-[#718096] hover:bg-[#e2e8f0] transition-colors border-0">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>refresh</span>Gerar novo
              </button>
            </div>
          </div>
        ) : (
          <button onClick={generate} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#021541] to-[#032170] text-white hover:opacity-90 disabled:opacity-50 border-0">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>key</span>
            {loading ? 'Gerando...' : 'Gerar Link & Código de Acesso'}
          </button>
        )}
      </div>
      <div className="bg-white rounded-xl p-4">
        <p className="text-xs font-bold text-[#718096] uppercase tracking-wider mb-2">O paciente terá acesso a:</p>
        <ul className="space-y-2">
          {['Próximos agendamentos', 'Histórico de consultas', 'Tratamentos realizados', 'Pedidos de exame e resultados', 'Histórico de pagamentos'].map(item => (
            <li key={item} className="flex items-center gap-2 text-sm text-[#021541]">
              <span className="material-symbols-outlined text-[#a8d5a2]" style={{ fontSize: '14px' }}>check_circle</span>{item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────
export default function PacienteDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [exams, setExams] = useState<ExamOrder[]>([])
  const [records, setRecords] = useState<ClinicalRecord[]>([])
  const [prontuarioNegado, setProntuarioNegado] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [activeTab, setActiveTab] = useState('timeline')
  const [loading, setLoading] = useState(true)

  // Dialogs
  const [registroDialog, setRegistroDialog] = useState(false)
  const [exameDialog, setExameDialog] = useState(false)
  const [tratamentoDialog, setTratamentoDialog] = useState(false)

  // Edit mode (Dados tab)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Patient>>({})
  const [savingEdit, setSavingEdit] = useState(false)

  const loadAll = () => {
    setLoading(true)
    // Cada requisição falha isoladamente. Antes, um 403 no prontuário ou um erro
    // de rede em qualquer aba rejeitava o Promise.all inteiro e a ficha exibia
    // "Paciente não encontrado" mesmo com o paciente tendo carregado.
    const safe = (url: string) =>
      fetch(url)
        .then(async r => (r.ok ? { ...(await r.json()), status: r.status } : { data: null, status: r.status }))
        .catch(() => ({ data: null, status: 0 }))

    Promise.all([
      safe(`/api/pacientes/${id}`),
      safe(`/api/agenda?patientId=${id}`),
      safe(`/api/tratamentos?patientId=${id}`),
      safe(`/api/exames?patientId=${id}`),
      safe(`/api/prontuario?patientId=${id}`),
      safe(`/api/financeiro?patientId=${id}`),
      safe('/api/usuarios'),
    ]).then(([pat, appts, treats, exs, recs, txs, usrs]) => {
      if (pat.data) { setPatient(pat.data); setEditForm(pat.data) }
      if (appts.data) setAppointments(appts.data)
      if (treats.data) setTreatments(treats.data)
      if (exs.data) setExams(exs.data)
      if (recs.data) setRecords(recs.data)
      // 403 e "sem registro" são coisas diferentes: dizer "nenhum registro
      // clínico" para quem não tem acesso escondia o motivo real.
      setProntuarioNegado(recs.status === 403)
      if (txs.data) setTransactions(txs.data)
      if (usrs.data) setDoctors(usrs.data.filter((u: { role: string }) => u.role === 'doctor'))
    }).finally(() => setLoading(false))
  }

  useEffect(() => { loadAll() }, [id])

  async function saveEdit() {
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/pacientes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          phone: editForm.phone,
          email: editForm.email || null,
          cpf: editForm.cpf || null,
          birthDate: editForm.birthDate || null,
          gender: editForm.gender as 'male' | 'female' | 'other' | null || null,
          address: editForm.address || null,
          city: editForm.city || null,
          insurance: editForm.insurance || null,
          insuranceNum: editForm.insuranceNum || null,
          notes: editForm.notes || null,
          photoUrl: editForm.photoUrl || null,
          internalNotes: editForm.internalNotes || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Dados atualizados!')
      setEditMode(false)
      loadAll()
    } catch { toast.error('Erro ao salvar') } finally { setSavingEdit(false) }
  }

  if (loading) return <p className="py-16 text-center text-sm text-[#718096]">Carregando...</p>
  if (!patient) return <p className="py-16 text-center text-sm text-[#ffb4ab]">Paciente não encontrado</p>

  const age = patient.birthDate
    ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null

  type TimelineEvent = { date: string; type: string; title: string; subtitle: string; color: string; icon: string }
  const timelineEvents: TimelineEvent[] = [
    { date: patient.createdAt, type: 'crm', title: 'Paciente cadastrado', subtitle: 'Entrada no sistema', color: '#00BCD4', icon: 'person_add' },
    ...appointments.map(a => ({ date: a.startAt, type: 'appointment', title: APPT_TYPE[a.type] ?? a.type, subtitle: a.doctor ? `Dr. ${a.doctor.name} · ${APPT_STATUS_LABEL[a.status] ?? a.status}` : APPT_STATUS_LABEL[a.status] ?? a.status, color: APPT_STATUS_COLOR[a.status] ?? '#94A3B8', icon: 'calendar_today' })),
    ...treatments.map(t => ({ date: t.createdAt, type: 'treatment', title: t.name, subtitle: `Tratamento · ${BRL(t.totalSale)}`, color: TREATMENT_STATUS[t.status]?.color ?? '#94A3B8', icon: 'vaccines' })),
    ...exams.map(e => ({ date: e.createdAt, type: 'exam', title: `${e.exams.length} exame(s) solicitado(s)`, subtitle: e.hypothesis ?? EXAM_URGENCY[e.urgency]?.label ?? '', color: '#e6c364', icon: 'biotech' })),
    ...records.map(r => ({ date: r.createdAt, type: 'record', title: RECORD_TYPE_LABEL[r.type] ?? r.type, subtitle: r.content.substring(0, 60) + (r.content.length > 60 ? '...' : ''), color: '#a8d5a2', icon: 'medical_information' })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="space-y-5">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-[#718096] hover:text-[#021541]">
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
        Voltar
      </button>

      {/* Patient header */}
      <div className="bg-white rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#f5f6f8] flex items-center justify-center text-[#021541] font-bold text-2xl shrink-0 overflow-hidden border border-[rgba(2,21,65,0.06)] relative select-none">
            {patient.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={patient.photoUrl} alt={patient.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#021541] to-[#032170] flex items-center justify-center text-white">
                {patient.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-[#021541]">{patient.name}</h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${patient.isActive ? 'bg-[#a8d5a2]/10 text-[#a8d5a2]' : 'bg-[#ffb4ab]/10 text-[#ffb4ab]'}`}>
                {patient.isActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-2 flex-wrap text-sm text-[#718096]">
              {age && <span>{age} anos</span>}
              {patient.phone && (
                <a href={`tel:${patient.phone}`} className="flex items-center gap-1 hover:text-[#00BCD4]">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>phone</span>{patient.phone}
                </a>
              )}
              {patient.email && (
                <a href={`mailto:${patient.email}`} className="flex items-center gap-1 hover:text-[#00BCD4]">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>mail</span>{patient.email}
                </a>
              )}
              {patient.city && <span className="flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>location_on</span>{patient.city}</span>}
              {patient.insurance && <span className="flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>health_and_safety</span>{patient.insurance}</span>}
            </div>
          </div>
          {/* Ações rápidas */}
          <div className="shrink-0 flex items-center gap-2">
            <button onClick={() => { setActiveTab('prontuario'); setRegistroDialog(true) }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#a8d5a2]/10 text-[#a8d5a2] text-xs font-bold hover:bg-[#a8d5a2]/20 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>note_add</span>Registro
            </button>
            <button onClick={() => { setActiveTab('exames'); setExameDialog(true) }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#e6c364]/10 text-[#e6c364] text-xs font-bold hover:bg-[#e6c364]/20 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>biotech</span>Exame
            </button>
            <button onClick={() => { setActiveTab('tratamentos'); setTratamentoDialog(true) }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-br from-[#021541] to-[#032170] text-white text-xs font-bold hover:opacity-90 transition-opacity">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>vaccines</span>Tratamento
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-5 gap-3 mt-4 pt-4 border-t border-[rgba(2,21,65,0.08)]">
          {[
            { label: 'Consultas', value: appointments.length, color: '#00BCD4' },
            { label: 'Tratamentos', value: treatments.length, color: '#e6c364' },
            { label: 'Exames', value: exams.length, color: '#a8d5a2' },
            { label: 'Registros', value: records.length, color: '#d3bbff' },
            { label: 'Receita total', value: BRL(treatments.filter(t => t.status === 'completed').reduce((s, t) => s + Number(t.totalSale), 0)), color: '#e2e8f0' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] text-[#718096] uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-[#f5f6f8] text-[#021541] shadow-sm' : 'text-[#718096]/70 hover:text-[#021541] hover:bg-[#f5f6f8]'}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {/* ── Timeline ── */}
        {activeTab === 'timeline' && (
          <div className="relative space-y-0 pl-6">
            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-[#1A2B56]/30" />
            {timelineEvents.length === 0 ? (
              <p className="text-sm text-[#718096] text-center py-8">Nenhum evento registrado</p>
            ) : timelineEvents.map((ev, i) => (
              <div key={i} className="relative flex gap-4 pb-5">
                <div className="absolute -left-6 mt-0.5 w-4 h-4 rounded-full border-2 border-[#0c1221] flex items-center justify-center" style={{ backgroundColor: ev.color }}>
                  <span className="material-symbols-outlined text-white" style={{ fontSize: '9px' }}>{ev.icon}</span>
                </div>
                <div className="flex-1 bg-white rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[#021541]">{ev.title}</p>
                      <p className="text-xs text-[#718096] mt-0.5">{ev.subtitle}</p>
                    </div>
                    <p className="text-xs text-[#718096]/60 shrink-0">{fDate(ev.date)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Prontuário ── */}
        {activeTab === 'prontuario' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button onClick={() => setRegistroDialog(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#021541] to-[#032170] text-white hover:opacity-90">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>note_add</span>
                Novo Registro
              </button>
            </div>
            {prontuarioNegado ? (
              <div className="bg-white rounded-xl py-12 text-center">
                <span className="material-symbols-outlined text-[#dc2626]/30" style={{ fontSize: '40px' }}>lock</span>
                <p className="text-sm text-[#021541] mt-3 font-medium">Você não tem permissão para ver o prontuário</p>
                <p className="text-xs text-[#718096]/60 mt-1">Peça acesso a um administrador da clínica</p>
              </div>
            ) : records.length === 0 ? (
              <div className="bg-white rounded-xl py-12 text-center">
                <span className="material-symbols-outlined text-[#718096]/20" style={{ fontSize: '40px' }}>medical_information</span>
                <p className="text-sm text-[#718096] mt-3">Nenhum registro clínico</p>
                <p className="text-xs text-[#718096]/60 mt-1">Anamneses, evoluções, prescrições e laudos serão listados aqui</p>
              </div>
            ) : records.map(r => (
              <div key={r.id} className="bg-white rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#a8d5a2]/10 text-[#a8d5a2] uppercase tracking-wider">
                    {RECORD_TYPE_LABEL[r.type] ?? r.type}
                  </span>
                  {r.doctor && <span className="text-xs text-[#718096]">Dr. {r.doctor.name}</span>}
                  <span className="text-[10px] text-[#718096]/60 ml-auto">{fDateTime(r.createdAt)}</span>
                </div>
                <p className="text-sm text-[#021541] whitespace-pre-wrap leading-relaxed">{r.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Consultas ── */}
        {activeTab === 'consultas' && (
          <div className="space-y-3">
            {appointments.length === 0 ? (
              <div className="bg-white rounded-xl py-12 text-center">
                <span className="material-symbols-outlined text-[#718096]/20" style={{ fontSize: '40px' }}>calendar_today</span>
                <p className="text-sm text-[#718096] mt-3">Nenhuma consulta registrada</p>
              </div>
            ) : appointments.map(a => (
              <div key={a.id} className="bg-white rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#021541]">{APPT_TYPE[a.type] ?? a.type}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[#718096]">
                      <span className="font-technical">{fDateTime(a.startAt)}</span>
                      {a.doctor && <span>· Dr. {a.doctor.name}</span>}
                    </div>
                    {a.notes && <p className="text-xs text-[#718096]/70 mt-1.5 italic">{a.notes}</p>}
                  </div>
                  <Badge label={APPT_STATUS_LABEL[a.status] ?? a.status} color={APPT_STATUS_COLOR[a.status] ?? '#94A3B8'} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tratamentos ── */}
        {activeTab === 'tratamentos' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button onClick={() => setTratamentoDialog(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#021541] to-[#032170] text-white hover:opacity-90">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                Novo Tratamento
              </button>
            </div>
            {treatments.length === 0 ? (
              <div className="bg-white rounded-xl py-12 text-center">
                <span className="material-symbols-outlined text-[#718096]/20" style={{ fontSize: '40px' }}>vaccines</span>
                <p className="text-sm text-[#718096] mt-3">Nenhum tratamento</p>
                <p className="text-xs text-[#718096]/60 mt-1">PRP, BMAC, Hialurônico, Proloterapia, Cirurgias e mais</p>
              </div>
            ) : treatments.map(t => {
              const cfg = TREATMENT_STATUS[t.status]
              const margin = Number(t.totalSale) - Number(t.totalCost)
              return (
                <div key={t.id} className="bg-white rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-bold text-[#021541]">{t.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-[#718096]">
                        <span>{fDate(t.createdAt)}</span>
                        {t.doctor && <span>· Dr. {t.doctor.name}</span>}
                      </div>
                    </div>
                    <Badge label={cfg?.label ?? t.status} color={cfg?.color ?? '#94A3B8'} />
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div><p className="text-xs text-[#718096]">Venda</p><p className="text-sm font-bold text-[#00BCD4]">{BRL(t.totalSale)}</p></div>
                    <div><p className="text-xs text-[#718096]">Custo</p><p className="text-sm font-bold text-[#021541]">{BRL(t.totalCost)}</p></div>
                    <div><p className="text-xs text-[#718096]">Margem</p><p className={`text-sm font-bold ${margin >= 0 ? 'text-[#a8d5a2]' : 'text-[#ffb4ab]'}`}>{BRL(margin)}</p></div>
                  </div>
                  {t.items.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[rgba(2,21,65,0.08)] space-y-1">
                      {t.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-[#718096]">{item.description}</span>
                          <span className="text-[#021541]">{item.quantity}x {BRL(item.unitPrice)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Exames ── */}
        {activeTab === 'exames' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button onClick={() => setExameDialog(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#021541] to-[#032170] text-white hover:opacity-90">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                Novo Pedido de Exame
              </button>
            </div>
            {exams.length === 0 ? (
              <div className="bg-white rounded-xl py-12 text-center">
                <span className="material-symbols-outlined text-[#718096]/20" style={{ fontSize: '40px' }}>biotech</span>
                <p className="text-sm text-[#718096] mt-3">Nenhum pedido de exame</p>
                <p className="text-xs text-[#718096]/60 mt-1">Hemogramas, imagens, laboratoriais e resultados ficam aqui</p>
              </div>
            ) : exams.map(ex => (
              <div key={ex.id} className="bg-white rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-bold text-[#021541]">{ex.exams.map(e => e.name).join(', ')}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-[#718096]">
                      <span>{fDate(ex.createdAt)}</span>
                      {ex.doctor && <span>· Dr. {ex.doctor.name}</span>}
                    </div>
                    {ex.hypothesis && <p className="text-xs text-[#718096]/70 mt-1">Hipótese: {ex.hypothesis}</p>}
                  </div>
                  <div className="flex flex-col gap-1 items-end shrink-0">
                    <Badge label={EXAM_URGENCY[ex.urgency]?.label ?? ex.urgency} color={EXAM_URGENCY[ex.urgency]?.color ?? '#94A3B8'} />
                    <span className="text-[10px] text-[#718096]">{EXAM_STATUS[ex.status] ?? ex.status}</span>
                  </div>
                </div>
                {ex.resultUrl ? (
                  <a href={ex.resultUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#00BCD4] hover:underline mt-2">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                    Ver resultado {ex.resultDate ? `(${fDate(ex.resultDate)})` : ''}
                  </a>
                ) : (
                  <p className="text-xs text-[#718096]/40 mt-2">Aguardando resultado</p>
                )}
                {ex.validUntil && !ex.resultUrl && (
                  <p className="text-xs text-[#718096]/60">Válido até: {fDate(ex.validUntil)}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Financeiro ── */}
        {activeTab === 'financeiro' && (
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="bg-white rounded-xl py-12 text-center">
                <span className="material-symbols-outlined text-[#718096]/20" style={{ fontSize: '40px' }}>payments</span>
                <p className="text-sm text-[#718096] mt-3">Nenhuma transação financeira</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {(() => {
                    const paid = transactions.filter(t => t.type === 'income' && t.isPaid).reduce((s, t) => s + Number(t.amount), 0)
                    const pending = transactions.filter(t => t.type === 'income' && !t.isPaid).reduce((s, t) => s + Number(t.amount), 0)
                    const total = paid + pending
                    return [
                      { label: 'Total', value: BRL(total), color: '#e2e8f0' },
                      { label: 'Pago', value: BRL(paid), color: '#a8d5a2' },
                      { label: 'Pendente', value: BRL(pending), color: '#e6c364' },
                    ].map(s => (
                      <div key={s.label} className="bg-white rounded-xl p-3 text-center">
                        <p className="text-base font-bold" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-[10px] text-[#718096] uppercase tracking-wider">{s.label}</p>
                      </div>
                    ))
                  })()}
                </div>
                {transactions.map(tx => (
                  <div key={tx.id} className="bg-white rounded-xl p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-[#021541]">{tx.description}</p>
                      <p className="text-xs text-[#718096] mt-0.5">
                        Lançamento: {fDate(tx.date)}
                        {tx.dueDate && ` · Vencimento: ${fDate(tx.dueDate)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${tx.type === 'income' ? 'text-[#a8d5a2]' : 'text-[#ffb4ab]'}`}>
                        {tx.type === 'income' ? '+' : '-'}{BRL(tx.amount)}
                      </p>
                      <span className={`text-[10px] font-bold ${tx.isPaid ? 'text-[#a8d5a2]' : 'text-[#e6c364]'}`}>
                        {tx.isPaid ? 'Pago' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── Dados ── */}
        {activeTab === 'dados' && (
          <div className="bg-white rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-bold text-[#021541]">Dados cadastrais</p>
              {!editMode ? (
                <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f5f6f8] text-[#718096] text-xs font-medium hover:bg-[#f5f6f8] hover:text-[#021541] transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>Editar
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { setEditMode(false); setEditForm(patient) }} className="px-3 py-1.5 rounded-xl bg-[#f5f6f8] text-[#718096] text-xs font-medium hover:bg-[#f5f6f8] transition-colors">
                    Cancelar
                  </button>
                  <button onClick={saveEdit} disabled={savingEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-br from-[#021541] to-[#032170] text-white text-xs font-bold hover:opacity-90 disabled:opacity-50">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>save</span>
                    {savingEdit ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              )}
            </div>

            {!editMode ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {[
                  ['Nome', patient.name],
                  ['CPF', patient.cpf],
                  ['Data de nascimento', patient.birthDate ? fDate(patient.birthDate) : null],
                  ['Gênero', patient.gender === 'male' ? 'Masculino' : patient.gender === 'female' ? 'Feminino' : patient.gender],
                  ['Telefone', patient.phone],
                  ['E-mail', patient.email],
                  ['Cidade', patient.city],
                  ['Convênio', patient.insurance],
                  ['Nº convênio', patient.insuranceNum],
                ].map(([label, val]) => (
                  <div key={label as string}>
                    <dt className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">{label}</dt>
                    <dd className="text-[#021541] mt-0.5">{(val as string | null | undefined) ?? '—'}</dd>
                  </div>
                ))}
                {patient.address && (
                  <div className="col-span-2">
                    <dt className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">Endereço</dt>
                    <dd className="text-[#021541] mt-0.5">{patient.address}</dd>
                  </div>
                )}
                {patient.notes && (
                  <div className="col-span-2">
                    <dt className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">Observações</dt>
                    <dd className="text-[#021541] mt-0.5 whitespace-pre-wrap">{patient.notes}</dd>
                  </div>
                )}
                {patient.internalNotes && (
                  <div className="col-span-2 border border-rose-100 rounded-xl p-3 bg-rose-50/20">
                    <dt className="text-[10px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-rose-500" style={{ fontSize: '14px' }}>lock</span>
                      Observações Internas (Uso da Clínica)
                    </dt>
                    <dd className="text-[#021541] mt-1.5 whitespace-pre-wrap font-medium">{patient.internalNotes}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="w-24 shrink-0">
                    <ImageUploader
                      type="logo"
                      label="Foto"
                      hint="Selecione"
                      currentUrl={editForm.photoUrl}
                      onUploaded={(url) => setEditForm(p => ({ ...p, photoUrl: url }))}
                      previewAspect="1/1"
                      previewClass="rounded-full object-cover w-20 h-20"
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className={labelCls}>Nome completo *</label>
                    <input value={editForm.name ?? ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className={labelCls}>CPF</label>
                    <input value={editForm.cpf ?? ''} onChange={e => setEditForm(p => ({ ...p, cpf: e.target.value }))} placeholder="000.000.000-00" className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>Data de nascimento</label>
                    <input type="date" value={editForm.birthDate?.split('T')[0] ?? ''} onChange={e => setEditForm(p => ({ ...p, birthDate: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>Gênero</label>
                    <Select value={editForm.gender ?? ''} onValueChange={v => setEditForm(p => ({ ...p, gender: v }))}>
                      <SelectTrigger className="bg-[#f5f6f8] border-none rounded-xl text-sm text-[#021541] h-10">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#f5f6f8] border-[rgba(2,21,65,0.10)]">
                        <SelectItem value="male" className="text-[#021541] text-sm">Masculino</SelectItem>
                        <SelectItem value="female" className="text-[#021541] text-sm">Feminino</SelectItem>
                        <SelectItem value="other" className="text-[#021541] text-sm">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={labelCls}>Telefone *</label>
                    <input value={editForm.phone ?? ''} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>E-mail</label>
                    <input type="email" value={editForm.email ?? ''} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className={labelCls}>Endereço</label>
                    <input value={editForm.address ?? ''} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>Cidade</label>
                    <input value={editForm.city ?? ''} onChange={e => setEditForm(p => ({ ...p, city: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={labelCls}>Convênio</label>
                    <input value={editForm.insurance ?? ''} onChange={e => setEditForm(p => ({ ...p, insurance: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>Nº carteirinha</label>
                    <input value={editForm.insuranceNum ?? ''} onChange={e => setEditForm(p => ({ ...p, insuranceNum: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Observações</label>
                  <textarea rows={3} value={editForm.notes ?? ''} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} className={inputCls + ' resize-none'} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls} style={{ color: '#e11d48' }}>Observações Internas (Uso da Clínica)</label>
                  <textarea rows={3} value={editForm.internalNotes ?? ''} onChange={e => setEditForm(p => ({ ...p, internalNotes: e.target.value }))} className={inputCls + ' resize-none border-rose-100 bg-rose-50/5'} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Portal ── */}
        {activeTab === 'portal' && <PortalTab patientId={patient.id} />}
      </div>

      {/* Dialogs */}
      <NovoRegistroDialog open={registroDialog} onOpenChange={setRegistroDialog} patientId={id} doctors={doctors} onCreated={loadAll} />
      <NovoExameDialog open={exameDialog} onOpenChange={setExameDialog} patientId={id} doctors={doctors} onCreated={loadAll} />
      <NovoTratamentoDialog open={tratamentoDialog} onOpenChange={setTratamentoDialog} patientId={id} doctors={doctors} onCreated={loadAll} />
    </div>
  )
}
