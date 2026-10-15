/**
 * SEC-06 — Content-Type arbitrário em rota pública de asset.
 *
 * /api/og-image e /api/favicon são públicas (sem sessão) e serviam o data URL
 * guardado em `clinicSettings` com o MIME declarado pelo próprio data URL. Um
 * `data:text/html;base64,...` virava HTML executado na origem da aplicação —
 * XSS armazenado, alcançável por qualquer um, e base para phishing hospedado no
 * domínio da clínica. `nosniff` não ajuda: o tipo era declarado, não adivinhado.
 *
 * Exigido: allowlist de MIME na leitura (fora dela → logo estático), teto de
 * tamanho, Content-Disposition inline + CSP sandbox na resposta, e a mesma
 * validação no gravador (PATCH /api/configuracoes/sistema).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    update: vi.fn(),
    insert: vi.fn(),
    query: { clinicSettings: { findFirst: vi.fn() } },
  },
}))
vi.mock('@/lib/db/queries/configuracoes', () => ({ getConfig: vi.fn(async () => null), setConfig: vi.fn() }))
vi.mock('@/lib/google/oauth', () => ({
  GKEYS: { clientId: 'g_id', clientSecret: 'g_secret', refreshToken: 'g_rt', email: 'g_email', connectedAt: 'g_at' },
}))

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { GET as ogImage } from '@/app/api/og-image/route'
import { GET as favicon } from '@/app/api/favicon/route'
import { PATCH } from '@/app/api/configuracoes/sistema/route'

const b64 = (s: string) => Buffer.from(s).toString('base64')
const HTML = `data:text/html;base64,${b64('<script>alert(document.cookie)</script>')}`
const SVG = `data:image/svg+xml;base64,${b64('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')}`
// PNG de 1×1 transparente.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

function comConfig(campos: Record<string, string | null>) {
  ;(db.query.clinicSettings.findFirst as unknown as Mock).mockResolvedValue({ id: 1, ...campos })
}

const rotas = [
  { nome: '/api/og-image', campo: 'ogImageUrl', GET: ogImage },
  { nome: '/api/favicon', campo: 'headerImageUrl', GET: favicon },
] as const

describe.each(rotas)('GET $nome — allowlist de MIME', ({ nome, campo, GET }) => {
  afterEach(() => vi.clearAllMocks())
  const req = () => new Request(`http://localhost${nome}`)

  it('data URL com text/html não é servido com o tipo declarado — cai no logo estático', async () => {
    comConfig({ [campo]: HTML })

    const res = await GET(req())

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/image/logo.png')
    expect(res.headers.get('content-type') ?? '').not.toContain('text/html')
  })

  it('SVG (documento com script) também cai no fallback', async () => {
    comConfig({ [campo]: SVG })
    const res = await GET(req())
    expect(res.status).toBe(307)
  })

  it('parâmetro extra no cabeçalho do data URL não fura a allowlist', async () => {
    comConfig({ [campo]: `data:text/html;charset=utf-8;base64,${b64('<b>x</b>')}` })
    const res = await GET(req())
    expect(res.status).toBe(307)
  })

  it('imagem acima do teto não é decodificada', async () => {
    comConfig({ [campo]: `data:image/png;base64,${'A'.repeat(7 * 1024 * 1024)}` })
    const res = await GET(req())
    expect(res.status).toBe(307)
  })

  it('PNG legítimo é servido com tipo fixo, inline, nosniff e CSP sandbox', async () => {
    comConfig({ [campo]: PNG })

    const res = await GET(req())

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('content-disposition')).toBe('inline')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('content-security-policy')).toContain('sandbox')
  })

  it('URL externa continua funcionando como redirect (é a funcionalidade)', async () => {
    comConfig({ [campo]: 'https://cdn.exemplo.com/og.png' })
    const res = await GET(req())
    expect(res.headers.get('location')).toBe('https://cdn.exemplo.com/og.png')
  })
})

describe('PATCH /api/configuracoes/sistema — validação no gravador', () => {
  afterEach(() => vi.clearAllMocks())

  function patch(body: Record<string, unknown>) {
    ;(auth as unknown as Mock).mockResolvedValue({ user: { id: 'u1', role: 'admin', customPermissions: null } })
    ;(db.query.clinicSettings.findFirst as unknown as Mock).mockResolvedValue({ id: 1 })
    ;(db.update as unknown as Mock).mockReturnValue(chain([]))
    return PATCH(new NextRequest('http://localhost/api/configuracoes/sistema', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }))
  }

  it.each([
    ['ogImageUrl', HTML],
    ['ogImageUrl', SVG],
    ['headerImageUrl', SVG],
    ['headerImageUrl', 'javascript:alert(1)'],
  ])('%s com conteúdo fora da allowlist é recusado antes de gravar', async (campo, valor) => {
    const res = await patch({ [campo]: valor })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/PNG, JPG, WEBP ou ICO/)
    expect(db.update).not.toHaveBeenCalled()
  })

  it.each([
    ['ogImageUrl', PNG],
    ['headerImageUrl', 'data:image/x-icon;base64,AAABAAEAEBAAAAEAIABoBAAAFgAAAA=='],
    ['ogImageUrl', 'https://cdn.exemplo.com/og.png'],
    ['ogImageUrl', ''],
    ['headerImageUrl', null],
  ])('%s com valor aceito grava normalmente', async (campo, valor) => {
    const res = await patch({ [campo]: valor })

    expect(res.status).toBe(200)
    expect(db.update).toHaveBeenCalledTimes(1)
  })
})
