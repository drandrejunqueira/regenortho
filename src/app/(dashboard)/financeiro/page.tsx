'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { formatCurrency, formatDate } from '@/lib/utils'
import { TRANSACTION_CATEGORY_LABELS } from '@/lib/constants'
import type { Transaction } from '@/types'

const INCOME_CATEGORIES = ['consultation_fee', 'prp_procedure', 'bmac_procedure', 'hyaluronic_procedure', 'surgery_fee', 'other_income']
const EXPENSE_CATEGORIES = ['rent', 'staff', 'marketing', 'materials', 'equipment', 'utilities', 'insurance', 'accounting', 'other_expense']

const inputCls = 'w-full bg-[#31353c] border-none rounded-xl px-3 py-2.5 text-sm text-[#dfe2eb] placeholder:text-[#bec9c9]/40 focus:outline-none focus:ring-2 focus:ring-[#61d8dd]/30'
const labelCls = 'text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider'

export default function FinanceiroPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [newDialog, setNewDialog] = useState(false)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (typeFilter !== 'all') params.set('type', typeFilter)
      const res = await fetch(`/api/financeiro?${params}`)
      if (res.ok) {
        const { data } = await res.json()
        setTransactions(data)
      }
    } finally {
      setLoading(false)
    }
  }, [typeFilter])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0)
  const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0)
  const netResult = totalIncome - totalExpense

  async function markPaid(id: string) {
    try {
      const res = await fetch(`/api/financeiro/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPaid: true }),
      })
      if (!res.ok) throw new Error()
      toast.success('Marcado como pago')
      fetchTransactions()
    } catch {
      toast.error('Erro ao atualizar')
    }
  }

  const FILTERS = [
    { value: 'all', label: 'Todos' },
    { value: 'income', label: 'Receitas' },
    { value: 'expense', label: 'Despesas' },
  ]

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="Controle de receitas e despesas"
        action={
          <button
            onClick={() => setNewDialog(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-[#006e72] to-[#61d8dd] text-[#003739] text-sm font-bold hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Novo Lançamento
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Receita total" value={formatCurrency(totalIncome)} accent="teal" icon="trending_up" />
        <KpiCard title="Despesas" value={formatCurrency(totalExpense)} accent="error" icon="trending_down" />
        <KpiCard title="Resultado líquido" value={formatCurrency(netResult)} accent={netResult >= 0 ? 'teal' : 'error'} icon="account_balance_wallet" />
        <KpiCard title="Lançamentos" value={transactions.length} accent="gold" icon="payments" />
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              typeFilter === f.value
                ? 'bg-gradient-to-br from-[#006e72] to-[#61d8dd] text-[#003739] font-bold'
                : 'bg-[#1c2026] text-[#bec9c9] hover:text-[#dfe2eb]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      {loading ? (
        <p className="text-sm text-[#bec9c9] py-8 text-center">Carregando...</p>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-[#1c2026] rounded-xl">
          <div className="w-12 h-12 rounded-full bg-[#262a31] flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[#bec9c9]" style={{ fontSize: '24px' }}>payments</span>
          </div>
          <p className="text-sm font-medium text-[#dfe2eb]">Nenhum lançamento encontrado</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden bg-[#1c2026]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#262a31]">
                <th className="text-left px-5 py-3 text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider">Data</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider">Descrição</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider">Categoria</th>
                <th className="text-right px-5 py-3 text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider">Valor</th>
                <th className="text-center px-5 py-3 text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider">Status</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3e4949]/20">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-[#262a31]/50 transition-colors">
                  <td className="px-5 py-3 font-technical text-xs text-[#bec9c9]">{formatDate(tx.date)}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-[#dfe2eb]">{tx.description}</p>
                    {tx.patient && <p className="text-xs text-[#bec9c9]">{tx.patient.name}</p>}
                  </td>
                  <td className="px-5 py-3 text-xs text-[#bec9c9]">
                    {TRANSACTION_CATEGORY_LABELS[tx.category] ?? tx.category}
                  </td>
                  <td className={`px-5 py-3 text-right font-technical font-bold text-sm ${tx.type === 'income' ? 'text-[#61d8dd]' : 'text-[#ffb4ab]'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      tx.isPaid
                        ? 'bg-[#61d8dd]/10 text-[#61d8dd]'
                        : 'bg-[#e6c364]/10 text-[#e6c364]'
                    }`}>
                      {tx.isPaid ? 'Pago' : 'Pendente'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {!tx.isPaid && (
                      <button
                        onClick={() => markPaid(tx.id)}
                        className="text-xs font-bold text-[#61d8dd] hover:underline"
                      >
                        Pagar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewTransactionDialog open={newDialog} onOpenChange={setNewDialog} onCreated={fetchTransactions} />
    </div>
  )
}

function NewTransactionDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<'income' | 'expense'>('income')
  const [form, setForm] = useState({ category: '', description: '', amount: '', date: '', isPaid: false, notes: '' })

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  async function submit() {
    if (!form.category || !form.description || !form.amount || !form.date) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/financeiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, type }),
      })
      if (!res.ok) throw new Error()
      toast.success('Lançamento criado')
      onOpenChange(false)
      onCreated()
      setForm({ category: '', description: '', amount: '', date: '', isPaid: false, notes: '' })
    } catch {
      toast.error('Erro ao criar lançamento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#1c2026] border-[#3e4949]/20">
        <DialogHeader>
          <DialogTitle className="text-[#dfe2eb] font-bold">Novo Lançamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => { setType('income'); setForm({ ...form, category: '' }) }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                type === 'income'
                  ? 'bg-gradient-to-br from-[#006e72] to-[#61d8dd] text-[#003739]'
                  : 'bg-[#31353c] text-[#bec9c9] hover:text-[#dfe2eb]'
              }`}
            >
              Receita
            </button>
            <button
              onClick={() => { setType('expense'); setForm({ ...form, category: '' }) }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                type === 'expense'
                  ? 'bg-[#93000a]/60 text-[#ffb4ab]'
                  : 'bg-[#31353c] text-[#bec9c9] hover:text-[#dfe2eb]'
              }`}
            >
              Despesa
            </button>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Categoria *</label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v ?? '' })}>
              <SelectTrigger className="bg-[#31353c] border-none rounded-xl text-sm text-[#dfe2eb] h-10">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent className="bg-[#31353c] border-[#3e4949]/30">
                {categories.map((c) => (
                  <SelectItem key={c} value={c} className="text-[#dfe2eb] text-sm">
                    {TRANSACTION_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Descrição *</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className={labelCls}>Valor (R$) *</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Data *</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="isPaid" checked={form.isPaid} onCheckedChange={(v) => setForm({ ...form, isPaid: Boolean(v) })} />
            <Label htmlFor="isPaid" className="text-sm text-[#bec9c9]">Marcar como pago</Label>
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
