'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const PAYMENT_TYPES = [
  { value: 'cash',             label: 'Dinheiro',          icon: 'payments' },
  { value: 'pix',              label: 'PIX',               icon: 'qr_code_2' },
  { value: 'debit_card',       label: 'Cartão de Débito',  icon: 'credit_card' },
  { value: 'credit_card',      label: 'Cartão de Crédito', icon: 'credit_card' },
  { value: 'bank_transfer',    label: 'Transferência',     icon: 'account_balance' },
  { value: 'insurance',        label: 'Convênio',          icon: 'health_and_safety' },
  { value: 'check',            label: 'Cheque',            icon: 'receipt' },
]

interface PaymentMethod {
  id: string
  name: string
  type: string
  feePercent: string
  maxInstallments: number
  isActive: boolean
}

const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/40 focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)]'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'

const TYPE_LABEL: Record<string, string> = Object.fromEntries(PAYMENT_TYPES.map(t => [t.value, t.label]))
const TYPE_ICON: Record<string, string> = Object.fromEntries(PAYMENT_TYPES.map(t => [t.value, t.icon]))

export default function PagamentosPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [dialog, setDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'pix', feePercent: '0', maxInstallments: 1 })

  useEffect(() => {
    fetch('/api/configuracoes/pagamentos')
      .then(r => r.json())
      .then(({ data }) => { if (data) setMethods(data) })
      .catch(() => {})
  }, [])

  function set(key: string, value: unknown) { setForm(p => ({ ...p, [key]: value })) }

  async function save() {
    if (!form.name || !form.type) { toast.error('Preencha nome e tipo'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/configuracoes/pagamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, feePercent: Number(form.feePercent), maxInstallments: Number(form.maxInstallments) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error()
      setMethods(p => [...p, data.data])
      setDialog(false)
      setForm({ name: '', type: 'pix', feePercent: '0', maxInstallments: 1 })
      toast.success('Forma de pagamento criada!')
    } catch { toast.error('Erro ao criar') } finally { setSaving(false) }
  }

  async function toggleActive(pm: PaymentMethod) {
    await fetch('/api/configuracoes/pagamentos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pm.id, isActive: !pm.isActive }),
    })
    setMethods(p => p.map(m => m.id === pm.id ? { ...m, isActive: !m.isActive } : m))
  }

  const active = methods.filter(m => m.isActive)
  const inactive = methods.filter(m => !m.isActive)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#718096]">{active.length} forma{active.length !== 1 ? 's' : ''} ativa{active.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setDialog(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-[#021541] to-[#032170] text-white text-sm font-bold hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
          Nova Forma de Pagamento
        </button>
      </div>

      <div className="space-y-2">
        {methods.length === 0 && (
          <div className="bg-white rounded-xl p-10 text-center text-sm text-[#718096]">Nenhuma forma cadastrada</div>
        )}
        {methods.map(pm => (
          <div key={pm.id} className={`bg-white rounded-xl p-4 flex items-center gap-4 ${!pm.isActive ? 'opacity-50' : ''}`}>
            <div className="w-10 h-10 rounded-xl bg-[#00BCE4]/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '20px' }}>
                {TYPE_ICON[pm.type] ?? 'payments'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#021541]">{pm.name}</p>
              <p className="text-xs text-[#718096] mt-0.5">
                {TYPE_LABEL[pm.type] ?? pm.type}
                {Number(pm.feePercent) > 0 && ` · ${pm.feePercent}% de taxa`}
                {pm.maxInstallments > 1 && ` · até ${pm.maxInstallments}x`}
              </p>
            </div>
            <button
              onClick={() => toggleActive(pm)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${pm.isActive ? 'bg-[#00BCE4]' : 'bg-[#f5f6f8]'}`}
              title={pm.isActive ? 'Desativar' : 'Ativar'}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform ${pm.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
        ))}
        {inactive.length > 0 && (
          <p className="text-[11px] text-[#718096]/50 px-1">{inactive.length} forma{inactive.length !== 1 ? 's' : ''} inativa{inactive.length !== 1 ? 's' : ''} (toggle para reativar)</p>
        )}
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-sm bg-white border-[rgba(2,21,65,0.08)]">
          <DialogHeader>
            <DialogTitle className="text-[#021541] font-bold">Nova Forma de Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Nome *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: PIX Principal" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Tipo *</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className={inputCls}>
                {PAYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls}>Taxa (%)</label>
                <input type="number" min="0" max="100" step="0.1" value={form.feePercent} onChange={e => set('feePercent', e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Máx. Parcelas</label>
                <input type="number" min="1" max="24" value={form.maxInstallments} onChange={e => set('maxInstallments', Number(e.target.value))} className={inputCls} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <button onClick={() => setDialog(false)} className="px-4 py-2.5 rounded-xl text-sm text-[#718096] bg-[#f5f6f8] hover:bg-[#f5f6f8]">Cancelar</button>
            <button onClick={save} disabled={saving} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#021541] to-[#032170] text-white hover:opacity-90 disabled:opacity-50">
              {saving ? 'Criando...' : 'Criar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
