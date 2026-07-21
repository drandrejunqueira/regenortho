'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'
import { formatDate, formatCurrency } from '@/lib/utils'
import { EditMaterialDialog } from '@/components/materiais/EditMaterialDialog'
import { SuggestedPurchaseListDrawer } from '@/components/materiais/SuggestedPurchaseListDrawer'
import { useMaterialCategories } from '@/components/materiais/shared'
import type { Material, PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, UserRole } from '@/types'

const inputCls =
  'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/60 focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'

const STATUS_CONFIG: Record<PurchaseOrderStatus, { label: string; color: string; bg: string }> = {
  draft: { label: 'Rascunho', color: '#718096', bg: 'rgba(113,128,150,0.10)' },
  ordered: { label: 'Pedido', color: '#d97706', bg: 'rgba(217,119,6,0.10)' },
  received: { label: 'Recebido', color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  cancelled: { label: 'Cancelado', color: '#dc2626', bg: 'rgba(220,38,38,0.10)' },
}

// ─────────────────────────────────────────────────────────────
export default function MateriaisPage() {
  const [tab, setTab] = useState<'estoque' | 'compras'>('estoque')
  const [materials, setMaterials] = useState<Material[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)

  // dialogs
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [movDialog, setMovDialog] = useState(false)
  const [movType, setMovType] = useState<'in' | 'out'>('in')
  const [orderDrawer, setOrderDrawer] = useState(false)
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null)
  const [receiveDialog, setReceiveDialog] = useState<PurchaseOrder | null>(null)
  const [cancelDialog, setCancelDialog] = useState<PurchaseOrder | null>(null)
  const [materialDialog, setMaterialDialog] = useState(false)
  const [suggestedListOpen, setSuggestedListOpen] = useState(false)
  const [onMaterialCreatedCallback, setOnMaterialCreatedCallback] = useState<
    ((m: Material) => void) | null
  >(null)

  // edição / filtros de estoque
  const [editMaterial, setEditMaterial] = useState<Material | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showInactive, setShowInactive] = useState(false)

  const { data: session } = useSession()
  const role = session?.user?.role as UserRole | undefined
  const canDelete = role ? hasPermission(role, 'materials:delete') : false
  const { roots: categoryRoots } = useMaterialCategories()

  async function toggleMaterialActive(mat: Material) {
    const res = await fetch(`/api/materiais/${mat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !mat.isActive }),
    })
    if (res.ok) {
      toast.success(mat.isActive ? 'Material inativado' : 'Material reativado')
      fetchMaterials()
    } else {
      toast.error('Não foi possível alterar o status')
    }
  }

  async function deleteMaterialRow(mat: Material) {
    if (!confirm(`Excluir permanentemente "${mat.name}"?`)) return
    const res = await fetch(`/api/materiais/${mat.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Material excluído')
      fetchMaterials()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Erro ao excluir. Considere inativar.')
    }
  }

  const fetchMaterials = useCallback(async () => {
    const res = await fetch('/api/materiais')
    if (res.ok) {
      const { data } = await res.json()
      setMaterials(data)
    }
  }, [])

  const fetchOrders = useCallback(async () => {
    const res = await fetch('/api/compras')
    if (res.ok) {
      const { data } = await res.json()
      setOrders(data)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchMaterials(), fetchOrders()])
    setLoading(false)
  }, [fetchMaterials, fetchOrders])

  useEffect(() => {
    load()
  }, [load])

  const critical = materials.filter(
    (m) => m.status === 'critical' || m.status === 'out_of_stock'
  ).length
  const low = materials.filter((m) => m.status === 'low').length
  const inactiveCount = materials.filter((m) => !m.isActive).length
  const restockCount = materials.filter((m) => m.isActive && m.status !== 'ok').length

  const visibleMaterials = materials.filter(
    (m) =>
      (showInactive || m.isActive) &&
      (categoryFilter === 'all' || m.categoryId === categoryFilter)
  )

  function openMovement(material: Material, type: 'in' | 'out') {
    setSelectedMaterial(material)
    setMovType(type)
    setMovDialog(true)
  }

  function generateWhatsApp(material: Material) {
    if (!material.supplierContact) return
    const qty = material.minimumStock * 2 - material.currentStock
    const msg = encodeURIComponent(
      `Olá! Preciso repor "${material.name}".\nQuantidade: ${qty} ${material.unit}.\nConfirmar disponibilidade e prazo.`
    )
    window.open(
      `https://wa.me/55${material.supplierContact.replace(/\D/g, '')}?text=${msg}`,
      '_blank'
    )
  }

  async function handleSend(order: PurchaseOrder) {
    const res = await fetch(`/api/compras/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send' }),
    })
    if (res.ok) {
      toast.success('Pedido enviado!')
      fetchOrders()
    } else toast.error('Erro ao enviar pedido')
  }

  async function handleReceive(order: PurchaseOrder) {
    const res = await fetch(`/api/compras/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'receive' }),
    })
    if (res.ok) {
      toast.success('Recebimento registrado! Estoque e despesa atualizados.')
      setReceiveDialog(null)
      load()
    } else {
      const { error } = await res.json()
      toast.error(error ?? 'Erro ao registrar recebimento')
    }
  }

  async function handleCancel(order: PurchaseOrder) {
    const res = await fetch(`/api/compras/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    if (res.ok) {
      toast.success('Pedido cancelado.')
      setCancelDialog(null)
      fetchOrders()
    } else toast.error('Erro ao cancelar pedido')
  }

  async function handleDelete(order: PurchaseOrder) {
    const res = await fetch(`/api/compras/${order.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Rascunho excluído.')
      fetchOrders()
    } else toast.error('Erro ao excluir')
  }

  const pendingOrders = orders.filter((o) => o.status === 'ordered').length
  const totalSpentThisMonth = orders
    .filter(
      (o) =>
        o.status === 'received' && o.receivedDate?.startsWith(new Date().toISOString().slice(0, 7))
    )
    .reduce((s, o) => s + parseFloat(o.totalAmount), 0)

  return (
    <div className="print:hidden">
      <PageHeader
        title="Controle de Materiais"
        description="Gerencie o estoque e as compras da clínica"
        action={
          tab === 'compras' ? (
            <button
              onClick={() => {
                setEditingOrder(null)
                setOrderDrawer(true)
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#021541] text-white hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                add
              </span>
              Nova Compra
            </button>
          ) : (
            <button
              onClick={() => {
                setOnMaterialCreatedCallback(null)
                setMaterialDialog(true)
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#021541] text-white hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                add
              </span>
              Novo Material
            </button>
          )
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[rgba(2,21,65,0.04)] rounded-xl w-fit mb-6">
        {(['estoque', 'compras'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t
                ? 'bg-white text-[#021541] shadow-sm'
                : 'text-[#718096] hover:text-[#021541]'
            }`}
          >
            {t === 'estoque' ? 'Estoque' : 'Compras'}
            {t === 'compras' && pendingOrders > 0 && (
              <span className="ml-2 text-[10px] bg-[#d97706] text-white rounded-full px-1.5 py-0.5">
                {pendingOrders}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ESTOQUE ── */}
      {tab === 'estoque' && (
        <>
          {critical > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.2)] rounded-xl text-sm text-[#DC2626] font-medium mb-4">
              <span
                className="material-symbols-outlined shrink-0"
                style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}
              >
                warning
              </span>
              {critical} {critical === 1 ? 'item' : 'itens'} com estoque crítico — ação necessária!
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KpiCard
              title="Total de itens"
              value={materials.length}
              accent="teal"
              icon="inventory_2"
            />
            <KpiCard title="Críticos" value={critical} accent="error" icon="warning" />
            <KpiCard title="Estoque baixo" value={low} accent="gold" icon="trending_down" />
            <KpiCard
              title="Normais"
              value={materials.filter((m) => m.status === 'ok').length}
              accent="teal"
              icon="check_circle"
            />
          </div>

          {/* Filtros por categoria (abas internas) + inativos */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  categoryFilter === 'all'
                    ? 'bg-[#021541] text-white border-[#021541]'
                    : 'bg-white text-[#718096] border-[rgba(2,21,65,0.12)] hover:text-[#021541]'
                }`}
              >
                Todos ({materials.filter((m) => showInactive || m.isActive).length})
              </button>
              {categoryRoots.map((cat) => {
                const count = materials.filter(
                  (m) => m.categoryId === cat.id && (showInactive || m.isActive)
                ).length
                if (count === 0) return null
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                      categoryFilter === cat.id
                        ? 'bg-[#021541] text-white border-[#021541]'
                        : 'bg-white text-[#718096] border-[rgba(2,21,65,0.12)] hover:text-[#021541]'
                    }`}
                  >
                    {cat.name} ({count})
                  </button>
                )
              })}
            </div>
            <label className="ml-auto flex items-center gap-2 text-xs font-medium text-[#718096] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="accent-[#00BCE4] w-3.5 h-3.5"
              />
              Mostrar inativos{inactiveCount > 0 ? ` (${inactiveCount})` : ''}
            </label>
          </div>

          {loading ? (
            <p className="text-sm text-[#718096] py-8 text-center">Carregando...</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[rgba(2,21,65,0.06)]">
              <table className="w-full text-sm bg-white">
                <thead>
                  <tr className="bg-[rgba(2,21,65,0.03)]">
                    {['Material', 'Categoria', 'Estoque', 'Mínimo', 'Status', 'Validade', ''].map(
                      (h) => (
                        <th
                          key={h}
                          className={`px-5 py-3 text-xs font-semibold text-[#021541] uppercase tracking-wider ${h === '' ? 'w-px whitespace-nowrap' : h === 'Estoque' || h === 'Mínimo' ? 'text-center' : 'text-left'} ${h === 'Categoria' || h === 'Validade' ? 'hidden sm:table-cell' : ''}`}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleMaterials.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-sm text-[#718096]">
                        Nenhum material nesta categoria.
                      </td>
                    </tr>
                  )}
                  {visibleMaterials.map((mat) => {
                    const isCritical = mat.status === 'critical' || mat.status === 'out_of_stock'
                    const batchExpiries = (mat.batches ?? [])
                      .map((b) => b.expiresAt)
                      .filter((d): d is string => !!d)
                      .sort()
                    const nextExpiry = batchExpiries[0] ?? mat.expiresAt
                    return (
                      <tr
                        key={mat.id}
                        onClick={() => setEditMaterial(mat)}
                        className={`border-b border-[rgba(2,21,65,0.05)] transition-colors cursor-pointer ${!mat.isActive ? 'opacity-50' : ''} ${isCritical ? 'bg-[rgba(239,68,68,0.02)] hover:bg-[rgba(239,68,68,0.04)]' : 'hover:bg-[rgba(2,21,65,0.015)]'}`}
                      >
                        <td className="px-5 py-3">
                          <p className="font-medium text-[#021541] flex items-center gap-1.5">
                            {mat.name}
                            {!mat.isActive && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[rgba(113,128,150,0.15)] text-[#718096]">
                                INATIVO
                              </span>
                            )}
                          </p>
                          {mat.supplier && <p className="text-xs text-[#718096]">{mat.supplier}</p>}
                        </td>
                        <td className="px-5 py-3 text-[#718096] text-xs hidden sm:table-cell">
                          <span className="capitalize">{mat.categoryName ?? mat.category}</span>
                          {mat.subcategoryName && (
                            <span className="text-[#a0aec0]"> · {mat.subcategoryName}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center font-technical font-bold text-[#021541]">
                          {mat.currentStock}{' '}
                          <span className="text-[#718096] font-normal text-xs">{mat.unit}</span>
                        </td>
                        <td className="px-5 py-3 text-center font-technical text-[#718096] text-sm">
                          {mat.minimumStock} <span className="text-xs">{mat.unit}</span>
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge type="stock_status" value={mat.status} pulse={isCritical} />
                        </td>
                        <td className="px-5 py-3 font-technical text-xs text-[#718096] hidden sm:table-cell">
                          {nextExpiry ? formatDate(nextExpiry) : '—'}
                          {(mat.batches?.length ?? 0) > 1 && (
                            <span className="text-[#a0aec0]"> +{(mat.batches?.length ?? 0) - 1}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 flex-nowrap">
                            <button
                              onClick={() => openMovement(mat, 'in')}
                              className="p-1.5 rounded-lg bg-[rgba(5,150,105,0.06)] text-[#059669] hover:bg-[rgba(5,150,105,0.12)] transition-all"
                              aria-label="Entrada"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                arrow_downward
                              </span>
                            </button>
                            <button
                              onClick={() => openMovement(mat, 'out')}
                              className="p-1.5 rounded-lg bg-[rgba(220,38,38,0.06)] text-[#DC2626] hover:bg-[rgba(220,38,38,0.12)] transition-all"
                              aria-label="Saída"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                arrow_upward
                              </span>
                            </button>
                            <button
                              onClick={() => setEditMaterial(mat)}
                              className="p-1.5 rounded-lg bg-[rgba(2,21,65,0.05)] text-[#021541] hover:bg-[rgba(2,21,65,0.1)] transition-all"
                              aria-label="Editar"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                edit
                              </span>
                            </button>
                            <button
                              onClick={() => toggleMaterialActive(mat)}
                              className={`p-1.5 rounded-lg transition-all ${mat.isActive ? 'bg-[rgba(217,119,6,0.07)] text-[#d97706] hover:bg-[rgba(217,119,6,0.14)]' : 'bg-[rgba(5,150,105,0.07)] text-[#059669] hover:bg-[rgba(5,150,105,0.14)]'}`}
                              aria-label={mat.isActive ? 'Inativar' : 'Reativar'}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                {mat.isActive ? 'toggle_off' : 'toggle_on'}
                              </span>
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => deleteMaterialRow(mat)}
                                className="p-1.5 rounded-lg bg-[rgba(220,38,38,0.06)] text-[#DC2626] hover:bg-[rgba(220,38,38,0.12)] transition-all"
                                aria-label="Excluir"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                  delete
                                </span>
                              </button>
                            )}
                            {mat.supplierContact && (
                              <button
                                onClick={() => generateWhatsApp(mat)}
                                className="p-1.5 rounded-lg bg-[rgba(0,188,228,0.06)] text-[#00BCE4] hover:bg-[rgba(0,188,228,0.12)] transition-all"
                                aria-label="WhatsApp"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                  chat
                                </span>
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
        </>
      )}

      {/* ── COMPRAS ── */}
      {tab === 'compras' && (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 bg-[rgba(0,188,228,0.06)] border border-[rgba(0,188,228,0.25)] rounded-xl mb-4">
            <div className="flex items-center gap-2.5 text-sm text-[#021541]">
              <span
                className="material-symbols-outlined text-[#00BCE4] shrink-0"
                style={{ fontSize: '20px' }}
              >
                checklist
              </span>
              {restockCount > 0 ? (
                <span>
                  <strong>{restockCount}</strong>{' '}
                  {restockCount === 1
                    ? 'item está no estoque mínimo ou abaixo'
                    : 'itens estão no estoque mínimo ou abaixo'}{' '}
                  — confira a lista de compras sugerida.
                </span>
              ) : (
                <span>Nenhum item precisa de reposição no momento.</span>
              )}
            </div>
            <button
              onClick={() => setSuggestedListOpen(true)}
              className="px-3.5 py-2 rounded-lg text-xs font-bold bg-[#00BCE4] text-white hover:opacity-90 transition-opacity shrink-0"
            >
              Ver Lista de Compras Sugerida
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KpiCard
              title="Total de pedidos"
              value={orders.length}
              accent="teal"
              icon="shopping_cart"
            />
            <KpiCard
              title="Aguardando entrega"
              value={pendingOrders}
              accent="gold"
              icon="local_shipping"
            />
            <KpiCard
              title="Recebidos no mês"
              value={
                orders.filter(
                  (o) =>
                    o.status === 'received' &&
                    o.receivedDate?.startsWith(new Date().toISOString().slice(0, 7))
                ).length
              }
              accent="teal"
              icon="check_circle"
            />
            <KpiCard
              title="Gasto no mês"
              value={formatCurrency(totalSpentThisMonth)}
              accent="error"
              icon="payments"
            />
          </div>

          {loading ? (
            <p className="text-sm text-[#718096] py-8 text-center">Carregando...</p>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 text-[#718096]">
              <span
                className="material-symbols-outlined mb-3 block"
                style={{ fontSize: '48px', opacity: 0.3 }}
              >
                shopping_cart
              </span>
              <p className="font-medium">Nenhuma compra registrada</p>
              <p className="text-sm mt-1">Clique em "Nova Compra" para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const cfg = STATUS_CONFIG[order.status]
                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-xl border border-[rgba(2,21,65,0.07)] shadow-[0_2px_8px_rgba(2,21,65,0.04)] p-5"
                  >
                    <div className="flex items-start gap-3 flex-wrap">
                      {/* Left */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-[#021541]">{order.supplier}</span>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: cfg.bg, color: cfg.color }}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#718096]">
                          <span>
                            Pedido:{' '}
                            <span className="font-technical text-[#021541]">
                              {formatDate(order.orderDate)}
                            </span>
                          </span>
                          {order.expectedDate && (
                            <span>
                              Previsão:{' '}
                              <span className="font-technical text-[#021541]">
                                {formatDate(order.expectedDate)}
                              </span>
                            </span>
                          )}
                          {order.receivedDate && (
                            <span>
                              Recebido:{' '}
                              <span className="font-technical text-[#059669] font-semibold">
                                {formatDate(order.receivedDate)}
                              </span>
                            </span>
                          )}
                          <span>
                            {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                          </span>
                        </div>

                        {/* Items summary */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {order.items.map((item) => (
                            <span
                              key={item.id}
                              className="text-[10px] bg-[rgba(2,21,65,0.04)] text-[#021541]/70 px-2 py-0.5 rounded-full border border-[rgba(2,21,65,0.06)]"
                            >
                              {item.material?.name} × {item.quantity} {item.material?.unit}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Right — valor + ações */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="font-technical font-bold text-lg text-[#021541]">
                          {formatCurrency(parseFloat(order.totalAmount))}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {order.status === 'draft' && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingOrder(order)
                                  setOrderDrawer(true)
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[rgba(2,21,65,0.06)] text-[#021541] hover:bg-[rgba(2,21,65,0.10)] transition-all"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleSend(order)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(217,119,6,0.10)] text-[#d97706] hover:bg-[rgba(217,119,6,0.18)] transition-all"
                              >
                                Enviar Pedido
                              </button>
                              <button
                                onClick={() => handleDelete(order)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[rgba(220,38,38,0.06)] text-[#dc2626] hover:bg-[rgba(220,38,38,0.12)] transition-all"
                              >
                                Excluir
                              </button>
                            </>
                          )}
                          {order.status === 'ordered' && (
                            <>
                              <button
                                onClick={() => setReceiveDialog(order)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(5,150,105,0.10)] text-[#059669] hover:bg-[rgba(5,150,105,0.18)] transition-all"
                              >
                                Registrar Recebimento
                              </button>
                              <button
                                onClick={() => setCancelDialog(order)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[rgba(220,38,38,0.06)] text-[#dc2626] hover:bg-[rgba(220,38,38,0.12)] transition-all"
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {order.notes && (
                      <p className="text-xs text-[#718096] mt-3 pt-3 border-t border-[rgba(2,21,65,0.05)]">
                        {order.notes}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Dialogs / Drawers ── */}
      <MovimentacaoDialog
        open={movDialog}
        material={selectedMaterial}
        type={movType}
        onOpenChange={setMovDialog}
        onCreated={fetchMaterials}
      />

      <OrderDrawer
        open={orderDrawer}
        order={editingOrder}
        materials={materials}
        onOpenChange={(v) => {
          setOrderDrawer(v)
          if (!v) setEditingOrder(null)
        }}
        onSaved={() => {
          fetchOrders()
          setOrderDrawer(false)
          setEditingOrder(null)
        }}
        onRegisterMaterial={(callback) => {
          setOnMaterialCreatedCallback(() => callback)
          setMaterialDialog(true)
        }}
      />

      <MaterialFormDialog
        open={materialDialog}
        onOpenChange={setMaterialDialog}
        onSaved={async (newMat) => {
          await fetchMaterials()
          if (onMaterialCreatedCallback) {
            onMaterialCreatedCallback(newMat)
          }
        }}
      />

      <EditMaterialDialog
        open={!!editMaterial}
        material={editMaterial}
        canDelete={canDelete}
        onOpenChange={(v) => {
          if (!v) setEditMaterial(null)
        }}
        onSaved={fetchMaterials}
      />

      <SuggestedPurchaseListDrawer
        open={suggestedListOpen}
        materials={materials}
        onOpenChange={setSuggestedListOpen}
      />

      {/* Confirmar recebimento */}
      <Dialog
        open={!!receiveDialog}
        onOpenChange={(v) => {
          if (!v) setReceiveDialog(null)
        }}
      >
        <DialogContent className="max-w-md bg-white border border-[rgba(2,21,65,0.08)]">
          <DialogHeader>
            <DialogTitle className="text-[#021541] font-bold">Confirmar Recebimento</DialogTitle>
          </DialogHeader>
          {receiveDialog && (
            <div className="space-y-3 text-sm text-[#021541]">
              <p>Ao confirmar, o sistema irá:</p>
              <ul className="space-y-1.5 text-sm">
                {receiveDialog.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <span
                      className="material-symbols-outlined text-[#059669]"
                      style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}
                    >
                      add_circle
                    </span>
                    <span>
                      Entrada de{' '}
                      <strong>
                        {item.quantity} {item.material?.unit}
                      </strong>{' '}
                      de <strong>{item.material?.name}</strong>
                    </span>
                  </li>
                ))}
                <li className="flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-[#dc2626]"
                    style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}
                  >
                    payments
                  </span>
                  <span>
                    Despesa de{' '}
                    <strong>{formatCurrency(parseFloat(receiveDialog.totalAmount))}</strong> lançada
                    no financeiro
                  </span>
                </li>
              </ul>
            </div>
          )}
          <DialogFooter className="gap-2">
            <button
              onClick={() => setReceiveDialog(null)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] hover:bg-[rgba(2,21,65,0.06)] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => receiveDialog && handleReceive(receiveDialog)}
              className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#059669] text-white hover:opacity-90 transition-opacity"
            >
              Confirmar Recebimento
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar cancelamento */}
      <Dialog
        open={!!cancelDialog}
        onOpenChange={(v) => {
          if (!v) setCancelDialog(null)
        }}
      >
        <DialogContent className="max-w-sm bg-white border border-[rgba(2,21,65,0.08)]">
          <DialogHeader>
            <DialogTitle className="text-[#021541] font-bold">Cancelar Pedido?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#718096]">
            Esta ação não pode ser desfeita. O pedido de{' '}
            <strong className="text-[#021541]">{cancelDialog?.supplier}</strong> será marcado como
            cancelado.
          </p>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setCancelDialog(null)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] hover:bg-[rgba(2,21,65,0.06)] transition-colors"
            >
              Voltar
            </button>
            <button
              onClick={() => cancelDialog && handleCancel(cancelDialog)}
              className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#dc2626] text-white hover:opacity-90 transition-opacity"
            >
              Cancelar Pedido
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Movimentação manual de estoque
// ─────────────────────────────────────────────────────────────
function MovimentacaoDialog({
  open,
  material,
  type,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  material: Material | null
  type: 'in' | 'out'
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  if (!material) return null

  async function submit() {
    if (!quantity || parseInt(quantity) <= 0) {
      toast.error('Informe uma quantidade válida')
      return
    }
    if (!material) return
    setLoading(true)
    try {
      const res = await fetch(`/api/materiais/${material.id}/movement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, quantity: parseInt(quantity), reason }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao registrar')
        return
      }
      toast.success(type === 'in' ? 'Entrada registrada!' : 'Saída registrada!')
      setQuantity('')
      setReason('')
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
            Estoque atual:{' '}
            <span className="font-technical font-bold text-[#021541]">
              {material.currentStock} {material.unit}
            </span>
          </p>
          <div className="space-y-1.5">
            <label className={labelCls}>Quantidade *</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={inputCls}
            />
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
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] hover:bg-[rgba(2,21,65,0.06)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#021541] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Confirmar'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────
// Drawer de criar / editar pedido de compra
// ─────────────────────────────────────────────────────────────
interface DraftItem {
  materialId: string
  quantity: number
  unitCost: number
  notes: string
}

function OrderDrawer({
  open,
  order,
  materials,
  onOpenChange,
  onSaved,
  onRegisterMaterial,
}: {
  open: boolean
  order: PurchaseOrder | null
  materials: Material[]
  onOpenChange: (v: boolean) => void
  onSaved: () => void
  onRegisterMaterial: (callback: (m: Material) => void) => void
}) {
  const [supplier, setSupplier] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([
    { materialId: '', quantity: 1, unitCost: 0, notes: '' },
  ])
  const [saving, setSaving] = useState(false)

  // populate when editing
  useEffect(() => {
    if (order) {
      setSupplier(order.supplier)
      setOrderDate(order.orderDate)
      setExpectedDate(order.expectedDate ?? '')
      setNotes(order.notes ?? '')
      setItems(
        order.items.map((i) => ({
          materialId: i.materialId,
          quantity: i.quantity,
          unitCost: parseFloat(i.unitCost),
          notes: i.notes ?? '',
        }))
      )
    } else {
      setSupplier('')
      setOrderDate(new Date().toISOString().slice(0, 10))
      setExpectedDate('')
      setNotes('')
      setItems([{ materialId: '', quantity: 1, unitCost: 0, notes: '' }])
    }
  }, [order, open])

  function setItem(idx: number, patch: Partial<DraftItem>) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item
        const updated = { ...item, ...patch }
        // auto-fill unitCost when material selected
        if (patch.materialId) {
          const mat = materials.find((m) => m.id === patch.materialId)
          if (mat?.unitCost) updated.unitCost = parseFloat(mat.unitCost)
        }
        return updated
      })
    )
  }

  function addItem() {
    setItems((p) => [...p, { materialId: '', quantity: 1, unitCost: 0, notes: '' }])
  }
  function removeItem(idx: number) {
    setItems((p) => p.filter((_, i) => i !== idx))
  }

  const total = items.reduce((s, i) => s + i.quantity * i.unitCost, 0)

  async function save() {
    if (!supplier.trim()) {
      toast.error('Informe o fornecedor')
      return
    }
    if (items.some((i) => !i.materialId)) {
      toast.error('Selecione o material em todos os itens')
      return
    }
    if (items.some((i) => i.quantity <= 0)) {
      toast.error('Quantidade deve ser maior que zero')
      return
    }

    setSaving(true)
    try {
      const payload = {
        supplier,
        orderDate,
        expectedDate: expectedDate || null,
        notes: notes || null,
        items: items.map((i) => ({
          materialId: i.materialId,
          quantity: i.quantity,
          unitCost: i.unitCost,
          notes: i.notes || undefined,
        })),
      }

      let res: Response
      if (order) {
        res = await fetch(`/api/compras/${order.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', ...payload }),
        })
      } else {
        res = await fetch('/api/compras', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        toast.success(order ? 'Pedido atualizado!' : 'Pedido criado!')
        onSaved()
      } else {
        const { error } = await res.json()
        toast.error(typeof error === 'string' ? error : 'Erro ao salvar')
      }
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={() => onOpenChange(false)}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(2,21,65,0.08)]">
          <div>
            <h2 className="text-base font-bold text-[#021541]">
              {order ? 'Editar Pedido' : 'Nova Compra'}
            </h2>
            <p className="text-xs text-[#718096] mt-0.5">
              {order
                ? `Rascunho — ${order.supplier}`
                : 'Crie um pedido de compra ou registre uma compra já feita'}
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-lg hover:bg-[rgba(2,21,65,0.06)] transition-colors"
          >
            <span className="material-symbols-outlined text-[#718096]" style={{ fontSize: '20px' }}>
              close
            </span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Fornecedor + datas */}
          <div className="space-y-1.5">
            <label className={labelCls}>Fornecedor *</label>
            <input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Nome do fornecedor"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Data do pedido *</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Previsão de entrega</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Notas sobre o pedido..."
              className={inputCls}
              style={{ resize: 'none' }}
            />
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className={labelCls}>Itens *</span>
              <button
                onClick={addItem}
                className="flex items-center gap-1 text-xs font-semibold text-[#00BCE4] hover:text-[#021541] transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                  add
                </span>
                Adicionar item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const mat = materials.find((m) => m.id === item.materialId)
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[rgba(2,21,65,0.02)] border border-[rgba(2,21,65,0.07)]"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        {/* Material select */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className={labelCls}>Material</label>
                            <button
                              type="button"
                              onClick={() =>
                                onRegisterMaterial((newMat) => {
                                  setItem(idx, { materialId: newMat.id })
                                })
                              }
                              className="text-[10px] font-bold text-[#00BCE4] hover:opacity-80 transition-opacity flex items-center gap-0.5"
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: '12px' }}
                              >
                                add
                              </span>
                              Cadastrar Novo
                            </button>
                          </div>
                          <select
                            value={item.materialId}
                            onChange={(e) => setItem(idx, { materialId: e.target.value })}
                            className={inputCls}
                          >
                            <option value="">Selecionar material...</option>
                            {materials.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.unit})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className={labelCls}>
                              Quantidade {mat ? `(${mat.unit})` : ''}
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                setItem(idx, {
                                  quantity: Math.max(1, parseInt(e.target.value) || 1),
                                })
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
                                setItem(idx, { unitCost: parseFloat(e.target.value) || 0 })
                              }
                              className={inputCls}
                            />
                          </div>
                        </div>

                        {item.materialId && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#718096]">Subtotal:</span>
                            <span className="font-technical font-bold text-[#021541]">
                              {formatCurrency(item.quantity * item.unitCost)}
                            </span>
                          </div>
                        )}
                      </div>

                      {items.length > 1 && (
                        <button
                          onClick={() => removeItem(idx)}
                          className="mt-6 p-1.5 rounded-lg bg-[rgba(220,38,38,0.06)] text-[#dc2626] hover:bg-[rgba(220,38,38,0.12)] transition-all shrink-0"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                            delete
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[rgba(2,21,65,0.08)] bg-[rgba(2,21,65,0.01)]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-[#718096] font-medium">Total do pedido:</span>
            <span className="font-technical font-bold text-xl text-[#021541]">
              {formatCurrency(total)}
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] hover:bg-[rgba(2,21,65,0.06)] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#021541] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Salvando...' : order ? 'Salvar Alterações' : 'Criar Pedido'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Cadastro de Novo Material
// ─────────────────────────────────────────────────────────────
function MaterialFormDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: (m: Material) => void
}) {
  const { roots, subcategoriesOf } = useMaterialCategories()
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [unit, setUnit] = useState('un')
  const [customUnit, setCustomUnit] = useState('')
  const [currentStock, setCurrentStock] = useState('0')
  const [minimumStock, setMinimumStock] = useState('5')
  const [unitCost, setUnitCost] = useState('')
  const [laboratory, setLaboratory] = useState('')
  const [supplier, setSupplier] = useState('')
  const [supplierContact, setSupplierContact] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  // Reset fields on open
  useEffect(() => {
    if (open) {
      setName('')
      setCategoryId('')
      setSubcategoryId('')
      setUnit('un')
      setCustomUnit('')
      setCurrentStock('0')
      setMinimumStock('5')
      setUnitCost('')
      setLaboratory('')
      setSupplier('')
      setSupplierContact('')
      setBatchNumber('')
      setExpiresAt('')
      setNotes('')
    }
  }, [open])

  async function submit() {
    if (!name.trim()) {
      toast.error('Nome do material é obrigatório')
      return
    }
    const finalUnit = unit === 'custom' ? customUnit.trim() : unit
    if (!finalUnit) {
      toast.error('Unidade de medida é obrigatória')
      return
    }

    setLoading(true)
    try {
      const payload = {
        name: name.trim(),
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        unit: finalUnit,
        currentStock: parseInt(currentStock) || 0,
        minimumStock: parseInt(minimumStock) || 0,
        unitCost: unitCost.trim() ? parseFloat(unitCost).toFixed(2) : null,
        laboratory: laboratory.trim() || null,
        supplier: supplier.trim() || null,
        supplierContact: supplierContact.trim() || null,
        batchNumber: batchNumber.trim() || null,
        expiresAt: expiresAt || null,
        notes: notes.trim() || null,
      }

      const res = await fetch('/api/materiais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao cadastrar material')
        return
      }
      toast.success('Material cadastrado com sucesso!')
      onOpenChange(false)
      onSaved(data.data)
    } catch {
      toast.error('Erro ao conectar ao servidor')
    } finally {
      setLoading(false)
    }
  }

  const units = ['un', 'ampola', 'seringa', 'agulha', 'pacote', 'frasco', 'par', 'caixa', 'custom']
  const subcats = subcategoriesOf(categoryId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border border-[rgba(2,21,65,0.08)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#021541] font-bold">Cadastrar Novo Material</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 my-2">
          <div className="space-y-1.5">
            <label className={labelCls}>Nome do Material *</label>
            <input
              placeholder="Ex: Luva de Procedimento Estéril"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
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
                <option value="">— Selecione —</option>
                {roots.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Unidade *</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u === 'custom' ? 'Outra...' : u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {unit === 'custom' && (
            <div className="space-y-1.5 animate-fadeIn">
              <label className={labelCls}>Especificar Unidade *</label>
              <input
                placeholder="Ex: par, rolo, litro"
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
                className={inputCls}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Estoque Inicial</label>
              <input
                type="number"
                min="0"
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Estoque Mínimo</label>
              <input
                type="number"
                min="0"
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Custo Unitário (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Laboratório</label>
              <input
                placeholder="Ex: Cristália, União Química..."
                value={laboratory}
                onChange={(e) => setLaboratory(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Fornecedor</label>
              <input
                placeholder="Nome do fornecedor"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Contato Fornecedor</label>
              <input
                placeholder="Ex: (11) 99999-9999"
                value={supplierContact}
                onChange={(e) => setSupplierContact(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Lote</label>
              <input
                placeholder="Número do lote"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Data de Validade</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Notas adicionais sobre o material..."
              className={inputCls}
              style={{ resize: 'none' }}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] hover:bg-[rgba(2,21,65,0.06)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#021541] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Cadastrar'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
