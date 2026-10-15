import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { select: vi.fn() } }))

// Espiona os predicados para afirmar QUAL janela e QUAL canal a rota montou —
// sem isso um filtro ignorado passaria devolvendo o relatório inteiro.
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    gte: vi.fn(actual.gte),
    lte: vi.fn(actual.lte),
    inArray: vi.fn(actual.inArray),
  }
})

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { gte, inArray, lte } from 'drizzle-orm'
import { GET } from '@/app/api/leads/relatorio/route'

const call = (qs: string) => GET(new NextRequest(`http://localhost/api/leads/relatorio?${qs}`))

const asAdmin = () =>
  (auth as unknown as Mock).mockResolvedValue({
    user: { id: 'u1', role: 'admin', customPermissions: null },
  })

/** As três consultas da rota, na ordem do Promise.all: linhas, total anterior, clínica. */
function mockQueries(rows: unknown[], prevTotal: number, clinicName = 'Regem Orto') {
  ;(db.select as unknown as Mock)
    .mockReturnValueOnce(chain(rows))
    .mockReturnValueOnce(chain([{ total: prevTotal }]))
    .mockReturnValueOnce(chain([{ name: clinicName }]))
}

const isoCalls = (fn: unknown) => (fn as Mock).mock.calls.map((c) => (c[1] as Date).toISOString())

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-15T12:00:00.000Z')) // 09h BRT
  asAdmin()
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('GET /api/leads/relatorio', () => {
  it('401 sem sessão', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)
    expect((await call('period=7d')).status).toBe(401)
    expect(db.select).not.toHaveBeenCalled()
  })

  it('403 para quem não vê o CRM (médico)', async () => {
    ;(auth as unknown as Mock).mockResolvedValue({
      user: { id: 'u2', role: 'doctor', customPermissions: null },
    })
    expect((await call('period=7d')).status).toBe(403)
    expect(db.select).not.toHaveBeenCalled()
  })

  it('400 para "Tudo" e para personalizado sem datas', async () => {
    expect((await call('period=all')).status).toBe(400)
    expect((await call('period=custom&from=2026-10-01')).status).toBe(400)
    expect(db.select).not.toHaveBeenCalled()
  })

  it('recorta o período atual e o anterior, de mesmo tamanho', async () => {
    mockQueries([], 0)
    const res = await call('period=7d')
    expect(res.status).toBe(200)
    // 1ª borda = período atual (09 a 15/10); 2ª = anterior (02 a 08/10), em BRT.
    expect(isoCalls(gte)).toEqual(['2026-10-09T03:00:00.000Z', '2026-10-02T03:00:00.000Z'])
    expect(isoCalls(lte)).toEqual(['2026-10-16T02:59:59.999Z', '2026-10-09T02:59:59.999Z'])
  })

  it('sem period, abre nos últimos 30 dias', async () => {
    mockQueries([], 0)
    const { data } = await (await call('')).json()
    expect(data.range).toEqual({ from: '2026-09-16', to: '2026-10-15', days: 30 })
  })

  it('canal filtra as duas consultas pelas mesmas origens', async () => {
    mockQueries([], 0)
    const { data } = await (await call('period=7d&channel=instagram')).json()
    expect(data.channel).toBe('instagram')
    expect(inArray).toHaveBeenCalledTimes(1)
    expect((inArray as unknown as Mock).mock.calls[0][1]).toEqual([
      'meta_ads',
      'instagram_organic',
      'facebook_organic',
    ])
  })

  it('canal desconhecido é ignorado', async () => {
    mockQueries([], 0)
    const { data } = await (await call('period=7d&channel=tiktok')).json()
    expect(data.channel).toBeNull()
    expect(inArray).not.toHaveBeenCalled()
  })

  it('agrega as linhas e devolve o nome da clínica', async () => {
    mockQueries(
      [
        {
          source: 'google_ads',
          status: 'scheduled',
          createdAt: new Date('2026-10-14T15:00:00Z'),
          specialty: null,
        },
        {
          source: 'meta_ads',
          status: 'new',
          createdAt: new Date('2026-10-15T13:00:00Z'),
          specialty: null,
        },
      ],
      1,
      'Clínica Dr. André'
    )
    const { data, meta } = await (await call('period=7d')).json()
    expect(data.total).toBe(2)
    expect(data.previous.total).toBe(1)
    expect(data.previous.deltaPct).toBe(100)
    expect(data.byChannel.map((c: { total: number }) => c.total)).toEqual([1, 1, 0])
    expect(meta.clinicName).toBe('Clínica Dr. André')
  })
})
