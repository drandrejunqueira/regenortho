import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { query: { leads: { findMany: vi.fn() } } } }))

// Espiona os construtores de predicado do Drizzle para poder afirmar QUAIS
// condições a rota montou. Sem isso, um filtro silenciosamente ignorado passaria
// no teste — a rota devolveria 200 com a lista inteira.
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: vi.fn(actual.eq),
    gte: vi.fn(actual.gte),
    lte: vi.fn(actual.lte),
    isNull: vi.fn(actual.isNull),
    // `sql` é template tag e carrega utilitários (`sql.raw`, `sql.join`) que o
    // Drizzle usa internamente — o Object.assign preserva todos eles.
    sql: Object.assign(
      vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => actual.sql(strings, ...values)),
      actual.sql,
    ),
  }
})

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { eq, gte, isNull, lte, sql } from 'drizzle-orm'
import { GET } from '@/app/api/leads/route'

const call = (qs: string) => GET(new NextRequest(`http://localhost/api/leads?${qs}`))

/**
 * Valores interpolados em todas as chamadas ao template `sql`.
 *
 * Ler a árvore montada não serve: ela referencia a tabela, que referencia as
 * colunas, que referenciam a tabela de volta, e o parâmetro fica embrulhado em
 * classe interna do Drizzle. Espionar o `sql` captura o valor como a rota o
 * passou, que é exatamente o que o teste quer afirmar.
 */
function sqlInterpolations(): unknown[] {
  return (sql as unknown as Mock).mock.calls.flatMap((call) => call.slice(1))
}

beforeEach(() => {
  ;(auth as unknown as Mock).mockResolvedValue({
    user: { id: 'u1', role: 'admin', customPermissions: null },
  })
  ;(db.query.leads.findMany as unknown as Mock).mockResolvedValue([])
})
afterEach(() => vi.clearAllMocks())

describe('GET /api/leads — filtros', () => {
  it('401 sem sessão', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)
    expect((await call('')).status).toBe(401)
    expect(db.query.leads.findMany).not.toHaveBeenCalled()
  })

  it('sem filtro nenhum, o where fica indefinido (não inventa condição)', async () => {
    await call('')
    const arg = (db.query.leads.findMany as unknown as Mock).mock.calls[0][0]
    expect(arg.where).toBeUndefined()
  })

  // Status/origem inválidos iam direto para o cast do Postgres e derrubavam a
  // query inteira com 500 em vez de serem ignorados.
  it('status fora do enum é ignorado em vez de virar erro de cast', async () => {
    await call('status=nao_existe')
    expect(eq).not.toHaveBeenCalled()
    const arg = (db.query.leads.findMany as unknown as Mock).mock.calls[0][0]
    expect(arg.where).toBeUndefined()
  })

  it('origem fora do enum é ignorada', async () => {
    await call('source=tiktok_ads')
    expect(eq).not.toHaveBeenCalled()
  })

  it('status válido vira condição', async () => {
    await call('status=contacted')
    expect(eq).toHaveBeenCalled()
  })

  it('assignedTo=none filtra por responsável nulo', async () => {
    await call('assignedTo=none')
    expect(isNull).toHaveBeenCalled()
    expect(eq).not.toHaveBeenCalled()
  })

  it('assignedTo com uuid válido compara por igualdade', async () => {
    await call('assignedTo=3f2504e0-4f89-11d3-9a0c-0305e82c3301')
    expect(eq).toHaveBeenCalled()
    expect(isNull).not.toHaveBeenCalled()
  })

  it('assignedTo com valor que não é uuid é ignorado', async () => {
    await call('assignedTo=; DROP TABLE leads')
    expect(eq).not.toHaveBeenCalled()
    expect(isNull).not.toHaveBeenCalled()
  })

  it('período aplica limite inferior e superior', async () => {
    await call('from=2026-08-01&to=2026-08-31')
    expect(gte).toHaveBeenCalled()
    expect(lte).toHaveBeenCalled()
  })

  it('data em formato inválido é ignorada', async () => {
    await call('from=01/08/2026')
    expect(gte).not.toHaveBeenCalled()
  })

  it('o fim do período é inclusivo — o dia escolhido inteiro entra', async () => {
    await call('to=2026-08-31')
    const limite = (lte as unknown as Mock).mock.calls[0][1] as Date
    // 31/08 23:59:59.999 em BRT (UTC-3) = 01/09 02:59:59.999 UTC.
    expect(limite.toISOString()).toBe('2026-09-01T02:59:59.999Z')
  })

  it('múltiplas tags viram UMA condição de containment (semântica E)', async () => {
    await call('tag=Convênio&tag=Urgente')
    const arg = (db.query.leads.findMany as unknown as Mock).mock.calls[0][0]
    expect(arg.where).toBeDefined()

    // Ambos os nomes precisam estar no MESMO parâmetro: duas cláusulas separadas
    // dariam semântica OU no `and`, devolvendo lead que tem só uma das tags.
    expect(sqlInterpolations()).toContain('["Convênio","Urgente"]')
  })

  it('tag vazia ou só de espaços não vira filtro', async () => {
    await call('tag=&tag=%20%20')
    const arg = (db.query.leads.findMany as unknown as Mock).mock.calls[0][0]
    expect(arg.where).toBeUndefined()
  })
})
