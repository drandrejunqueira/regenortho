'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────
interface TreatmentItem {
  id?: string
  type: 'procedure' | 'material' | 'fee'
  materialId?: string | null
  description: string
  quantity: number
  unitCost: number
  unitPrice: number
  total: number
  sortOrder: number
}

interface Treatment {
  id: string
  name: string
  category: string
  status: string
  subtotal: string
  discount: string
  totalSale: string
  totalCost: string
  installments: number
  notes: string | null
  cancelReason: string | null
  completedAt: string | null
  createdAt: string
  patient: { id: string; name: string } | null
  doctor: { id: string; name: string } | null
  paymentMethod: { id: string; name: string; type: string } | null
  items: TreatmentItem[]
}

interface Patient { id: string; name: string }
interface PaymentMethod { id: string; name: string; type: string }
interface Material { id: string; name: string; unitCost: string | null; unit: string }

// ── Constants ───────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  draft:       { label: 'Rascunho',     color: '#718096', bg: 'rgba(113,128,150,0.1)', icon: 'edit_note' },
  approved:    { label: 'Aprovado',     color: '#d97706', bg: 'rgba(217,119,6,0.1)',   icon: 'thumb_up' },
  in_progress: { label: 'Em andamento', color: '#00BCE4', bg: 'rgba(0,188,228,0.1)',   icon: 'autorenew' },
  completed:   { label: 'Concluído',    color: '#059669', bg: 'rgba(5,150,105,0.1)',   icon: 'check_circle' },
  cancelled:   { label: 'Cancelado',    color: '#DC2626', bg: 'rgba(239,68,68,0.1)',   icon: 'cancel' },
}

const ITEM_TYPE_LABELS = { procedure: 'Procedimento', material: 'Material', fee: 'Honorário' }

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'consultation_fee', label: 'Consulta' },
  { value: 'prp_procedure', label: 'PRP' },
  { value: 'bmac_procedure', label: 'BMAC' },
  { value: 'hyaluronic_procedure', label: 'Ácido Hialurônico' },
  { value: 'surgery_fee', label: 'Cirurgia' },
  { value: 'other_income', label: 'Outros' },
]

interface TemplateItem {
  type: 'procedure' | 'material' | 'fee'
  materialId: string | null
  description: string
  quantity: string
  unitPrice: string
  sortOrder: number
}
interface Template {
  id: string
  name: string
  description: string | null
  category: string
  defaultPrice: string
  estimatedCost: string
  isActive: boolean
  notes: string | null
  items: TemplateItem[]
}

const BRL = (v: string | number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))

const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/60 focus:outline-none focus:border-[#00BCE4] focus:ring-2 focus:ring-[rgba(0,188,228,0.15)] transition-colors'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'

// ── StatusBadge ─────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ color: cfg.color, background: cfg.bg }}>
      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  )
}

// ── DrawerCreateTreatment ────────────────────────────────
function DrawerCreateTreatment({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (t: Treatment) => void
}) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    patientId: '',
    paymentMethodId: '',
    templateId: '',
    category: 'consultation_fee',
    name: '',
    discount: 0,
    installments: 1,
    notes: '',
  })
  const [items, setItems] = useState<TreatmentItem[]>([
    { type: 'procedure', description: '', quantity: 1, unitCost: 0, unitPrice: 0, total: 0, sortOrder: 0 },
  ])

  useEffect(() => {
    if (!open) return
    Promise.all([
      fetch('/api/pacientes?limit=200').then(r => r.json()),
      fetch('/api/configuracoes/pagamentos').then(r => r.json()),
      fetch('/api/materiais').then(r => r.json()),
      fetch('/api/tratamentos/templates').then(r => r.json()),
    ]).then(([pRes, pmRes, mRes, tRes]) => {
      if (pRes.data) setPatients(pRes.data)
      if (pmRes.data) setPaymentMethods(pmRes.data.filter((p: PaymentMethod & { isActive?: boolean }) => p.isActive !== false))
      if (mRes.data) setMaterials(mRes.data)
      if (tRes.data) setTemplates(tRes.data)
    }).catch(() => {})
  }, [open])

  function setF(key: string, value: unknown) { setForm(p => ({ ...p, [key]: value })) }

  /** Aplica um modelo do catálogo: preenche nome, categoria e itens. */
  function applyTemplate(templateId: string) {
    setF('templateId', templateId)
    const tpl = templates.find(t => t.id === templateId)
    if (!tpl) return
    setForm(p => ({ ...p, templateId, name: tpl.name, category: tpl.category }))
    setItems(tpl.items.map((it, i) => {
      const mat = it.materialId ? materials.find(m => m.id === it.materialId) : null
      const unitCost = mat ? Number(mat.unitCost ?? 0) : 0
      const quantity = Number(it.quantity)
      const unitPrice = Number(it.unitPrice)
      return {
        type: it.type,
        materialId: it.materialId,
        description: it.description,
        quantity,
        unitCost,
        unitPrice,
        total: quantity * unitPrice,
        sortOrder: it.sortOrder ?? i,
      }
    }))
  }

  function addItem() {
    setItems(p => [...p, { type: 'procedure', description: '', quantity: 1, unitCost: 0, unitPrice: 0, total: 0, sortOrder: p.length }])
  }

  function removeItem(idx: number) {
    setItems(p => p.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, key: string, value: unknown) {
    setItems(p => {
      const next = [...p]
      next[idx] = { ...next[idx], [key]: value }
      const item = next[idx]
      if (['quantity', 'unitPrice'].includes(key)) {
        next[idx].total = Number(item.quantity) * Number(item.unitPrice)
      }
      if (key === 'materialId') {
        const mat = materials.find(m => m.id === value)
        if (mat) {
          next[idx].description = mat.name
          next[idx].unitCost = Number(mat.unitCost ?? 0)
        }
      }
      return next
    })
  }

  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const totalSale = Math.max(0, subtotal - form.discount)
  const margin = totalSale - items.reduce((s, i) => s + i.quantity * i.unitCost, 0)

  async function save() {
    if (!form.patientId) { toast.error('Selecione um paciente'); return }
    if (!form.name) { toast.error('Informe o nome do tratamento'); return }
    if (items.some(i => !i.description)) { toast.error('Preencha a descrição de todos os itens'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/tratamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error()
      onCreated(data.data)
      toast.success('Tratamento criado!')
      onClose()
      setForm({ patientId: '', paymentMethodId: '', templateId: '', category: 'consultation_fee', name: '', discount: 0, installments: 1, notes: '' })
      setItems([{ type: 'procedure', description: '', quantity: 1, unitCost: 0, unitPrice: 0, total: 0, sortOrder: 0 }])
    } catch { toast.error('Erro ao criar tratamento') } finally { setSaving(false) }
  }

  if (!open) return null

  const drawerInputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/60 focus:outline-none focus:border-[#00BCE4] focus:ring-2 focus:ring-[rgba(0,188,228,0.15)] transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-[600px] bg-white h-full flex flex-col shadow-2xl overflow-hidden border-l border-[rgba(2,21,65,0.08)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(2,21,65,0.06)] shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#021541]">Novo Tratamento</h2>
            <p className="text-xs text-[#718096] mt-0.5">Crie o plano de tratamento com materiais e valores</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#718096] hover:bg-[#f5f6f8] hover:text-[#021541] transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Basics */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <label className={labelCls}>Paciente *</label>
                <select value={form.patientId} onChange={e => setF('patientId', e.target.value)} className={drawerInputCls}>
                  <option value="">Selecione...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {templates.length > 0 && (
                <div className="space-y-1.5 col-span-2">
                  <label className={labelCls}>Modelo do Catálogo</label>
                  <select value={form.templateId} onChange={e => applyTemplate(e.target.value)} className={drawerInputCls}>
                    <option value="">Começar do zero...</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name} — {BRL(t.defaultPrice)}</option>)}
                  </select>
                  <p className="text-[11px] text-[#718096]">Preenche itens e valores automaticamente. Você pode ajustar depois.</p>
                </div>
              )}
              <div className="space-y-1.5 col-span-2">
                <label className={labelCls}>Nome do Tratamento *</label>
                <input value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Ex: PRP Joelho Bilateral" className={drawerInputCls} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className={labelCls}>Categoria (centro de custo)</label>
                <select value={form.category} onChange={e => setF('category', e.target.value)} className={drawerInputCls}>
                  {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Forma de Pagamento</label>
                <select value={form.paymentMethodId} onChange={e => setF('paymentMethodId', e.target.value)} className={drawerInputCls}>
                  <option value="">Selecione...</option>
                  {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Parcelas</label>
                <input type="number" min="1" max="24" value={form.installments} onChange={e => setF('installments', Number(e.target.value))} className={drawerInputCls} />
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">Itens do Tratamento</p>
              <button onClick={addItem} className="flex items-center gap-1 text-xs text-[#00BCE4] hover:text-[#00BCE4]/80 font-medium">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
                Adicionar item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="bg-[#f5f6f8] rounded-xl p-3 space-y-2 border border-[rgba(2,21,65,0.06)]">
                  <div className="flex items-center gap-2">
                    <select value={item.type} onChange={e => updateItem(idx, 'type', e.target.value)} className="bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-[#021541] focus:outline-none focus:border-[#00BCE4]">
                      {Object.entries(ITEM_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    {item.type === 'material' && (
                      <select
                        value={item.materialId ?? ''}
                        onChange={e => updateItem(idx, 'materialId', e.target.value || null)}
                        className="flex-1 bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-[#021541] focus:outline-none focus:border-[#00BCE4]"
                      >
                        <option value="">Selecione do estoque...</option>
                        {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                      </select>
                    )}
                    <button onClick={() => removeItem(idx)} className="w-6 h-6 flex items-center justify-center text-[#718096]/50 hover:text-[#DC2626] ml-auto shrink-0 transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                    </button>
                  </div>
                  <input
                    value={item.description}
                    onChange={e => updateItem(idx, 'description', e.target.value)}
                    placeholder="Descrição do item..."
                    className="w-full bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-[#021541] placeholder:text-[#718096]/50 focus:outline-none focus:border-[#00BCE4]"
                  />
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <p className={`${labelCls} mb-1`}>Qtd</p>
                      <input type="number" min="0.001" step="0.001" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} className="w-full bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2 py-1.5 text-xs text-[#021541] focus:outline-none focus:border-[#00BCE4]" />
                    </div>
                    <div>
                      <p className={`${labelCls} mb-1`}>Custo (R$)</p>
                      <input type="number" min="0" step="0.01" value={item.unitCost} onChange={e => updateItem(idx, 'unitCost', Number(e.target.value))} className="w-full bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2 py-1.5 text-xs text-[#021541] focus:outline-none focus:border-[#00BCE4]" />
                    </div>
                    <div>
                      <p className={`${labelCls} mb-1`}>Preço (R$)</p>
                      <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))} className="w-full bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2 py-1.5 text-xs text-[#021541] focus:outline-none focus:border-[#00BCE4]" />
                    </div>
                    <div>
                      <p className={`${labelCls} mb-1`}>Total</p>
                      <p className="text-xs font-bold text-[#00BCE4] py-1.5">{BRL(item.total)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-[#f5f6f8] rounded-xl p-4 space-y-2 border border-[rgba(2,21,65,0.06)]">
            <div className="flex justify-between text-sm">
              <span className="text-[#718096]">Subtotal</span>
              <span className="text-[#021541]">{BRL(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#718096]">Desconto (R$)</span>
              <input
                type="number" min="0" step="0.01"
                value={form.discount}
                onChange={e => setF('discount', Number(e.target.value))}
                className="w-24 bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2 py-1 text-xs text-right text-[#021541] focus:outline-none focus:border-[#00BCE4]"
              />
            </div>
            <div className="border-t border-[rgba(2,21,65,0.08)] pt-2 flex justify-between text-sm font-bold">
              <span className="text-[#021541]">Total de Venda</span>
              <span className="text-[#00BCE4]">{BRL(totalSale)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#718096]">Margem (lucro estimado)</span>
              <span className={margin >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}>{BRL(margin)}</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className={labelCls}>Observações</label>
            <textarea value={form.notes} onChange={e => setF('notes', e.target.value)} rows={3} placeholder="Orientações pós-procedimento, condições especiais..." className={`${drawerInputCls} resize-none`} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(2,21,65,0.06)] shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-[#718096] bg-[#f5f6f8] hover:bg-[rgba(2,21,65,0.06)] border border-[rgba(2,21,65,0.08)] transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-[#021541] text-white hover:bg-[#032170] disabled:opacity-50 transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>vaccines</span>
            {saving ? 'Criando...' : 'Criar Tratamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── DrawerEditTreatment ──────────────────────────────────
function DrawerEditTreatment({
  treatmentId,
  onClose,
  onUpdated,
}: {
  treatmentId: string | null
  onClose: () => void
  onUpdated: () => void
}) {
  const open = !!treatmentId
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [saving, setSaving] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelSection, setShowCancelSection] = useState(false)
  const [loadedTreatment, setLoadedTreatment] = useState<Treatment | null>(null)

  const [form, setForm] = useState({
    name: '',
    category: 'consultation_fee',
    paymentMethodId: '',
    discount: 0,
    installments: 1,
    notes: '',
  })
  const [items, setItems] = useState<TreatmentItem[]>([])
  const [cancelReason, setCancelReason] = useState('')

  useEffect(() => {
    if (!open || !treatmentId) return
    setShowCancelSection(false)
    setCancelReason('')
    Promise.all([
      fetch(`/api/tratamentos/${treatmentId}`).then(r => r.json()),
      fetch('/api/configuracoes/pagamentos').then(r => r.json()),
      fetch('/api/materiais').then(r => r.json()),
    ]).then(([tRes, pmRes, mRes]) => {
      if (pmRes.data) setPaymentMethods(pmRes.data.filter((p: PaymentMethod & { isActive?: boolean }) => p.isActive !== false))
      if (mRes.data) setMaterials(mRes.data)
      if (tRes.data) {
        const t: Treatment = tRes.data
        setLoadedTreatment(t)
        setForm({
          name: t.name,
          category: t.category ?? 'consultation_fee',
          paymentMethodId: t.paymentMethod?.id ?? '',
          discount: Number(t.discount),
          installments: t.installments,
          notes: t.notes ?? '',
        })
        setItems(t.items.map((it, i) => ({
          ...it,
          quantity: Number(it.quantity),
          unitCost: Number(it.unitCost),
          unitPrice: Number(it.unitPrice),
          total: Number(it.quantity) * Number(it.unitPrice),
          sortOrder: it.sortOrder ?? i,
        })))
      }
    }).catch(() => {})
  }, [open, treatmentId])

  function setF(key: string, value: unknown) { setForm(p => ({ ...p, [key]: value })) }

  function addItem() {
    setItems(p => [...p, { type: 'procedure', description: '', quantity: 1, unitCost: 0, unitPrice: 0, total: 0, sortOrder: p.length }])
  }

  function updateItem(idx: number, key: string, value: unknown) {
    setItems(p => {
      const next = [...p]
      next[idx] = { ...next[idx], [key]: value }
      if (['quantity', 'unitPrice'].includes(key)) {
        next[idx].total = Number(next[idx].quantity) * Number(next[idx].unitPrice)
      }
      if (key === 'materialId') {
        const mat = materials.find(m => m.id === value)
        if (mat) {
          next[idx].description = mat.name
          next[idx].unitCost = Number(mat.unitCost ?? 0)
        }
      }
      return next
    })
  }

  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const totalSale = Math.max(0, subtotal - form.discount)
  const margin = totalSale - items.reduce((s, i) => s + i.quantity * i.unitCost, 0)
  const isLocked = loadedTreatment?.status === 'completed' || loadedTreatment?.status === 'cancelled'

  async function save() {
    if (!form.name) { toast.error('Informe o nome'); return }
    if (items.some(i => !i.description)) { toast.error('Preencha a descrição de todos os itens'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/tratamentos/${treatmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          paymentMethodId: form.paymentMethodId || null,
          discount: form.discount,
          installments: form.installments,
          notes: form.notes || null,
          items: items.map((it, i) => ({
            type: it.type,
            materialId: it.materialId ?? null,
            description: it.description,
            quantity: Number(it.quantity),
            unitCost: Number(it.unitCost),
            unitPrice: Number(it.unitPrice),
            sortOrder: i,
          })),
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Tratamento atualizado!')
      onUpdated()
      onClose()
    } catch { toast.error('Erro ao salvar') } finally { setSaving(false) }
  }

  async function confirmCancel() {
    if (!cancelReason.trim()) { toast.error('Informe o motivo do cancelamento'); return }
    setCancelling(true)
    try {
      const res = await fetch(`/api/tratamentos/${treatmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', cancelReason: cancelReason.trim() }),
      })
      if (!res.ok) throw new Error()
      toast.success('Tratamento cancelado')
      onUpdated()
      onClose()
    } catch { toast.error('Erro ao cancelar') } finally { setCancelling(false) }
  }

  if (!open) return null

  const cls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/60 focus:outline-none focus:border-[#00BCE4] focus:ring-2 focus:ring-[rgba(0,188,228,0.15)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-[620px] bg-white h-full flex flex-col shadow-2xl overflow-hidden border-l border-[rgba(2,21,65,0.08)]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(2,21,65,0.06)] shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#021541]">{loadedTreatment?.name || 'Editar Tratamento'}</h2>
            <div className="flex items-center gap-2 mt-1">
              {loadedTreatment && <StatusBadge status={loadedTreatment.status} />}
              {loadedTreatment?.patient && (
                <span className="text-xs text-[#718096]">· {loadedTreatment.patient.name}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#718096] hover:bg-[#f5f6f8] hover:text-[#021541] transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Campos principais */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <label className={labelCls}>Nome do Tratamento *</label>
              <input value={form.name} onChange={e => setF('name', e.target.value)} disabled={isLocked} className={cls} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className={labelCls}>Categoria</label>
              <select value={form.category} onChange={e => setF('category', e.target.value)} disabled={isLocked} className={cls}>
                {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Forma de Pagamento</label>
              <select value={form.paymentMethodId} onChange={e => setF('paymentMethodId', e.target.value)} disabled={isLocked} className={cls}>
                <option value="">Selecione...</option>
                {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Parcelas</label>
              <input type="number" min="1" max="24" value={form.installments} onChange={e => setF('installments', Number(e.target.value))} disabled={isLocked} className={cls} />
            </div>
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">Itens do Tratamento</p>
              {!isLocked && (
                <button onClick={addItem} className="flex items-center gap-1 text-xs text-[#00BCE4] hover:text-[#00BCE4]/80 font-medium">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>Adicionar item
                </button>
              )}
            </div>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="bg-[#f5f6f8] rounded-xl p-3 space-y-2 border border-[rgba(2,21,65,0.06)]">
                  <div className="flex items-center gap-2">
                    <select value={item.type} onChange={e => updateItem(idx, 'type', e.target.value)} disabled={isLocked} className="bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-[#021541] focus:outline-none focus:border-[#00BCE4] disabled:opacity-50">
                      {Object.entries(ITEM_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    {item.type === 'material' && (
                      <select value={item.materialId ?? ''} onChange={e => updateItem(idx, 'materialId', e.target.value || null)} disabled={isLocked} className="flex-1 bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-[#021541] focus:outline-none focus:border-[#00BCE4] disabled:opacity-50">
                        <option value="">Selecione do estoque...</option>
                        {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                      </select>
                    )}
                    {!isLocked && (
                      <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))} className="w-6 h-6 flex items-center justify-center text-[#718096]/50 hover:text-[#DC2626] ml-auto shrink-0 transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                      </button>
                    )}
                  </div>
                  <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} disabled={isLocked} placeholder="Descrição..." className="w-full bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-[#021541] placeholder:text-[#718096]/50 focus:outline-none focus:border-[#00BCE4] disabled:opacity-50" />
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <p className={`${labelCls} mb-1`}>Qtd</p>
                      <input type="number" min="0.001" step="0.001" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} disabled={isLocked} className="w-full bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2 py-1.5 text-xs text-[#021541] focus:outline-none focus:border-[#00BCE4] disabled:opacity-50" />
                    </div>
                    <div>
                      <p className={`${labelCls} mb-1`}>Custo (R$)</p>
                      <input type="number" min="0" step="0.01" value={item.unitCost} onChange={e => updateItem(idx, 'unitCost', Number(e.target.value))} disabled={isLocked} className="w-full bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2 py-1.5 text-xs text-[#021541] focus:outline-none focus:border-[#00BCE4] disabled:opacity-50" />
                    </div>
                    <div>
                      <p className={`${labelCls} mb-1`}>Preço (R$)</p>
                      <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))} disabled={isLocked} className="w-full bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2 py-1.5 text-xs text-[#021541] focus:outline-none focus:border-[#00BCE4] disabled:opacity-50" />
                    </div>
                    <div>
                      <p className={`${labelCls} mb-1`}>Total</p>
                      <p className="text-xs font-bold text-[#00BCE4] py-1.5">{BRL(item.total)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resumo financeiro */}
          <div className="bg-[#f5f6f8] rounded-xl p-4 space-y-2 border border-[rgba(2,21,65,0.06)]">
            <div className="flex justify-between text-sm">
              <span className="text-[#718096]">Subtotal</span>
              <span className="text-[#021541]">{BRL(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#718096]">Desconto (R$)</span>
              <input type="number" min="0" step="0.01" value={form.discount} onChange={e => setF('discount', Number(e.target.value))} disabled={isLocked} className="w-24 bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2 py-1 text-xs text-right text-[#021541] focus:outline-none focus:border-[#00BCE4] disabled:opacity-50" />
            </div>
            <div className="border-t border-[rgba(2,21,65,0.08)] pt-2 flex justify-between text-sm font-bold">
              <span className="text-[#021541]">Total de Venda</span>
              <span className="text-[#00BCE4]">{BRL(totalSale)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#718096]">Margem estimada</span>
              <span className={margin >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}>{BRL(margin)}</span>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <label className={labelCls}>Observações</label>
            <textarea value={form.notes} onChange={e => setF('notes', e.target.value)} disabled={isLocked} rows={3} placeholder="Orientações pós-procedimento, condições especiais..." className={`${cls} resize-none`} />
          </div>

          {/* Cancelar tratamento */}
          {loadedTreatment?.status !== 'cancelled' && loadedTreatment?.status !== 'completed' && (
            <div className="border border-[rgba(239,68,68,0.2)] rounded-xl overflow-hidden">
              <button
                onClick={() => setShowCancelSection(s => !s)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[#DC2626] hover:bg-[rgba(239,68,68,0.04)] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>cancel</span>
                  Cancelar este tratamento
                </span>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', transform: showCancelSection ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  expand_more
                </span>
              </button>
              {showCancelSection && (
                <div className="px-4 pb-4 space-y-3 bg-[rgba(239,68,68,0.02)]">
                  <div className="space-y-1.5">
                    <label className={labelCls}>Motivo do cancelamento *</label>
                    <textarea
                      value={cancelReason}
                      onChange={e => setCancelReason(e.target.value)}
                      rows={3}
                      placeholder="Descreva o motivo do cancelamento..."
                      className="w-full bg-white border border-[rgba(239,68,68,0.3)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/60 focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[rgba(239,68,68,0.15)] resize-none transition-colors"
                    />
                  </div>
                  <button
                    onClick={confirmCancel}
                    disabled={cancelling || !cancelReason.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold bg-[#DC2626] text-white hover:bg-[#b91c1c] disabled:opacity-40 transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>cancel</span>
                    {cancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Motivo exibido se já cancelado */}
          {loadedTreatment?.status === 'cancelled' && loadedTreatment.cancelReason && (
            <div className="bg-[rgba(239,68,68,0.05)] border border-[rgba(239,68,68,0.15)] rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-[#DC2626] uppercase tracking-wider mb-1">Motivo do cancelamento</p>
              <p className="text-sm text-[#718096]">{loadedTreatment.cancelReason}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(2,21,65,0.06)] shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-[#718096] bg-[#f5f6f8] hover:bg-[rgba(2,21,65,0.06)] border border-[rgba(2,21,65,0.08)] transition-colors">
            Fechar
          </button>
          {!isLocked && (
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-[#021541] text-white hover:bg-[#032170] disabled:opacity-50 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── DrawerTemplate (catálogo) ────────────────────────────
function DrawerTemplate({
  open, editing, onClose, onSaved,
}: {
  open: boolean
  editing: Template | null
  onClose: () => void
  onSaved: () => void
}) {
  const [materials, setMaterials] = useState<Material[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'consultation_fee', description: '', notes: '' })
  const [items, setItems] = useState<TreatmentItem[]>([
    { type: 'procedure', description: '', quantity: 1, unitCost: 0, unitPrice: 0, total: 0, sortOrder: 0 },
  ])

  useEffect(() => {
    if (!open) return
    fetch('/api/materiais').then(r => r.json()).then(m => { if (m.data) setMaterials(m.data) }).catch(() => {})
    if (editing) {
      setForm({ name: editing.name, category: editing.category, description: editing.description ?? '', notes: editing.notes ?? '' })
      setItems(editing.items.map((it, i) => ({
        type: it.type, materialId: it.materialId, description: it.description,
        quantity: Number(it.quantity), unitCost: 0, unitPrice: Number(it.unitPrice),
        total: Number(it.quantity) * Number(it.unitPrice), sortOrder: it.sortOrder ?? i,
      })))
    } else {
      setForm({ name: '', category: 'consultation_fee', description: '', notes: '' })
      setItems([{ type: 'procedure', description: '', quantity: 1, unitCost: 0, unitPrice: 0, total: 0, sortOrder: 0 }])
    }
  }, [open, editing])

  function updateItem(idx: number, key: string, value: unknown) {
    setItems(p => {
      const next = [...p]
      next[idx] = { ...next[idx], [key]: value }
      const item = next[idx]
      if (['quantity', 'unitPrice'].includes(key)) next[idx].total = Number(item.quantity) * Number(item.unitPrice)
      if (key === 'materialId') {
        const mat = materials.find(m => m.id === value)
        if (mat) next[idx].description = mat.name
      }
      return next
    })
  }

  const price = items.reduce((s, i) => s + i.total, 0)

  async function save() {
    if (!form.name) { toast.error('Informe o nome do modelo'); return }
    if (items.some(i => !i.description)) { toast.error('Preencha a descrição de todos os itens'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name, category: form.category, description: form.description, notes: form.notes,
        items: items.map((it, i) => ({
          type: it.type, materialId: it.materialId ?? null, description: it.description,
          quantity: Number(it.quantity), unitPrice: Number(it.unitPrice), sortOrder: i,
        })),
      }
      const res = await fetch(editing ? `/api/tratamentos/templates/${editing.id}` : '/api/tratamentos/templates', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      toast.success(editing ? 'Modelo atualizado!' : 'Modelo criado!')
      onSaved(); onClose()
    } catch { toast.error('Erro ao salvar modelo') } finally { setSaving(false) }
  }

  if (!open) return null
  const cls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/60 focus:outline-none focus:border-[#00BCE4] focus:ring-2 focus:ring-[rgba(0,188,228,0.15)] transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-[600px] bg-white h-full flex flex-col shadow-2xl overflow-hidden border-l border-[rgba(2,21,65,0.08)]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(2,21,65,0.06)] shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#021541]">{editing ? 'Editar Modelo' : 'Novo Modelo de Tratamento'}</h2>
            <p className="text-xs text-[#718096] mt-0.5">Cadastre o tratamento e o que ele consome do estoque</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#718096] hover:bg-[#f5f6f8] hover:text-[#021541] transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <label className={labelCls}>Nome do Modelo *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: PRP Joelho Bilateral" className={cls} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className={labelCls}>Categoria (centro de custo)</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={cls}>
                {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className={labelCls}>Descrição</label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Resumo do protocolo" className={cls} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">Itens (procedimentos, materiais, honorários)</p>
              <button onClick={() => setItems(p => [...p, { type: 'procedure', description: '', quantity: 1, unitCost: 0, unitPrice: 0, total: 0, sortOrder: p.length }])} className="flex items-center gap-1 text-xs text-[#00BCE4] hover:text-[#00BCE4]/80 font-medium">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span> Adicionar item
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="bg-[#f5f6f8] rounded-xl p-3 space-y-2 border border-[rgba(2,21,65,0.06)]">
                  <div className="flex items-center gap-2">
                    <select value={item.type} onChange={e => updateItem(idx, 'type', e.target.value)} className="bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-[#021541] focus:outline-none focus:border-[#00BCE4]">
                      {Object.entries(ITEM_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    {item.type === 'material' && (
                      <select value={item.materialId ?? ''} onChange={e => updateItem(idx, 'materialId', e.target.value || null)} className="flex-1 bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-[#021541] focus:outline-none focus:border-[#00BCE4]">
                        <option value="">Selecione do estoque...</option>
                        {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                      </select>
                    )}
                    <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))} className="w-6 h-6 flex items-center justify-center text-[#718096]/50 hover:text-[#DC2626] ml-auto shrink-0 transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                    </button>
                  </div>
                  <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Descrição do item..." className="w-full bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-[#021541] placeholder:text-[#718096]/50 focus:outline-none focus:border-[#00BCE4]" />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className={`${labelCls} mb-1`}>Qtd</p>
                      <input type="number" min="0.001" step="0.001" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} className="w-full bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2 py-1.5 text-xs text-[#021541] focus:outline-none focus:border-[#00BCE4]" />
                    </div>
                    <div>
                      <p className={`${labelCls} mb-1`}>Preço (R$)</p>
                      <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))} className="w-full bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2 py-1.5 text-xs text-[#021541] focus:outline-none focus:border-[#00BCE4]" />
                    </div>
                    <div>
                      <p className={`${labelCls} mb-1`}>Total</p>
                      <p className="text-xs font-bold text-[#00BCE4] py-1.5">{BRL(item.total)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#f5f6f8] rounded-xl p-4 flex justify-between text-sm font-bold border border-[rgba(2,21,65,0.06)]">
            <span className="text-[#021541]">Preço padrão do modelo</span>
            <span className="text-[#00BCE4]">{BRL(price)}</span>
          </div>
          <p className="text-[11px] text-[#718096]">O custo de materiais é calculado automaticamente pelo custo atual do estoque ao salvar.</p>

          <div className="space-y-1.5">
            <label className={labelCls}>Observações padrão</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Orientações pós-procedimento padrão..." className={`${cls} resize-none`} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(2,21,65,0.06)] shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-[#718096] bg-[#f5f6f8] hover:bg-[rgba(2,21,65,0.06)] border border-[rgba(2,21,65,0.08)] transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-[#021541] text-white hover:bg-[#032170] disabled:opacity-50 transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
            {saving ? 'Salvando...' : editing ? 'Salvar Modelo' : 'Criar Modelo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CatalogoPanel ────────────────────────────────────────
function CatalogoPanel() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/tratamentos/templates?all=true').then(r => r.json())
      .then(({ data }) => { if (data) setTemplates(data) })
      .catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  async function remove(id: string) {
    if (!confirm('Inativar este modelo? Tratamentos já criados não são afetados.')) return
    const res = await fetch(`/api/tratamentos/templates/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Modelo inativado'); load() } else toast.error('Erro ao inativar')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#021541]">Catálogo de Tratamentos</h1>
          <p className="text-sm text-[#718096] mt-0.5">Modelos reutilizáveis com materiais e valores — base do centro de custo</p>
        </div>
        <button onClick={() => { setEditing(null); setDrawerOpen(true) }} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#021541] text-white text-sm font-bold hover:bg-[#032170] transition-colors shrink-0">
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span> Novo Modelo
        </button>
      </div>

      <div className="bg-white rounded-xl overflow-hidden border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)]">
        {loading ? (
          <p className="text-center py-10 text-sm text-[#718096]">Carregando...</p>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 bg-[#f5f6f8] rounded-xl">
            <span className="material-symbols-outlined text-[#718096]/30" style={{ fontSize: '48px' }}>menu_book</span>
            <p className="text-sm text-[#718096] mt-3">Nenhum modelo cadastrado</p>
            <button onClick={() => { setEditing(null); setDrawerOpen(true) }} className="mt-4 text-xs text-[#00BCE4] hover:underline font-medium">Cadastrar o primeiro modelo</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(2,21,65,0.06)]">
                  {['Modelo', 'Categoria', 'Itens', 'Custo estimado', 'Preço padrão', 'Margem', 'Status', ''].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold text-[#718096] uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(2,21,65,0.04)]">
                {templates.map(t => {
                  const margin = Number(t.defaultPrice) - Number(t.estimatedCost)
                  const cat = CATEGORY_OPTIONS.find(c => c.value === t.category)?.label ?? t.category
                  return (
                    <tr key={t.id} className={`hover:bg-[#f5f6f8] transition-colors ${!t.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3"><p className="text-sm font-medium text-[#021541]">{t.name}</p>{t.description && <p className="text-xs text-[#718096] mt-0.5">{t.description}</p>}</td>
                      <td className="px-4 py-3 text-sm text-[#718096] whitespace-nowrap">{cat}</td>
                      <td className="px-4 py-3 text-sm text-[#718096] whitespace-nowrap">{t.items.length}</td>
                      <td className="px-4 py-3 text-sm text-[#718096] whitespace-nowrap">{BRL(t.estimatedCost)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-[#021541] whitespace-nowrap">{BRL(t.defaultPrice)}</td>
                      <td className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${margin >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>{BRL(margin)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold" style={t.isActive ? { color: '#059669', background: 'rgba(5,150,105,0.1)' } : { color: '#718096', background: 'rgba(113,128,150,0.1)' }}>
                          {t.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => { setEditing(t); setDrawerOpen(true) }} title="Editar" className="w-7 h-7 rounded-lg flex items-center justify-center text-[#00BCE4] hover:bg-[rgba(0,188,228,0.1)] transition-colors">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                          </button>
                          {t.isActive && (
                            <button onClick={() => remove(t.id)} title="Inativar" className="w-7 h-7 rounded-lg flex items-center justify-center text-[#718096]/50 hover:text-[#DC2626] hover:bg-[rgba(239,68,68,0.1)] transition-colors">
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>block</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DrawerTemplate open={drawerOpen} editing={editing} onClose={() => setDrawerOpen(false)} onSaved={load} />
    </div>
  )
}

// ── Dialog de Conclusão e Faturamento do Tratamento ───────────
interface ConcluirTratamentoDialogProps {
  open: boolean
  treatment: Treatment | null
  onClose: () => void
  onCompleted: () => void
}

function ConcluirTratamentoDialog({ open, treatment, onClose, onCompleted }: ConcluirTratamentoDialogProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [bankAccounts, setBankAccounts] = useState<{ id: string; name: string; bank: string | null; isDefault: boolean }[]>([])
  const [bankAccountId, setBankAccountId] = useState('')
  const [installments, setInstallments] = useState(1)
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'first_paid' | 'all_paid'>('pending')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !treatment) return
    fetch('/api/configuracoes/pagamentos')
      .then(r => r.json())
      .then(({ data }) => {
        if (data) {
          setPaymentMethods(data.filter((p: PaymentMethod & { isActive?: boolean }) => p.isActive !== false))
        }
      })
      .catch(() => {})

    fetch('/api/configuracoes/contas')
      .then(r => r.json())
      .then(({ data }) => {
        if (data) {
          setBankAccounts(data)
          const def = data.find((a: { isDefault: boolean }) => a.isDefault) ?? data[0]
          setBankAccountId(def?.id ?? '')
        }
      })
      .catch(() => {})

    setPaymentMethodId(treatment.paymentMethod?.id || '')
    setInstallments(treatment.installments || 1)
    setPaymentStatus('pending')
  }, [open, treatment])

  async function handleConfirm() {
    if (!treatment) return
    if (!paymentMethodId) {
      toast.error('Selecione uma forma de pagamento')
      return
    }
    // Quando há parcela a receber agora, a conta de destino é obrigatória
    if (paymentStatus !== 'pending' && !bankAccountId) {
      toast.error('Selecione a conta de recebimento')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/tratamentos/${treatment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          paymentMethodId,
          bankAccountId: paymentStatus !== 'pending' ? bankAccountId || null : null,
          installments,
          paymentStatus
        })
      })
      if (!res.ok) throw new Error()
      toast.success('Tratamento concluído e faturamento lançado com sucesso!')
      onCompleted()
      onClose()
    } catch {
      toast.error('Erro ao concluir tratamento')
    } finally {
      setLoading(false)
    }
  }

  if (!open || !treatment) return null

  const totalSale = Number(treatment.totalSale)
  const totalCents = Math.round(totalSale * 100)
  const baseCents = Math.floor(totalCents / installments)
  const today = new Date()

  const previewInstallments = Array.from({ length: installments }, (_, i) => {
    const cents = i === installments - 1 ? totalCents - baseCents * (installments - 1) : baseCents
    const amount = cents / 100
    const due = new Date(today.getFullYear(), today.getMonth() + i, today.getDate())
    const isPaid = paymentStatus === 'all_paid' || (paymentStatus === 'first_paid' && i === 0)
    return {
      num: i + 1,
      amount,
      dueDate: due.toLocaleDateString('pt-BR'),
      isPaid,
    }
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-[rgba(2,21,65,0.08)] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[rgba(2,21,65,0.06)] flex items-center justify-between bg-[#f8fafc]">
          <div>
            <h3 className="text-sm font-bold text-[#021541]">Concluir e Faturar Tratamento</h3>
            <p className="text-[11px] text-[#718096] mt-0.5">Defina a forma de pagamento e parcelamento para faturamento</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#718096] hover:bg-[#e2e8f0] transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <div className="bg-[#021541]/5 p-3.5 rounded-xl space-y-1.5 border border-[#021541]/10">
            <p className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">Tratamento</p>
            <p className="font-bold text-[#021541] text-sm">{treatment.name}</p>
            <div className="flex justify-between items-center pt-1 border-t border-[rgba(2,21,65,0.06)]">
              <span className="text-[#718096]">Paciente: <strong>{treatment.patient?.name}</strong></span>
              <span className="font-bold text-[#00BCE4] text-sm">{BRL(treatment.totalSale)}</span>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Forma de Pagamento *</label>
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

            {paymentStatus !== 'pending' && (
              <div className="space-y-1.5">
                <label className={labelCls}>Conta de Recebimento *</label>
                <select
                  value={bankAccountId}
                  onChange={e => setBankAccountId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Selecione...</option>
                  {bankAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}{acc.bank ? ` · ${acc.bank}` : ''}{acc.isDefault ? ' (padrão)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[#718096] leading-snug">
                  O valor das parcelas pagas será creditado nesta conta.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls}>Parcelas</label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={installments}
                  onChange={e => setInstallments(Math.max(1, Number(e.target.value)))}
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Status do Pagamento</label>
                <select
                  value={paymentStatus}
                  onChange={e => setPaymentStatus(e.target.value as any)}
                  className={inputCls}
                >
                  <option value="pending">Todas Pendentes</option>
                  <option value="first_paid">1ª Paga (restante pendente)</option>
                  <option value="all_paid">Todas Pagas (À Vista)</option>
                </select>
              </div>
            </div>

            {/* Preview de Parcelas */}
            <div className="space-y-1.5 border-t border-[rgba(2,21,65,0.06)] pt-3">
              <p className={labelCls}>Pré-visualização das Parcelas (Contabilização)</p>
              <div className="bg-[#f5f6f8] rounded-xl p-3 space-y-2 max-h-[140px] overflow-y-auto border border-[rgba(2,21,65,0.04)]">
                {previewInstallments.map(inst => (
                  <div key={inst.num} className="flex items-center justify-between py-1 border-b border-[rgba(2,21,65,0.04)] last:border-0 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#021541]">#{inst.num}</span>
                      <span className="text-[#718096]">Vencimento: <strong className="text-[#021541] font-medium">{inst.dueDate}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#021541]">{BRL(inst.amount)}</span>
                      {inst.isPaid ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-bold text-[9px] uppercase tracking-wider">Pago</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-bold text-[9px] uppercase tracking-wider">Pendente</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200/60 p-3 rounded-xl text-[11px] text-amber-800 leading-relaxed flex gap-2">
            <span className="material-symbols-outlined text-amber-600 shrink-0" style={{ fontSize: '16px' }}>info</span>
            <div>
              <p className="font-bold">Atenção:</p>
              <p className="mt-0.5">Ao faturar, os lançamentos financeiros correspondentes serão gerados no contas a receber do paciente, e os insumos do estoque vinculados a este procedimento serão baixados automaticamente.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[rgba(2,21,65,0.06)] flex items-center justify-end gap-2 bg-[#f8fafc]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-[#718096] hover:bg-[#e2e8f0] transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#059669] text-white hover:bg-[#047857] transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>payments</span>
            {loading ? 'Processando...' : 'Concluir e Faturar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────
const MASK = '•••••'

export default function TratamentosPage() {
  const [tab, setTab] = useState<'tratamentos' | 'catalogo'>('tratamentos')
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [completingTreatment, setCompletingTreatment] = useState<Treatment | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [hideValues, setHideValues] = useState(false)
  const [editingTreatmentId, setEditingTreatmentId] = useState<string | null>(null)

  useEffect(() => {
    setHideValues(localStorage.getItem('tratamentos_privacy') === 'on')
  }, [])

  function toggleHideValues() {
    const next = !hideValues
    setHideValues(next)
    localStorage.setItem('tratamentos_privacy', next ? 'on' : 'off')
  }

  async function handleDropTreatment(e: React.DragEvent, targetStatus: string) {
    e.preventDefault()
    const id = e.dataTransfer.getData('treatment-id')
    if (!id) return
    const treatment = treatments.find(t => t.id === id)
    if (!treatment) return

    if (treatment.status === targetStatus) return

    if (targetStatus === 'completed') {
      setCompletingTreatment(treatment)
    } else {
      await updateStatus(treatment.id, targetStatus)
    }
  }

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/tratamentos${statusFilter ? `?status=${statusFilter}` : ''}`)
      .then(r => r.json())
      .then(({ data }) => { if (data) setTreatments(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/tratamentos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      toast.success(status === 'completed' ? 'Tratamento concluído!' : 'Status atualizado')
      load()
    } else {
      toast.error('Erro ao atualizar')
    }
  }

  const filtered = treatments.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.patient?.name.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total: treatments.length,
    active: treatments.filter(t => t.status === 'in_progress').length,
    completed: treatments.filter(t => t.status === 'completed').length,
    revenue: treatments.filter(t => t.status === 'completed').reduce((s, t) => s + Number(t.totalSale), 0),
  }

  const kpiCards = [
    { label: 'Total', value: stats.total, icon: 'vaccines', iconBg: 'bg-[rgba(2,21,65,0.06)]', iconColor: '#021541' },
    { label: 'Em andamento', value: stats.active, icon: 'autorenew', iconBg: 'bg-[rgba(0,188,228,0.1)]', iconColor: '#00BCE4' },
    { label: 'Concluídos', value: stats.completed, icon: 'check_circle', iconBg: 'bg-[rgba(5,150,105,0.1)]', iconColor: '#059669' },
    { label: 'Receita total', value: hideValues ? MASK : BRL(stats.revenue), icon: 'payments', iconBg: 'bg-[rgba(5,150,105,0.08)]', iconColor: '#059669' },
  ]

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 bg-[#f5f6f8] p-1 rounded-xl w-fit border border-[rgba(2,21,65,0.06)]">
        {([['tratamentos', 'Tratamentos', 'vaccines'], ['catalogo', 'Catálogo', 'menu_book']] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${tab === id ? 'bg-white text-[#021541] shadow-[0_1px_4px_rgba(2,21,65,0.08)]' : 'text-[#718096] hover:text-[#021541]'}`}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{icon}</span>{label}
          </button>
        ))}
      </div>

      {tab === 'catalogo' ? <CatalogoPanel /> : <>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#021541]">Tratamentos</h1>
          <p className="text-sm text-[#718096] mt-0.5">Planos de tratamento, materiais e controle financeiro</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleHideValues}
            title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-full border border-[rgba(2,21,65,0.12)] text-sm font-medium text-[#718096] hover:text-[#021541] hover:bg-[rgba(2,21,65,0.04)] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {hideValues ? 'visibility_off' : 'visibility'}
            </span>
          </button>
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#021541] text-white text-sm font-bold hover:bg-[#032170] transition-colors shrink-0"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Novo Tratamento
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiCards.map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl p-4 flex items-center gap-3 border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)]">
            <div className={`w-10 h-10 rounded-lg ${kpi.iconBg} flex items-center justify-center shrink-0`}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: kpi.iconColor }}>{kpi.icon}</span>
            </div>
            <div>
              <p className="text-xs text-[#718096]">{kpi.label}</p>
              <p className="text-lg font-bold text-[#021541]">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#718096]/50" style={{ fontSize: '16px' }}>search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tratamento ou paciente..."
            className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/60 focus:outline-none focus:border-[#00BCE4] focus:ring-2 focus:ring-[rgba(0,188,228,0.15)]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] focus:outline-none focus:border-[#00BCE4] focus:ring-2 focus:ring-[rgba(0,188,228,0.15)]"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <p className="text-center py-10 text-sm text-[#718096]">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-[#f5f6f8] rounded-xl border border-[rgba(2,21,65,0.06)]">
          <span className="material-symbols-outlined text-[#718096]/30" style={{ fontSize: '48px' }}>vaccines</span>
          <p className="text-sm text-[#718096] mt-3">Nenhum tratamento encontrado</p>
          <button onClick={() => setDrawerOpen(true)} className="mt-4 text-xs text-[#00BCE4] hover:underline font-medium">Criar o primeiro tratamento</button>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 select-none min-h-[500px]">
          {(['draft', 'approved', 'in_progress', 'completed', 'cancelled'] as const).map(status => {
            const cfg = STATUS_CONFIG[status]
            const colTreats = filtered.filter(t => t.status === status)
            const isOver = dragOverColumn === status

            return (
              <div
                key={status}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverColumn(status)
                }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={async (e) => {
                  setDragOverColumn(null)
                  await handleDropTreatment(e, status)
                }}
                className={cn(
                  'flex-1 min-w-[250px] max-w-[320px] rounded-2xl p-3 flex flex-col transition-all border',
                  isOver 
                    ? 'bg-slate-100 border-[#00BCE4] shadow-md ring-2 ring-[#00BCE4]/20' 
                    : 'bg-[#f8fafc] border-[rgba(2,21,65,0.05)] shadow-sm'
                )}
              >
                {/* Col Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: cfg.color }}>{cfg.icon}</span>
                    <h3 className="text-xs font-bold text-[#021541] tracking-wide">{cfg.label}</h3>
                  </div>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-[#e2e8f0] text-[#718096]">
                    {colTreats.length}
                  </span>
                </div>

                {/* Col Body (Cards) */}
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[60vh] min-h-[350px] pr-1">
                  {colTreats.map(t => {
                    const margin = Number(t.totalSale) - Number(t.totalCost)
                    const canDrag = t.status !== 'completed' && t.status !== 'cancelled'
                    return (
                      <div
                        key={t.id}
                        draggable={canDrag}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('treatment-id', t.id)
                          e.stopPropagation()
                        }}
                        onClick={() => setEditingTreatmentId(t.id)}
                        className={cn(
                          'bg-white p-3 rounded-xl border border-[rgba(2,21,65,0.06)] shadow-sm hover:shadow-md hover:border-[#00BCE4]/40 transition-all group relative text-xs cursor-pointer',
                          !canDrag && 'opacity-85'
                        )}
                      >
                        <p className="font-bold text-[#021541] line-clamp-2 leading-snug">{t.name}</p>
                        
                        <div className="flex items-center gap-1.5 mt-2">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#021541]/10 to-[#021541]/20 flex items-center justify-center text-[#021541] text-[9px] font-bold shrink-0">
                            {t.patient?.name ? t.patient.name.charAt(0) : 'P'}
                          </div>
                          <p className="text-[10px] font-medium text-[#718096] truncate flex-1">{t.patient?.name ?? '—'}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 mt-3 pt-2.5 border-t border-[rgba(2,21,65,0.04)]">
                          <div>
                            <p className="text-[8px] text-[#718096] uppercase tracking-wider">Venda</p>
                            <p className="text-xs font-bold text-[#021541] font-technical">
                              {hideValues ? MASK : BRL(t.totalSale)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] text-[#718096] uppercase tracking-wider">Margem</p>
                            <p className={cn(
                              'text-xs font-bold font-technical',
                              margin >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'
                            )}>
                              {hideValues ? MASK : BRL(margin)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2 text-[9px] text-[#718096] font-medium">
                          <span>{new Date(t.createdAt).toLocaleDateString('pt-BR')}</span>
                          <span className="bg-[#f1f5f9] text-[#718096] px-1 py-0.5 rounded font-mono">
                            {t.items.length} {t.items.length === 1 ? 'item' : 'itens'}
                          </span>
                        </div>
                        
                        {/* Action hover buttons */}
                        {canDrag && (
                          <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 bg-white pl-1.5 rounded-bl">
                            <button
                              onClick={() => updateStatus(t.id, 'cancelled')}
                              title="Cancelar"
                              className="w-5 h-5 rounded hover:bg-rose-50 text-[#718096] hover:text-[#DC2626] flex items-center justify-center transition-all cursor-pointer border-0 bg-transparent"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>cancel</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {colTreats.length === 0 && (
                    <div className="h-24 rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-[10px] text-[#718096]/50 italic">
                      Arraste um item aqui
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <DrawerCreateTreatment
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={t => setTreatments(p => [t, ...p])}
      />

      <DrawerEditTreatment
        treatmentId={editingTreatmentId}
        onClose={() => setEditingTreatmentId(null)}
        onUpdated={load}
      />

      <ConcluirTratamentoDialog
        open={completingTreatment !== null}
        treatment={completingTreatment}
        onClose={() => setCompletingTreatment(null)}
        onCompleted={load}
      />
      </>}
    </div>
  )
}
