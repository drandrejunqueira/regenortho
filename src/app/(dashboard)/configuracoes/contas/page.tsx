'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Conta Corrente' },
  { value: 'savings',  label: 'Conta Poupança' },
  { value: 'pix_key',  label: 'Chave PIX' },
]

interface BankAccount {
  id: string
  name: string
  bank: string | null
  agency: string | null
  account: string | null
  type: string
  pixKey: string | null
  isDefault: boolean
  isActive: boolean
  currentBalance: string
}

const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/40 focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)]'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'

const BRL = (v: string | number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
const TYPE_LABEL: Record<string, string> = Object.fromEntries(ACCOUNT_TYPES.map(t => [t.value, t.label]))

const EMPTY = { name: '', bank: '', agency: '', account: '', type: 'checking', pixKey: '', isDefault: false, currentBalance: '0' }

export default function ContasPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [dialog, setDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    fetch('/api/configuracoes/contas')
      .then(r => r.json())
      .then(({ data }) => { if (data) setAccounts(data) })
      .catch(() => {})
  }, [])

  function set(key: string, value: unknown) { setForm(p => ({ ...p, [key]: value })) }

  async function save() {
    if (!form.name) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/configuracoes/contas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, currentBalance: Number(form.currentBalance) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error()
      setAccounts(p => [...p, data.data])
      setDialog(false)
      setForm(EMPTY)
      toast.success('Conta criada!')
    } catch { toast.error('Erro ao criar') } finally { setSaving(false) }
  }

  async function setDefault(id: string) {
    const res = await fetch('/api/configuracoes/contas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isDefault: true }),
    })
    // Sem checar a resposta, um 403 ou 500 ainda pintava a tela como se tivesse
    // dado certo — e a conta padrão continuava a antiga no banco.
    if (!res.ok) {
      toast.error('Não foi possível definir a conta padrão')
      return
    }
    setAccounts(p => p.map(a => ({ ...a, isDefault: a.id === id })))
    toast.success('Conta padrão definida')
  }

  async function remove(id: string) {
    if (!confirm('Remover esta conta bancária? Ela deixará de aparecer nos recebimentos.')) return
    const res = await fetch('/api/configuracoes/contas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: false }),
    })
    if (!res.ok) {
      toast.error('Não foi possível remover a conta')
      return
    }
    setAccounts(p => p.filter(a => a.id !== id))
    toast.success('Conta removida')
  }

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0)

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="bg-white rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-[#718096] uppercase tracking-wider font-bold">Saldo Total</p>
          <p className="text-2xl font-bold text-[#021541] mt-1">{BRL(totalBalance)}</p>
          <p className="text-xs text-[#718096] mt-0.5">{accounts.length} conta{accounts.length !== 1 ? 's' : ''} cadastrada{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setDialog(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-[#021541] to-[#032170] text-white text-sm font-bold hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
          Nova Conta
        </button>
      </div>

      {/* Account list */}
      <div className="space-y-2">
        {accounts.length === 0 && (
          <div className="bg-white rounded-xl p-10 text-center text-sm text-[#718096]">Nenhuma conta cadastrada</div>
        )}
        {accounts.map(acc => (
          <div key={acc.id} className="bg-white rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#00BCE4]/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '20px' }}>account_balance</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-[#021541]">{acc.name}</p>
                {acc.isDefault && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00BCE4]/10 text-[#00BCE4] uppercase tracking-wider">Padrão</span>
                )}
              </div>
              <p className="text-xs text-[#718096] mt-0.5">
                {acc.bank && `${acc.bank} · `}
                {TYPE_LABEL[acc.type] ?? acc.type}
                {acc.agency && ` · Ag. ${acc.agency}`}
                {acc.account && ` · Cc. ${acc.account}`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-[#021541]">{BRL(acc.currentBalance)}</p>
              <p className="text-[10px] text-[#718096]">saldo atual</p>
            </div>
            <div className="flex gap-1 shrink-0">
              {!acc.isDefault && (
                <button onClick={() => setDefault(acc.id)} title="Definir como padrão" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#718096] hover:text-[#00BCE4] hover:bg-[#f5f6f8] transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>star</span>
                </button>
              )}
              <button onClick={() => remove(acc.id)} title="Remover" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#718096] hover:text-[#ffb4ab] hover:bg-[#ffb4ab]/10 transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md bg-white border-[rgba(2,21,65,0.08)]">
          <DialogHeader>
            <DialogTitle className="text-[#021541] font-bold">Nova Conta Bancária</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Nome da conta *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Itaú Principal" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls}>Banco</label>
                <input value={form.bank} onChange={e => set('bank', e.target.value)} placeholder="Itaú, Bradesco..." className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Tipo</label>
                <select value={form.type} onChange={e => set('type', e.target.value)} className={inputCls}>
                  {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            {form.type !== 'pix_key' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelCls}>Agência</label>
                  <input value={form.agency} onChange={e => set('agency', e.target.value)} placeholder="0001" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Conta</label>
                  <input value={form.account} onChange={e => set('account', e.target.value)} placeholder="12345-6" className={inputCls} />
                </div>
              </div>
            )}
            {form.type === 'pix_key' && (
              <div className="space-y-1.5">
                <label className={labelCls}>Chave PIX</label>
                <input value={form.pixKey} onChange={e => set('pixKey', e.target.value)} placeholder="CPF, CNPJ, e-mail ou aleatória" className={inputCls} />
              </div>
            )}
            <div className="space-y-1.5">
              <label className={labelCls}>Saldo inicial</label>
              <input type="number" step="0.01" value={form.currentBalance} onChange={e => set('currentBalance', e.target.value)} className={inputCls} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isDefault} onChange={e => set('isDefault', e.target.checked)} className="rounded" />
              <span className="text-sm text-[#021541]">Definir como conta padrão</span>
            </label>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <button onClick={() => setDialog(false)} className="px-4 py-2.5 rounded-xl text-sm text-[#718096] bg-[#f5f6f8] hover:bg-[#f5f6f8]">Cancelar</button>
            <button onClick={save} disabled={saving} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#021541] to-[#032170] text-white hover:opacity-90 disabled:opacity-50">
              {saving ? 'Criando...' : 'Criar Conta'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
