/**
 * SEC-08 — faltavam CSP, HSTS e Permissions-Policy.
 *
 * O bloco `headers()` do next.config devolvia só X-Frame-Options, nosniff e
 * Referrer-Policy. Sem CSP, qualquer falha de sanitização (o sistema renderiza
 * HTML gerado por IA e conteúdo de site editável) roda com acesso ao cookie de
 * sessão — site público e dashboard dividem a origem. Sem HSTS o primeiro acesso
 * é rebaixável para HTTP. Câmera, microfone e localização ficavam liberados por
 * omissão numa aplicação que não usa nenhum dos três.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

type Header = { key: string; value: string }

async function headersEm(nodeEnv: string): Promise<{ source: string; headers: Map<string, string> }> {
  vi.stubEnv('NODE_ENV', nodeEnv)
  vi.resetModules()
  const { default: config } = await import('../../next.config.mjs')
  const [regra] = (await config.headers!()) as { source: string; headers: Header[] }[]
  return { source: regra.source, headers: new Map(regra.headers.map(h => [h.key.toLowerCase(), h.value])) }
}

function diretivas(csp: string): Map<string, string[]> {
  return new Map(
    csp.split(';').map(d => d.trim()).filter(Boolean).map(d => {
      const [nome, ...valores] = d.split(/\s+/)
      return [nome, valores] as [string, string[]]
    }),
  )
}

describe('next.config — headers de segurança em produção', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('valem para todas as rotas', async () => {
    const { source } = await headersEm('production')
    expect(source).toBe('/(.*)')
  })

  it('mantém os headers que já existiam', async () => {
    const { headers } = await headersEm('production')
    expect(headers.get('x-frame-options')).toBe('DENY')
    expect(headers.get('x-content-type-options')).toBe('nosniff')
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
  })

  it('CSP aplicada (não só Report-Only) com as diretivas que fecham as classes de ataque', async () => {
    const { headers } = await headersEm('production')
    const csp = headers.get('content-security-policy')
    expect(csp).toBeTruthy()
    const d = diretivas(csp!)

    expect(d.get('default-src')).toEqual(["'self'"])
    expect(d.get('object-src')).toEqual(["'none'"])
    expect(d.get('base-uri')).toEqual(["'self'"])
    expect(d.get('form-action')).toEqual(["'self'"])
    expect(d.get('frame-ancestors')).toEqual(["'none'"])
    // Exfiltração por fetch/XHR para outro domínio fica bloqueada.
    expect(d.get('connect-src')).toEqual(["'self'"])
  })

  it('script-src não aceita domínio externo nem eval em produção', async () => {
    const { headers } = await headersEm('production')
    const script = diretivas(headers.get('content-security-policy')!).get('script-src')!

    expect(script).toContain("'self'")
    expect(script).not.toContain("'unsafe-eval'")
    expect(script.filter(v => /^https?:|^\*/.test(v))).toEqual([])
  })

  it('em dev libera só o necessário para o HMR do Next', async () => {
    const { headers } = await headersEm('development')
    const d = diretivas(headers.get('content-security-policy')!)
    expect(d.get('script-src')).toContain("'unsafe-eval'")
    expect(d.get('connect-src')).toContain('ws:')
  })

  it('HSTS de pelo menos 1 ano, cobrindo subdomínios', async () => {
    const { headers } = await headersEm('production')
    const hsts = headers.get('strict-transport-security')!
    const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1])
    expect(maxAge).toBeGreaterThanOrEqual(31536000)
    expect(hsts).toContain('includeSubDomains')
  })

  it('Permissions-Policy fecha câmera, microfone e localização', async () => {
    const { headers } = await headersEm('production')
    const pp = headers.get('permissions-policy')!
    expect(pp).toContain('camera=()')
    expect(pp).toContain('microphone=()')
    expect(pp).toContain('geolocation=()')
  })
})
