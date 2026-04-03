'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { getInitials, timeAgo } from '@/lib/utils'
import { LEAD_STATUS_LABELS } from '@/lib/constants'
import type { Lead, LeadInteraction, LeadStatus } from '@/types'

interface Props {
  lead: Lead | null
  interactions: LeadInteraction[]
  open: boolean
  onOpenChange: (v: boolean) => void
  onUpdate: () => void
}

const STATUSES: LeadStatus[] = ['new', 'contacted', 'scheduled', 'attended', 'active_patient', 'lost']

export function LeadDrawer({ lead, interactions, open, onOpenChange, onUpdate }: Props) {
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  if (!lead) return null

  async function updateStatus(status: string) {
    if (!lead) return
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md overflow-y-auto bg-[#181c22] border-l border-[#3e4949]/20" side="right">
        <SheetHeader className="pb-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-[#006e72] flex items-center justify-center text-[#dfe2eb] font-bold text-base shrink-0 select-none">
              {getInitials(lead.name)}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-bold text-[#dfe2eb]">{lead.name}</SheetTitle>
              <div className="mt-1.5">
                <Select value={lead.status} onValueChange={(v) => v && updateStatus(v)} disabled={updatingStatus}>
                  <SelectTrigger className="h-6 w-auto text-[10px] font-bold border-none bg-[#31353c] px-2 rounded-full uppercase tracking-wider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#31353c] border-[#3e4949]/30">
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="text-[#dfe2eb] text-xs">
                        {LEAD_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Quick info */}
        <div className="py-4 space-y-2 mb-4">
          <a
            href={`tel:${lead.phone}`}
            className="flex items-center gap-2 text-sm text-[#bec9c9] hover:text-[#dfe2eb] transition-colors"
          >
            <span className="material-symbols-outlined text-[#61d8dd]/60" style={{ fontSize: '16px' }}>phone</span>
            {lead.phone}
          </a>
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              className="flex items-center gap-2 text-sm text-[#bec9c9] hover:text-[#dfe2eb] transition-colors"
            >
              <span className="material-symbols-outlined text-[#61d8dd]/60" style={{ fontSize: '16px' }}>mail</span>
              {lead.email}
            </a>
          )}
          {lead.complaint && (
            <p className="text-sm text-[#bec9c9] italic pl-1">"{lead.complaint}"</p>
          )}
        </div>

        <Tabs defaultValue="timeline" className="pt-2">
          <TabsList className="w-full bg-[#1c2026] rounded-xl p-1">
            <TabsTrigger
              value="timeline"
              className="flex-1 text-xs font-bold data-[state=active]:bg-[#31353c] data-[state=active]:text-[#dfe2eb] text-[#bec9c9] rounded-lg"
            >
              Timeline
            </TabsTrigger>
            <TabsTrigger
              value="actions"
              className="flex-1 text-xs font-bold data-[state=active]:bg-[#31353c] data-[state=active]:text-[#dfe2eb] text-[#bec9c9] rounded-lg"
            >
              Ações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="mt-4 space-y-3">
            {/* Adicionar nota */}
            <div className="flex gap-2">
              <textarea
                placeholder="Adicionar nota..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={2}
                className="flex-1 bg-[#31353c] border-none rounded-xl text-sm text-[#dfe2eb] placeholder:text-[#bec9c9]/50 p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#61d8dd]/30"
              />
              <button
                onClick={addNote}
                disabled={savingNote || !noteContent.trim()}
                className="p-2.5 rounded-xl bg-gradient-to-br from-[#006e72] to-[#61d8dd] text-[#003739] font-bold disabled:opacity-40 transition-opacity"
                aria-label="Enviar nota"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
              </button>
            </div>

            {/* Timeline */}
            {interactions.length === 0 ? (
              <p className="text-sm text-[#bec9c9] text-center py-4">Nenhuma interação ainda</p>
            ) : (
              <ul className="space-y-2">
                {interactions.map((i) => (
                  <li key={i.id} className="bg-[#1c2026] rounded-lg p-2.5">
                    <p className="font-technical text-[10px] text-[#e6c364] font-bold mb-1">{timeAgo(i.createdAt)}</p>
                    <p className="text-sm text-[#dfe2eb]">{i.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="actions" className="mt-4 space-y-3">
            <button
              className="w-full flex items-center justify-start gap-3 px-4 py-3 rounded-xl bg-[#1c2026] text-sm font-medium text-[#4ade80] hover:bg-[#4ade80]/10 transition-colors"
              onClick={() => {
                const phone = lead.phone.replace(/\D/g, '')
                window.open(`https://wa.me/55${phone}`, '_blank')
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chat</span>
              Abrir WhatsApp
            </button>
            <button
              className="w-full flex items-center justify-start gap-3 px-4 py-3 rounded-xl bg-gradient-to-br from-[#006e72] to-[#61d8dd] text-[#003739] text-sm font-bold hover:opacity-90 transition-opacity"
              onClick={() => updateStatus('active_patient')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>person</span>
              Converter em Paciente Ativo
            </button>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
