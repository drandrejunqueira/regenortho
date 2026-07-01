'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useMaterialCategories } from '@/components/materiais/shared'
import type { MaterialCategory } from '@/types'

const inputCls =
  'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/40 focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)]'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'

export default function CategoriasPage() {
  const { tree, loading, reload } = useMaterialCategories()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MaterialCategory | null>(null)
  const [parentId, setParentId] = useState<string | null>(null)
  const [parentName, setParentName] = useState<string>('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function openCreateRoot() {
    setEditing(null)
    setParentId(null)
    setParentName('')
    setName('')
    setDialogOpen(true)
  }

  function openCreateSub(parent: MaterialCategory) {
    setEditing(null)
    setParentId(parent.id)
    setParentName(parent.name)
    setName('')
    setDialogOpen(true)
  }

  function openEdit(cat: MaterialCategory, parent?: MaterialCategory) {
    setEditing(cat)
    setParentId(cat.parentId)
    setParentName(parent?.name ?? '')
    setName(cat.name)
    setDialogOpen(true)
  }

  async function save() {
    if (!name.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    setSubmitting(true)
    try {
      const url = editing ? `/api/materiais/categorias/${editing.id}` : '/api/materiais/categorias'
      const method = editing ? 'PATCH' : 'POST'
      const body = editing ? { name: name.trim() } : { name: name.trim(), parentId }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success(editing ? 'Categoria atualizada!' : 'Categoria criada!')
        setDialogOpen(false)
        reload()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Erro ao salvar')
      }
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(cat: MaterialCategory) {
    const res = await fetch(`/api/materiais/categorias/${cat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !cat.isActive }),
    })
    if (res.ok) reload()
    else toast.error('Erro ao alterar status')
  }

  async function remove(cat: MaterialCategory, isRoot: boolean) {
    const msg = isRoot
      ? `Excluir a categoria "${cat.name}"? Suas subcategorias também serão removidas e os materiais ficarão sem categoria.`
      : `Excluir a subcategoria "${cat.name}"?`
    if (!confirm(msg)) return
    const res = await fetch(`/api/materiais/categorias/${cat.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Categoria excluída')
      reload()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Erro ao excluir')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Categorias de Materiais"
        description="Organize os materiais em categorias e subcategorias (ex: EPI → Óculos)"
        action={
          <button
            onClick={openCreateRoot}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#021541] text-white text-sm font-bold hover:bg-[#032170] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              add
            </span>
            Nova Categoria
          </button>
        }
      />

      {loading ? (
        <p className="text-sm text-[#718096] py-8 text-center">Carregando...</p>
      ) : tree.length === 0 ? (
        <div className="bg-white border border-[rgba(2,21,65,0.06)] rounded-xl p-8 text-center text-[#718096] space-y-2">
          <span className="material-symbols-outlined text-[rgba(2,21,65,0.15)] text-5xl">category</span>
          <p className="text-sm font-bold text-[#021541]">Nenhuma categoria cadastrada</p>
          <p className="text-xs max-w-sm mx-auto">
            Crie categorias para organizar seu estoque e filtrar os materiais por tipo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tree.map((cat) => (
            <div
              key={cat.id}
              className={`bg-white border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] rounded-xl p-4 space-y-3 ${!cat.isActive ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-[#00BCE4]"
                    style={{ fontSize: '20px' }}
                  >
                    folder
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-[#021541]">{cat.name}</h3>
                    <p className="text-[10px] text-[#718096]">
                      {cat.children?.length ?? 0}{' '}
                      {(cat.children?.length ?? 0) === 1 ? 'subcategoria' : 'subcategorias'}
                      {!cat.isActive && <span className="text-[#d97706] font-semibold"> · inativa</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <IconBtn icon="add" title="Nova subcategoria" onClick={() => openCreateSub(cat)} />
                  <IconBtn icon="edit" title="Renomear" onClick={() => openEdit(cat)} />
                  <IconBtn
                    icon={cat.isActive ? 'toggle_off' : 'toggle_on'}
                    title={cat.isActive ? 'Inativar' : 'Reativar'}
                    onClick={() => toggleActive(cat)}
                  />
                  <IconBtn icon="delete" title="Excluir" danger onClick={() => remove(cat, true)} />
                </div>
              </div>

              {cat.children && cat.children.length > 0 && (
                <div className="space-y-1 pl-2 border-l-2 border-[rgba(0,188,228,0.2)]">
                  {cat.children.map((sub) => (
                    <div
                      key={sub.id}
                      className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[rgba(2,21,65,0.02)] ${!sub.isActive ? 'opacity-60' : ''}`}
                    >
                      <span className="text-xs font-medium text-[#021541] flex items-center gap-1.5">
                        <span
                          className="material-symbols-outlined text-[#a0aec0]"
                          style={{ fontSize: '15px' }}
                        >
                          subdirectory_arrow_right
                        </span>
                        {sub.name}
                        {!sub.isActive && (
                          <span className="text-[9px] text-[#d97706] font-semibold">inativa</span>
                        )}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <IconBtn
                          icon="edit"
                          title="Renomear"
                          small
                          onClick={() => openEdit(sub, cat)}
                        />
                        <IconBtn
                          icon={sub.isActive ? 'toggle_off' : 'toggle_on'}
                          title={sub.isActive ? 'Inativar' : 'Reativar'}
                          small
                          onClick={() => toggleActive(sub)}
                        />
                        <IconBtn
                          icon="delete"
                          title="Excluir"
                          small
                          danger
                          onClick={() => remove(sub, false)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm bg-white border border-[rgba(2,21,65,0.06)]">
          <DialogHeader>
            <DialogTitle className="text-[#021541] font-bold">
              {editing
                ? 'Renomear'
                : parentId
                  ? `Nova subcategoria em "${parentName}"`
                  : 'Nova Categoria'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className={labelCls}>Nome *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                placeholder={parentId ? 'Ex: Óculos, Luvas...' : 'Ex: EPI, Descartáveis...'}
                className={inputCls}
                maxLength={120}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] border border-[rgba(2,21,65,0.08)] hover:bg-[rgba(2,21,65,0.04)] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={submitting}
              className="px-4 py-2 rounded-full text-sm font-bold bg-[#021541] text-white hover:bg-[#032170] transition-colors disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Salvar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function IconBtn({
  icon,
  title,
  onClick,
  danger,
  small,
}: {
  icon: string
  title: string
  onClick: () => void
  danger?: boolean
  small?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`rounded-lg transition-all ${small ? 'p-1' : 'p-1.5'} ${
        danger
          ? 'text-[#718096] hover:text-[#DC2626] hover:bg-[rgba(220,38,38,0.08)]'
          : 'text-[#718096] hover:text-[#00BCE4] hover:bg-[#f5f6f8]'
      }`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: small ? '15px' : '18px' }}>
        {icon}
      </span>
    </button>
  )
}
