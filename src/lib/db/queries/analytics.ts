import { db } from '@/lib/db'
import { analyticsEvents } from '@/lib/db/schema'
import { sql, gte, desc, eq, and } from 'drizzle-orm'

// ── Gravação ────────────────────────────────────────────────────
export const recordEvents = async (events: (typeof analyticsEvents.$inferInsert)[]) => {
  if (events.length === 0) return
  await db.insert(analyticsEvents).values(events)
}

// ── Helpers de período ──────────────────────────────────────────
const desdeDias = (dias: number) => {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d
}

// ── Agregações para o painel admin ──────────────────────────────

/** Visão geral: totais por tipo de evento nos últimos N dias */
export const getResumoTracking = async (dias = 30) => {
  const desde = desdeDias(dias)
  const rows = await db
    .select({
      tipo: analyticsEvents.tipo,
      total: sql<number>`count(*)::int`,
      sessoes: sql<number>`count(distinct ${analyticsEvents.sessionId})::int`,
    })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, desde))
    .groupBy(analyticsEvents.tipo)

  const map = Object.fromEntries(rows.map(r => [r.tipo, r]))
  const sessoes = await db
    .select({ total: sql<number>`count(distinct ${analyticsEvents.sessionId})::int` })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, desde))

  return {
    pageviews: map['pageview']?.total ?? 0,
    cliques:   map['click']?.total ?? 0,
    buscas:    map['search']?.total ?? 0,
    saidas:    map['outbound']?.total ?? 0,
    visitantes: sessoes[0]?.total ?? 0,
  }
}

/** Série temporal de pageviews por dia */
export const getPageviewsPorDia = async (dias = 30) => {
  const desde = desdeDias(dias)
  return db
    .select({
      dia: sql<string>`to_char(date_trunc('day', ${analyticsEvents.createdAt}), 'YYYY-MM-DD')`,
      total: sql<number>`count(*)::int`,
      visitantes: sql<number>`count(distinct ${analyticsEvents.sessionId})::int`,
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.tipo, 'pageview'), gte(analyticsEvents.createdAt, desde)))
    .groupBy(sql`date_trunc('day', ${analyticsEvents.createdAt})`)
    .orderBy(sql`date_trunc('day', ${analyticsEvents.createdAt})`)
}

/** Páginas mais vistas */
export const getTopPaginas = async (dias = 30, limite = 15) => {
  const desde = desdeDias(dias)
  return db
    .select({
      path: analyticsEvents.path,
      total: sql<number>`count(*)::int`,
      visitantes: sql<number>`count(distinct ${analyticsEvents.sessionId})::int`,
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.tipo, 'pageview'), gte(analyticsEvents.createdAt, desde)))
    .groupBy(analyticsEvents.path)
    .orderBy(desc(sql`count(*)`))
    .limit(limite)
}

/** Cliques mais frequentes (por rótulo) */
export const getTopCliques = async (dias = 30, limite = 15) => {
  const desde = desdeDias(dias)
  return db
    .select({
      rotulo: analyticsEvents.rotulo,
      total: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.tipo, 'click'), gte(analyticsEvents.createdAt, desde)))
    .groupBy(analyticsEvents.rotulo)
    .orderBy(desc(sql`count(*)`))
    .limit(limite)
}

/** Palavras-chave buscadas no site */
export const getTopBuscas = async (dias = 30, limite = 20) => {
  const desde = desdeDias(dias)
  return db
    .select({
      termo: analyticsEvents.rotulo,
      total: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.tipo, 'search'), gte(analyticsEvents.createdAt, desde)))
    .groupBy(analyticsEvents.rotulo)
    .orderBy(desc(sql`count(*)`))
    .limit(limite)
}

/** Distribuição por dispositivo */
export const getDispositivos = async (dias = 30) => {
  const desde = desdeDias(dias)
  return db
    .select({
      device: analyticsEvents.device,
      total: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.tipo, 'pageview'), gte(analyticsEvents.createdAt, desde)))
    .groupBy(analyticsEvents.device)
    .orderBy(desc(sql`count(*)`))
}

/** Origens de tráfego (referrers) */
export const getTopReferrers = async (dias = 30, limite = 12) => {
  const desde = desdeDias(dias)
  return db
    .select({
      referrer: analyticsEvents.referrer,
      total: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.tipo, 'pageview'), gte(analyticsEvents.createdAt, desde)))
    .groupBy(analyticsEvents.referrer)
    .orderBy(desc(sql`count(*)`))
    .limit(limite)
}
