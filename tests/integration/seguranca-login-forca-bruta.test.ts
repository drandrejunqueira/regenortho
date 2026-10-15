/**
 * SEC-01 — login sem freio de força bruta.
 *
 * Os quatro e-mails administrativos são públicos (estão no repositório). Antes,
 * `authorize()` comparava o bcrypt e devolvia, sem limite de tentativa nem
 * bloqueio, e a falha não deixava rastro — uma lista de senhas rodava até o fim,
 * de quantos IPs o atacante quisesse.
 *
 * Duas camadas, testadas separadamente:
 * - rota `/api/auth/callback/credentials`: 429 por IP e por e-mail, antes do
 *   NextAuth. A chave por e-mail é a que segura o atacante que troca de IP.
 * - `autorizarCredenciais`: bloqueio progressivo contado em `activity_logs`
 *   (compartilhado entre instâncias), zerado pelo último login bem-sucedido.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/auth/config', () => ({
  handlers: {
    GET: vi.fn(),
    POST: vi.fn(async () => Response.json({ url: 'http://localhost/dashboard' })),
  },
}))
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    query: { users: { findFirst: vi.fn() } },
  },
}))
vi.mock('@/lib/db/logger', () => ({ logActivity: vi.fn() }))

import { handlers } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/db/logger'
import { POST } from '@/app/api/auth/[...nextauth]/route'
import { autorizarCredenciais } from '@/lib/auth/credentials'
import {
  ACAO_LOGIN_BLOQUEADO,
  ACAO_LOGIN_FALHOU,
  LIMITE_LOGIN_POR_EMAIL,
  LIMITE_LOGIN_POR_IP,
  LoginBloqueado,
  bloqueioRestanteMs,
  inicioJanelaFalhas,
} from '@/lib/auth/loginGuard'

const MIN = 60 * 1000

function loginReq(email: string, ip: string, extraHeaders: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/auth/callback/credentials', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-vercel-forwarded-for': ip,
      ...extraHeaders,
    },
    // String, não URLSearchParams: no jsdom o URLSearchParams não é o do undici.
    body: new URLSearchParams({ email, password: 'chute-qualquer', csrfToken: 'x' }).toString(),
  })
}

describe('rota de credenciais — 429 antes do NextAuth', () => {
  afterEach(() => vi.clearAllMocks())

  it('mesmo e-mail vindo de IPs diferentes leva 429 depois do limite por e-mail', async () => {
    const email = 'admin-distribuido@regemorto.com.br'

    for (let i = 0; i < LIMITE_LOGIN_POR_EMAIL; i++) {
      const res = await POST(loginReq(email, `203.0.113.${i + 1}`))
      expect(res.status).toBe(200)
    }

    const bloqueada = await POST(loginReq(email, '198.51.100.77'))

    expect(bloqueada.status).toBe(429)
    expect(Number(bloqueada.headers.get('Retry-After'))).toBeGreaterThan(0)
    // O signIn() do cliente lê `url` para montar o erro — precisa vir o código.
    const corpo = await bloqueada.json()
    expect(new URL(corpo.url).searchParams.get('code')).toBe('muitas_tentativas')
    // A tentativa barrada não chega ao NextAuth (nem ao bcrypt).
    expect(handlers.POST).toHaveBeenCalledTimes(LIMITE_LOGIN_POR_EMAIL)
  })

  it('caixa diferente no e-mail não vira balde novo', async () => {
    for (let i = 0; i < LIMITE_LOGIN_POR_EMAIL; i++) {
      await POST(loginReq('Medico-Caixa@regemorto.com.br', `203.0.113.${100 + i}`))
    }
    const res = await POST(loginReq('MEDICO-CAIXA@REGEMORTO.COM.BR', '203.0.113.250'))
    expect(res.status).toBe(429)
  })

  it('mesmo IP tentando e-mails diferentes leva 429 depois do limite por IP', async () => {
    const ip = '192.0.2.10'
    for (let i = 0; i < LIMITE_LOGIN_POR_IP; i++) {
      const res = await POST(loginReq(`conta-${i}@exemplo.com`, ip))
      expect(res.status).toBe(200)
    }
    const res = await POST(loginReq('mais-uma@exemplo.com', ip))
    expect(res.status).toBe(429)
  })

  it('x-forwarded-for inventado não gera balde novo quando a Vercel informa o IP', async () => {
    const ip = '192.0.2.20'
    for (let i = 0; i < LIMITE_LOGIN_POR_IP; i++) {
      await POST(loginReq(`spoof-${i}@exemplo.com`, ip, { 'x-forwarded-for': `10.0.0.${i}` }))
    }
    const res = await POST(loginReq('spoof-final@exemplo.com', ip, { 'x-forwarded-for': '10.9.9.9' }))
    expect(res.status).toBe(429)
  })

  it('outras rotas do NextAuth (signout, session) não passam pelo freio', async () => {
    const req = new NextRequest('http://localhost/api/auth/signout', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(handlers.POST).toHaveBeenCalledWith(req)
  })
})

describe('autorizarCredenciais — bloqueio progressivo da conta', () => {
  let hashCerto = ''
  const agora = Date.now()

  beforeAll(async () => {
    hashCerto = await bcrypt.hash('senha-certa', 4)
  })

  afterEach(() => vi.clearAllMocks())

  function mockConta(opts: { falhas: number; ultimaFalhaHaMs?: number; existe?: boolean }) {
    ;(db.query.users.findFirst as unknown as Mock).mockResolvedValue(
      opts.existe === false
        ? undefined
        : {
            id: 'user-admin',
            name: 'Admin',
            email: 'admin@regemorto.com.br',
            role: 'admin',
            isActive: true,
            passwordHash: hashCerto,
            customPermissions: null,
            lastLoginAt: null,
          },
    )
    const ultima = opts.ultimaFalhaHaMs !== undefined ? new Date(agora - opts.ultimaFalhaHaMs) : null
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ total: opts.falhas, ultima }]))
    ;(db.update as unknown as Mock).mockReturnValue(chain([]))
  }

  const req = () => new Request('http://localhost/api/auth/callback/credentials', {
    headers: { 'x-vercel-forwarded-for': '203.0.113.9' },
  })

  it('senha errada abaixo do limite: recusa e registra a falha sem guardar a senha', async () => {
    mockConta({ falhas: 3, ultimaFalhaHaMs: MIN })

    const res = await autorizarCredenciais({ email: 'Admin@Regemorto.com.br', password: 'errada123' }, req())

    expect(res).toBeNull()
    expect(logActivity).toHaveBeenCalledTimes(1)
    const registro = (logActivity as unknown as Mock).mock.calls[0][0]
    expect(registro.action).toBe(ACAO_LOGIN_FALHOU)
    expect(registro.module).toBe('auth')
    expect(registro.targetName).toBe('admin@regemorto.com.br')
    expect(registro.ip).toBe('203.0.113.9')
    expect(JSON.stringify(registro)).not.toContain('errada123')
  })

  it('a partir da 5ª falha a conta trava — nem a senha certa entra', async () => {
    mockConta({ falhas: 5, ultimaFalhaHaMs: MIN })

    await expect(
      autorizarCredenciais({ email: 'admin@regemorto.com.br', password: 'senha-certa' }, req()),
    ).rejects.toBeInstanceOf(LoginBloqueado)

    // Não atualiza lastLoginAt — o que zeraria o contador — e marca a tentativa
    // como barrada, não como falha (senão o bloqueio se estenderia sozinho).
    expect(db.update).not.toHaveBeenCalled()
    expect((logActivity as unknown as Mock).mock.calls[0][0].action).toBe(ACAO_LOGIN_BLOQUEADO)
  })

  it('o erro de bloqueio chega ao cliente como code=muitas_tentativas', () => {
    expect(new LoginBloqueado().code).toBe('muitas_tentativas')
  })

  it('e-mail inexistente também trava — a mensagem não revela quais contas existem', async () => {
    mockConta({ falhas: 5, ultimaFalhaHaMs: MIN, existe: false })

    await expect(
      autorizarCredenciais({ email: 'nao-existe@regemorto.com.br', password: 'qualquer1' }, req()),
    ).rejects.toBeInstanceOf(LoginBloqueado)
  })

  it('passado o bloqueio, a senha certa entra e grava lastLoginAt', async () => {
    mockConta({ falhas: 5, ultimaFalhaHaMs: 16 * MIN })

    const res = await autorizarCredenciais({ email: 'admin@regemorto.com.br', password: 'senha-certa' }, req())

    expect(res?.id).toBe('user-admin')
    expect(db.update).toHaveBeenCalledTimes(1)
    expect(logActivity).not.toHaveBeenCalled()
  })

  it('o bloqueio dobra a cada falha extra (15 → 30 → 60 min) e para no teto de 1h', () => {
    const t = Date.now()
    expect(bloqueioRestanteMs(4, new Date(t), t)).toBe(0)
    expect(bloqueioRestanteMs(5, new Date(t), t)).toBe(15 * MIN)
    expect(bloqueioRestanteMs(6, new Date(t), t)).toBe(30 * MIN)
    expect(bloqueioRestanteMs(7, new Date(t), t)).toBe(60 * MIN)
    expect(bloqueioRestanteMs(12, new Date(t), t)).toBe(60 * MIN)
    expect(bloqueioRestanteMs(6, new Date(t - 31 * MIN), t)).toBe(0)
  })

  it('6 falhas: ainda travada 20 min depois da última', async () => {
    mockConta({ falhas: 6, ultimaFalhaHaMs: 20 * MIN })
    await expect(
      autorizarCredenciais({ email: 'admin@regemorto.com.br', password: 'senha-certa' }, req()),
    ).rejects.toBeInstanceOf(LoginBloqueado)
  })

  it('o último login bem-sucedido zera a contagem; nada além de 24h conta', () => {
    const t = Date.now()
    const loginRecente = new Date(t - 2 * 60 * MIN)
    expect(inicioJanelaFalhas(loginRecente, t).getTime()).toBe(loginRecente.getTime())
    expect(inicioJanelaFalhas(new Date(t - 48 * 60 * MIN), t).getTime()).toBe(t - 24 * 60 * MIN)
    expect(inicioJanelaFalhas(null, t).getTime()).toBe(t - 24 * 60 * MIN)
  })
})
