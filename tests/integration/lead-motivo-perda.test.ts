import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { update: vi.fn() } }))
vi.mock('@/lib/db/logger', () => ({ logActivity: vi.fn() }))

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { PATCH } from '@/app/api/leads/[id]/route'

const LEAD_ID = '11111111-1111-4111-8111-111111111111'
const params = { params: Promise.resolve({ id: LEAD_ID }) }

const patch = (body: unknown) =>
  PATCH(
    new NextRequest(`http://localhost/api/leads/${LEAD_ID}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    params,
  )

/** Captura o objeto passado ao .set() do update. */
function mockUpdate() {
  const q = chain([{ id: LEAD_ID, name: 'Ana', status: 'x', phone: '1' }])
  ;(db.update as unknown as Mock).mockReturnValue(q)
  return q.set as Mock
}

afterEach(() => vi.clearAllMocks())

describe('PATCH /api/leads/[id] — motivo da perda', () => {
  it('recusa marcar como perdido sem motivo', async () => {
    ;(auth as unknown as Mock).mockResolvedValue({ user: { id: 'u1', role: 'receptionist', customPermissions: null } })
    const res = await patch({ status: 'lost' })
    expect(res.status).toBe(400)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('recusa motivo em branco', async () => {
    ;(auth as unknown as Mock).mockResolvedValue({ user: { id: 'u1', role: 'receptionist', customPermissions: null } })
    const res = await patch({ status: 'lost', lostReason: '   ' })
    expect(res.status).toBe(400)
  })

  it('grava o motivo ao marcar como perdido', async () => {
    ;(auth as unknown as Mock).mockResolvedValue({ user: { id: 'u1', role: 'receptionist', customPermissions: null } })
    const set = mockUpdate()
    const res = await patch({ status: 'lost', lostReason: 'Queria convênio' })
    expect(res.status).toBe(200)
    expect(set.mock.calls[0][0]).toMatchObject({ status: 'lost', lostReason: 'Queria convênio' })
  })

  it('limpa o motivo antigo quando o lead é reativado', async () => {
    ;(auth as unknown as Mock).mockResolvedValue({ user: { id: 'u1', role: 'receptionist', customPermissions: null } })
    const set = mockUpdate()
    const res = await patch({ status: 'contacted' })
    expect(res.status).toBe(200)
    expect(set.mock.calls[0][0]).toMatchObject({ status: 'contacted', lostReason: null })
  })

  it('edição sem status não mexe no motivo', async () => {
    ;(auth as unknown as Mock).mockResolvedValue({ user: { id: 'u1', role: 'receptionist', customPermissions: null } })
    const set = mockUpdate()
    await patch({ notes: 'ligar amanhã' })
    expect(set.mock.calls[0][0]).not.toHaveProperty('lostReason')
  })
})
