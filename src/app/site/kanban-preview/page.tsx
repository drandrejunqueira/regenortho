'use client'

import { SessionProvider } from 'next-auth/react'
import { KanbanBoard } from '@/components/leads/KanbanBoard'
import type { Lead, LeadStatus } from '@/types'

const NAMES = [
  'Maria Aparecida da Silva Santos', 'João Pedro', 'Ana Beatriz Nogueira', 'Carlos Eduardo',
  'Fernanda Lima', 'Roberto Carlos de Assis', 'Juliana Prado', 'Marcos Vinícius',
  'Patrícia Gonçalves', 'Ricardo Alves', 'Camila Souza', 'Bruno Henrique',
]

function makeLead(i: number, status: LeadStatus): Lead {
  return {
    id: `lead-${status}-${i}`,
    name: NAMES[i % NAMES.length],
    phone: '11987654321',
    email: null,
    source: 'instagram',
    status,
    specialty: 'Ortopedia e Traumatologia Esportiva',
    complaint: 'Dor lombar crônica há 6 meses',
    notes: null,
    tags: i % 2 === 0 ? ['Convênio', 'Retorno'] : ['Particular'],
    assignedToId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown as Lead
}

const LEADS: Lead[] = [
  ...Array.from({ length: 5 }, (_, i) => makeLead(i, 'new')),
  ...Array.from({ length: 8 }, (_, i) => makeLead(i, 'contacted')),
  ...Array.from({ length: 2 }, (_, i) => makeLead(i, 'scheduled')),
  ...Array.from({ length: 4 }, (_, i) => makeLead(i, 'attended')),
  ...Array.from({ length: 3 }, (_, i) => makeLead(i, 'lost')),
]

export default function KanbanPreviewPage() {
  return (
    <SessionProvider session={null}>
      {/* Reproduz o layout do dashboard: sidebar de 220px + padding do main */}
      <div className="h-screen flex bg-white">
        <div className="hidden md:block w-[220px] shrink-0 bg-[#021541]" />
        <main className="flex-1 min-w-0 overflow-y-auto p-4 md:p-6">
          <div className="h-full flex flex-col">
            <h1 className="text-xl font-bold text-[#021541] mb-4">CRM de Leads</h1>
            <div className="flex-1 overflow-hidden">
              <KanbanBoard initialLeads={LEADS} onRefresh={() => {}} />
            </div>
          </div>
        </main>
      </div>
    </SessionProvider>
  )
}
