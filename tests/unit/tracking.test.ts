import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { captureTrackingParams, deriveLeadSource, getTrackingParams } from '@/lib/tracking'

function setUrl(pathAndQuery: string) {
  window.history.pushState({}, '', pathAndQuery)
}

describe('captureTrackingParams', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    setUrl('/')
  })

  it('captura todos os parâmetros da URL, não uma lista fixa', () => {
    setUrl('/?utm_source=google&utm_medium=cpc&sck=abc123&custom_param=xyz')
    const params = captureTrackingParams()
    expect(params).toMatchObject({
      utm_source: 'google',
      utm_medium: 'cpc',
      sck: 'abc123',
      custom_param: 'xyz',
    })
  })

  it('persiste em sessionStorage e mescla com navegação interna sem query', () => {
    setUrl('/?utm_source=google&fbclid=abc')
    captureTrackingParams()

    setUrl('/outra-pagina')
    const merged = captureTrackingParams()
    expect(merged.utm_source).toBe('google')
    expect(merged.fbclid).toBe('abc')
  })

  it('params da URL atual sobrescrevem os persistidos em caso de conflito', () => {
    setUrl('/?utm_source=google')
    captureTrackingParams()

    setUrl('/?utm_source=meta')
    const merged = captureTrackingParams()
    expect(merged.utm_source).toBe('meta')
  })

  it('grava referrer de primeiro toque só quando ainda não há um salvo', () => {
    Object.defineProperty(document, 'referrer', { value: 'https://google.com/search', configurable: true })
    setUrl('/')
    const first = captureTrackingParams()
    expect(first.referrer).toBe('https://google.com/search')

    Object.defineProperty(document, 'referrer', { value: 'https://outro-site.com', configurable: true })
    const second = captureTrackingParams()
    expect(second.referrer).toBe('https://google.com/search')
  })

  it('não grava referrer do próprio domínio (navegação interna)', () => {
    Object.defineProperty(document, 'referrer', {
      value: `${window.location.origin}/pagina-anterior`,
      configurable: true,
    })
    const params = captureTrackingParams()
    expect(params.referrer).toBeUndefined()
  })
})

describe('getTrackingParams', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    setUrl('/')
  })

  it('mescla persistidos com a URL atual sem exigir captureTrackingParams antes', () => {
    setUrl('/?gclid=xyz')
    expect(getTrackingParams().gclid).toBe('xyz')
  })
})

describe('deriveLeadSource', () => {
  it('IDs de clique pago vencem qualquer UTM', () => {
    expect(deriveLeadSource({ gclid: 'abc', utm_source: 'newsletter' })).toBe('google_ads')
    expect(deriveLeadSource({ fbclid: 'abc', utm_source: 'newsletter' })).toBe('meta_ads')
    expect(deriveLeadSource({ gbraid: 'abc' })).toBe('google_ads')
    expect(deriveLeadSource({ wbraid: 'abc' })).toBe('google_ads')
  })

  it('utm_source + medium pago', () => {
    expect(deriveLeadSource({ utm_source: 'google', utm_medium: 'cpc' })).toBe('google_ads')
    expect(deriveLeadSource({ utm_source: 'facebook', utm_medium: 'paid_social' })).toBe('meta_ads')
    expect(deriveLeadSource({ utm_source: 'instagram', utm_medium: 'cpc' })).toBe('meta_ads')
  })

  it('utm_source conhecido sem medium pago vira orgânico', () => {
    expect(deriveLeadSource({ utm_source: 'google' })).toBe('google_organic')
    expect(deriveLeadSource({ utm_source: 'facebook' })).toBe('facebook_organic')
    expect(deriveLeadSource({ utm_source: 'instagram' })).toBe('instagram_organic')
  })

  it('utm_source whatsapp', () => {
    expect(deriveLeadSource({ utm_source: 'whatsapp' })).toBe('whatsapp')
    expect(deriveLeadSource({ utm_source: 'wa' })).toBe('whatsapp')
  })

  it('sem UTM útil cai para o referrer', () => {
    expect(deriveLeadSource({}, 'https://www.google.com/search?q=x')).toBe('google_organic')
    expect(deriveLeadSource({}, 'https://www.instagram.com/')).toBe('instagram_organic')
    expect(deriveLeadSource({}, 'https://www.facebook.com/')).toBe('facebook_organic')
    expect(deriveLeadSource({}, 'https://wa.me/5511999999999')).toBe('whatsapp')
    expect(deriveLeadSource({}, 'https://algum-blog.com/post')).toBe('referral')
  })

  it('sem UTM e sem referrer é "other"', () => {
    expect(deriveLeadSource({})).toBe('other')
  })

  it('utm_source inventado pelo próprio site não vira "Google Orgânico" via referrer interno', () => {
    // Regressão documentada no código: só o referrer real decide o orgânico,
    // nunca um utm_source qualquer sem sinal de mídia paga.
    expect(deriveLeadSource({ utm_source: 'site-dr-andre' })).toBe('other')
  })
})
