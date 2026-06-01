'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

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
  status: string
  subtotal: string
  discount: string
  totalSale: string
  totalCost: string
  installments: number
  notes: string | null
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
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    patientId: '',
    paymentMethodId: '',
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
    ]).then(([pRes, pmRes, mRes]) => {
      if (pRes.data) setPatients(pRes.data)
      if (pmRes.data) setPaymentMethods(pmRes.data.filter((p: PaymentMethod & { isActive?: boolean }) => p.isActive !== false))
      if (mRes.data) setMaterials(mRes.data)
    }).catch(() => {})
  }, [open])

  function setF(key: string, value: unknown) { setForm(p => ({ ...p, [key]: value })) }

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
      setForm({ patientId: '', paymentMethodId: '', name: '', discount: 0, installments: 1, notes: '' })
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
              <div className="space-y-1.5 col-span-2">
                <label className={labelCls}>Nome do Tratamento *</label>
                <input value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Ex: PRP Joelho Bilateral" className={drawerInputCls} />
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

// ── Main page ────────────────────────────────────────────
export default function TratamentosPage() {
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

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
    { label: 'Receita total', value: BRL(stats.revenue), icon: 'payments', iconBg: 'bg-[rgba(5,150,105,0.08)]', iconColor: '#059669' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#021541]">Tratamentos</h1>
          <p className="text-sm text-[#718096] mt-0.5">Planos de tratamento, materiais e controle financeiro</p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#021541] text-white text-sm font-bold hover:bg-[#032170] transition-colors shrink-0"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
          Novo Tratamento
        </button>
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

      {/* Table */}
      <div className="bg-white rounded-xl overflow-hidden border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)]">
        {loading ? (
          <p className="text-center py-10 text-sm text-[#718096]">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-[#f5f6f8] rounded-xl">
            <span className="material-symbols-outlined text-[#718096]/30" style={{ fontSize: '48px' }}>vaccines</span>
            <p className="text-sm text-[#718096] mt-3">Nenhum tratamento encontrado</p>
            <button onClick={() => setDrawerOpen(true)} className="mt-4 text-xs text-[#00BCE4] hover:underline font-medium">Criar o primeiro tratamento</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(2,21,65,0.06)]">
                  {['Tratamento', 'Paciente', 'Itens', 'Custo', 'Venda', 'Margem', 'Status', ''].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold text-[#718096] uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(2,21,65,0.04)]">
                {filtered.map(t => {
                  const margin = Number(t.totalSale) - Number(t.totalCost)
                  return (
                    <tr key={t.id} className="hover:bg-[#f5f6f8] transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-[#021541]">{t.name}</p>
                        <p className="text-xs text-[#718096] mt-0.5">{new Date(t.createdAt).toLocaleDateString('pt-BR')}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#021541] whitespace-nowrap">{t.patient?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-[#718096] whitespace-nowrap">{t.items.length} {t.items.length === 1 ? 'item' : 'itens'}</td>
                      <td className="px-4 py-3 text-sm text-[#718096] whitespace-nowrap">{BRL(t.totalCost)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-[#021541] whitespace-nowrap">{BRL(t.totalSale)}</td>
                      <td className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${margin >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>{BRL(margin)}</td>
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-3">
                        {t.status !== 'completed' && t.status !== 'cancelled' && (
                          <div className="flex gap-1">
                            {t.status === 'draft' && (
                              <button onClick={() => updateStatus(t.id, 'approved')} title="Aprovar" className="w-7 h-7 rounded-lg flex items-center justify-center text-[#d97706] hover:bg-[rgba(217,119,6,0.1)] transition-colors">
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>thumb_up</span>
                              </button>
                            )}
                            {t.status === 'approved' && (
                              <button onClick={() => updateStatus(t.id, 'in_progress')} title="Iniciar" className="w-7 h-7 rounded-lg flex items-center justify-center text-[#00BCE4] hover:bg-[rgba(0,188,228,0.1)] transition-colors">
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>play_arrow</span>
                              </button>
                            )}
                            {t.status === 'in_progress' && (
                              <button onClick={() => updateStatus(t.id, 'completed')} title="Concluir" className="w-7 h-7 rounded-lg flex items-center justify-center text-[#059669] hover:bg-[rgba(5,150,105,0.1)] transition-colors">
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>
                              </button>
                            )}
                            <button onClick={() => updateStatus(t.id, 'cancelled')} title="Cancelar" className="w-7 h-7 rounded-lg flex items-center justify-center text-[#718096]/50 hover:text-[#DC2626] hover:bg-[rgba(239,68,68,0.1)] transition-colors">
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>cancel</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DrawerCreateTreatment
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={t => setTreatments(p => [t, ...p])}
      />
    </div>
  )
}
