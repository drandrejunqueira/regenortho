import { randomBytes } from 'crypto'
import { google } from 'googleapis'
import { getConfig, setConfig } from '@/lib/db/queries/configuracoes'
import { GKEYS, obterClienteAutorizado } from '@/lib/google/oauth'

/**
 * Fase 5 — Notificação automática de buscadores ao publicar conteúdo.
 *
 * O "ping" legado do Google (google.com/ping?sitemap=) foi DESCONTINUADO em 2023.
 * Usamos os métodos modernos e suportados:
 *   1. Search Console API (sitemaps.submit) — reenvia o sitemap (precisa OAuth Google).
 *   2. IndexNow — indexação instantânea no Bing/Yandex e parceiros (gratuito, via chave).
 *
 * Tudo é "fire and forget": nenhuma falha aqui pode quebrar a publicação.
 */

/** URL base do site (config site_url > env > fallback). */
export async function getBaseUrl(): Promise<string> {
  const cfg = await getConfig('site_url')
  const base = cfg || process.env.NEXT_PUBLIC_SITE_URL || 'https://twixeventos.vercel.app'
  return base.replace(/\/$/, '')
}

/** Gera (ou recupera) a chave do IndexNow. */
export async function getOuCriarIndexNowKey(): Promise<string> {
  let key = await getConfig('indexnow_key')
  if (!key) {
    key = randomBytes(16).toString('hex')
    await setConfig('indexnow_key', key, 'Chave de verificação do IndexNow')
  }
  return key
}

/** Reenvia o sitemap ao Google Search Console (se a conta estiver conectada). */
export async function submeterSitemapGoogle(base: string): Promise<{ ok: boolean; motivo?: string }> {
  try {
    const auth = await obterClienteAutorizado()
    if (!auth) return { ok: false, motivo: 'google_nao_conectado' }
    const site = (await getConfig(GKEYS.gscSite)) || process.env.GSC_SITE_URL
    if (!site) return { ok: false, motivo: 'sem_site_gsc' }

    const sc = google.searchconsole({ version: 'v1', auth })
    await sc.sitemaps.submit({ siteUrl: site, feedpath: `${base}/sitemap.xml` })
    return { ok: true }
  } catch (e) {
    console.error('[seo/sitemap-google]', e)
    return { ok: false, motivo: 'erro_api' }
  }
}

/** Envia URLs ao IndexNow (Bing/Yandex e parceiros). */
export async function enviarIndexNow(urls: string[], base: string): Promise<{ ok: boolean; motivo?: string }> {
  const lista = urls.filter(Boolean)
  if (lista.length === 0) return { ok: false, motivo: 'sem_urls' }

  const key = await getOuCriarIndexNowKey()
  const host = new URL(base).host

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${base}/api/seo/indexnow-key`,
        urlList: lista,
      }),
    })
    return { ok: res.ok || res.status === 202, motivo: res.ok ? undefined : `status_${res.status}` }
  } catch (e) {
    console.error('[seo/indexnow]', e)
    return { ok: false, motivo: 'erro_fetch' }
  }
}

/**
 * Notifica os buscadores sobre conteúdo novo/atualizado.
 * Reenvia o sitemap (Google) e dispara IndexNow para as URLs informadas.
 * Aceita caminhos relativos (ex: "/glossario/x") ou URLs absolutas.
 * Nunca lança exceção.
 */
export async function notificarBuscadores(urls: string[]): Promise<void> {
  try {
    const base = await getBaseUrl()
    const absolutas = urls
      .filter(Boolean)
      .map(u => (u.startsWith('http') ? u : `${base}${u.startsWith('/') ? '' : '/'}${u}`))
    await Promise.allSettled([
      submeterSitemapGoogle(base),
      enviarIndexNow(absolutas, base),
    ])
  } catch (e) {
    console.error('[seo/notificar]', e)
  }
}
