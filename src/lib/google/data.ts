import { google } from 'googleapis'
import { getConfig } from '@/lib/db/queries/configuracoes'
import {
  GKEYS,
  googleConfigurado,
  obterClienteAutorizado,
} from './oauth'

export interface GoogleStatus {
  configurado: boolean        // credenciais (client id/secret) presentes
  conectado: boolean          // refresh token salvo
  email: string | null
  conectadoEm: string | null
  gscSite: string | null
  ga4Property: string | null
}

export async function getGoogleStatus(): Promise<GoogleStatus> {
  const [email, conectadoEm, gscCfg, ga4Cfg, refresh] = await Promise.all([
    getConfig(GKEYS.email),
    getConfig(GKEYS.connectedAt),
    getConfig(GKEYS.gscSite),
    getConfig(GKEYS.ga4Property),
    getConfig(GKEYS.refreshToken),
  ])
  return {
    configurado: await googleConfigurado(),
    conectado: Boolean(refresh),
    email: email || null,
    conectadoEm: conectadoEm || null,
    gscSite: gscCfg || process.env.GSC_SITE_URL || null,
    ga4Property: ga4Cfg || process.env.GA4_PROPERTY_ID || null,
  }
}

function intervaloDatas(dias: number): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - dias)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { start: fmt(start), end: fmt(end) }
}

// ---------- Search Console ----------

export interface GscQuery { query: string; clicks: number; impressions: number; ctr: number; position: number }
export interface GscResumo {
  totalClicks: number
  totalImpressions: number
  ctrMedio: number
  posicaoMedia: number
  topQueries: GscQuery[]
  topPaginas: { page: string; clicks: number; impressions: number }[]
}

export async function getSearchConsoleResumo(dias = 28): Promise<GscResumo | null> {
  const auth = await obterClienteAutorizado()
  if (!auth) return null
  const site = (await getConfig(GKEYS.gscSite)) || process.env.GSC_SITE_URL
  if (!site) return null

  const sc = google.searchconsole({ version: 'v1', auth })
  const { start, end } = intervaloDatas(dias)

  try {
    const [porQuery, porPagina] = await Promise.all([
      sc.searchanalytics.query({
        siteUrl: site,
        requestBody: { startDate: start, endDate: end, dimensions: ['query'], rowLimit: 25 },
      }),
      sc.searchanalytics.query({
        siteUrl: site,
        requestBody: { startDate: start, endDate: end, dimensions: ['page'], rowLimit: 10 },
      }),
    ])

    const rowsQ = porQuery.data.rows ?? []
    const rowsP = porPagina.data.rows ?? []

    const totalClicks = rowsQ.reduce((s, r) => s + (r.clicks ?? 0), 0)
    const totalImpressions = rowsQ.reduce((s, r) => s + (r.impressions ?? 0), 0)
    const ctrMedio = totalImpressions ? totalClicks / totalImpressions : 0
    const posicaoMedia = rowsQ.length
      ? rowsQ.reduce((s, r) => s + (r.position ?? 0), 0) / rowsQ.length
      : 0

    return {
      totalClicks,
      totalImpressions,
      ctrMedio,
      posicaoMedia,
      topQueries: rowsQ.map(r => ({
        query: r.keys?.[0] ?? '—',
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: r.ctr ?? 0,
        position: r.position ?? 0,
      })),
      topPaginas: rowsP.map(r => ({
        page: r.keys?.[0] ?? '—',
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
      })),
    }
  } catch (e) {
    console.error('[google/gsc]', e)
    return null
  }
}

// ---------- Analytics GA4 ----------

export interface Ga4Resumo {
  usuariosAtivos: number
  sessoes: number
  pageviews: number
  duracaoMedia: number
  porDia: { data: string; usuarios: number }[]
  topPaginas: { path: string; views: number }[]
  canais: { canal: string; sessoes: number }[]
}

export async function getAnalyticsResumo(dias = 28): Promise<Ga4Resumo | null> {
  const auth = await obterClienteAutorizado()
  if (!auth) return null
  const propertyId = (await getConfig(GKEYS.ga4Property)) || process.env.GA4_PROPERTY_ID
  if (!propertyId) return null

  const analytics = google.analyticsdata({ version: 'v1beta', auth })
  const property = `properties/${propertyId.replace(/^properties\//, '')}`
  const dateRanges = [{ startDate: `${dias}daysAgo`, endDate: 'today' }]

  try {
    const [totais, porDiaRes, porPaginaRes, canaisRes] = await Promise.all([
      analytics.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          metrics: [
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'averageSessionDuration' },
          ],
        },
      }),
      analytics.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        },
      }),
      analytics.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          dimensions: [{ name: 'pagePath' }],
          metrics: [{ name: 'screenPageViews' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: '10',
        },
      }),
      analytics.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: '8',
        },
      }),
    ])

    const t = totais.data.rows?.[0]?.metricValues ?? []
    const num = (i: number) => Number(t[i]?.value ?? 0)

    return {
      usuariosAtivos: num(0),
      sessoes: num(1),
      pageviews: num(2),
      duracaoMedia: num(3),
      porDia: (porDiaRes.data.rows ?? []).map(r => {
        const raw = r.dimensionValues?.[0]?.value ?? '' // YYYYMMDD
        const data = raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw
        return { data, usuarios: Number(r.metricValues?.[0]?.value ?? 0) }
      }),
      topPaginas: (porPaginaRes.data.rows ?? []).map(r => ({
        path: r.dimensionValues?.[0]?.value ?? '—',
        views: Number(r.metricValues?.[0]?.value ?? 0),
      })),
      canais: (canaisRes.data.rows ?? []).map(r => ({
        canal: r.dimensionValues?.[0]?.value ?? '—',
        sessoes: Number(r.metricValues?.[0]?.value ?? 0),
      })),
    }
  } catch (e) {
    console.error('[google/ga4]', e)
    return null
  }
}
