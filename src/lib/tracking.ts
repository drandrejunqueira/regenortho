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
  'gad_source',
  'gbraid',
  'wbraid',
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
  const merged = { ...readStored(), ...readUrlParams() }
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

/**
 * Deriva a origem (enum do CRM) a partir dos UTMs / IDs de clique. Função pura,
 * segura para rodar no servidor (não acessa window). Usada pelas rotas de captação
 * para não hardcodar a origem e contaminar a atribuição.
 */
export function deriveLeadSource(t: Record<string, string>): LeadSource {
  const s = (t.utm_source || '').toLowerCase()
  const m = (t.utm_medium || '').toLowerCase()
  const paid = m.includes('cpc') || m.includes('paid') || m.includes('ppc')
  if (t.gclid || t.gad_source || s.includes('google')) {
    return paid || t.gclid || t.gad_source ? 'google_ads' : 'google_organic'
  }
  if (t.fbclid || s.includes('meta') || s.includes('facebook') || s === 'fb') {
    return paid || t.fbclid ? 'meta_ads' : 'facebook_organic'
  }
  if (s.includes('insta') || s === 'ig') return 'instagram_organic'
  if (s.includes('whatsapp') || s === 'wa') return 'whatsapp'
  if (m.includes('referral') || s.includes('referr')) return 'referral'
  return 'other'
}
