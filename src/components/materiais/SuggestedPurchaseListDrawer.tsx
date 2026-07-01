'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import type { Material } from '@/types'
import { inputCls, labelCls } from './shared'

type ListItem = {
  materialId: string
  quantity: number
  unitCost: number
}

type Props = {
  open: boolean
  materials: Material[]
  onOpenChange: (v: boolean) => void
}

function suggestedQuantity(material: Material): number {
  return Math.max(1, material.minimumStock * 2 - material.currentStock)
}

export function SuggestedPurchaseListDrawer({ open, materials, onOpenChange }: Props) {
  const [items, setItems] = useState<ListItem[]>([])
  const [addingId, setAddingId] = useState('')

  useEffect(() => {
    if (!open) return
    const needsRestock = materials.filter((m) => m.isActive && m.status !== 'ok')
    setItems(
      needsRestock.map((m) => ({
        materialId: m.id,
        quantity: suggestedQuantity(m),
        unitCost: m.unitCost ? parseFloat(m.unitCost) : 0,
      }))
    )
    setAddingId('')
  }, [open, materials])

  function updateItem(idx: number, patch: Partial<ListItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function addMaterial(materialId: string) {
    const material = materials.find((m) => m.id === materialId)
    if (!material || items.some((i) => i.materialId === materialId)) return
    setItems((prev) => [
      ...prev,
      {
        materialId,
        quantity: suggestedQuantity(material),
        unitCost: material.unitCost ? parseFloat(material.unitCost) : 0,
      },
    ])
    setAddingId('')
  }

  const rows = items
    .map((item) => ({ item, material: materials.find((m) => m.id === item.materialId) }))
    .filter((r): r is { item: ListItem; material: Material } => !!r.material)

  const total = rows.reduce((s, { item }) => s + item.quantity * item.unitCost, 0)
  const availableToAdd = materials.filter(
    (m) => m.isActive && !items.some((i) => i.materialId === m.id)
  )

  function handlePrint() {
    if (rows.length === 0) {
      toast.error('Adicione ao menos um item à lista antes de exportar')
      return
    }
    window.print()
  }

  if (!open) return null

  return (
    <>
      <div className="print:hidden">
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-black/30 z-40 transition-opacity"
          onClick={() => onOpenChange(false)}
        />

        {/* Drawer */}
        <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(2,21,65,0.08)]">
            <div>
              <h2 className="text-base font-bold text-[#021541]">Lista de Compras Sugerida</h2>
              <p className="text-xs text-[#718096] mt-0.5">
                Itens no estoque mínimo ou abaixo — edite quantidades e custos antes de exportar
              </p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-lg hover:bg-[rgba(2,21,65,0.06)] transition-colors"
            >
              <span
                className="material-symbols-outlined text-[#718096]"
                style={{ fontSize: '20px' }}
              >
                close
              </span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
            {rows.length === 0 ? (
              <div className="text-center py-16 text-[#718096]">
                <span
                  className="material-symbols-outlined mb-3 block"
                  style={{ fontSize: '48px', opacity: 0.3 }}
                >
                  checklist
                </span>
                <p className="font-medium">Nenhum item na lista</p>
                <p className="text-sm mt-1">
                  Todos os materiais estão com estoque normal, ou remova itens manualmente abaixo
                </p>
              </div>
            ) : (
              rows.map(({ item, material }, idx) => (
                <div
                  key={item.materialId}
                  className="p-4 rounded-xl bg-[rgba(2,21,65,0.02)] border border-[rgba(2,21,65,0.07)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#021541] text-sm">{material.name}</p>
                      <p className="text-xs text-[#718096]">
                        Estoque atual: {material.currentStock} {material.unit} · Mínimo:{' '}
                        {material.minimumStock} {material.unit}
                        {material.laboratory && <> · {material.laboratory}</>}
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(idx)}
                      className="p-1.5 rounded-lg bg-[rgba(220,38,38,0.06)] text-[#dc2626] hover:bg-[rgba(220,38,38,0.12)] transition-all shrink-0"
                      aria-label="Remover item"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        delete
                      </span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="space-y-1">
                      <label className={labelCls}>Quantidade a comprar ({material.unit})</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
                        }
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={labelCls}>Custo unitário (R$)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitCost}
                        onChange={(e) =>
                          updateItem(idx, { unitCost: parseFloat(e.target.value) || 0 })
                        }
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs mt-2">
                    <span className="text-[#718096]">Subtotal:</span>
                    <span className="font-technical font-bold text-[#021541]">
                      {formatCurrency(item.quantity * item.unitCost)}
                    </span>
                  </div>
                </div>
              ))
            )}

            {availableToAdd.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <label className={labelCls}>Adicionar outro material à lista</label>
                <select
                  value={addingId}
                  onChange={(e) => addMaterial(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Selecionar material...</option>
                  {availableToAdd.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.unit})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-[rgba(2,21,65,0.08)] bg-[rgba(2,21,65,0.01)]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[#718096] font-medium">Total estimado:</span>
              <span className="font-technical font-bold text-xl text-[#021541]">
                {formatCurrency(total)}
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => onOpenChange(false)}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] hover:bg-[rgba(2,21,65,0.06)] transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-[#021541] text-white hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  print
                </span>
                Exportar PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <div className="hidden print:block p-8">
            <h1 className="text-xl font-bold text-[#021541] mb-1">Lista de Compras Sugerida</h1>
            <p className="text-xs text-[#718096] mb-6">
              Gerado em {new Date().toLocaleDateString('pt-BR')}
            </p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-[#021541]">
                  <th className="text-left py-2 pr-2">Material</th>
                  <th className="text-left py-2 pr-2">Laboratório</th>
                  <th className="text-left py-2 pr-2">Fornecedor</th>
                  <th className="text-right py-2 pr-2">Estoque</th>
                  <th className="text-right py-2 pr-2">Mínimo</th>
                  <th className="text-right py-2 pr-2">Qtd. a comprar</th>
                  <th className="text-right py-2 pr-2">Custo unit.</th>
                  <th className="text-right py-2">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ item, material }) => (
                  <tr key={item.materialId} className="border-b border-[rgba(2,21,65,0.15)]">
                    <td className="py-2 pr-2">{material.name}</td>
                    <td className="py-2 pr-2">{material.laboratory ?? '—'}</td>
                    <td className="py-2 pr-2">{material.supplier ?? '—'}</td>
                    <td className="py-2 pr-2 text-right">
                      {material.currentStock} {material.unit}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {material.minimumStock} {material.unit}
                    </td>
                    <td className="py-2 pr-2 text-right font-bold">
                      {item.quantity} {material.unit}
                    </td>
                    <td className="py-2 pr-2 text-right">{formatCurrency(item.unitCost)}</td>
                    <td className="py-2 text-right">
                      {formatCurrency(item.quantity * item.unitCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={7} className="py-3 text-right font-bold">
                    Total estimado:
                  </td>
                  <td className="py-3 text-right font-bold">{formatCurrency(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>,
          document.body
        )}
    </>
  )
}
