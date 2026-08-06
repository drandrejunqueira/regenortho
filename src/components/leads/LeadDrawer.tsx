'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { toast } from 'sonner'
import { getInitials, timeAgo } from '@/lib/utils'
import { hasPermission } from '@/lib/permissions'
import { LEAD_STATUS_LABELS, LEAD_SOURCE_LABELS } from '@/lib/constants'
import type { Lead, LeadInteraction, LeadStatus, UserRole } from '@/types'
import type { PersonOption, TagOption } from '@/components/leads/LeadFilters'

interface Props {
  lead: Lead | null
  interactions: LeadInteraction[]
  open: boolean
  onOpenChange: (v: boolean) => void
  onUpdate: () => void
  onScheduleLead?: (lead: Lead) => void
}

// Mesmos estágios do quadro. 'active_patient' saiu daqui também: se ficasse,
// marcar o lead com ele o faria sumir do CRM (não há mais coluna para exibi-lo).
const STATUSES: LeadStatus[] = ['new', 'contacted', 'scheduled', 'attended', 'lost']

const STATUS_STYLES: Record<string, string> = {
  new:            'bg-cyan-50 border-cyan-200 text-cyan-700',
  contacted:      'bg-amber-50 border-amber-200 text-amber-700',
  scheduled:      'bg-violet-50 border-violet-200 text-violet-700',
  attended:       'bg-teal-50 border-teal-200 text-teal-700',
  active_patient: 'bg-green-50 border-green-200 text-green-700',
  lost:           'bg-red-50 border-red-200 text-red-600',
}

const STATUS_ACTIVE: Record<string, string> = {
  new:            'bg-cyan-500 border-cyan-500 text-white shadow-cyan-200',
  contacted:      'bg-amber-500 border-amber-500 text-white shadow-amber-200',
  scheduled:      'bg-violet-600 border-violet-600 text-white shadow-violet-200',
  attended:       'bg-teal-500 border-teal-500 text-white shadow-teal-200',
  active_patient: 'bg-green-600 border-green-600 text-white shadow-green-200',
  lost:           'bg-red-500 border-red-500 text-white shadow-red-200',
}

const INTERACTION_ICON: Record<string, string> = {
  note:        'edit_note',
  call:        'phone',
  email:       'mail',
  whatsapp:    'chat',
  appointment: 'calendar_today',
}

export function LeadDrawer({ lead, interactions, open, onOpenChange, onUpdate, onScheduleLead }: Props) {
  const { data: session } = useSession()
  // Excluir lead é exclusivo de quem tem a permissão (por padrão, só admin).
  // Sem este gate, recepção via o botão e recebia 403 ("Erro ao excluir o lead").
  const canDelete = !!session?.user?.role && hasPermission(session.user.role as UserRole, 'leads:delete', session.user.customPermissions)
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Estados para Tags
  const [updatingTags, setUpdatingTags] = useState(false)
  // Vocabulário oficial (Configurações → Tags) e lista de responsáveis.
  const [registryTags, setRegistryTags] = useState<TagOption[]>([])
  const [people, setPeople] = useState<PersonOption[]>([])
  const [updatingOwner, setUpdatingOwner] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [t, p] = await Promise.allSettled([
        fetch('/api/tags'),
        fetch('/api/usuarios?assignable=1'),
      ])
      if (cancelled) return
      if (t.status === 'fulfilled' && t.value.ok) setRegistryTags((await t.value.json()).data ?? [])
      if (p.status === 'fulfilled' && p.value.ok) setPeople((await p.value.json()).data ?? [])
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (!lead) return null

  async function updateStatus(status: string) {
    if (!lead) return
    if (status === 'scheduled') {
      if (onScheduleLead) {
        onScheduleLead(lead)
      }
      return
    }

    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      toast.success('Status atualizado')
      onUpdate()
    } catch {
      toast.error('Erro ao atualizar status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function deleteLead() {
    if (!lead) return
    if (!confirm(`Deseja realmente excluir o lead "${lead.name}" permanentemente do CRM?`)) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const serverMsg = await res.json().then((d) => d?.error).catch(() => null)
        const msg =
          res.status === 403
            ? 'Você não tem permissão para excluir leads.'
            : serverMsg || 'Não foi possível excluir o lead.'
        throw new Error(msg)
      }
      toast.success('Lead excluído permanentemente!')
      onOpenChange(false)
      onUpdate()
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Erro ao excluir o lead.')
    } finally {
      setDeleting(false)
    }
  }

  async function addNote() {
    if (!lead || !noteContent.trim()) return
    setSavingNote(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'note', content: noteContent }),
      })
      if (!res.ok) throw new Error()
      toast.success('Nota adicionada')
      setNoteContent('')
      onUpdate()
    } catch {
      toast.error('Erro ao adicionar nota')
    } finally {
      setSavingNote(false)
    }
  }

  async function addTag(tagText: string) {
    if (!lead || !tagText.trim()) return
    const cleanedTag = tagText.trim()
    const currentTags = lead.tags ?? []
    if (currentTags.includes(cleanedTag)) {
      toast.error('Esta tag já existe.')
      return
    }
    const updatedTags = [...currentTags, cleanedTag]
    setUpdatingTags(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updatedTags }),
      })
      if (!res.ok) throw new Error()
      toast.success('Tag adicionada!')
      onUpdate()
    } catch {
      toast.error('Erro ao adicionar tag.')
    } finally {
      setUpdatingTags(false)
    }
  }

  async function updateOwner(userId: string | null) {
    if (!lead) return
    setUpdatingOwner(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToId: userId }),
      })
      if (!res.ok) throw new Error()
      toast.success(userId ? 'Responsável definido!' : 'Responsável removido.')
      onUpdate()
    } catch {
      toast.error('Erro ao definir responsável.')
    } finally {
      setUpdatingOwner(false)
    }
  }

  async function removeTag(tagToRemove: string) {
    if (!lead) return
    const currentTags = lead.tags ?? []
    const updatedTags = currentTags.filter(t => t !== tagToRemove)
    setUpdatingTags(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updatedTags }),
      })
      if (!res.ok) throw new Error()
      toast.success('Tag removida!')
      onUpdate()
    } catch {
      toast.error('Erro ao remover tag.')
    } finally {
      setUpdatingTags(false)
    }
  }

  const phone = lead.phone.replace(/\D/g, '')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        showCloseButton={false}
        className="w-full max-w-[440px] p-0 gap-0 overflow-hidden flex flex-col border-l border-[rgba(2,21,65,0.10)] shadow-2xl bg-[#f5f6f8]"
        side="right"
      >
        {/* ── HEADER ───────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-[#021541] via-[#032170] to-[#021541] text-white relative overflow-hidden shrink-0">
          {/* Decorative glow */}
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-[#00BCE4]/10 blur-3xl pointer-events-none" />

          <div className="relative p-6 pb-4">
            {/* Top row: avatar + name + close */}
            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-[#00BCE4]/20 border border-[#00BCE4]/30 flex items-center justify-center text-xl font-bold text-[#00BCE4] shrink-0 select-none">
                {getInitials(lead.name)}
              </div>

              <div className="flex-1 min-w-0 pt-0.5">
                <h2 className="text-base font-bold text-white leading-tight truncate">{lead.name}</h2>
                {lead.specialty && (
                  <p className="text-xs text-white/50 mt-0.5 truncate">{lead.specialty}</p>
                )}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {/* status badge */}
                  <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border ${STATUS_STYLES[lead.status]}`}>
                    {LEAD_STATUS_LABELS[lead.status] || lead.status}
                  </span>
                  {/* source badge */}
                  <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-white/60">
                    {LEAD_SOURCE_LABELS[lead.source] ?? lead.source}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onOpenChange(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                aria-label="Fechar"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
              </button>
            </div>

            {/* Quick action buttons */}
            <div className="flex gap-2">
              <a
                href={`https://wa.me/55${phone}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500 hover:bg-green-400 text-white text-[11px] font-bold transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chat</span>
                WhatsApp
              </a>
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-[11px] font-bold transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>mail</span>
                  E-mail
                </a>
              )}
              <a
                href={`tel:${lead.phone}`}
                className="w-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-colors cursor-pointer"
                aria-label="Ligar"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>phone</span>
              </a>
            </div>
          </div>
        </div>

        {/* ── SCROLLABLE BODY ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">

          {/* Status selector */}
          <div className="bg-white px-5 py-4 border-b border-[rgba(2,21,65,0.06)]">
            <p className="text-[9px] font-bold text-[#718096] uppercase tracking-widest mb-2.5">Mover etapa</p>
            <div className="flex gap-1.5 flex-wrap">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={updatingStatus}
                  onClick={() => updateStatus(s)}
                  className={`text-[9px] font-bold px-3 py-1.5 rounded-full border tracking-wide transition-all disabled:opacity-50 cursor-pointer ${
                    lead.status === s
                      ? `${STATUS_ACTIVE[s]} shadow-sm scale-105`
                      : 'border-[rgba(2,21,65,0.10)] bg-[#f5f6f8] text-[#718096] hover:border-[rgba(2,21,65,0.20)] hover:text-[#021541]'
                  }`}
                >
                  {LEAD_STATUS_LABELS[s] || s}
                </button>
              ))}
            </div>
          </div>

          {/* Tags de Marcação */}
          <div className="bg-white px-5 py-4 border-b border-[rgba(2,21,65,0.06)] mt-2">
            <p className="text-[9px] font-bold text-[#718096] uppercase tracking-widest mb-2.5">Tags de Marcação</p>
            
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(lead.tags ?? []).length === 0 ? (
                <p className="text-xs text-[#718096] italic">Nenhuma tag adicionada</p>
              ) : (
                (lead.tags ?? []).map((t) => (
                  <span
                    key={t}
                    className="flex items-center gap-1.5 bg-[rgba(2,21,65,0.04)] text-[#021541]/75 text-[10px] px-2.5 py-1 rounded-full font-semibold border border-[rgba(2,21,65,0.06)]"
                  >
                    {t}
                    <button
                      disabled={updatingTags}
                      onClick={() => removeTag(t)}
                      className="text-[#718096] hover:text-[#dc2626] cursor-pointer disabled:opacity-50 flex items-center justify-center"
                      aria-label={`Remover tag ${t}`}
                    >
                      <span className="material-symbols-outlined select-none" style={{ fontSize: '12px' }}>close</span>
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Escolha do vocabulário oficial, não texto livre: é o que impede
                "Convênio" e "convenio" de virarem duas marcações no funil. */}
            {(() => {
              const disponiveis = registryTags.filter(
                (t) => t.isActive && !(lead?.tags ?? []).includes(t.name),
              )
              if (registryTags.length === 0) {
                return (
                  <p className="text-[11px] text-[#718096]">
                    Nenhuma tag cadastrada. Crie em <span className="font-semibold">Configurações → Tags</span>.
                  </p>
                )
              }
              if (disponiveis.length === 0) {
                return <p className="text-[11px] text-[#718096]">Todas as tags disponíveis já foram aplicadas.</p>
              }
              return (
                <select
                  value=""
                  disabled={updatingTags}
                  onChange={(e) => { if (e.target.value) addTag(e.target.value) }}
                  aria-label="Adicionar tag ao lead"
                  className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.10)] rounded-xl px-3 py-1.5 text-xs text-[#021541] focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.25)] focus:border-[#00BCE4] transition-all cursor-pointer disabled:opacity-50"
                >
                  <option value="">+ Adicionar tag...</option>
                  {disponiveis.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              )
            })()}
          </div>

          {/* Responsável pelo atendimento */}
          <div className="bg-white px-5 py-4 border-b border-[rgba(2,21,65,0.06)] mt-2">
            <p className="text-[9px] font-bold text-[#718096] uppercase tracking-widest mb-2.5">Responsável</p>
            <select
              value={lead.assignedToId ?? ''}
              disabled={updatingOwner}
              onChange={(e) => updateOwner(e.target.value || null)}
              aria-label="Responsável pelo lead"
              className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.10)] rounded-xl px-3 py-2 text-xs text-[#021541] focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.25)] focus:border-[#00BCE4] transition-all cursor-pointer disabled:opacity-50"
            >
              <option value="">Sem responsável</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Contact info */}
          <div className="bg-white px-5 py-4 border-b border-[rgba(2,21,65,0.06)] mt-2 space-y-2">
            <p className="text-[9px] font-bold text-[#718096] uppercase tracking-widest mb-1">Contato</p>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#f5f6f8] border border-[rgba(2,21,65,0.06)]">
              <div className="w-8 h-8 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-green-600" style={{ fontSize: '14px' }}>chat</span>
              </div>
              <div className="min-w-0">
                <p className="text-[8px] font-bold text-[#718096] uppercase tracking-widest">WhatsApp / Telefone</p>
                <p className="text-sm font-semibold text-[#021541]">{lead.phone}</p>
              </div>
            </div>

            {lead.email && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#f5f6f8] border border-[rgba(2,21,65,0.06)]">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-blue-500" style={{ fontSize: '14px' }}>mail</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] font-bold text-[#718096] uppercase tracking-widest">E-mail</p>
                  <p className="text-xs font-semibold text-[#021541] break-all">{lead.email}</p>
                </div>
              </div>
            )}

            {lead.complaint && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#f5f6f8] border border-[rgba(2,21,65,0.06)]">
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-amber-500" style={{ fontSize: '14px' }}>healing</span>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-[#718096] uppercase tracking-widest mb-0.5">Queixa Principal</p>
                  <p className="text-xs text-[#021541] leading-relaxed">{lead.complaint}</p>
                </div>
              </div>
            )}

            {(lead.utmSource || lead.utmCampaign) && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#f5f6f8] border border-[rgba(2,21,65,0.06)]">
                <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-purple-500" style={{ fontSize: '14px' }}>analytics</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] font-bold text-[#718096] uppercase tracking-widest">Campanha</p>
                  <p className="text-xs font-semibold text-[#021541] truncate">
                    {lead.utmCampaign ?? lead.utmSource}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#f5f6f8] border border-[rgba(2,21,65,0.06)]">
              <div className="w-8 h-8 rounded-lg bg-[rgba(2,21,65,0.05)] border border-[rgba(2,21,65,0.08)] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[#718096]" style={{ fontSize: '14px' }}>schedule</span>
              </div>
              <div>
                <p className="text-[8px] font-bold text-[#718096] uppercase tracking-widest">Captado</p>
                <p className="text-xs font-semibold text-[#021541]">
                  {new Date(lead.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white px-5 py-4 mt-2 border-b border-[rgba(2,21,65,0.06)]">
            <p className="text-[9px] font-bold text-[#718096] uppercase tracking-widest mb-4">Histórico de Interações</p>

            {interactions.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-[rgba(2,21,65,0.08)] rounded-2xl">
                <span className="material-symbols-outlined text-[#CBD5E0] block mb-1" style={{ fontSize: '24px' }}>forum</span>
                <p className="text-xs text-[#CBD5E0] font-medium">Nenhuma interação ainda</p>
              </div>
            ) : (
              <ul className="space-y-0">
                {interactions.map((i, idx) => (
                  <li key={i.id} className="flex gap-3">
                    {/* timeline track */}
                    <div className="flex flex-col items-center pt-1 shrink-0">
                      <div className="w-7 h-7 rounded-full bg-[rgba(0,188,228,0.10)] border border-[rgba(0,188,228,0.20)] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '12px' }}>
                          {INTERACTION_ICON[i.type] ?? 'edit_note'}
                        </span>
                      </div>
                      {idx < interactions.length - 1 && (
                        <div className="w-px flex-1 bg-[rgba(2,21,65,0.08)] my-1" />
                      )}
                    </div>
                    {/* content */}
                    <div className="pb-4 flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-bold text-[#00BCE4] uppercase tracking-wider">
                          {timeAgo(i.createdAt)}
                        </span>
                        {i.user && (
                          <span className="text-[9px] text-[#718096]">· {i.user.name}</span>
                        )}
                      </div>
                      <p className="text-sm text-[#021541] leading-relaxed">{i.content}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Nova nota */}
          <div className="bg-white px-5 py-4 mt-2">
            <p className="text-[9px] font-bold text-[#718096] uppercase tracking-widest mb-3">Nova Anotação</p>
            <div className="relative">
              <textarea
                placeholder="Registrar progresso, observação ou próximo passo..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={3}
                className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.10)] rounded-2xl text-sm text-[#021541] placeholder:text-[#CBD5E0] p-4 pr-14 resize-none focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.25)] focus:border-[#00BCE4] transition-all"
              />
              <button
                onClick={addNote}
                disabled={savingNote || !noteContent.trim()}
                className="absolute bottom-3 right-3 w-9 h-9 rounded-xl bg-gradient-to-br from-[#0097a7] to-[#00BCE4] text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-opacity hover:opacity-90 cursor-pointer"
                aria-label="Enviar nota"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span>
              </button>
            </div>
          </div>

        </div>

        {/* ── FOOTER ───────────────────────────────────────────────────── */}
        <div className="bg-white border-t border-[rgba(2,21,65,0.08)] p-4 flex gap-3 shrink-0">
          <button
            onClick={() => {
              if (onScheduleLead) {
                onScheduleLead(lead)
              }
            }}
            disabled={updatingStatus || deleting || lead.status === 'scheduled'}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-br from-[#021541] to-[#032170] text-white text-[11px] font-bold uppercase tracking-widest shadow-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>calendar_today</span>
            Agendar Consulta
          </button>
          <button
            onClick={() => { updateStatus('lost'); onOpenChange(false) }}
            disabled={updatingStatus || deleting || lead.status === 'lost'}
            className="w-12 flex items-center justify-center rounded-2xl bg-red-50 border border-red-100 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Marcar como perdido"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_off</span>
          </button>
          {canDelete && (
            <button
              onClick={deleteLead}
              disabled={updatingStatus || deleting}
              className="w-12 flex items-center justify-center rounded-2xl bg-red-50 border border-red-100 text-red-500 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Excluir lead permanentemente"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
