'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import type { Material, MaterialBatch } from '@/types'
import { inputCls, labelCls, useMaterialCategories } from './shared'

type Props = {
  open: boolean
  material: Material | null
  canDelete: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

const UNITS = ['un', 'ampola', 'seringa', 'agulha', 'pacote', 'frasco', 'par', 'caixa']

export function EditMaterialDialog({ open, material, canDelete, onOpenChange, onSaved }: Props) {
  const { roots, subcategoriesOf } = useMaterialCategories()

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [subcategoryId, setSubcategoryId] = useState<string>('')
  const [unit, setUnit] = useState('un')
  const [minimumStock, setMinimumStock] = useState('5')
  const [currentStock, setCurrentStock] = useState('0')
  const [unitCost, setUnitCost] = useState('')
  const [supplier, setSupplier] = useState('')
  const [supplierContact, setSupplierContact] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const [batches, setBatches] = useState<MaterialBatch[]>([])
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null)
  const [bLote, setBLote] = useState('')
  const [bValidade, setBValidade] = useState('')
  const [bQtd, setBQtd] = useState('')

  const hasBatches = batches.length > 0
  const batchTotal = batches.reduce((s, b) => s + (b.quantity ?? 0), 0)

  const loadBatches = useCallback(async (materialId: string) => {
    const res = await fetch(`/api/materiais/${materialId}/batches`)
    if (res.ok) {
      const { data } = await res.json()
      setBatches(data ?? [])
    }
  }, [])

  useEffect(() => {
    if (open && material) {
      setName(material.name)
      setCategoryId(material.categoryId ?? '')
      setSubcategoryId(material.subcategoryId ?? '')
      setUnit(material.unit)
      setMinimumStock(String(material.minimumStock))
      setCurrentStock(String(material.currentStock))
      setUnitCost(material.unitCost ?? '')
      setSupplier(material.supplier ?? '')
      setSupplierContact(material.supplierContact ?? '')
      setNotes(material.notes ?? '')
      setEditingBatchId(null)
      resetBatchForm()
      loadBatches(material.id)
    }
  }, [open, material, loadBatches])

  function resetBatchForm() {
    setEditingBatchId(null)
    setBLote('')
    setBValidade('')
    setBQtd('')
  }

  async function saveMaterial() {
    if (!material) return
    if (!name.trim()) {
      toast.error('Nome do material é obrigatório')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        unit,
        minimumStock: parseInt(minimumStock) || 0,
        unitCost: unitCost.trim() ? parseFloat(unitCost).toFixed(2) : null,
        supplier: supplier.trim() || null,
        supplierContact: supplierContact.trim() || null,
        notes: notes.trim() || null,
      }
      // Estoque só é editável direto quando não há lotes controlando.
      if (!hasBatches) payload.currentStock = parseInt(currentStock) || 0

      const res = await fetch(`/api/materiais/${material.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao salvar')
        return
      }
      toast.success('Material atualizado!')
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error('Erro ao conectar ao servidor')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive() {
    if (!material) return
    const next = !material.isActive
    const res = await fetch(`/api/materiais/${material.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: next }),
    })
    if (res.ok) {
      toast.success(next ? 'Material reativado' : 'Material inativado')
      onSaved()
      onOpenChange(false)
    } else {
      toast.error('Não foi possível alterar o status')
    }
  }

  async function deleteMaterial() {
    if (!material) return
    if (!confirm(`Excluir permanentemente "${material.name}"? Esta ação não pode ser desfeita.`)) return
    const res = await fetch(`/api/materiais/${material.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Material excluído')
      onSaved()
      onOpenChange(false)
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Erro ao excluir. Considere inativar.')
    }
  }

  async function saveBatch() {
    if (!material) return
    const qtd = parseInt(bQtd) || 0
    const payload = {
      batchNumber: bLote.trim() || null,
      expiresAt: bValidade || null,
      quantity: qtd,
    }
    const url = editingBatchId
      ? `/api/materiais/${material.id}/batches/${editingBatchId}`
      : `/api/materiais/${material.id}/batches`
    const res = await fetch(url, {
      method: editingBatchId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      toast.success(editingBatchId ? 'Lote atualizado' : 'Lote adicionado')
      resetBatchForm()
      await loadBatches(material.id)
      onSaved()
    } else {
      toast.error('Erro ao salvar lote')
    }
  }

  async function removeBatch(batchId: string) {
    if (!material) return
    const res = await fetch(`/api/materiais/${material.id}/batches/${batchId}`, { method: 'DELETE' })
    if (res.ok) {
      if (editingBatchId === batchId) resetBatchForm()
      await loadBatches(material.id)
      onSaved()
    } else {
      toast.error('Erro ao excluir lote')
    }
  }

  function startEditBatch(b: MaterialBatch) {
    setEditingBatchId(b.id)
    setBLote(b.batchNumber ?? '')
    setBValidade(b.expiresAt ? b.expiresAt.slice(0, 10) : '')
    setBQtd(String(b.quantity ?? 0))
  }

  if (!material) return null
  const subcats = subcategoriesOf(categoryId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white border border-[rgba(2,21,65,0.08)] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#021541] font-bold flex items-center gap-2">
            Editar Material
            {!material.isActive && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(113,128,150,0.15)] text-[#718096]">
                INATIVO
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 my-2">
          <div className="space-y-1.5">
            <label className={labelCls}>Nome do Material *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Categoria</label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value)
                  setSubcategoryId('')
                }}
                className={inputCls}
              >
                <option value="">— Sem categoria —</option>
                {roots.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Subcategoria</label>
              <select
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
                className={inputCls}
                disabled={!categoryId || subcats.length === 0}
              >
                <option value="">— Nenhuma —</option>
                {subcats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Unidade</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
                {[...new Set([unit, ...UNITS])].map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Estoque atual</label>
              <input
                type="number"
                min="0"
                value={hasBatches ? batchTotal : currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                disabled={hasBatches}
                className={`${inputCls} ${hasBatches ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Estoque mínimo</label>
              <input
                type="number"
                min="0"
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          {hasBatches && (
            <p className="text-[11px] text-[#718096] -mt-2">
              O estoque é calculado automaticamente pela soma dos lotes abaixo.
            </p>
          )}

          {/* ── Lotes / Validades (variedades) ── */}
          <div className="rounded-xl border border-[rgba(2,21,65,0.1)] p-3 space-y-3 bg-[#fafbfc]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#021541] uppercase tracking-wider">
                Lotes e Validades
              </span>
              <span className="text-[11px] text-[#718096]">
                {batches.length} {batches.length === 1 ? 'lote' : 'lotes'}
              </span>
            </div>

            {batches.length > 0 && (
              <div className="space-y-1.5">
                {batches.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-2 text-xs bg-white rounded-lg border border-[rgba(2,21,65,0.07)] px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-[#021541]">
                        {b.batchNumber || 'Sem nº'}
                      </span>
                      <span className="text-[#718096]">
                        {' · '}
                        {b.expiresAt ? `val. ${formatDate(b.expiresAt)}` : 'sem validade'}
                      </span>
                    </div>
                    <span className="font-technical font-bold text-[#021541]">{b.quantity}</span>
                    <button
                      onClick={() => startEditBatch(b)}
                      className="p-1 rounded text-[#00BCE4] hover:bg-[rgba(0,188,228,0.1)]"
                      aria-label="Editar lote"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                        edit
                      </span>
                    </button>
                    <button
                      onClick={() => removeBatch(b.id)}
                      className="p-1 rounded text-[#DC2626] hover:bg-[rgba(220,38,38,0.1)]"
                      aria-label="Excluir lote"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                        delete
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Formulário de lote (adicionar/editar) */}
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div className="space-y-1">
                <label className={labelCls}>Nº do Lote</label>
                <input
                  value={bLote}
                  onChange={(e) => setBLote(e.target.value)}
                  placeholder="Lote"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Validade</label>
                <input
                  type="date"
                  value={bValidade}
                  onChange={(e) => setBValidade(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1 w-20">
                <label className={labelCls}>Qtd</label>
                <input
                  type="number"
                  min="0"
                  value={bQtd}
                  onChange={(e) => setBQtd(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveBatch}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-bold bg-[#00BCE4] text-white hover:opacity-90 transition-opacity"
              >
                {editingBatchId ? 'Salvar lote' : '+ Adicionar lote'}
              </button>
              {editingBatchId && (
                <button
                  onClick={resetBatchForm}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-[#718096] bg-[#f0f1f3] hover:bg-[rgba(2,21,65,0.06)]"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Custo Unitário (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Fornecedor</label>
              <input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Contato do Fornecedor</label>
            <input
              value={supplierContact}
              onChange={(e) => setSupplierContact(e.target.value)}
              placeholder="Ex: (11) 99999-9999"
              className={inputCls}
            />
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputCls}
              style={{ resize: 'none' }}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap sm:justify-between">
          <div className="flex gap-2">
            <button
              onClick={toggleActive}
              className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                material.isActive
                  ? 'bg-[rgba(217,119,6,0.1)] text-[#d97706] hover:bg-[rgba(217,119,6,0.18)]'
                  : 'bg-[rgba(5,150,105,0.1)] text-[#059669] hover:bg-[rgba(5,150,105,0.18)]'
              }`}
            >
              {material.isActive ? 'Inativar' : 'Reativar'}
            </button>
            {canDelete && (
              <button
                onClick={deleteMaterial}
                className="px-3 py-2.5 rounded-xl text-sm font-semibold bg-[rgba(220,38,38,0.08)] text-[#DC2626] hover:bg-[rgba(220,38,38,0.15)] transition-colors"
              >
                Excluir
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] hover:bg-[rgba(2,21,65,0.06)] transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={saveMaterial}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#021541] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
