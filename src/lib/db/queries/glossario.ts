import { db } from '@/lib/db'
import { glossarioTermos } from '@/lib/db/schema'
import { eq, and, asc, ilike, or } from 'drizzle-orm'

// ── Funções Públicas ──────────────────────────────────────────

/**
 * Retorna todos os verbetes publicados ordenados alfabeticamente
 */
export const getTermosPublicados = () =>
  db
    .select()
    .from(glossarioTermos)
    .where(eq(glossarioTermos.status, 'publicado'))
    .orderBy(asc(glossarioTermos.termo))

/**
 * Retorna verbetes de uma determinada letra inicial
 */
export const getTermosByLetraPublicados = (letra: string) =>
  db
    .select()
    .from(glossarioTermos)
    .where(
      and(
        eq(glossarioTermos.status, 'publicado'),
        eq(glossarioTermos.letra, letra.toUpperCase())
      )
    )
    .orderBy(asc(glossarioTermos.termo))

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
  let query = db.select().from(glossarioTermos)
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
    // @ts-ignore
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
