'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { LeadCard } from './LeadCard'
import { LeadDrawer } from './LeadDrawer'
import { ScheduleLeadDialog } from './ScheduleLeadDialog'
import { toast } from 'sonner'
import type { Lead, LeadStatus, LeadInteraction } from '@/types'

const STATUSES: LeadStatus[] = ['new', 'contacted', 'scheduled', 'lost']

interface Props {
  initialLeads: Lead[]
  onRefresh: () => void
}

export function KanbanBoard({ initialLeads, onRefresh }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [interactions, setInteractions] = useState<LeadInteraction[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Estados para o diálogo de agendamento automático
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [leadToSchedule, setLeadToSchedule] = useState<Lead | null>(null)
  const [previousStatus, setPreviousStatus] = useState<LeadStatus | null>(null)

  // Sincronizar leads locais quando initialLeads mudar no pai
  useEffect(() => {
    setLeads(initialLeads)
  }, [initialLeads])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function getLeadsByStatus(status: LeadStatus) {
    return leads.filter((l) => l.status === status)
  }

  function handleDragStart(event: DragStartEvent) {
    const lead = leads.find((l) => l.id === event.active.id)
    if (lead) setActiveLead(lead)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveLead(null)

    if (!over || active.id === over.id) return

    const leadId = active.id as string
    let newStatus = over.id as LeadStatus

    // Se dropou sobre um card de lead, resolve o status correspondente àquela coluna
    if (!STATUSES.includes(newStatus)) {
      const overLead = leads.find((l) => l.id === over.id)
      if (overLead) {
        newStatus = overLead.status
      }
    }

    if (!STATUSES.includes(newStatus)) return

    const lead = leads.find((l) => l.id === leadId)
    if (!lead || lead.status === newStatus) return

    // Se mover para 'scheduled' (Agendado), abre o formulário de agendamento
    if (newStatus === 'scheduled') {
      setLeadToSchedule(lead)
      setPreviousStatus(lead.status)
      setScheduleDialogOpen(true)
      // Mover otimista
      setLeads((prev) =>
        prev.map((l) => l.id === leadId ? { ...l, status: 'scheduled', updatedAt: new Date().toISOString() } : l)
      )
      return
    }

    // Optimistic update para outros status (ex: contacted, lost, new)
    setLeads((prev) =>
      prev.map((l) => l.id === leadId ? { ...l, status: newStatus, updatedAt: new Date().toISOString() } : l)
    )

    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      toast.success('Etapa atualizada!')
    } catch {
      // Reverter
      setLeads((prev) =>
        prev.map((l) => l.id === leadId ? { ...l, status: lead.status } : l)
      )
      toast.error('Erro ao mover lead')
    }
  }

  function handleCancelSchedule() {
    if (leadToSchedule && previousStatus) {
      // Reverter o card para o status anterior
      setLeads((prev) =>
        prev.map((l) => l.id === leadToSchedule.id ? { ...l, status: previousStatus } : l)
      )
    }
    setScheduleDialogOpen(false)
    setLeadToSchedule(null)
    setPreviousStatus(null)
  }

  function handleScheduleSuccess() {
    setScheduleDialogOpen(false)
    setLeadToSchedule(null)
    setPreviousStatus(null)
    onRefresh()
  }

  async function handleLeadClick(lead: Lead) {
    setSelectedLead(lead)
    setDrawerOpen(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}`)
      if (res.ok) {
        const { data } = await res.json()
        setInteractions(data.interactions ?? [])
      }
    } catch {}
  }

  function handleDrawerUpdate() {
    onRefresh()
    // Atualizar interações no drawer se aberto
    if (selectedLead) handleLeadClick(selectedLead)
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 h-full items-start">
          {STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              leads={getLeadsByStatus(status)}
              onLeadClick={handleLeadClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead ? (
            <div className="rotate-2 shadow-xl">
              <LeadCard lead={activeLead} onClick={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <LeadDrawer
        lead={selectedLead}
        interactions={interactions}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onUpdate={handleDrawerUpdate}
        onScheduleLead={(lead) => {
          setDrawerOpen(false)
          setLeadToSchedule(lead)
          setPreviousStatus(lead.status)
          setScheduleDialogOpen(true)
        }}
      />

      <ScheduleLeadDialog
        open={scheduleDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleCancelSchedule()
        }}
        lead={leadToSchedule}
        onScheduled={handleScheduleSuccess}
      />
    </>
  )
}
