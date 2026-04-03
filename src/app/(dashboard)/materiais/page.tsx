'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import type { Material } from '@/types'

const inputCls = 'w-full bg-[#31353c] border-none rounded-xl px-3 py-2.5 text-sm text-[#dfe2eb] placeholder:text-[#bec9c9]/40 focus:outline-none focus:ring-2 focus:ring-[#61d8dd]/30'
const labelCls = 'text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider'

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
        <div className="flex items-center gap-3 px-4 py-3 bg-[#93000a]/20 border-l-4 border-[#ffb4ab] rounded-r-xl text-sm text-[#ffb4ab] font-medium mb-4">
          <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>warning</span>
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
        <p className="text-sm text-[#bec9c9] py-8 text-center">Carregando...</p>
      ) : (
        <div className="rounded-xl overflow-hidden bg-[#1c2026]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#262a31]">
                {['Material', 'Categoria', 'Estoque', 'Mínimo', 'Status', 'Validade', ''].map((h) => (
                  <th key={h} className={`px-5 py-3 text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider ${h === '' ? 'w-24' : h === 'Estoque' || h === 'Mínimo' ? 'text-center' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3e4949]/20">
              {materials.map((mat) => {
                const isCritical = mat.status === 'critical' || mat.status === 'out_of_stock'
                return (
                  <tr key={mat.id} className={`hover:bg-[#262a31]/50 transition-colors ${isCritical ? 'bg-[#93000a]/10' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-[#dfe2eb]">{mat.name}</p>
                      {mat.supplier && <p className="text-xs text-[#bec9c9]">{mat.supplier}</p>}
                    </td>
                    <td className="px-5 py-3 text-[#bec9c9] capitalize text-xs">{mat.category}</td>
                    <td className="px-5 py-3 text-center font-technical font-bold text-[#dfe2eb]">
                      {mat.currentStock} <span className="text-[#bec9c9] font-normal text-xs">{mat.unit}</span>
                    </td>
                    <td className="px-5 py-3 text-center font-technical text-[#bec9c9] text-sm">
                      {mat.minimumStock} <span className="text-xs">{mat.unit}</span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge type="stock_status" value={mat.status} pulse={isCritical} />
                    </td>
                    <td className="px-5 py-3 font-technical text-xs text-[#bec9c9]">
                      {mat.expiresAt ? formatDate(mat.expiresAt) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openMovement(mat, 'in')}
                          className="p-1.5 rounded-lg bg-[#31353c] text-[#4ade80]/70 hover:text-[#4ade80] hover:bg-[#4ade80]/10 transition-all"
                          aria-label="Entrada"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_downward</span>
                        </button>
                        <button
                          onClick={() => openMovement(mat, 'out')}
                          className="p-1.5 rounded-lg bg-[#31353c] text-[#ffb4ab]/70 hover:text-[#ffb4ab] hover:bg-[#ffb4ab]/10 transition-all"
                          aria-label="Saída"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_upward</span>
                        </button>
                        {mat.supplierContact && (
                          <button
                            onClick={() => generateWhatsApp(mat)}
                            className="p-1.5 rounded-lg bg-[#31353c] text-[#4ade80]/70 hover:text-[#4ade80] hover:bg-[#4ade80]/10 transition-all"
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
      <DialogContent className="max-w-sm bg-[#1c2026] border-[#3e4949]/20">
        <DialogHeader>
          <DialogTitle className="text-[#dfe2eb] font-bold">
            {type === 'in' ? 'Registrar Entrada' : 'Registrar Saída'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm font-medium text-[#dfe2eb]">{material.name}</p>
          <p className="text-sm text-[#bec9c9]">
            Estoque atual: <span className="font-technical font-bold text-[#dfe2eb]">{material.currentStock} {material.unit}</span>
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
          <button onClick={() => onOpenChange(false)} disabled={loading} className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#bec9c9] bg-[#31353c] hover:bg-[#262a31] transition-colors">
            Cancelar
          </button>
          <button onClick={submit} disabled={loading} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#006e72] to-[#61d8dd] text-[#003739] hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? 'Salvando...' : 'Confirmar'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
