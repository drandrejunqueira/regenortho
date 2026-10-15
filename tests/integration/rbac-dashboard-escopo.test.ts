/**
 * RBAC — GET /api/dashboard
 *
 * A rota é um agregador de CINCO módulos (leads, agenda, financeiro, estoque,
 * metas) atrás de uma única permissão: 'dashboard:view', que está no preset dos
 * quatro papéis. Resultado: cada papel recebe dados dos módulos que não pode
 * abrir pela porta da frente.
 *
 *   médico / recepção → financialSummary (receita, despesa, resultado) e
 *                       revenueChart, sem 'financial:view'
 *   financeiro        → recentLeads (nome/telefone/origem) sem 'leads:view' e
 *                       todayAppointments (nome e telefone do paciente) sem
 *                       'agenda:view'
 *
 * O padrão correto já existe no projeto: /api/relatorios/resumo devolve
 * `faturamentoMensal: null` para quem não tem 'financial:view'. O dashboard deve
 * fazer o mesmo, seção por seção.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    query: {
      leads: { findMany: vi.fn() },
      appointments: { findMany: vi.fn() },
      materials: { findMany: vi.fn() },
      monthlyGoals: { findFirst: vi.fn() },
    },
  },
}))

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { GET } from '@/app/api/dashboard/route'

function session(role: string, customPermissions: string[] | null = null) {
  return { user: { id: 'user-1', role, customPermissions, name: 'Fulano', email: 'f@x.com' } }
}

const LEAD = { id: 'l-1', name: 'Lead Um', phone: '11988887777', source: 'meta_ads', status: 'new' }
const CONSULTA = {
  id: 'a-1',
  type: 'consultation',
  startAt: new Date('2026-09-06T13:00:00Z'),
  patient: { id: 'p-1', name: 'Paciente Um', phone: '11977776666' },
  lead: null,
  googleEventId: null,
}

function mockDb() {
  // Toda agregação financeira devolve valor não-zero: se ele aparecer na
  // resposta de quem não tem financial:view, vazou.
  ;(db.select as unknown as Mock).mockImplementation(() =>
    chain([{ count: 9, total: '87654.32', status: 'new', date: '2026-09-01' }]),
  )
  ;(db.query.leads.findMany as unknown as Mock).mockResolvedValue([LEAD])
  ;(db.query.appointments.findMany as unknown as Mock).mockResolvedValue([CONSULTA])
  ;(db.query.materials.findMany as unknown as Mock).mockResolvedValue([
    { id: 'm-1', name: 'Ácido hialurônico', status: 'critical' },
  ])
  ;(db.query.monthlyGoals.findFirst as unknown as Mock).mockResolvedValue({ revenueGoal: '25000' })
}

describe('GET /api/dashboard — financeiro para quem não tem financial:view', () => {
  afterEach(() => vi.clearAllMocks())

  it.each(['doctor', 'receptionist'])('%s não recebe receita, despesa nem resultado', async (role) => {
    ;(auth as unknown as Mock).mockResolvedValue(session(role))
    mockDb()

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.financialSummary ?? null).toBeNull()
    expect(body.revenueChart ?? null).toBeNull()
    expect(body.kpis.revenue ?? 0).toBe(0)
  })

  it('financeiro e admin continuam recebendo o resumo financeiro', async () => {
    for (const role of ['admin', 'financial']) {
      ;(auth as unknown as Mock).mockResolvedValue(session(role))
      mockDb()

      const res = await GET()
      const body = await res.json()

      expect(body.financialSummary?.income, `papel ${role}`).toBe(87654.32)
      vi.clearAllMocks()
    }
  })
})

describe('GET /api/dashboard — leads e agenda para quem não tem as permissões', () => {
  afterEach(() => vi.clearAllMocks())

  it('financeiro não tem leads:view — não recebe a lista de leads recentes', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('financial'))
    mockDb()

    const res = await GET()
    const body = await res.json()

    expect(body.recentLeads ?? []).toEqual([])
  })

  it('financeiro não tem agenda:view — não recebe nome e telefone dos pacientes do dia', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('financial'))
    mockDb()

    const res = await GET()
    const body = await res.json()

    expect(body.todayAppointments ?? []).toEqual([])
  })

  it('financeiro não tem materials:view — não recebe os alertas de estoque', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('financial'))
    mockDb()

    const res = await GET()
    const body = await res.json()

    expect(body.stockAlerts ?? []).toEqual([])
  })
})

describe('GET /api/dashboard — customPermissions', () => {
  afterEach(() => vi.clearAllMocks())

  it('usuário com customPermissions ["dashboard:view"] recebe o esqueleto e nada mais', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('admin', ['dashboard:view']))
    mockDb()

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.financialSummary ?? null).toBeNull()
    expect(body.recentLeads ?? []).toEqual([])
    expect(body.todayAppointments ?? []).toEqual([])
    expect(body.stockAlerts ?? []).toEqual([])
  })

  it('usuário sem dashboard:view leva 403 mesmo sendo admin', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('admin', ['leads:view']))

    const res = await GET()

    expect(res.status).toBe(403)
  })
})
