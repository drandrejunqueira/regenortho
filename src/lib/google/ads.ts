import { google } from 'googleapis'
import { getConfig } from '@/lib/db/queries/configuracoes'
import { GKEYS, obterClienteAutorizado } from './oauth'

/**
 * Campanhas de mídia paga no painel de Tráfego.
 *
 * Dois caminhos, em ordem de preferência:
 *
 * 1. API do Google Ads — traz custo, cliques, CPC, orçamento e status
 *    (ativa/pausada). Exige um developer token aprovado pelo Google no API
 *    Center da conta de administrador (MCC), além do customer ID da conta de
 *    anúncios. Nível "Test" só lê conta de teste; para dado real é preciso
 *    "Basic".
 *
 * 2. GA4 — traz nome de campanha e sessões de mídia paga, sem custo nenhum de
 *    configuração além do que já existe. Só depende de o Google Ads estar
 *    vinculado à propriedade do GA4. É o fallback enquanto o token não sai.
 *
 * Nada aqui lança: a página de Tráfego recebe o erro em texto e mostra na tela,
 * em vez de renderizar um bloco vazio sem explicação.
 */

// A API do Google Ads troca de versão ~3x por ano e versões antigas são
// desligadas. Se o Google responder "version not found / deprecated", basta
// apontar esta variável para a versão atual — sem mexer em código.
const ADS_API_VERSION = process.env.GOOGLE_ADS_API_VERSION || 'v21'

export type OrigemCampanhas = 'google_ads' | 'ga4' | 'nenhuma'

export interface Campanha {
  id: string
  nome: string
  /** 'ENABLED' | 'PAUSED' | ... — só vem pela API do Google Ads. */
  status: string | null
  impressoes: number | null
  cliques: number | null
  custo: number | null
  cpc: number | null
  ctr: number | null
  conversoes: number | null
  orcamentoDiario: number | null
  /** Sessões atribuídas à campanha no GA4 (caminho 2). */
  sessoes: number | null
}

export interface ResultadoCampanhas {
  origem: OrigemCampanhas
  campanhas: Campanha[]
  /** Mensagem para a tela quando não foi possível trazer os dados. */
  erro: string | null
  /** O que falta configurar, quando for o caso. */
  faltaConfigurar: string[]
}

export interface AdsConfig {
  developerToken: string | null
  customerId: string | null
  loginCustomerId: string | null
}

/** Só dígitos: o Google aceita 1234567890, não 123-456-7890. */
function somenteDigitos(v: string | null): string | null {
  if (!v) return null
  const d = v.replace(/\D/g, '')
  return d || null
}

export async function getAdsConfig(): Promise<AdsConfig> {
  const [token, customer, login] = await Promise.all([
    getConfig(GKEYS.adsDeveloperToken),
    getConfig(GKEYS.adsCustomerId),
    getConfig(GKEYS.adsLoginCustomerId),
  ])
  return {
    developerToken: (token || process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '').trim() || null,
    customerId: somenteDigitos(customer || process.env.GOOGLE_ADS_CUSTOMER_ID || null),
    loginCustomerId: somenteDigitos(login || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || null),
  }
}

const micros = (v: unknown): number => Number(v ?? 0) / 1_000_000

// ---------- Caminho 1: API do Google Ads ----------

const GAQL_CAMPANHAS = `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    campaign_budget.amount_micros,
    metrics.impressions,
    metrics.clicks,
    metrics.cost_micros,
    metrics.conversions,
    metrics.ctr,
    metrics.average_cpc
  FROM campaign
  WHERE segments.date DURING LAST_30_DAYS
    AND campaign.status != 'REMOVED'
  ORDER BY metrics.cost_micros DESC
`

interface LinhaAds {
  campaign?: { id?: string; name?: string; status?: string }
  campaignBudget?: { amountMicros?: string }
  metrics?: {
    impressions?: string
    clicks?: string
    costMicros?: string
    conversions?: number
    ctr?: number
    averageCpc?: string
  }
}

async function buscarNoGoogleAds(cfg: AdsConfig): Promise<ResultadoCampanhas> {
  const auth = await obterClienteAutorizado()
  if (!auth) {
    return { origem: 'nenhuma', campanhas: [], erro: null, faltaConfigurar: ['Conta Google não conectada'] }
  }

  const { token } = await auth.getAccessToken()
  if (!token) {
    return {
      origem: 'nenhuma',
      campanhas: [],
      erro: 'Não foi possível renovar o acesso ao Google. Reconecte a conta.',
      faltaConfigurar: [],
    }
  }

  const url = `https://googleads.googleapis.com/${ADS_API_VERSION}/customers/${cfg.customerId}/googleAds:searchStream`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'developer-token': cfg.developerToken!,
    'Content-Type': 'application/json',
  }
  // Só é necessário quando a conta de anúncios está sob uma conta de administrador.
  if (cfg.loginCustomerId) headers['login-customer-id'] = cfg.loginCustomerId

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: GAQL_CAMPANHAS }),
    cache: 'no-store',
  })

  if (!res.ok) {
    // O erro do Google é específico e acionável ("developer token not approved",
    // "version deprecated"...). Repassa em vez de engolir.
    const corpo = await res.text()
    let detalhe = corpo.slice(0, 300)
    try {
      const json = JSON.parse(corpo)
      detalhe = json?.[0]?.error?.message ?? json?.error?.message ?? detalhe
    } catch {
      /* resposta não-JSON: usa o texto cru */
    }
    return {
      origem: 'nenhuma',
      campanhas: [],
      erro: `Google Ads (${res.status}): ${detalhe}`,
      faltaConfigurar: [],
    }
  }

  // searchStream devolve uma lista de blocos, cada um com "results".
  const blocos = (await res.json()) as Array<{ results?: LinhaAds[] }>
  const linhas = blocos.flatMap((b) => b.results ?? [])

  const campanhas: Campanha[] = linhas.map((l) => ({
    id: l.campaign?.id ?? '',
    nome: l.campaign?.name ?? 'Sem nome',
    status: l.campaign?.status ?? null,
    impressoes: Number(l.metrics?.impressions ?? 0),
    cliques: Number(l.metrics?.clicks ?? 0),
    custo: micros(l.metrics?.costMicros),
    cpc: micros(l.metrics?.averageCpc),
    ctr: Number(l.metrics?.ctr ?? 0) * 100,
    conversoes: Number(l.metrics?.conversions ?? 0),
    orcamentoDiario: micros(l.campaignBudget?.amountMicros),
    sessoes: null,
  }))

  return { origem: 'google_ads', campanhas, erro: null, faltaConfigurar: [] }
}

// ---------- Caminho 2: GA4 ----------

async function buscarNoGa4(dias: number): Promise<ResultadoCampanhas> {
  const auth = await obterClienteAutorizado()
  if (!auth) {
    return { origem: 'nenhuma', campanhas: [], erro: null, faltaConfigurar: ['Conta Google não conectada'] }
  }
  const propertyId = (await getConfig(GKEYS.ga4Property)) || process.env.GA4_PROPERTY_ID
  if (!propertyId) {
    return { origem: 'nenhuma', campanhas: [], erro: null, faltaConfigurar: ['Propriedade GA4'] }
  }

  const analytics = google.analyticsdata({ version: 'v1beta', auth })
  const property = `properties/${propertyId.replace(/^properties\//, '')}`

  const resp = await analytics.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate: `${dias}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'sessionCampaignName' }],
      metrics: [{ name: 'sessions' }],
      // Só mídia paga: sem isto viriam também as sessões orgânicas e diretas.
      dimensionFilter: {
        filter: {
          fieldName: 'sessionMedium',
          inListFilter: { values: ['cpc', 'ppc', 'paid', 'paidsearch'], caseSensitive: false },
        },
      },
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: '25',
    },
  })

  const campanhas: Campanha[] = (resp.data.rows ?? [])
    .map((r) => ({
      id: r.dimensionValues?.[0]?.value ?? '',
      nome: r.dimensionValues?.[0]?.value ?? 'Sem nome',
      status: null,
      impressoes: null,
      cliques: null,
      custo: null,
      cpc: null,
      ctr: null,
      conversoes: null,
      orcamentoDiario: null,
      sessoes: Number(r.metricValues?.[0]?.value ?? 0),
    }))
    // "(not set)" aparece quando o GA4 não conseguiu atribuir a campanha.
    .filter((c) => c.nome && c.nome !== '(not set)')

  return { origem: 'ga4', campanhas, erro: null, faltaConfigurar: [] }
}

// ---------- Entrada única ----------

/**
 * Tenta a API do Google Ads; se ela não estiver configurada, cai para o GA4.
 * Devolve sempre um resultado — o erro vai no campo `erro`, para a tela mostrar.
 */
export async function getCampanhas(dias = 30): Promise<ResultadoCampanhas> {
  const cfg = await getAdsConfig()
  const falta: string[] = []
  if (!cfg.developerToken) falta.push('Developer token do Google Ads')
  if (!cfg.customerId) falta.push('ID da conta de anúncios (customer ID)')

  if (falta.length === 0) {
    try {
      const r = await buscarNoGoogleAds(cfg)
      // Deu certo, ou falhou com erro que o usuário precisa ver.
      if (r.origem === 'google_ads' || r.erro) return r
    } catch (error) {
      console.error('[ads] falha ao consultar o Google Ads:', error)
      return {
        origem: 'nenhuma',
        campanhas: [],
        erro: error instanceof Error ? error.message : 'Erro ao consultar o Google Ads',
        faltaConfigurar: [],
      }
    }
  }

  try {
    const viaGa4 = await buscarNoGa4(dias)
    return { ...viaGa4, faltaConfigurar: [...falta, ...viaGa4.faltaConfigurar] }
  } catch (error) {
    console.error('[ads] falha ao consultar o GA4:', error)
    return {
      origem: 'nenhuma',
      campanhas: [],
      erro: error instanceof Error ? error.message : 'Erro ao consultar o GA4',
      faltaConfigurar: falta,
    }
  }
}
