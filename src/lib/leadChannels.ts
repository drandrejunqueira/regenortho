/**
 * Canais de captação — o agrupamento que a clínica entende.
 *
 * O CRM grava a origem detalhada (8 valores derivados da atribuição), mas a
 * pergunta do dia a dia é "quanto veio do Google, quanto do Instagram". Anúncio
 * Meta conta como Instagram: é onde a clínica roda as campanhas, e
 * deriveLeadSource já grava Instagram pago como `meta_ads`.
 */
import type { LeadSource } from '@/types'

export const LEAD_CHANNELS = ['google', 'instagram', 'outros'] as const
export type LeadChannel = (typeof LEAD_CHANNELS)[number]

export const LEAD_CHANNEL_SOURCES: Record<LeadChannel, readonly LeadSource[]> = {
  google: ['google_ads', 'google_organic'],
  instagram: ['meta_ads', 'instagram_organic', 'facebook_organic'],
  outros: ['whatsapp', 'referral', 'other'],
}

export const LEAD_CHANNEL_LABELS: Record<LeadChannel, string> = {
  google: 'Google',
  instagram: 'Instagram',
  outros: 'Outros',
}

/** O que entra em cada canal — vai impresso no relatório para o cliente. */
export const LEAD_CHANNEL_HINTS: Record<LeadChannel, string> = {
  google: 'Google Ads e busca orgânica',
  instagram: 'Instagram, Facebook e anúncios Meta',
  outros: 'WhatsApp, indicação e sem origem identificada',
}

/**
 * Cor fixa por canal: a cor segue o canal, nunca a posição no ranking — filtrar
 * não pode repintar quem sobrou. Validada como paleta categórica (CVD ΔE ≥ 9
 * entre todos os pares) sobre fundo branco.
 */
export const LEAD_CHANNEL_COLORS: Record<LeadChannel, string> = {
  google: '#2a78d6',
  instagram: '#eb6834',
  outros: '#1baf7a',
}

export function isLeadChannel(value: string | null | undefined): value is LeadChannel {
  return !!value && (LEAD_CHANNELS as readonly string[]).includes(value)
}

/** Canal de uma origem gravada. Origem desconhecida cai em "outros". */
export function channelOfSource(source: string): LeadChannel {
  return (
    LEAD_CHANNELS.find((c) => (LEAD_CHANNEL_SOURCES[c] as readonly string[]).includes(source)) ??
    'outros'
  )
}
