/**
 * SEC-05 — credencial do portal viajava e persistia na URL.
 *
 * O token de 7 dias chegava por `?token=` / `?code=`, a página o regravava na
 * barra de endereço mesmo quando o paciente entrava pelo código, e ainda o
 * guardava no localStorage. Vazava por access log, Referer, histórico, print e
 * link compartilhado, e sobrevivia 7 dias em dispositivo compartilhado.
 *
 * Agora: a credencial entra só por corpo de POST e vira um cookie HttpOnly,
 * SameSite=Strict, de 2h, restrito a /api/portal/me. A resposta não devolve o
 * token, e a página limpa a URL e não usa localStorage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { render, screen, waitFor } from '@testing-library/react'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    query: { patientAccessTokens: { findFirst: vi.fn(), findMany: vi.fn() } },
  },
}))
vi.mock('@/lib/db/logger', () => ({ logActivity: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ notify: vi.fn() }))

import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { DELETE, GET, POST } from '@/app/api/portal/me/route'
import { COOKIE_SESSAO_PORTAL, DURACAO_SESSAO_PORTAL_MS, criarValorSessaoPortal } from '@/lib/portal/sessao'
import PortalPage from '@/app/(portal)/portal/page'

process.env.AUTH_SECRET = 'segredo-de-teste-do-portal'

const PACIENTE_ID = '3f9b1e2a-5c4d-4a7b-9e21-8f0c6d5b4a31'
const ACESSO_ID = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d'
const TOKEN = 'f'.repeat(64)

const acesso = (expiresAt = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)) => ({
  id: ACESSO_ID,
  patientId: PACIENTE_ID,
  token: TOKEN,
  code: '424242',
  expiresAt,
  lastUsedAt: null,
  isActive: true,
  createdAt: new Date(),
})

function mockBanco() {
  ;(db.select as unknown as Mock).mockImplementation((campos?: Record<string, unknown>) => {
    if (campos && 'total' in campos) return chain([{ total: 0 }])
    return {
      from: (tabela: unknown) =>
        chain(tabela === patients ? [{ id: PACIENTE_ID, name: 'Maria Teste', email: null, phone: '12999990000', birthDate: '1980-05-17', insurance: null }] : []),
    }
  })
  ;(db.update as unknown as Mock).mockImplementation(() => chain([]))
}

let ipSeq = 0
const headersBase = () => ({ 'x-vercel-forwarded-for': `192.0.2.${++ipSeq}` })

const postToken = () =>
  new NextRequest('http://localhost/api/portal/me', {
    method: 'POST',
    headers: { ...headersBase(), 'content-type': 'application/json' },
    body: JSON.stringify({ token: TOKEN }),
  })

const getComCookie = (valor: string) =>
  new NextRequest('http://localhost/api/portal/me', {
    headers: { ...headersBase(), cookie: `${COOKIE_SESSAO_PORTAL}=${valor}` },
  })

describe('/api/portal/me — sessão por cookie, nunca pela URL', () => {
  beforeEach(mockBanco)
  afterEach(() => vi.clearAllMocks())

  it('GET com ?token= na URL não autentica', async () => {
    ;(db.query.patientAccessTokens.findFirst as unknown as Mock).mockResolvedValue(acesso())

    const res = await GET(new NextRequest(`http://localhost/api/portal/me?token=${TOKEN}`, { headers: headersBase() }))

    expect(res.status).toBe(401)
    expect(db.query.patientAccessTokens.findFirst).not.toHaveBeenCalled()
  })

  it('GET com ?code= na URL não autentica', async () => {
    const res = await GET(new NextRequest('http://localhost/api/portal/me?code=424242', { headers: headersBase() }))
    expect(res.status).toBe(401)
    expect(db.query.patientAccessTokens.findMany).not.toHaveBeenCalled()
  })

  it('POST com o token do link abre sessão em cookie HttpOnly/Strict restrito ao portal', async () => {
    ;(db.query.patientAccessTokens.findFirst as unknown as Mock).mockResolvedValue(acesso())

    const res = await POST(postToken())

    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toMatch(new RegExp(`^${COOKIE_SESSAO_PORTAL}=`))
    expect(setCookie).toMatch(/HttpOnly/i)
    expect(setCookie).toMatch(/SameSite=Strict/i)
    expect(setCookie).toMatch(/Path=\/api\/portal\/me/i)
    expect(res.headers.get('cache-control')).toBe('no-store')
    // O cookie não é o token: roubá-lo não entrega a credencial de 7 dias.
    expect(setCookie).not.toContain(TOKEN)
  })

  it('a resposta não devolve o token (antes voltava em data.token)', async () => {
    ;(db.query.patientAccessTokens.findFirst as unknown as Mock).mockResolvedValue(acesso())

    const res = await POST(postToken())
    const corpo = await res.text()

    expect(corpo).not.toContain(TOKEN)
    expect(JSON.parse(corpo).data.token).toBeUndefined()
  })

  it('a sessão dura 2h e nunca passa do vencimento do acesso', async () => {
    ;(db.query.patientAccessTokens.findFirst as unknown as Mock).mockResolvedValue(acesso())
    const antes = Date.now()
    const res = await POST(postToken())
    const expira = res.cookies.get(COOKIE_SESSAO_PORTAL)?.expires
    expect(expira).toBeInstanceOf(Date)
    expect((expira as Date).getTime()).toBeLessThanOrEqual(antes + DURACAO_SESSAO_PORTAL_MS + 1000)

    const venceLogo = new Date(Date.now() + 10 * 60 * 1000)
    ;(db.query.patientAccessTokens.findFirst as unknown as Mock).mockResolvedValue(acesso(venceLogo))
    const res2 = await POST(postToken())
    const expira2 = res2.cookies.get(COOKIE_SESSAO_PORTAL)?.expires as Date
    expect(Math.abs(expira2.getTime() - venceLogo.getTime())).toBeLessThan(1000)
  })

  it('GET com o cookie da sessão devolve os dados', async () => {
    ;(db.query.patientAccessTokens.findFirst as unknown as Mock).mockResolvedValue(acesso())

    const res = await GET(getComCookie(criarValorSessaoPortal(ACESSO_ID, Date.now() + 60_000)))

    expect(res.status).toBe(200)
    expect((await res.json()).data.patient.id).toBe(PACIENTE_ID)
  })

  it('cookie adulterado (outro id com a assinatura antiga) é recusado', async () => {
    const valido = criarValorSessaoPortal(ACESSO_ID, Date.now() + 60_000)
    const [, exp, assinatura] = valido.split('.')
    const adulterado = `00000000-0000-4000-8000-000000000000.${exp}.${assinatura}`

    const res = await GET(getComCookie(adulterado))

    expect(res.status).toBe(401)
    expect(db.query.patientAccessTokens.findFirst).not.toHaveBeenCalled()
  })

  it('cookie vencido é recusado', async () => {
    const res = await GET(getComCookie(criarValorSessaoPortal(ACESSO_ID, Date.now() - 1000)))
    expect(res.status).toBe(401)
  })

  it('acesso revogado na clínica derruba a sessão e apaga o cookie', async () => {
    ;(db.query.patientAccessTokens.findFirst as unknown as Mock).mockResolvedValue(undefined)

    const res = await GET(getComCookie(criarValorSessaoPortal(ACESSO_ID, Date.now() + 60_000)))

    expect(res.status).toBe(401)
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/i)
  })

  it('DELETE (sair) apaga o cookie', async () => {
    const res = await DELETE()
    expect(res.headers.get('set-cookie')).toMatch(new RegExp(`${COOKIE_SESSAO_PORTAL}=;`))
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/i)
  })
})

describe('página /portal — o token não fica na URL nem no localStorage', () => {
  const dados = {
    patient: { id: PACIENTE_ID, name: 'Maria Teste', email: null, phone: '12999990000', birthDate: '1980-05-17', insurance: null },
    appointments: [], treatments: [], exams: [], transactions: [],
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    window.history.replaceState({}, '', '/')
    localStorage.clear()
  })

  it('entrada pelo link: limpa a URL, manda o token no corpo do POST e não grava nada local', async () => {
    const fetchMock = vi.fn(async () => Response.json({ data: dados }))
    vi.stubGlobal('fetch', fetchMock)
    // Resquício da versão anterior num aparelho que já usou o portal.
    localStorage.setItem('portal_token', 'token-antigo')
    window.history.replaceState({}, '', `/portal?token=${TOKEN}`)

    render(<PortalPage />)

    await waitFor(() => expect(screen.getByText('Maria Teste')).toBeInTheDocument())
    expect(window.location.search).toBe('')
    expect(window.location.pathname).toBe('/portal')
    expect(localStorage.getItem('portal_token')).toBeNull()

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/portal/me')
    expect(url).not.toContain(TOKEN)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ token: TOKEN })
  })

  it('sem link e sem sessão: mostra o formulário de código + data de nascimento', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Sessão expirada' }, { status: 401 })))
    window.history.replaceState({}, '', '/portal')

    render(<PortalPage />)

    await waitFor(() => expect(screen.getByLabelText('Código de Acesso')).toBeInTheDocument())
    expect(screen.getByLabelText('Data de Nascimento')).toBeInTheDocument()
  })
})
