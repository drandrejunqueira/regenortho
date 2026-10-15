/**
 * RBAC — GET /api/configuracoes/contas
 *
 * A leitura foi aberta para 'treatments:edit' (preset do MÉDICO) porque a tela
 * de concluir tratamento precisa de um seletor de conta. Só que a rota faz
 * `select()` sem projeção: devolve a linha inteira de `bank_accounts` — banco,
 * agência, número da conta, chave PIX e saldo atual.
 *
 * O médico é descrito em ROLE_META como "sem acesso financeiro" e não tem
 * 'payments:view'. Para preencher um seletor bastam id e nome.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { select: vi.fn() } }))

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { GET } from '@/app/api/configuracoes/contas/route'

function session(role: string, customPermissions: string[] | null = null) {
  return { user: { id: 'user-1', role, customPermissions, name: 'Fulano', email: 'f@x.com' } }
}

const CONTA: Record<string, unknown> = {
  id: 'ba-1',
  name: 'Conta principal',
  bank: 'Itaú',
  agency: '1234',
  account: '56789-0',
  type: 'checking',
  pixKey: 'clinica@regenorto.com.br',
  isDefault: true,
  isActive: true,
  currentBalance: '184320.75',
}

/** `select()` sem projeção devolve a linha completa; com projeção, só as colunas pedidas. */
function mockSelect() {
  ;(db.select as unknown as Mock).mockImplementation((proj?: Record<string, unknown>) => {
    if (!proj) return chain([CONTA])
    return chain([Object.fromEntries(Object.keys(proj).map((k) => [k, CONTA[k] ?? null]))])
  })
}

describe('GET /api/configuracoes/contas — projeção por permissão', () => {
  afterEach(() => vi.clearAllMocks())

  it('médico entra por treatments:edit e recebe só o suficiente para o seletor', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('doctor'))
    mockSelect()

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data[0].id).toBe('ba-1')
    expect(body.data[0].name).toBe('Conta principal')
    expect(body.data[0].account ?? null).toBeNull()
    expect(body.data[0].agency ?? null).toBeNull()
    expect(body.data[0].pixKey ?? null).toBeNull()
    expect(body.data[0].currentBalance ?? null).toBeNull()
  })

  it.each(['admin', 'financial'])('%s tem payments:view e recebe a conta completa', async (role) => {
    ;(auth as unknown as Mock).mockResolvedValue(session(role))
    mockSelect()

    const res = await GET()
    const body = await res.json()

    expect(body.data[0].account).toBe('56789-0')
    expect(body.data[0].currentBalance).toBe('184320.75')
  })

  it('recepção não tem nem payments:view nem treatments:edit — 403', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('receptionist'))
    mockSelect()

    const res = await GET()

    expect(res.status).toBe(403)
  })

  it('customPermissions substituem o preset: só treatments:edit não abre saldo nem PIX', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('admin', ['treatments:edit']))
    mockSelect()

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data[0].pixKey ?? null).toBeNull()
    expect(body.data[0].currentBalance ?? null).toBeNull()
  })
})
