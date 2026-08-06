import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { update: vi.fn(), select: vi.fn(), query: { users: { findFirst: vi.fn() } } },
}))
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn(async () => '$2a$12$hashed') } }))

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { PATCH } from '@/app/api/usuarios/[id]/route'

function session(role: string, customPermissions: string[] | null = null, id = 'admin-1') {
  return { user: { id, role, customPermissions } }
}

function patchReq(body: unknown) {
  return new NextRequest('http://localhost/api/usuarios/user-9', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

const params = (id = 'user-9') => ({ params: Promise.resolve({ id }) })

/** Prepara o db.update e devolve o builder para inspecionar o `.set()`. */
function mockUpdate(returned: unknown = { id: 'user-9', name: 'Alvo' }) {
  const builder = chain([returned])
  ;(db.update as unknown as Mock).mockReturnValue(builder)
  return builder
}

/**
 * A guarda do último admin lê o alvo e, se ele for admin ativo, conta os admins
 * ativos restantes. Por padrão o alvo é um médico — a guarda nem dispara.
 */
function mockTarget(
  target: { role: string; isActive: boolean } = { role: 'doctor', isActive: true },
  activeAdmins: Array<{ id: string }> = [],
) {
  ;(db.select as unknown as Mock)
    .mockReturnValueOnce(chain([target]))
    .mockReturnValueOnce(chain(activeAdmins))
}

describe('PATCH /api/usuarios/[id] — gate de permissão', () => {
  afterEach(() => vi.clearAllMocks())

  it('401 sem sessão', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)
    const res = await PATCH(patchReq({ role: 'admin' }), params())
    expect(res.status).toBe(401)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('403 para papel sem users:edit — o médico não edita usuários', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('doctor'))
    const res = await PATCH(patchReq({ role: 'admin' }), params())
    expect(res.status).toBe(403)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('403 para recepcionista e financeiro', async () => {
    for (const role of ['receptionist', 'financial']) {
      ;(auth as unknown as Mock).mockResolvedValue(session(role))
      mockTarget()
      const res = await PATCH(patchReq({ isActive: false }), params())
      expect(res.status, `papel ${role}`).toBe(403)
    }
    expect(db.update).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/usuarios/[id] — mass assignment', () => {
  afterEach(() => vi.clearAllMocks())

  // O `updates` é montado com `{ ...rest }` a partir do parse do zod. Isso só
  // seria mass assignment se o schema deixasse passar chave não declarada —
  // `z.object()` no zod v4 descarta desconhecidas, então `rest` nunca carrega
  // coluna fora do schema. Este teste trava esse comportamento: se alguém
  // trocar por `z.looseObject()`/`.passthrough()`, ele fica vermelho.
  it('descarta campos fora do schema — passwordHash e id não chegam ao update', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('admin'))
    mockTarget()
    const builder = mockUpdate()

    const res = await PATCH(
      patchReq({
        isActive: false,
        passwordHash: '$2a$12$INJETADO',
        id: 'outro-usuario',
        createdAt: '1970-01-01',
        email_verified: true,
      }),
      params(),
    )

    expect(res.status).toBe(200)
    const setArg = (builder.set as unknown as Mock).mock.calls[0][0] as Record<string, unknown>

    expect(setArg).not.toHaveProperty('passwordHash')
    expect(setArg).not.toHaveProperty('id')
    expect(setArg).not.toHaveProperty('createdAt')
    expect(setArg).not.toHaveProperty('email_verified')
    expect(setArg).toMatchObject({ isActive: false })
  })

  it('a senha só vira passwordHash pelo caminho do bcrypt, nunca crua', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('admin'))
    const builder = mockUpdate()

    await PATCH(patchReq({ password: 'senha-nova-123' }), params())
    const setArg = (builder.set as unknown as Mock).mock.calls[0][0] as Record<string, unknown>

    expect(setArg.passwordHash).toBe('$2a$12$hashed')
    expect(setArg).not.toHaveProperty('password')
  })

  // O admin não configura o resumo diário de outro usuário. Se configurasse,
  // reescreveria o `dailyAgendaWhatsapp` de um médico e o cron passaria a
  // mandar a agenda dele — nome e horário de cada paciente — para o número
  // trocado, silenciosamente. Os campos saíram do schema: viram chave
  // desconhecida e o zod descarta. Configuração é só autoatendimento, via
  // /api/perfil.
  it('não deixa o admin reescrever o resumo diário de outro usuário', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('admin'))
    const builder = mockUpdate()

    const res = await PATCH(
      patchReq({
        isActive: true,
        dailyAgendaEnabled: true,
        dailyAgendaWhatsapp: '5511900000000',
        dailyAgendaHour: '07:00',
      }),
      params(),
    )

    expect(res.status).toBe(200)
    const setArg = (builder.set as unknown as Mock).mock.calls[0][0] as Record<string, unknown>

    expect(setArg).not.toHaveProperty('dailyAgendaWhatsapp')
    expect(setArg).not.toHaveProperty('dailyAgendaEnabled')
    expect(setArg).not.toHaveProperty('dailyAgendaHour')
    expect(JSON.stringify(setArg)).not.toContain('5511900000000')
    expect(setArg).toMatchObject({ isActive: true })
  })

  it('rejeita role fora do enum', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('admin'))
    const res = await PATCH(patchReq({ role: 'superadmin' }), params())
    expect(res.status).toBe(400)
    expect(db.update).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/usuarios/[id] — guarda do último admin', () => {
  afterEach(() => vi.clearAllMocks())

  it('403 ao rebaixar o último admin ativo', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('admin'))
    // Alvo é admin ativo e é o único da lista.
    mockTarget({ role: 'admin', isActive: true }, [{ id: 'user-9' }])
    mockUpdate()

    const res = await PATCH(patchReq({ role: 'doctor' }), params())

    expect(res.status).toBe(403)
    expect(db.update).not.toHaveBeenCalled()
    const body = await res.json()
    expect(String(body.error)).toMatch(/admin/i)
  })

  it('403 ao desativar o último admin ativo', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('admin'))
    mockTarget({ role: 'admin', isActive: true }, [{ id: 'user-9' }])
    mockUpdate()

    const res = await PATCH(patchReq({ isActive: false }), params())

    expect(res.status).toBe(403)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('permite rebaixar um admin quando sobra outro admin ativo', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('admin'))
    mockTarget({ role: 'admin', isActive: true }, [{ id: 'user-9' }, { id: 'admin-2' }])
    const builder = mockUpdate()

    const res = await PATCH(patchReq({ role: 'doctor' }), params())

    expect(res.status).toBe(200)
    const setArg = (builder.set as unknown as Mock).mock.calls[0][0] as Record<string, unknown>
    expect(setArg).toMatchObject({ role: 'doctor' })
  })

  it('não interfere ao desativar quem não é admin', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('admin'))
    mockTarget({ role: 'doctor', isActive: true })
    const builder = mockUpdate()

    const res = await PATCH(patchReq({ isActive: false }), params())

    expect(res.status).toBe(200)
    const setArg = (builder.set as unknown as Mock).mock.calls[0][0] as Record<string, unknown>
    expect(setArg).toMatchObject({ isActive: false })
  })

  it('promover a admin não dispara a guarda', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('admin'))
    const builder = mockUpdate()

    const res = await PATCH(patchReq({ role: 'admin' }), params())

    expect(res.status).toBe(200)
    expect(db.select).not.toHaveBeenCalled()
    const setArg = (builder.set as unknown as Mock).mock.calls[0][0] as Record<string, unknown>
    expect(setArg).toMatchObject({ role: 'admin' })
  })
})
