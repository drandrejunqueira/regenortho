'use client'

import { useState, useCallback } from 'react'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { LeadCard } from './LeadCard'
import { LeadDrawer } from './LeadDrawer'
import { toast } from 'sonner'
import type { Lead, LeadStatus, LeadInteraction } from '@/types'

const STATUSES: LeadStatus[] = ['new', 'contacted', 'scheduled', 'attended', 'active_patient', 'lost']

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
    const newStatus = over.id as LeadStatus

    if (!STATUSES.includes(newStatus)) return

    const lead = leads.find((l) => l.id === leadId)
    if (!lead || lead.status === newStatus) return

    // Optimistic update
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
    } catch {
      // Reverter
      setLeads((prev) =>
        prev.map((l) => l.id === leadId ? { ...l, status: lead.status } : l)
      )
      toast.error('Erro ao mover lead')
    }
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
    // Re-fetch interactions
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
        <div className="flex gap-4 overflow-x-auto pb-4">
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
      />
    </>
  )
}
