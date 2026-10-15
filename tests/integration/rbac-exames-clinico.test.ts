/**
 * RBAC — GET /api/exames
 *
 * A rota exige apenas 'exams:view', que está no preset da RECEPÇÃO. A projeção,
 * porém, devolve `hypothesis` (hipótese diagnóstica), `cid10` e `resultUrl` —
 * conteúdo clínico, exatamente o que 'patients:view_clinical' existe para
 * proteger e o que /api/prontuario e /api/pacientes/[id] barram para a recepção.
 *
 * O comentário na própria rota reconhece o risco ("ainda mais grave porque
 * 'exams:view' está no preset da recepção"), mas a correção anterior tratou só
 * do escopo (exigir patientId), não do conteúdo devolvido.
 *
 * O mock devolve exatamente as colunas que a rota pediu, então o teste aceita as
 * duas formas de correção: cortar a projeção ou filtrar a resposta.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { select: vi.fn() } }))
vi.mock('@/lib/db/logger', () => ({ logActivity: vi.fn() }))

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { GET } from '@/app/api/exames/route'

function session(role: string, customPermissions: string[] | null = null) {
  return { user: { id: 'user-1', role, customPermissions, name: 'Fulano', email: 'f@x.com' } }
}

const FIXTURE: Record<string, unknown> = {
  id: 'ex-1',
  exams: [{ name: 'RM joelho direito' }],
  hypothesis: 'Lesão meniscal medial, suspeita de rotura em alça de balde',
  cid10: 'M23.2',
  urgency: 'routine',
  status: 'result_available',
  resultUrl: 'https://laudos.example.com/ex-1.pdf',
  resultDate: '2026-08-01',
  validUntil: '2026-12-01',
  notes: 'Paciente relata dor há 3 meses',
  createdAt: new Date('2026-08-01T12:00:00Z'),
  patient: { id: 'p-1', name: 'Paciente Um' },
  doctor: { id: 'd-1', name: 'Dr. Fulano' },
}

/** Devolve uma linha com exatamente as colunas que a rota selecionou. */
function mockSelect() {
  ;(db.select as unknown as Mock).mockImplementation((proj?: Record<string, unknown>) => {
    if (!proj) return chain([])
    const linha = Object.fromEntries(Object.keys(proj).map((k) => [k, FIXTURE[k] ?? null]))
    return chain([linha])
  })
}

const req = () => new NextRequest('http://localhost/api/exames?patientId=3f9b1e2a-5c4d-4a7b-9e21-8f0c6d5b4a31')

describe('GET /api/exames — conteúdo clínico do pedido', () => {
  afterEach(() => vi.clearAllMocks())

  it('recepção tem exams:view mas não patients:view_clinical — sem hipótese diagnóstica e sem CID-10', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('receptionist'))
    mockSelect()

    const res = await GET(req())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data[0].hypothesis ?? null).toBeNull()
    expect(body.data[0].cid10 ?? null).toBeNull()
  })

  it('recepção continua vendo o que precisa para o fluxo administrativo', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('receptionist'))
    mockSelect()

    const res = await GET(req())
    const body = await res.json()

    expect(body.data[0].id).toBe('ex-1')
    expect(body.data[0].status).toBe('result_available')
  })

  it.each(['admin', 'doctor'])('%s tem patients:view_clinical e recebe hipótese e CID-10', async (role) => {
    ;(auth as unknown as Mock).mockResolvedValue(session(role))
    mockSelect()

    const res = await GET(req())
    const body = await res.json()

    expect(body.data[0].hypothesis).toBe(FIXTURE.hypothesis)
    expect(body.data[0].cid10).toBe('M23.2')
  })

  it('customPermissions substituem o preset: só exams:view não abre o dado clínico', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('admin', ['exams:view']))
    mockSelect()

    const res = await GET(req())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data[0].hypothesis ?? null).toBeNull()
    expect(body.data[0].cid10 ?? null).toBeNull()
  })
})
