'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import type { Material } from '@/types'

const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/60 focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'

export default function MateriaisPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [movDialog, setMovDialog] = useState(false)
  const [movType, setMovType] = useState<'in' | 'out'>('in')

  const fetchMaterials = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/materiais')
      if (res.ok) {
        const { data } = await res.json()
        setMaterials(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMaterials() }, [fetchMaterials])

  const critical = materials.filter((m) => m.status === 'critical' || m.status === 'out_of_stock').length
  const low = materials.filter((m) => m.status === 'low').length

  function openMovement(material: Material, type: 'in' | 'out') {
    setSelectedMaterial(material)
    setMovType(type)
    setMovDialog(true)
  }

  function generateWhatsApp(material: Material) {
    if (!material.supplierContact) return
    const qty = material.minimumStock * 2 - material.currentStock
    const msg = encodeURIComponent(
      `Olá! Preciso repor o item "${material.name}".\nQuantidade necessária: ${qty} ${material.unit}.\nPor favor, confirmar disponibilidade e prazo de entrega.`
    )
    const phone = material.supplierContact.replace(/\D/g, '')
    window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank')
  }

  return (
    <div>
      <PageHeader
        title="Controle de Materiais"
        description="Gerencie o estoque de materiais da clínica"
      />

      {critical > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.2)] rounded-xl text-sm text-[#DC2626] font-medium mb-4">
          <span className="material-symbols-outlined shrink-0" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>warning</span>
          {critical} {critical === 1 ? 'item' : 'itens'} com estoque crítico — ação necessária!
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total de itens" value={materials.length} accent="teal" icon="inventory_2" />
        <KpiCard title="Críticos" value={critical} accent="error" icon="warning" />
        <KpiCard title="Estoque baixo" value={low} accent="gold" icon="trending_down" />
        <KpiCard title="Normais" value={materials.filter((m) => m.status === 'ok').length} accent="teal" icon="check_circle" />
      </div>

      {loading ? (
        <p className="text-sm text-[#718096] py-8 text-center">Carregando...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[rgba(2,21,65,0.06)]">
          <table className="w-full text-sm bg-white">
            <thead>
              <tr className="bg-[rgba(2,21,65,0.03)]">
                {['Material', 'Categoria', 'Estoque', 'Mínimo', 'Status', 'Validade', ''].map((h) => (
                  <th
                    key={h}
                    className={`px-5 py-3 text-xs font-semibold text-[#021541] uppercase tracking-wider ${
                      h === '' ? 'w-24' : h === 'Estoque' || h === 'Mínimo' ? 'text-center' : 'text-left'
                    } ${h === 'Categoria' || h === 'Validade' ? 'hidden sm:table-cell' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {materials.map((mat) => {
                const isCritical = mat.status === 'critical' || mat.status === 'out_of_stock'
                return (
                  <tr
                    key={mat.id}
                    className={`border-b border-[rgba(2,21,65,0.05)] transition-colors ${
                      isCritical
                        ? 'bg-[rgba(239,68,68,0.02)] hover:bg-[rgba(239,68,68,0.04)]'
                        : 'hover:bg-[rgba(2,21,65,0.015)]'
                    }`}
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-[#021541]">{mat.name}</p>
                      {mat.supplier && <p className="text-xs text-[#718096]">{mat.supplier}</p>}
                    </td>
                    <td className="px-5 py-3 text-[#718096] capitalize text-xs hidden sm:table-cell">{mat.category}</td>
                    <td className="px-5 py-3 text-center font-technical font-bold text-[#021541]">
                      {mat.currentStock} <span className="text-[#718096] font-normal text-xs">{mat.unit}</span>
                    </td>
                    <td className="px-5 py-3 text-center font-technical text-[#718096] text-sm">
                      {mat.minimumStock} <span className="text-xs">{mat.unit}</span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge type="stock_status" value={mat.status} pulse={isCritical} />
                    </td>
                    <td className="px-5 py-3 font-technical text-xs text-[#718096] hidden sm:table-cell">
                      {mat.expiresAt ? formatDate(mat.expiresAt) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <button
                          onClick={() => openMovement(mat, 'in')}
                          className="p-1.5 rounded-lg bg-[rgba(5,150,105,0.06)] text-[#059669] hover:bg-[rgba(5,150,105,0.12)] transition-all"
                          aria-label="Entrada"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_downward</span>
                        </button>
                        <button
                          onClick={() => openMovement(mat, 'out')}
                          className="p-1.5 rounded-lg bg-[rgba(220,38,38,0.06)] text-[#DC2626] hover:bg-[rgba(220,38,38,0.12)] transition-all"
                          aria-label="Saída"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_upward</span>
                        </button>
                        {mat.supplierContact && (
                          <button
                            onClick={() => generateWhatsApp(mat)}
                            className="p-1.5 rounded-lg bg-[rgba(0,188,228,0.06)] text-[#00BCE4] hover:bg-[rgba(0,188,228,0.12)] transition-all"
                            aria-label="Solicitar compra via WhatsApp"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chat</span>
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

      <MovimentacaoDialog
        open={movDialog}
        material={selectedMaterial}
        type={movType}
        onOpenChange={setMovDialog}
        onCreated={fetchMaterials}
      />
    </div>
  )
}

function MovimentacaoDialog({ open, material, type, onOpenChange, onCreated }: {
  open: boolean; material: Material | null; type: 'in' | 'out';
  onOpenChange: (v: boolean) => void; onCreated: () => void
}) {
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  if (!material) return null

  async function submit() {
    if (!quantity || parseInt(quantity) <= 0) { toast.error('Informe uma quantidade válida'); return }
    if (!material) return
    setLoading(true)
    try {
      const res = await fetch(`/api/materiais/${material.id}/movement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, quantity: parseInt(quantity), reason }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro ao registrar'); return }
      toast.success(type === 'in' ? 'Entrada registrada!' : 'Saída registrada!')
      setQuantity(''); setReason('')
      onOpenChange(false)
      onCreated()
    } catch {
      toast.error('Erro ao registrar movimentação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-white border border-[rgba(2,21,65,0.08)]">
        <DialogHeader>
          <DialogTitle className="text-[#021541] font-bold">
            {type === 'in' ? 'Registrar Entrada' : 'Registrar Saída'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm font-medium text-[#021541]">{material.name}</p>
          <p className="text-sm text-[#718096]">
            Estoque atual: <span className="font-technical font-bold text-[#021541]">{material.currentStock} {material.unit}</span>
          </p>
          <div className="space-y-1.5">
            <label className={labelCls}>Quantidade *</label>
            <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Motivo</label>
            <input
              placeholder={type === 'in' ? 'ex: Compra, doação...' : 'ex: Procedimento PRP...'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={() => onOpenChange(false)} disabled={loading} className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] hover:bg-[rgba(2,21,65,0.06)] transition-colors">
            Cancelar
          </button>
          <button onClick={submit} disabled={loading} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#021541] text-white hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? 'Salvando...' : 'Confirmar'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
