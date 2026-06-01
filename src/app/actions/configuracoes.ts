'use server'

import { revalidatePath } from 'next/cache'
import { setConfig } from '@/lib/db/queries/configuracoes'
import { GKEYS, desconectarGoogle } from '@/lib/google/oauth'
import { submeterSitemapGoogle, enviarIndexNow, getBaseUrl } from '@/lib/seo/notificar'

export async function saveConfigs(entries: Record<string, string>) {
  await Promise.all(
    Object.entries(entries).map(([chave, valor]) => setConfig(chave, valor))
  )
  revalidatePath('/')
  revalidatePath('/site')
  revalidatePath('/configuracoes')
  revalidatePath('/configuracoes/site')
}

/** Liga/desliga flags de funcionalidades (tracking, leitura, ads do glossário). */
export async function setFlags(entries: Record<string, string>) {
  await Promise.all(
    Object.entries(entries).map(([chave, valor]) => setConfig(chave, valor))
  )
  revalidatePath('/')
  revalidatePath('/site')
  revalidatePath('/trafego')
  revalidatePath('/glossario')
  revalidatePath('/site/glossario', 'layout')
}

/** Salva o site do Search Console e a propriedade GA4 usados na integração Google. */
export async function salvarConfigGoogle(entries: { gscSite?: string; ga4Property?: string }) {
  if (entries.gscSite !== undefined) {
    await setConfig(GKEYS.gscSite, entries.gscSite.trim(), 'Site do Search Console')
  }
  if (entries.ga4Property !== undefined) {
    await setConfig(GKEYS.ga4Property, entries.ga4Property.trim(), 'Propriedade GA4 (somente números)')
  }
  revalidatePath('/trafego')
}

/** Desconecta a conta Google (remove refresh token salvo). */
export async function desconectarContaGoogle() {
  await desconectarGoogle()
  revalidatePath('/trafego')
}

/** Reenvia o sitemap ao Google e dispara o IndexNow para as páginas principais. */
export async function reenviarSitemapAgora(): Promise<{ google: boolean; indexnow: boolean }> {
  const base = await getBaseUrl()
  const urls = [base, `${base}/site/tratamentos`, `${base}/site/glossario`, `${base}/site/lp/articulacoes`]
  const [g, i] = await Promise.all([
    submeterSitemapGoogle(base),
    enviarIndexNow(urls, base),
  ])
  return { google: g.ok, indexnow: i.ok }
}
