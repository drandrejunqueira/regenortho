/**
 * SEC-04 — portal do paciente: código de 6 dígitos com freio só por IP.
 *
 * O código tem 900 mil combinações e o atacante não persegue *um* código: testa
 * contra todos os acessos ativos ao mesmo tempo, e cada IP novo era um
 * orçamento novo. Um acerto devolvia dados cadastrais, consultas, tratamentos,
 * exames e financeiro (LGPD art. 11).
 *
 * O que este teste exige:
 * - segundo fator: código + data de nascimento;
 * - 3 nascimentos errados contra o mesmo código anulam o código;
 * - limite global de falhas, somado entre IPs e contado no banco, com aviso;
 * - nenhuma tentativa grava o código ou o nascimento digitados no log.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'
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
import { logActivity } from '@/lib/db/logger'
import { notify } from '@/lib/notifications'
import { POST } from '@/app/api/portal/me/route'
import {
  ACAO_CODIGO_ANULADO,
  ACAO_CODIGO_FALHOU,
  ACAO_CODIGO_INVALIDO,
  LIMITE_GLOBAL_FALHAS_CODIGO,
  LIMITE_PORTAL_POR_IP,
  MAX_FALHAS_POR_CODIGO,
} from '@/lib/portal/entrada'

process.env.AUTH_SECRET = 'segredo-de-teste-do-portal'

const PACIENTE_ID = '3f9b1e2a-5c4d-4a7b-9e21-8f0c6d5b4a31'
const ACESSO_ID = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d'
const TOKEN = 'a'.repeat(64)

function acessoAtivo(birthDate: string | null = '1980-05-17') {
  return {
    id: ACESSO_ID,
    patientId: PACIENTE_ID,
    token: TOKEN,
    code: '424242',
    expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    lastUsedAt: null,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
    patient: { birthDate },
  }
}

// Fila de resultados das consultas de contagem (activity_logs), na ordem em que
// a rota as faz: primeiro o limite global, depois as falhas do código.
let contagens: number[] = []

function mockBanco() {
  ;(db.select as unknown as Mock).mockImplementation((campos?: Record<string, unknown>) => {
    if (campos && 'total' in campos) return chain([{ total: contagens.shift() ?? 0 }])
    return {
      from: (tabela: unknown) =>
        chain(tabela === patients ? [{ id: PACIENTE_ID, name: 'Maria Teste', email: null, phone: '12999990000', birthDate: '1980-05-17', insurance: null }] : []),
    }
  })
  ;(db.update as unknown as Mock).mockImplementation(() => chain([]))
}

let ipSeq = 0
const novoIp = () => `198.51.100.${++ipSeq}`

function codigoReq(body: unknown, ip = novoIp()) {
  return new NextRequest('http://localhost/api/portal/me', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-vercel-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

const chamadasLog = () => (logActivity as unknown as Mock).mock.calls.map(c => c[0])

describe('POST /api/portal/me — entrada por código', () => {
  beforeEach(() => {
    contagens = []
    mockBanco()
  })
  afterEach(() => vi.clearAllMocks())

  it('código sozinho, sem data de nascimento, é recusado antes de consultar o banco', async () => {
    const res = await POST(codigoReq({ code: '424242' }))

    expect(res.status).toBe(400)
    expect(db.query.patientAccessTokens.findMany).not.toHaveBeenCalled()
  })

  it('código + nascimento certos entram e abrem sessão', async () => {
    ;(db.query.patientAccessTokens.findMany as unknown as Mock).mockResolvedValue([acessoAtivo()])

    const res = await POST(codigoReq({ code: '424242', birthDate: '1980-05-17' }))

    expect(res.status).toBe(200)
    expect(res.cookies.get('portal_sessao')?.value).toBeTruthy()
    expect((await res.json()).data.patient.name).toBe('Maria Teste')
  })

  it('código certo com nascimento errado: 401 e falha registrada contra o código, sem gravar o que foi digitado', async () => {
    ;(db.query.patientAccessTokens.findMany as unknown as Mock).mockResolvedValue([acessoAtivo()])
    contagens = [0, 1]

    const res = await POST(codigoReq({ code: '424242', birthDate: '1990-01-01' }))

    expect(res.status).toBe(401)
    expect(res.cookies.get('portal_sessao')).toBeUndefined()
    const [registro] = chamadasLog()
    expect(registro.action).toBe(ACAO_CODIGO_FALHOU)
    expect(registro.targetId).toBe(ACESSO_ID)
    expect(JSON.stringify(chamadasLog())).not.toContain('424242')
    expect(JSON.stringify(chamadasLog())).not.toContain('1990-01-01')
  })

  it(`a ${MAX_FALHAS_POR_CODIGO}ª data errada contra o mesmo código anula o código`, async () => {
    ;(db.query.patientAccessTokens.findMany as unknown as Mock).mockResolvedValue([acessoAtivo()])
    contagens = [0, MAX_FALHAS_POR_CODIGO]

    const res = await POST(codigoReq({ code: '424242', birthDate: '1990-01-01' }))

    expect(res.status).toBe(401)
    const update = (db.update as unknown as Mock).mock.results[0].value
    // Só o código cai: o link (token) continua valendo para o paciente.
    expect(update.set).toHaveBeenCalledWith({ code: null })
    expect(chamadasLog().map(r => r.action)).toContain(ACAO_CODIGO_ANULADO)
  })

  it('paciente sem data de nascimento cadastrada não entra só com o código', async () => {
    ;(db.query.patientAccessTokens.findMany as unknown as Mock).mockResolvedValue([acessoAtivo(null)])
    contagens = [0, 1]

    const res = await POST(codigoReq({ code: '424242', birthDate: '1980-05-17' }))

    expect(res.status).toBe(401)
  })

  it('código que não existe: 401 e a falha entra na contagem global', async () => {
    ;(db.query.patientAccessTokens.findMany as unknown as Mock).mockResolvedValue([])

    const res = await POST(codigoReq({ code: '111111', birthDate: '1980-05-17' }))

    expect(res.status).toBe(401)
    expect(chamadasLog()[0].action).toBe(ACAO_CODIGO_INVALIDO)
  })

  it('limite global: falhas somadas de vários IPs suspendem a entrada por código e avisam a clínica', async () => {
    contagens = [LIMITE_GLOBAL_FALHAS_CODIGO]

    // IP nunca visto antes — o freio por IP sozinho deixaria passar.
    const res = await POST(codigoReq({ code: '424242', birthDate: '1980-05-17' }))

    expect(res.status).toBe(429)
    expect(db.query.patientAccessTokens.findMany).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'system', priority: 'high' }))
  })

  it('o limite global não bloqueia a entrada pelo link (token)', async () => {
    contagens = [LIMITE_GLOBAL_FALHAS_CODIGO]
    ;(db.query.patientAccessTokens.findFirst as unknown as Mock).mockResolvedValue(acessoAtivo())

    const res = await POST(codigoReq({ token: TOKEN }))

    expect(res.status).toBe(200)
  })

  it('código ambíguo (dois acessos ativos) é recusado', async () => {
    ;(db.query.patientAccessTokens.findMany as unknown as Mock).mockResolvedValue([acessoAtivo(), acessoAtivo()])

    const res = await POST(codigoReq({ code: '424242', birthDate: '1980-05-17' }))

    expect(res.status).toBe(401)
  })

  it('o freio por IP continua valendo', async () => {
    ;(db.query.patientAccessTokens.findMany as unknown as Mock).mockResolvedValue([])
    const ip = '203.0.113.200'
    for (let i = 0; i < LIMITE_PORTAL_POR_IP; i++) {
      await POST(codigoReq({ code: '111111', birthDate: '1980-05-17' }, ip))
    }

    const res = await POST(codigoReq({ code: '111111', birthDate: '1980-05-17' }, ip))

    expect(res.status).toBe(429)
  })
})
