'use client'

// Vocabulário oficial de tags da clínica. Quem marca um lead escolhe daqui, em
// vez de digitar — é o que impede "Cirurgia", "cirurgia" e "cirurgía" de virarem
// três marcações diferentes no funil.
import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Tag {
  id: string
  name: string
  color: string
  isActive: boolean
}

const PRESET_COLORS = [
  '#00BCE4', '#e6c364', '#10b981', '#8b5cf6',
  '#f97316', '#ef4444', '#ec4899', '#3b82f6',
]

const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/40 focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)]'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Tag | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [submitting, setSubmitting] = useState(false)

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags')
      if (!res.ok) { toast.error('Erro ao carregar tags'); return }
      const { data } = await res.json()
      setTags(data ?? [])
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTags() }, [fetchTags])

  function openCreate() {
    setEditing(null)
    setName('')
    setColor(PRESET_COLORS[0])
    setDialogOpen(true)
  }

  function openEdit(tag: Tag) {
    setEditing(tag)
    setName(tag.name)
    setColor(tag.color)
    setDialogOpen(true)
  }

  async function submit() {
    const trimmed = name.trim()
    if (trimmed.length < 2) { toast.error('O nome precisa ter ao menos 2 caracteres'); return }

    setSubmitting(true)
    try {
      const res = await fetch(editing ? `/api/tags/${editing.id}` : '/api/tags', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, color }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar')
      toast.success(editing ? 'Tag atualizada! Os leads marcados foram renomeados junto.' : 'Tag criada!')
      setDialogOpen(false)
      fetchTags()
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(tag: Tag) {
    // Otimista: a lista responde na hora e o servidor confirma depois.
    setTags((prev) => prev.map((t) => (t.id === tag.id ? { ...t, isActive: !t.isActive } : t)))
    try {
      const res = await fetch(`/api/tags/${tag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !tag.isActive }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('Não foi possível alterar a tag')
      fetchTags()
    }
  }

  async function remove(tag: Tag) {
    if (!confirm(`Excluir a tag "${tag.name}"?`)) return
    try {
      const res = await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Erro ao excluir')
      toast.success('Tag excluída')
      fetchTags()
    } catch (e: unknown) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Tags"
        description="Vocabulário de marcação usado no CRM de Leads"
        action={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#021541] text-white text-sm font-bold hover:bg-[#032170] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Nova Tag
          </button>
        }
      />

      {loading ? (
        <p className="text-sm text-[#718096] py-8 text-center">Carregando...</p>
      ) : tags.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <span className="material-symbols-outlined text-[#718096]/40" style={{ fontSize: '40px' }}>sell</span>
          <p className="text-sm font-semibold text-[#021541]">Nenhuma tag cadastrada</p>
          <p className="text-xs text-[#718096] max-w-sm mx-auto">
            Crie tags como &quot;Convênio&quot;, &quot;Urgente&quot; ou &quot;Retorno&quot; para marcar e filtrar leads no CRM.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[rgba(2,21,65,0.06)] rounded-2xl overflow-hidden">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(2,21,65,0.05)] last:border-0"
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: tag.color }} />
              <span className={cn('flex-1 min-w-0 text-sm font-semibold truncate', tag.isActive ? 'text-[#021541]' : 'text-[#718096] line-through')}>
                {tag.name}
              </span>

              <button
                type="button"
                role="switch"
                aria-checked={tag.isActive}
                aria-label={tag.isActive ? `Desativar ${tag.name}` : `Ativar ${tag.name}`}
                onClick={() => toggleActive(tag)}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors',
                  tag.isActive ? 'bg-[#00BCE4]' : 'bg-[#1A2B56]/30',
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none mt-0.5 inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                    tag.isActive ? 'translate-x-[18px]' : 'translate-x-0.5',
                  )}
                />
              </button>

              <button
                onClick={() => openEdit(tag)}
                aria-label={`Editar ${tag.name}`}
                className="p-1.5 rounded-lg text-[#718096] hover:text-[#00BCE4] hover:bg-[#021541]/[0.04] transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>edit</span>
              </button>
              <button
                onClick={() => remove(tag)}
                aria-label={`Excluir ${tag.name}`}
                className="p-1.5 rounded-lg text-[#718096] hover:text-red-500 hover:bg-red-500/5 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>delete</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] text-[#718096]">
        Desativar mantém a marcação nos leads que já a têm, mas tira a tag do seletor. Excluir só é
        permitido em tag que não está em uso.
      </p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar tag' : 'Nova tag'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="tag-name">Nome</label>
              <input
                id="tag-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !submitting) submit() }}
                placeholder="Ex.: Convênio, Urgente, Retorno"
                maxLength={40}
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <span className={labelCls}>Cor</span>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Cor ${c}`}
                    aria-pressed={color === c}
                    className={cn(
                      'w-8 h-8 rounded-full transition-transform',
                      color === c ? 'ring-2 ring-offset-2 ring-[#021541] scale-110' : 'hover:scale-105',
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            {editing && (
              <p className="text-[11px] text-[#718096]">
                Renomear atualiza a marcação em todos os leads que usam esta tag.
              </p>
            )}
          </div>

          <DialogFooter>
            <button
              onClick={() => setDialogOpen(false)}
              className="px-4 py-2 rounded-xl text-sm font-bold text-[#718096] hover:bg-[#021541]/[0.04] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={submitting || name.trim().length < 2}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-[#021541] hover:bg-[#032170] disabled:opacity-40 transition-colors"
            >
              {submitting ? 'Salvando...' : 'Salvar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
