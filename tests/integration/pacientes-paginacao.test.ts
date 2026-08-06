import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { query: { patients: { findMany: vi.fn() } } },
}))

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { GET } from '@/app/api/pacientes/route'

function session(role = 'admin') {
  return { user: { id: 'user-1', role, customPermissions: null } }
}

function req(query = '') {
  return new NextRequest(`http://localhost/api/pacientes${query}`)
}

/** Argumentos que a rota entregou ao Drizzle (`limit`/`offset` do findMany). */
function findManyArgs() {
  return (db.query.patients.findMany as unknown as Mock).mock.calls[0][0] as {
    limit: number
    offset: number
  }
}

describe('GET /api/pacientes — paginação', () => {
  afterEach(() => vi.clearAllMocks())

  function ok() {
    ;(auth as unknown as Mock).mockResolvedValue(session())
    ;(db.query.patients.findMany as unknown as Mock).mockResolvedValue([])
  }

  it('403 sem patients:view', async () => {
    ;(auth as unknown as Mock).mockResolvedValue({
      user: { id: 'u', role: 'financial', customPermissions: ['financial:view'] },
    })
    const res = await GET(req())
    expect(res.status).toBe(403)
    expect(db.query.patients.findMany).not.toHaveBeenCalled()
  })

  it('usa o padrão 20/página quando nada é informado', async () => {
    ok()
    await GET(req())
    expect(findManyArgs()).toMatchObject({ limit: 20, offset: 0 })
  })

  it('respeita paginação válida', async () => {
    ok()
    await GET(req('?page=3&limit=50'))
    expect(findManyArgs()).toMatchObject({ limit: 50, offset: 100 })
  })

  // Sem teto, `?limit=999999` faz a rota tentar carregar a base inteira de
  // pacientes — com `with:` de agendamentos, tratamentos e transações junto.
  it('limita o teto em 100 — ?limit=999999 não carrega a base inteira', async () => {
    ok()
    await GET(req('?limit=999999'))
    expect(findManyArgs().limit).toBe(100)
  })

  it('limite não-numérico cai no padrão em vez de virar NaN', async () => {
    ok()
    await GET(req('?limit=abc&page=xyz'))
    const args = findManyArgs()
    expect(Number.isNaN(args.limit)).toBe(false)
    expect(Number.isNaN(args.offset)).toBe(false)
    expect(args).toMatchObject({ limit: 20, offset: 0 })
  })

  it('zero e negativo não produzem offset negativo', async () => {
    ok()
    await GET(req('?page=0&limit=-1'))
    const args = findManyArgs()
    expect(args.offset).toBeGreaterThanOrEqual(0)
    expect(args.limit).toBeGreaterThan(0)
  })

  it('página negativa não produz offset negativo', async () => {
    ok()
    await GET(req('?page=-5'))
    expect(findManyArgs().offset).toBeGreaterThanOrEqual(0)
  })
})
