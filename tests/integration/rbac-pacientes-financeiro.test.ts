/**
 * RBAC — GET /api/pacientes (listagem)
 *
 * A ficha individual (GET /api/pacientes/[id]) já faz a coisa certa: corta
 * `transactions` de quem não tem 'financial:view' e `clinicalRecords` de quem
 * não tem 'patients:view_clinical'.
 *
 * A LISTAGEM não faz esse corte: o `with:` traz `transactions` (valor, vencimento,
 * pago/não pago) de todos os pacientes da página para qualquer papel com
 * 'patients:view' — o que inclui médico e recepcionista, os dois descritos em
 * ROLE_META como "sem acesso financeiro". A mesma porta que a ficha fecha, a
 * lista deixa aberta.
 *
 * O mock de banco responde ao `with:` recebido, então o teste passa tanto se a
 * correção deixar de PEDIR as transações quanto se ela as remover da resposta.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { query: { patients: { findMany: vi.fn() } } },
}))
vi.mock('@/lib/db/logger', () => ({ logActivity: vi.fn() }))

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { GET } from '@/app/api/pacientes/route'

function session(role: string, customPermissions: string[] | null = null) {
  return { user: { id: 'user-1', role, customPermissions, name: 'Fulano', email: 'f@x.com' } }
}

const TRANSACOES = [
  { id: 'tx-1', amount: '4500.00', isPaid: false, dueDate: '2026-10-01', type: 'income' },
]

/** Devolve exatamente as relações que a rota pediu no `with:`. */
function mockPacientes() {
  const findMany = db.query.patients.findMany as unknown as Mock
  findMany.mockImplementation((arg?: { with?: Record<string, unknown> }) => {
    const linha: Record<string, unknown> = { id: 'p-1', name: 'Paciente Um', phone: '11999999999' }
    if (arg?.with?.appointments) linha.appointments = []
    if (arg?.with?.treatments) linha.treatments = []
    if (arg?.with?.transactions) linha.transactions = TRANSACOES
    return Promise.resolve([linha])
  })
  return findMany
}

const req = () => new NextRequest('http://localhost/api/pacientes')

describe('GET /api/pacientes — dado financeiro do paciente na listagem', () => {
  afterEach(() => vi.clearAllMocks())

  it.each(['doctor', 'receptionist'])(
    '%s tem patients:view mas não financial:view — não pode receber transações',
    async (role) => {
      ;(auth as unknown as Mock).mockResolvedValue(session(role))
      mockPacientes()

      const res = await GET(req())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data[0].transactions ?? []).toEqual([])
    },
  )

  it('financeiro e admin (com financial:view) continuam recebendo as transações', async () => {
    for (const role of ['admin', 'financial']) {
      ;(auth as unknown as Mock).mockResolvedValue(session(role))
      mockPacientes()

      const res = await GET(req())
      const body = await res.json()

      expect(body.data[0].transactions, `papel ${role}`).toEqual(TRANSACOES)
      vi.clearAllMocks()
    }
  })

  it('customPermissions substituem o preset: admin só com patients:view não vê transações', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('admin', ['patients:view']))
    mockPacientes()

    const res = await GET(req())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data[0].transactions ?? []).toEqual([])
  })
})
