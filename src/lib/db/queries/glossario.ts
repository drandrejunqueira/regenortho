import { db } from '@/lib/db'
import { glossarioTermos } from '@/lib/db/schema'
import { eq, and, ne, asc, ilike, or, sql } from 'drizzle-orm'

/**
 * Tamanho do resumo trazido nas listagens.
 * O card do glossário exibe 130 caracteres; 280 dá folga para o corte
 * cair numa palavra inteira e ainda alimenta a busca por palavra-chave.
 */
const RESUMO_LEN = 280

/**
 * Resumo em texto puro derivado de `conteudo` direto no Postgres.
 *
 * `conteudo` guarda o artigo completo em HTML e sozinho responde por 1,69 MB
 * dos 1,92 MB de `SELECT *` sobre os 449 verbetes publicados. Trazer o artigo
 * inteiro só para renderizar um resumo de 130 caracteres estourava o teto de
 * 2 MB do data cache do Next — a página caía para "sem cache" e reexecutava a
 * query em todo request, além de mandar os 1,92 MB no payload RSC de cada
 * visita. O recorte é feito no banco, não na aplicação.
 */
const resumoSql = sql<string>`
  substring(
    btrim(
      regexp_replace(
        regexp_replace(coalesce(${glossarioTermos.conteudo}, ''), '<[^>]*>', ' ', 'g'),
        '\\s+', ' ', 'g'
      )
    )
    from 1 for ${RESUMO_LEN}
  )
`

// ── Funções Públicas ──────────────────────────────────────────

/**
 * Retorna todos os verbetes publicados ordenados alfabeticamente.
 *
 * Colunas explícitas + resumo derivado: 232 kB em vez de 1,92 MB (−88%).
 * O artigo completo só é carregado na página do verbete
 * (`getTermoBySlugPublicado`).
 */
export const getTermosPublicados = () =>
  db
    .select({
      id: glossarioTermos.id,
      termo: glossarioTermos.termo,
      slug: glossarioTermos.slug,
      letra: glossarioTermos.letra,
      nicho: glossarioTermos.nicho,
      status: glossarioTermos.status,
      resumo: resumoSql,
    })
    .from(glossarioTermos)
    .where(eq(glossarioTermos.status, 'publicado'))
    .orderBy(asc(glossarioTermos.termo))

export type TermoResumo = Awaited<ReturnType<typeof getTermosPublicados>>[number]

/**
 * Retorna verbetes de uma determinada letra inicial, para linkagem interna.
 *
 * Só devolve os campos que o link usa e corta no banco em vez de trazer a
 * letra inteira para descartar no servidor: no pior caso (letra "A", 39
 * verbetes) são 0,7 kB em vez de 171 kB.
 */
export const getTermosByLetraPublicados = (
  letra: string,
  opts: { excluirId?: string; limite?: number } = {}
) => {
  const query = db
    .select({
      id: glossarioTermos.id,
      termo: glossarioTermos.termo,
      slug: glossarioTermos.slug,
      letra: glossarioTermos.letra,
      nicho: glossarioTermos.nicho,
    })
    .from(glossarioTermos)
    .where(
      and(
        eq(glossarioTermos.status, 'publicado'),
        eq(glossarioTermos.letra, letra.toUpperCase()),
        opts.excluirId ? ne(glossarioTermos.id, opts.excluirId) : undefined
      )
    )
    .orderBy(asc(glossarioTermos.termo))

  return opts.limite ? query.limit(opts.limite) : query
}

/**
 * Retorna um verbete publicado a partir do slug
 */
export const getTermoBySlugPublicado = async (slug: string) =>
  db
    .select()
    .from(glossarioTermos)
    .where(and(eq(glossarioTermos.slug, slug), eq(glossarioTermos.status, 'publicado')))
    .limit(1)
    .then(r => r[0] ?? null)

// ── Funções Admin ──────────────────────────────────────────────

/**
 * Busca flexível de termos para a tabela do painel administrativo
 */
export const getTermosAdmin = async (filters: {
  search?: string
  status?: string
  letra?: string
}) => {
  let query = db.select().from(glossarioTermos).$dynamic()
  const conditions = []

  if (filters.status) {
    conditions.push(eq(glossarioTermos.status, filters.status))
  }
  if (filters.letra) {
    conditions.push(eq(glossarioTermos.letra, filters.letra.toUpperCase()))
  }
  if (filters.search) {
    conditions.push(
      or(
        ilike(glossarioTermos.termo, `%${filters.search}%`),
        ilike(glossarioTermos.nicho, `%${filters.search}%`)
      )
    )
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions))
  }

  return query.orderBy(asc(glossarioTermos.termo))
}

/**
 * Retorna um verbete completo por ID
 */
export const getTermoById = async (id: string) =>
  db
    .select()
    .from(glossarioTermos)
    .where(eq(glossarioTermos.id, id))
    .limit(1)
    .then(r => r[0] ?? null)

/**
 * Cria novos termos em lote (bulk insert), ignorando conflitos de slug
 */
export const createTermos = async (data: (typeof glossarioTermos.$inferInsert)[]) => {
  if (data.length === 0) return []
  return db
    .insert(glossarioTermos)
    .values(data)
    .onConflictDoNothing()
    .returning()
}

/**
 * Atualiza um verbete por ID
 */
export const updateTermo = async (id: string, data: Partial<typeof glossarioTermos.$inferInsert>) =>
  db
    .update(glossarioTermos)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(glossarioTermos.id, id))
    .returning()
    .then(r => r[0])

/**
 * Exclui um verbete por ID
 */
export const deleteTermo = (id: string) =>
  db.delete(glossarioTermos).where(eq(glossarioTermos.id, id))
