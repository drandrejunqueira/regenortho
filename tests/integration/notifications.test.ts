import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { select: vi.fn() } }))
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return { ...actual, inArray: vi.fn(actual.inArray) }
})

import { inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { GET } from '@/app/api/notifications/route'

function session(role: string, customPermissions: string[] | null = null) {
  return { user: { id: 'user-1', role, customPermissions } }
}

function mockRowsAndCount(rows: unknown[], count: number) {
  ;(db.select as unknown as Mock)
    .mockReturnValueOnce(chain(rows))
    .mockReturnValueOnce(chain([{ count }]))
}

describe('GET /api/notifications', () => {
  afterEach(() => vi.clearAllMocks())

  it('401 sem sessão', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    expect(db.select).not.toHaveBeenCalled()
  })

  it('médico vê avisos de agenda e tratamentos, mas não de leads/estoque (sem as permissões)', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('doctor'))
    mockRowsAndCount([], 0)

    await GET()
    const tipos = (inArray as unknown as Mock).mock.calls[0][1] as string[]
    expect(tipos.sort()).toEqual(
      ['system', 'appointment_new', 'appointment_cancelled', 'treatment_new', 'treatment_status'].sort(),
    )
    expect(tipos).not.toContain('lead_new')
    expect(tipos).not.toContain('stock_low')
  })

  it('financeiro vê avisos de tratamento (view) mas não de leads/agenda/estoque', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('financial'))
    mockRowsAndCount([], 0)

    await GET()
    const tipos = (inArray as unknown as Mock).mock.calls[0][1] as string[]
    expect(tipos.sort()).toEqual(['system', 'treatment_new', 'treatment_status'].sort())
    expect(tipos).not.toContain('lead_new')
    expect(tipos).not.toContain('appointment_new')
    expect(tipos).not.toContain('stock_low')
  })

  it('recepcionista vê leads, agenda, tratamentos e estoque', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('receptionist'))
    mockRowsAndCount([], 0)

    await GET()
    const tipos = (inArray as unknown as Mock).mock.calls[0][1] as string[]
    expect(tipos).toContain('lead_new')
    expect(tipos).toContain('appointment_new')
    expect(tipos).toContain('stock_low')
    expect(tipos).toContain('treatment_new')
  })

  it('permissões customizadas substituem totalmente o preset do papel', () => {
    return (async () => {
      ;(auth as unknown as Mock).mockResolvedValue(session('admin', ['leads:view']))
      mockRowsAndCount([], 0)

      await GET()
      const tipos = (inArray as unknown as Mock).mock.calls[0][1] as string[]
      expect(tipos.sort()).toEqual(['system', 'lead_new'].sort())
      expect(tipos).not.toContain('users:view') // nem faz sentido como tipo, só reforça o corte
      expect(tipos).not.toContain('stock_low')
    })()
  })

  it('devolve as linhas e o unreadCount vindos das duas queries em paralelo', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('admin'))
    mockRowsAndCount(
      [{ id: 'n1', type: 'system', title: 'Oi', body: null, link: null, priority: 'normal', createdAt: new Date(), isRead: false }],
      3,
    )

    const res = await GET()
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.unreadCount).toBe(3)
  })
})
