import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { query: { leads: { findMany: vi.fn() } } } }))

// Espiona os construtores de predicado para afirmar QUAL janela a rota montou.
// Sem isso um preset ignorado passaria no teste: a rota devolveria 200 com a
// lista inteira, que é exatamente o peso que o filtro existe para evitar.
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return { ...actual, gte: vi.fn(actual.gte), lte: vi.fn(actual.lte) }
})

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { gte, lte } from 'drizzle-orm'
import { GET } from '@/app/api/leads/route'

const call = (qs: string) => GET(new NextRequest(`http://localhost/api/leads?${qs}`))

/** Bordas da janela como a rota as passou ao Drizzle, em ISO. */
function janela(): { from?: string; to?: string } {
  const from = (gte as unknown as Mock).mock.calls[0]?.[1] as Date | undefined
  const to = (lte as unknown as Mock).mock.calls[0]?.[1] as Date | undefined
  return { from: from?.toISOString(), to: to?.toISOString() }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-28T12:00:00.000Z')) // 09h BRT
  ;(auth as unknown as Mock).mockResolvedValue({
    user: { id: 'u1', role: 'admin', customPermissions: null },
  })
  ;(db.query.leads.findMany as unknown as Mock).mockResolvedValue([])
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('GET /api/leads — recorte por período', () => {
  it('period=today recorta o dia corrente da clínica, de ponta a ponta', () => {
    return call('period=today').then(() => {
      // 00:00 e 23:59:59.999 de 28/08 em BRT (UTC-3).
      expect(janela()).toEqual({
        from: '2026-08-28T03:00:00.000Z',
        to: '2026-08-29T02:59:59.999Z',
      })
    })
  })

  it('period=7d volta seis dias e inclui hoje', async () => {
    await call('period=7d')
    expect(janela().from).toBe('2026-08-22T03:00:00.000Z')
    expect(janela().to).toBe('2026-08-29T02:59:59.999Z')
  })

  it('period=30d é o recorte padrão do quadro', async () => {
    await call('period=30d')
    expect(janela().from).toBe('2026-07-30T03:00:00.000Z')
  })

  it('period=all não aplica nenhuma borda', async () => {
    await call('period=all')
    expect(gte).not.toHaveBeenCalled()
    expect(lte).not.toHaveBeenCalled()
    expect((db.query.leads.findMany as unknown as Mock).mock.calls[0][0].where).toBeUndefined()
  })

  it('o preset vence as datas soltas que sobraram na query', async () => {
    // A tela limpa `from`/`to` ao sair do personalizado, mas uma URL colada por
    // engano não pode furar o recorte e trazer o funil inteiro de volta.
    await call('period=today&from=2020-01-01&to=2030-12-31')
    expect(janela().from).toBe('2026-08-28T03:00:00.000Z')
    expect(janela().to).toBe('2026-08-29T02:59:59.999Z')
  })

  it('period=all ignora datas soltas em vez de recortar por elas', async () => {
    await call('period=all&from=2026-08-01')
    expect(gte).not.toHaveBeenCalled()
  })

  it('period=custom usa as datas escolhidas na tela', async () => {
    await call('period=custom&from=2026-08-01&to=2026-08-31')
    expect(janela()).toEqual({
      from: '2026-08-01T03:00:00.000Z',
      to: '2026-09-01T02:59:59.999Z',
    })
  })

  it('sem period as datas continuam valendo — contrato anterior ao filtro', async () => {
    await call('from=2026-08-01')
    expect(janela().from).toBe('2026-08-01T03:00:00.000Z')
  })

  it('period desconhecido não inventa janela nem derruba a rota', async () => {
    const res = await call('period=90d&from=2026-08-01')
    expect(res.status).toBe(200)
    expect(janela().from).toBe('2026-08-01T03:00:00.000Z')
  })

  it('devolve o período aplicado no meta para a tela saber o que recebeu', async () => {
    const res = await call('period=7d')
    const { meta } = await res.json()
    expect(meta).toMatchObject({ period: '7d', from: '2026-08-22', to: '2026-08-28' })
  })
})

describe('GET /api/leads — teto de cards', () => {
  const leadsFalsos = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `lead-${i}`, name: `Lead ${i}` }))

  it('busca um card a mais que o teto para detectar o corte', async () => {
    await call('period=all')
    const arg = (db.query.leads.findMany as unknown as Mock).mock.calls[0][0]
    expect(arg.limit).toBe(301)
  })

  it('corta no teto e avisa que sobrou lead de fora', async () => {
    // O corte silencioso fazia os leads mais antigos sumirem do quadro sem
    // explicação — a recepção achava que tinham sido excluídos.
    ;(db.query.leads.findMany as unknown as Mock).mockResolvedValue(leadsFalsos(301))
    const { data, meta } = await (await call('period=all')).json()
    expect(data).toHaveLength(300)
    expect(meta.truncated).toBe(true)
  })

  it('não avisa nada quando tudo coube', async () => {
    ;(db.query.leads.findMany as unknown as Mock).mockResolvedValue(leadsFalsos(300))
    const { data, meta } = await (await call('period=all')).json()
    expect(data).toHaveLength(300)
    expect(meta.truncated).toBe(false)
  })
})
