// Captura e persistência de parâmetros de atribuição (UTMs + IDs de clique).
// Centralizado aqui para não duplicar a lógica frágil em cada página (LEI 10).
// Todo acesso a window/sessionStorage é defensivo: em SSR ou modo privado
// (SecurityError) cai para os defaults sem quebrar o formulário.

const STORAGE_KEY = 'tracking_params'

export const TRACKED_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',
  'gclid',
  'gclsrc',
  'gad_source',
  'gad_campaignid',
  'gbraid',
  'wbraid',
  'srsltid',
  'ttclid',
  'msclkid',
  'src',
  'sck',
] as const

function readUrlParams(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  // Fallback para SPAs com query dentro do hash.
  const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : ''
  const sp = new URLSearchParams(window.location.search || hashQuery)
  const out: Record<string, string> = {}
  sp.forEach((v, k) => {
    if (v) out[k] = v
  })
  return out
}

function readStored(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

/**
 * Captura todos os parâmetros da URL atual e mescla com os já persistidos na
 * sessão (a query string se perde ao navegar entre seções de uma SPA). Deve ser
 * chamado ao montar a landing/página de captação.
 */
export function captureTrackingParams(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const stored = readStored()
  const merged = { ...stored, ...readUrlParams() }
  // Referrer de primeiro toque: só grava se ainda não houver um, senão a
  // navegação interna sobrescreveria a origem real pelo próprio domínio.
  if (!stored.referrer && document.referrer && !document.referrer.includes(window.location.host)) {
    merged.referrer = document.referrer
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    /* modo privado / sandbox — ignora */
  }
  return merged
}

/** Retorna os parâmetros de atribuição atuais (persistidos + URL atual). */
export function getTrackingParams(): Record<string, string> {
  return { ...readStored(), ...readUrlParams() }
}

export type LeadSource =
  | 'google_ads' | 'meta_ads' | 'instagram_organic' | 'facebook_organic'
  | 'google_organic' | 'referral' | 'whatsapp' | 'other'

// IDs de clique que SÓ existem em anúncio pago. gbraid/wbraid substituem o gclid
// em cliques do iOS e de apps — sem eles, tráfego pago do Google era gravado como
// orgânico (era a maior fonte de erro de atribuição do CRM).
const GOOGLE_PAID_IDS = ['gclid', 'gbraid', 'wbraid', 'gad_source', 'gad_campaignid'] as const
const META_PAID_IDS = ['fbclid'] as const

// utm_medium de mídia paga. Cobre o padrão do Google (cpc/ppc), do Meta
// (paid_social) e de campanhas de display/remarketing.
const PAID_MEDIUMS = ['cpc', 'ppc', 'paid', 'display', 'banner', 'cpm', 'retarget', 'remarket']

function hasAny(t: Record<string, string>, keys: readonly string[]): boolean {
  return keys.some((k) => Boolean(t[k]))
}

/**
 * Deriva a origem (enum do CRM) a partir dos UTMs / IDs de clique. Função pura,
 * segura para rodar no servidor (não acessa window). Usada pelas rotas de captação
 * para não hardcodar a origem e contaminar a atribuição.
 *
 * `referrer` é usado só como desempate quando não veio nenhum UTM — é o único
 * jeito honesto de separar orgânico de "origem desconhecida".
 */
export function deriveLeadSource(t: Record<string, string>, referrer = ''): LeadSource {
  const s = (t.utm_source || '').toLowerCase()
  const m = (t.utm_medium || '').toLowerCase()
  const paidMedium = PAID_MEDIUMS.some((p) => m.includes(p))

  // 1. IDs de clique pago — evidência mais forte, vence qualquer UTM.
  if (hasAny(t, GOOGLE_PAID_IDS)) return 'google_ads'
  if (hasAny(t, META_PAID_IDS)) return 'meta_ads'

  // 2. utm_source conhecido + medium pago.
  const isGoogle = s.includes('google') || s.includes('adwords')
  const isMeta = s.includes('meta') || s.includes('facebook') || s === 'fb'
  const isInstagram = s.includes('insta') || s === 'ig'

  if (isGoogle) return paidMedium ? 'google_ads' : 'google_organic'
  if (isMeta) return paidMedium ? 'meta_ads' : 'facebook_organic'
  if (isInstagram) return paidMedium ? 'meta_ads' : 'instagram_organic'

  if (s.includes('whatsapp') || s === 'wa') return 'whatsapp'
  if (m.includes('referral') || s.includes('referr')) return 'referral'

  // 3. Sem UTM útil: cai para o referrer. Um utm_source inventado pelo site
  //    (ex: 'site-dr-andre') não é origem — não pode virar "Google Orgânico".
  const ref = referrer.toLowerCase()
  if (ref) {
    if (ref.includes('google.')) return 'google_organic'
    if (ref.includes('instagram.')) return 'instagram_organic'
    if (ref.includes('facebook.') || ref.includes('fb.com')) return 'facebook_organic'
    if (ref.includes('whatsapp') || ref.includes('wa.me')) return 'whatsapp'
    return 'referral'
  }

  return 'other'
}
