/**
 * RBAC — /api/portal/token
 *
 * 'portal:manage' está no preset de recepção e médico. Com ela dá para emitir
 * (POST) ou ler (GET) o token/código de acesso de QUALQUER paciente e usá-lo em
 * /api/portal/me, que é uma rota pública e devolve, entre outras coisas, a lista
 * de `transactions` do paciente (valor, vencimento, pago/não pago).
 *
 * Nem recepção nem médico têm 'financial:view'. A ficha do paciente corta essas
 * transações para os dois (/api/pacientes/[id]); o portal não corta — logo o
 * portal é um caminho lateral para o mesmo dado.
 *
 * Emitir credencial de acesso a prontuário/financeiro de terceiro é ação
 * sensível e hoje não deixa rastro nenhum: `activity_logs` não registra. Sem
 * atribuição não há como responder "quem gerou o acesso do paciente X e quando".
 * Este teste exige o registro de auditoria — o mesmo que /api/prontuario POST e
 * /api/pacientes/[id] PATCH já fazem.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    query: { patientAccessTokens: { findFirst: vi.fn() } },
  },
}))
vi.mock('@/lib/db/logger', () => ({ logActivity: vi.fn() }))

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/db/logger'
import { GET, POST } from '@/app/api/portal/token/route'

function session(role: string, customPermissions: string[] | null = null) {
  return { user: { id: 'user-1', role, customPermissions, name: 'Recepção', email: 'r@x.com' } }
}

const PID = '3f9b1e2a-5c4d-4a7b-9e21-8f0c6d5b4a31'

function mockEmissao() {
  ;(db.update as unknown as Mock).mockReturnValue(chain([]))
  ;(db.query.patientAccessTokens.findFirst as unknown as Mock).mockResolvedValue(undefined)
  ;(db.insert as unknown as Mock).mockReturnValue(
    chain([{ token: 'abc123', code: '424242', expiresAt: new Date('2026-09-13T00:00:00Z') }]),
  )
}

const postReq = () =>
  new NextRequest('http://localhost/api/portal/token', {
    method: 'POST',
    body: JSON.stringify({ patientId: PID }),
  })

const getReq = () => new NextRequest(`http://localhost/api/portal/token?patientId=${PID}`)

describe('POST /api/portal/token — auditoria da emissão', () => {
  afterEach(() => vi.clearAllMocks())

  it.each(['receptionist', 'doctor', 'admin'])(
    '%s emite o acesso e a emissão fica registrada em activity_logs',
    async (role) => {
      ;(auth as unknown as Mock).mockResolvedValue(session(role))
      mockEmissao()

      const res = await POST(postReq())

      expect(res.status).toBe(200)
      expect(logActivity).toHaveBeenCalledTimes(1)
      const registro = (logActivity as unknown as Mock).mock.calls[0][0]
      expect(registro.userId).toBe('user-1')
      expect(registro.module).toBe('portal')
      expect(String(registro.action)).toContain('portal')
      // O token e o código são a credencial: não podem ser copiados para o log.
      expect(JSON.stringify(registro)).not.toContain('abc123')
      expect(JSON.stringify(registro)).not.toContain('424242')
    },
  )

  it('financeiro não tem portal:manage — 403 e nada é emitido nem logado', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('financial'))
    mockEmissao()

    const res = await POST(postReq())

    expect(res.status).toBe(403)
    expect(db.insert).not.toHaveBeenCalled()
    expect(logActivity).not.toHaveBeenCalled()
  })

  it('customPermissions substituem o preset: recepcionista sem portal:manage leva 403', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('receptionist', ['patients:view', 'agenda:view']))
    mockEmissao()

    const res = await POST(postReq())

    expect(res.status).toBe(403)
    expect(db.insert).not.toHaveBeenCalled()
  })
})

describe('GET /api/portal/token — auditoria da leitura da credencial', () => {
  afterEach(() => vi.clearAllMocks())

  it('ler o token ativo de um paciente também deixa rastro', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('receptionist'))
    ;(db.select as unknown as Mock).mockReturnValue(
      chain([{ token: 'abc123', code: '424242', expiresAt: new Date('2026-09-13T00:00:00Z') }]),
    )

    const res = await GET(getReq())

    expect(res.status).toBe(200)
    expect(logActivity).toHaveBeenCalledTimes(1)
    expect((logActivity as unknown as Mock).mock.calls[0][0].module).toBe('portal')
  })

  it('patientId inválido não vira consulta', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('receptionist'))
    ;(db.select as unknown as Mock).mockReturnValue(chain([]))

    const res = await GET(new NextRequest('http://localhost/api/portal/token?patientId=nao-e-uuid'))

    expect(res.status).toBe(400)
    expect(db.select).not.toHaveBeenCalled()
  })
})
