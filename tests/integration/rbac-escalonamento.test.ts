/**
 * RBAC — cenários de escalonamento e permissões personalizadas.
 *
 * Guarda de regressão para os portões que HOJE funcionam. Se alguém trocar um
 * `hasPermission` por uma checagem só de sessão, ou fizer `getEffectivePermissions`
 * unir preset + customPermissions em vez de substituir, este arquivo quebra.
 *
 * Regra que todo teste aqui exercita: customPermissions NÃO é aditivo. Lista
 * custom não vazia substitui inteiramente o preset do papel — um admin com
 * ['dashboard:view'] tem exatamente uma permissão.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), query: { users: { findMany: vi.fn() } } },
}))
vi.mock('@/lib/db/logger', () => ({ logActivity: vi.fn() }))

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { getEffectivePermissions, hasPermission, ROLE_PRESETS } from '@/lib/permissions'
import { GET as PRONTUARIO_GET, POST as PRONTUARIO_POST } from '@/app/api/prontuario/route'
import { GET as DRE_GET } from '@/app/api/relatorios/dre/route'
import { GET as USUARIOS_GET, POST as USUARIOS_POST } from '@/app/api/usuarios/route'

function session(role: string, customPermissions: string[] | null = null) {
  return { user: { id: 'user-1', role, customPermissions, name: 'Fulano', email: 'f@x.com' } }
}

const PID = '3f9b1e2a-5c4d-4a7b-9e21-8f0c6d5b4a31'

const prontuarioGetReq = () => new NextRequest(`http://localhost/api/prontuario?patientId=${PID}`)
const prontuarioPostReq = () =>
  new NextRequest('http://localhost/api/prontuario', {
    method: 'POST',
    body: JSON.stringify({ patientId: PID, content: 'Evolução forjada', type: 'evolucao' }),
  })
const dreReq = () => new NextRequest('http://localhost/api/relatorios/dre?year=2026')
const usuariosReq = () => new NextRequest('http://localhost/api/usuarios')
const usuariosPostReq = () =>
  new NextRequest('http://localhost/api/usuarios', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Invasor',
      email: 'invasor@x.com',
      password: 'senha12345',
      role: 'admin',
    }),
  })

function esperaNenhumaEscrita() {
  expect(db.insert).not.toHaveBeenCalled()
  expect(db.select).not.toHaveBeenCalled()
}

describe('escalonamento — prontuário clínico', () => {
  afterEach(() => vi.clearAllMocks())

  it.each(['receptionist', 'financial'])('%s não lê prontuário (sem patients:view_clinical)', async (role) => {
    ;(auth as unknown as Mock).mockResolvedValue(session(role))

    const res = await PRONTUARIO_GET(prontuarioGetReq())

    expect(res.status).toBe(403)
    esperaNenhumaEscrita()
  })

  it.each(['receptionist', 'financial'])(
    '%s não escreve evolução clínica (sem patients:create_clinical)',
    async (role) => {
      ;(auth as unknown as Mock).mockResolvedValue(session(role))

      const res = await PRONTUARIO_POST(prontuarioPostReq())

      expect(res.status).toBe(403)
      esperaNenhumaEscrita()
    },
  )

  it('médico lê e escreve prontuário', () => {
    expect(hasPermission('doctor', 'patients:view_clinical')).toBe(true)
    expect(hasPermission('doctor', 'patients:create_clinical')).toBe(true)
  })
})

describe('escalonamento — DRE / balancete', () => {
  afterEach(() => vi.clearAllMocks())

  it.each(['doctor', 'receptionist'])('%s não abre o DRE (sem reports:balancete)', async (role) => {
    ;(auth as unknown as Mock).mockResolvedValue(session(role))

    const res = await DRE_GET(dreReq())

    expect(res.status).toBe(403)
    expect(db.select).not.toHaveBeenCalled()
  })

  it('financeiro tem reports:balancete por preset', () => {
    expect(hasPermission('financial', 'reports:balancete')).toBe(true)
  })
})

describe('escalonamento — gestão de usuários', () => {
  afterEach(() => vi.clearAllMocks())

  it.each(['doctor', 'receptionist', 'financial'])('%s não lista usuários (sem users:view)', async (role) => {
    ;(auth as unknown as Mock).mockResolvedValue(session(role))

    const res = await USUARIOS_GET(usuariosReq())

    expect(res.status).toBe(403)
  })

  it.each(['doctor', 'receptionist', 'financial'])(
    '%s não cria usuário admin (sem users:create)',
    async (role) => {
      ;(auth as unknown as Mock).mockResolvedValue(session(role))

      const res = await USUARIOS_POST(usuariosPostReq())

      expect(res.status).toBe(403)
      expect(db.insert).not.toHaveBeenCalled()
    },
  )
})

describe('customPermissions substituem o preset — nunca somam', () => {
  afterEach(() => vi.clearAllMocks())

  it('lista custom não vazia devolve exatamente ela, sem nada do papel', () => {
    expect(getEffectivePermissions('admin', ['dashboard:view'])).toEqual(['dashboard:view'])
    expect(getEffectivePermissions('doctor', ['financial:view'])).toEqual(['financial:view'])
  })

  it('lista vazia ou nula cai no preset do papel', () => {
    expect(getEffectivePermissions('doctor', [])).toEqual(ROLE_PRESETS.doctor)
    expect(getEffectivePermissions('doctor', null)).toEqual(ROLE_PRESETS.doctor)
    expect(getEffectivePermissions('doctor', undefined)).toEqual(ROLE_PRESETS.doctor)
  })

  it('admin com customPermissions ["dashboard:view"] perde TODAS as outras permissões', () => {
    const custom = ['dashboard:view']
    const perdidas = ROLE_PRESETS.admin.filter((p) => p !== 'dashboard:view')

    expect(perdidas.length).toBeGreaterThan(30)
    for (const p of perdidas) {
      expect(hasPermission('admin', p, custom), `permissão ${p}`).toBe(false)
    }
  })

  it('admin com customPermissions ["dashboard:view"] leva 403 no prontuário, no DRE e em usuários', async () => {
    const custom = ['dashboard:view']

    ;(auth as unknown as Mock).mockResolvedValue(session('admin', custom))
    expect((await PRONTUARIO_GET(prontuarioGetReq())).status).toBe(403)

    ;(auth as unknown as Mock).mockResolvedValue(session('admin', custom))
    expect((await PRONTUARIO_POST(prontuarioPostReq())).status).toBe(403)

    ;(auth as unknown as Mock).mockResolvedValue(session('admin', custom))
    expect((await DRE_GET(dreReq())).status).toBe(403)

    ;(auth as unknown as Mock).mockResolvedValue(session('admin', custom))
    expect((await USUARIOS_GET(usuariosReq())).status).toBe(403)

    ;(auth as unknown as Mock).mockResolvedValue(session('admin', custom))
    expect((await USUARIOS_POST(usuariosPostReq())).status).toBe(403)

    esperaNenhumaEscrita()
  })

  it('recepcionista com custom ["patients:view_clinical"] GANHA o prontuário e PERDE a agenda', () => {
    const custom = ['patients:view_clinical']

    expect(hasPermission('receptionist', 'patients:view_clinical', custom)).toBe(true)
    expect(hasPermission('receptionist', 'agenda:view', custom)).toBe(false)
    expect(hasPermission('receptionist', 'leads:view', custom)).toBe(false)
  })
})
