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

const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/60 focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'

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
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#021541] text-white text-sm font-bold hover:opacity-90 transition-opacity"
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
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              typeFilter === f.value
                ? 'bg-[#021541] text-white'
                : 'text-[#718096] hover:text-[#021541] hover:bg-[rgba(2,21,65,0.06)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      {loading ? (
        <p className="text-sm text-[#718096] py-8 text-center">Carregando...</p>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-white border border-[rgba(2,21,65,0.06)] rounded-xl">
          <div className="w-12 h-12 rounded-full bg-[rgba(0,188,228,0.08)] flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '24px' }}>payments</span>
          </div>
          <p className="text-sm font-medium text-[#021541]">Nenhum lançamento encontrado</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[rgba(2,21,65,0.06)]">
          <table className="w-full text-sm bg-white">
            <thead>
              <tr className="bg-[rgba(2,21,65,0.03)]">
                <th className="text-left px-5 py-3 text-xs font-semibold text-[#021541] uppercase tracking-wider">Data</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[#021541] uppercase tracking-wider">Descrição</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[#021541] uppercase tracking-wider hidden sm:table-cell">Categoria</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-[#021541] uppercase tracking-wider">Valor</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-[#021541] uppercase tracking-wider">Status</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-[rgba(2,21,65,0.05)] hover:bg-[rgba(2,21,65,0.015)] transition-colors">
                  <td className="px-5 py-3 font-technical text-xs text-[#718096] whitespace-nowrap">
                    <div>{formatDate(tx.date)}</div>
                    {tx.dueDate && tx.dueDate !== tx.date && (
                      <div className="text-[10px] text-amber-600 font-medium mt-0.5">Venc: {formatDate(tx.dueDate)}</div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-[#021541]">{tx.description}</p>
                    {tx.patient && <p className="text-xs text-[#718096]">{tx.patient.name}</p>}
                  </td>
                  <td className="px-5 py-3 text-xs text-[#718096] hidden sm:table-cell">
                    {TRANSACTION_CATEGORY_LABELS[tx.category] ?? tx.category}
                  </td>
                  <td className={`px-5 py-3 text-right font-technical font-semibold text-sm whitespace-nowrap ${tx.type === 'income' ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      tx.isPaid
                        ? 'bg-[rgba(0,188,228,0.08)] text-[#00BCE4]'
                        : 'bg-[rgba(245,158,11,0.1)] text-[#D97706]'
                    }`}>
                      {tx.isPaid ? 'Pago' : 'Pendente'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {!tx.isPaid && (
                      <button
                        onClick={() => markPaid(tx.id)}
                        className="bg-[rgba(0,188,228,0.08)] text-[#00BCE4] hover:bg-[rgba(0,188,228,0.15)] rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap"
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
      <DialogContent className="max-w-md bg-white border border-[rgba(2,21,65,0.08)]">
        <DialogHeader>
          <DialogTitle className="text-[#021541] font-bold">Novo Lançamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => { setType('income'); setForm({ ...form, category: '' }) }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                type === 'income'
                  ? 'bg-[rgba(0,188,228,0.1)] text-[#00BCE4] border border-[rgba(0,188,228,0.3)]'
                  : 'bg-[#f5f6f8] text-[#718096] hover:text-[#021541]'
              }`}
            >
              Receita
            </button>
            <button
              onClick={() => { setType('expense'); setForm({ ...form, category: '' }) }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                type === 'expense'
                  ? 'bg-[rgba(239,68,68,0.08)] text-[#DC2626] border border-[rgba(239,68,68,0.2)]'
                  : 'bg-[#f5f6f8] text-[#718096] hover:text-[#021541]'
              }`}
            >
              Despesa
            </button>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Categoria *</label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v ?? '' })}>
              <SelectTrigger className="bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl text-sm text-[#021541] h-10">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent className="bg-white border border-[rgba(2,21,65,0.1)]">
                {categories.map((c) => (
                  <SelectItem key={c} value={c} className="text-[#021541] text-sm">
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
            <Label htmlFor="isPaid" className="text-sm text-[#718096]">Marcar como pago</Label>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Observações</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls + ' resize-none'} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={() => onOpenChange(false)} disabled={loading} className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] hover:bg-[rgba(2,21,65,0.06)] transition-colors">
            Cancelar
          </button>
          <button onClick={submit} disabled={loading} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#021541] text-white hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
