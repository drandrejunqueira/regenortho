/**
 * RBAC — GET /api/tratamentos
 *
 * A rota exige só 'treatments:view' (preset de médico, recepção, financeiro e
 * admin) e devolve `totalCost`, `subtotal`, `discount` e um bloco `stats` com a
 * receita total da clínica.
 *
 * Custo x venda por procedimento é exatamente o conteúdo do DRE, protegido por
 * 'reports:balancete' — permissão marcada `sensitive: true` e ausente do preset
 * de médico e recepção. Ou seja: quem leva 403 em /api/relatorios/dre monta o
 * mesmo demonstrativo somando o que esta rota entrega.
 *
 * O mock devolve exatamente as colunas selecionadas, então a correção pode ser
 * cortar a projeção ou filtrar a resposta.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { select: vi.fn() } }))
vi.mock('@/lib/db/logger', () => ({ logActivity: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ notify: vi.fn() }))

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { GET } from '@/app/api/tratamentos/route'

function session(role: string, customPermissions: string[] | null = null) {
  return { user: { id: 'user-1', role, customPermissions, name: 'Fulano', email: 'f@x.com' } }
}

const FIXTURE: Record<string, unknown> = {
  id: 't-1',
  name: 'PRP joelho',
  status: 'completed',
  subtotal: '3000.00',
  discount: '0.00',
  totalSale: '3000.00',
  totalCost: '910.55',
  installments: 1,
  notes: null,
  completedAt: null,
  createdAt: new Date('2026-08-01T12:00:00Z'),
  updatedAt: new Date('2026-08-01T12:00:00Z'),
  patient: { id: 'p-1', name: 'Paciente Um' },
  doctor: { id: 'd-1', name: 'Dr. Fulano' },
  paymentMethod: null,
  total: 12,
  emAndamento: 3,
  concluidos: 9,
  receitaTotal: '145000.00',
}

/** Cada select devolve uma linha com exatamente as colunas pedidas. */
function mockSelect() {
  ;(db.select as unknown as Mock).mockImplementation((proj?: Record<string, unknown>) => {
    if (!proj) return chain([]) // busca dos itens do tratamento
    const linha = Object.fromEntries(Object.keys(proj).map((k) => [k, FIXTURE[k] ?? null]))
    return chain([linha])
  })
}

const req = () => new NextRequest('http://localhost/api/tratamentos')

describe('GET /api/tratamentos — custo e margem sem reports:balancete', () => {
  afterEach(() => vi.clearAllMocks())

  it.each(['doctor', 'receptionist'])(
    '%s vê o tratamento mas não o custo (é o numerador do DRE)',
    async (role) => {
      ;(auth as unknown as Mock).mockResolvedValue(session(role))
      mockSelect()

      const res = await GET(req())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data[0].id).toBe('t-1')
      expect(body.data[0].totalCost ?? null).toBeNull()
    },
  )

  it('recepção não recebe a receita total da clínica no bloco stats', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('receptionist'))
    mockSelect()

    const res = await GET(req())
    const body = await res.json()

    expect(body.stats.receitaTotal ?? 0).toBe(0)
  })

  it.each(['admin', 'financial'])('%s tem reports:balancete e continua vendo custo e receita', async (role) => {
    ;(auth as unknown as Mock).mockResolvedValue(session(role))
    mockSelect()

    const res = await GET(req())
    const body = await res.json()

    expect(body.data[0].totalCost).toBe('910.55')
    expect(body.stats.receitaTotal).toBe(145000)
  })

  it('customPermissions substituem o preset: só treatments:view não abre o custo', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('admin', ['treatments:view']))
    mockSelect()

    const res = await GET(req())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data[0].totalCost ?? null).toBeNull()
  })
})
