import { getGoogleStatus, getSearchConsoleResumo, getAnalyticsResumo } from '@/lib/google/data'
import { db } from '@/lib/db'
import { leads, analyticsEvents } from '@/lib/db/schema'
import { gte, eq, or, and, desc, sql } from 'drizzle-orm'
import { TrafegoClient } from '@/components/admin/TrafegoClient'
import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'

export default async function TrafegoPage() {
  // A página consulta leads direto no banco e renderiza no servidor: sem este
  // guarda, qualquer usuário logado via os dados de captação da clínica.
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user.role as UserRole
  if (!hasPermission(role, 'traffic:view', session.user.customPermissions)) redirect('/dashboard')

  const desde = new Date()
  desde.setDate(desde.getDate() - 30)

  // 1. Google connection status
  const googleStatus = await getGoogleStatus()

  // 2. Fetch GSC + GA4 if connected
  const [gscData, ga4Data] = await Promise.all([
    googleStatus.conectado ? getSearchConsoleResumo(30) : Promise.resolve(null),
    googleStatus.conectado ? getAnalyticsResumo(30) : Promise.resolve(null)
  ])

  // 3. Fetch real CRM leads from paid traffic in the last 30 days
  const dbLeads = await db
    .select({
      id: leads.id,
      name: leads.name,
      phone: leads.phone,
      email: leads.email,
      status: leads.status,
      source: leads.source,
      utmCampaign: leads.utmCampaign,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(
      and(
        or(eq(leads.source, 'google_ads'), eq(leads.source, 'meta_ads')),
        gte(leads.createdAt, desde)
      )
    )
    .orderBy(desc(leads.createdAt))
    .limit(100)

  // Convert dates to ISO strings for client compatibility
  const serializedLeads = dbLeads.map(l => ({
    ...l,
    createdAt: l.createdAt.toISOString()
  }))

  // 4. Fetch first party stats on any LP (starting with /site/lp/)
  const lpStats = await db
    .select({
      tipo: analyticsEvents.tipo,
      total: sql<number>`count(*)::int`,
      visitantes: sql<number>`count(distinct ${analyticsEvents.sessionId})::int`,
    })
    .from(analyticsEvents)
    .where(
      and(
        sql`${analyticsEvents.path} LIKE '/site/lp/%'`,
        gte(analyticsEvents.createdAt, desde)
      )
    )
    .groupBy(analyticsEvents.tipo)

  const statsMap = Object.fromEntries(lpStats.map(s => [s.tipo, s]))
  
  const pageviews = statsMap['pageview']?.total ?? 0
  const clickEvents = statsMap['click']?.total ?? 0
  const uniqueVisitors = statsMap['pageview']?.visitantes ?? 0
  const conversaoRate = uniqueVisitors > 0 ? (serializedLeads.length / uniqueVisitors) * 100 : 0

  // 5. Generate daily series (last 30 days) on all LPs to prevent chart holes
  const dailyVisits = await db
    .select({
      dia: sql<string>`to_char(date_trunc('day', ${analyticsEvents.createdAt}), 'YYYY-MM-DD')`,
      total: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(
      and(
        sql`${analyticsEvents.path} LIKE '/site/lp/%'`,
        eq(analyticsEvents.tipo, 'pageview'),
        gte(analyticsEvents.createdAt, desde)
      )
    )
    .groupBy(sql`date_trunc('day', ${analyticsEvents.createdAt})`)

  const dailyLeads = await db
    .select({
      dia: sql<string>`to_char(date_trunc('day', ${leads.createdAt}), 'YYYY-MM-DD')`,
      total: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(
      and(
        or(eq(leads.source, 'google_ads'), eq(leads.source, 'meta_ads')),
        gte(leads.createdAt, desde)
      )
    )
    .groupBy(sql`date_trunc('day', ${leads.createdAt})`)

  const visitsMap = Object.fromEntries(dailyVisits.map(v => [v.dia, v.total]))
  const leadsMap = Object.fromEntries(dailyLeads.map(l => [l.dia, l.total]))

  // Compile 30 day sequence
  const chartData = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const diaStr = d.toISOString().slice(0, 10)
    chartData.push({
      data: diaStr,
      visitas: visitsMap[diaStr] ?? 0,
      leads: leadsMap[diaStr] ?? 0
    })
  }

  return (
    <TrafegoClient
      googleStatus={{
        conectado: googleStatus.conectado,
        email: googleStatus.email,
        gscSite: googleStatus.gscSite,
        ga4Property: googleStatus.ga4Property
      }}
      leads={serializedLeads}
      firstPartyStats={{
        pageviews,
        clicks: clickEvents,
        visitantes: uniqueVisitors,
        conversao: conversaoRate
      }}
      chartData={chartData}
      gscData={gscData}
      ga4Data={ga4Data}
    />
  )
}
