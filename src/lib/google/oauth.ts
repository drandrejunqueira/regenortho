import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'
import { getConfig, setConfig } from '@/lib/db/queries/configuracoes'

/**
 * Integração com Google (Search Console + Analytics GA4).
 *
 * O administrador conecta a própria conta Google (que tem acesso ao
 * Search Console e ao Analytics) via OAuth. Guardamos apenas o
 * refresh_token na tabela `configuracoes` para puxar os dados no painel.
 *
 * Variáveis de ambiente necessárias (Google Cloud Console):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 * Opcionais (também configuráveis pelo painel):
 *   GSC_SITE_URL      ex: "https://twixeventos.com.br/" ou "sc-domain:twixeventos.com"
 *   GA4_PROPERTY_ID   ex: "123456789" (somente os números)
 */

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
  'openid',
  'email',
]

// Chaves usadas na tabela configuracoes
export const GKEYS = {
  refreshToken: 'google_refresh_token',
  email: 'google_connected_email',
  connectedAt: 'google_connected_at',
  gscSite: 'google_gsc_site',
  ga4Property: 'google_ga4_property',
} as const

export function googleConfigurado(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

/** Cria um cliente OAuth2 com o redirect baseado na origem da requisição. */
export function criarOAuthClient(origin: string): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${origin}/api/admin/google/callback`,
  )
}

/** Gera a URL de consentimento (offline = recebe refresh_token). */
export function gerarUrlConsentimento(origin: string): string {
  const client = criarOAuthClient(origin)
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
    include_granted_scopes: true,
  })
}

/** Troca o code pelo token e persiste o refresh_token + e-mail conectado. */
export async function trocarCodePorToken(origin: string, code: string): Promise<void> {
  const client = criarOAuthClient(origin)
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error('Google não retornou refresh_token. Reconecte com "prompt=consent".')
  }
  client.setCredentials(tokens)

  // Descobre o e-mail da conta conectada
  let email = ''
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const info = await oauth2.userinfo.get()
    email = info.data.email ?? ''
  } catch {
    // ignora — e-mail é apenas informativo
  }

  await setConfig(GKEYS.refreshToken, tokens.refresh_token, 'Token de atualização Google (Search Console + Analytics)')
  await setConfig(GKEYS.email, email, 'Conta Google conectada')
  await setConfig(GKEYS.connectedAt, new Date().toISOString(), 'Data da conexão com o Google')
}

/** Retorna um cliente autorizado a partir do refresh_token salvo, ou null. */
export async function obterClienteAutorizado(): Promise<OAuth2Client | null> {
  if (!googleConfigurado()) return null
  const refreshToken = await getConfig(GKEYS.refreshToken)
  if (!refreshToken) return null

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  client.setCredentials({ refresh_token: refreshToken })
  return client
}

/** Remove os dados de conexão (desconectar). */
export async function desconectarGoogle(): Promise<void> {
  await setConfig(GKEYS.refreshToken, '')
  await setConfig(GKEYS.email, '')
  await setConfig(GKEYS.connectedAt, '')
}
