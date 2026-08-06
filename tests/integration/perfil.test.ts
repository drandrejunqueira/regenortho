import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { select: vi.fn(), update: vi.fn() } }))
vi.mock('bcryptjs', () => ({ default: { compare: vi.fn(), hash: vi.fn() } }))

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { GET, PATCH } from '@/app/api/perfil/route'

function session(userId = 'user-1') {
  return { user: { id: userId } }
}

function patchReq(body: unknown) {
  return new NextRequest('http://localhost/api/perfil', { method: 'PATCH', body: JSON.stringify(body) })
}

describe('GET /api/perfil', () => {
  afterEach(() => vi.clearAllMocks())

  it('401 sem sessão', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('404 quando o usuário da sessão não existe mais no banco', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session())
    ;(db.select as unknown as Mock).mockReturnValue(chain([]))
    const res = await GET()
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/perfil', () => {
  beforeEach(() => {
    ;(auth as unknown as Mock).mockResolvedValue(session())
  })
  afterEach(() => vi.clearAllMocks())

  it('401 sem sessão', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)
    const res = await PATCH(patchReq({ name: 'Novo Nome' }))
    expect(res.status).toBe(401)
  })

  it('400 quando dailyAgendaHour não é HH:00 em ponto', async () => {
    const res = await PATCH(patchReq({ dailyAgendaHour: '08:30' }))
    expect(res.status).toBe(400)
  })

  it('400 quando dailyAgendaHour tem hora fora do range 00-23', async () => {
    const res = await PATCH(patchReq({ dailyAgendaHour: '24:00' }))
    expect(res.status).toBe(400)
  })

  it('aceita dailyAgendaHour válido em cada limite do dia', async () => {
    ;(db.update as unknown as Mock).mockReturnValue(chain([{ id: 'user-1' }]))
    for (const hora of ['00:00', '08:00', '23:00']) {
      const res = await PATCH(patchReq({ dailyAgendaHour: hora }))
      expect(res.status).toBe(200)
    }
  })

  it('400 quando o avatar não é data URL nem http(s)', async () => {
    const res = await PATCH(patchReq({ avatar: 'ftp://arquivo.com/foto.png' }))
    expect(res.status).toBe(400)
  })

  it('aceita avatar como data URL base64 (padrão do projeto para upload de imagem)', async () => {
    ;(db.update as unknown as Mock).mockReturnValue(chain([{ id: 'user-1' }]))
    const res = await PATCH(patchReq({ avatar: 'data:image/webp;base64,AAAA' }))
    expect(res.status).toBe(200)
  })

  // A política de senha precisa ser a mesma dos dois lados: /api/usuarios/[id]
  // exige 8, e aceitar 6 aqui deixaria o próprio usuário rebaixar a senha
  // abaixo do mínimo que o admin é obrigado a respeitar.
  it('400 quando a nova senha tem menos de 8 caracteres', async () => {
    // Caminho feliz mockado de propósito: assim a única razão possível para
    // não dar 400 é o schema ter aceitado a senha curta.
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ passwordHash: 'hash-antigo' }]))
    ;(bcrypt.compare as unknown as Mock).mockResolvedValue(true)
    ;(bcrypt.hash as unknown as Mock).mockResolvedValue('$2a$12$novo')
    ;(db.update as unknown as Mock).mockReturnValue(chain([{ id: 'user-1' }]))

    const res = await PATCH(patchReq({ currentPassword: 'atual123', newPassword: '1234567' }))
    expect(res.status).toBe(400)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('aceita nova senha com exatamente 8 caracteres', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ passwordHash: 'hash-antigo' }]))
    ;(bcrypt.compare as unknown as Mock).mockResolvedValue(true)
    ;(bcrypt.hash as unknown as Mock).mockResolvedValue('$2a$12$novo')
    ;(db.update as unknown as Mock).mockReturnValue(chain([{ id: 'user-1' }]))

    const res = await PATCH(patchReq({ currentPassword: 'atual123', newPassword: '12345678' }))
    expect(res.status).toBe(200)
  })

  // Sessão órfã: JWT ainda válido apontando para usuário já removido do banco.
  // Sem a guarda, `user.passwordHash` lança TypeError e a rota devolve 500.
  it('401 — e não 500 — quando a sessão aponta para um usuário que não existe mais', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([]))

    const res = await PATCH(patchReq({ currentPassword: 'atual123', newPassword: 'senhaNova123' }))
    expect(res.status).toBe(401)
    expect(db.update).not.toHaveBeenCalled()
  })

  // O número vira destino de mensagem saindo do número da clínica. Sem
  // validação, `dailyAgendaWhatsapp` aceitava qualquer string de até 30 chars.
  it('400 quando dailyAgendaWhatsapp não é número BR plausível', async () => {
    ;(db.update as unknown as Mock).mockReturnValue(chain([{ id: 'user-1' }]))
    for (const invalido of ['abc', '123', 'javascript:alert(1)', '999999999999999', '12036@g.us']) {
      const res = await PATCH(patchReq({ dailyAgendaWhatsapp: invalido }))
      expect(res.status, `valor ${invalido}`).toBe(400)
    }
    expect(db.update).not.toHaveBeenCalled()
  })

  it('aceita formatos brasileiros reais de WhatsApp', async () => {
    ;(db.update as unknown as Mock).mockReturnValue(chain([{ id: 'user-1' }]))
    for (const valido of ['(12) 99999-9999', '12999999999', '5512999999999', '+55 12 99999-9999', '1233334444']) {
      const res = await PATCH(patchReq({ dailyAgendaWhatsapp: valido }))
      expect(res.status, `valor ${valido}`).toBe(200)
    }
  })

  it('aceita null para desligar o resumo diário', async () => {
    ;(db.update as unknown as Mock).mockReturnValue(chain([{ id: 'user-1' }]))
    const res = await PATCH(patchReq({ dailyAgendaWhatsapp: null }))
    expect(res.status).toBe(200)
  })

  it('400 ao trocar senha sem informar a senha atual', async () => {
    const res = await PATCH(patchReq({ newPassword: 'novaSenha123' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Senha atual obrigatória' })
  })

  it('400 quando a senha atual informada está incorreta', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ passwordHash: 'hash-antigo' }]))
    ;(bcrypt.compare as unknown as Mock).mockResolvedValue(false)

    const res = await PATCH(patchReq({ currentPassword: 'errada', newPassword: 'novaSenha123' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Senha atual incorreta' })
  })

  it('troca a senha quando a atual confere', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ passwordHash: 'hash-antigo' }]))
    ;(bcrypt.compare as unknown as Mock).mockResolvedValue(true)
    ;(bcrypt.hash as unknown as Mock).mockResolvedValue('hash-novo')
    ;(db.update as unknown as Mock).mockReturnValue(chain([{ id: 'user-1' }]))

    const res = await PATCH(patchReq({ currentPassword: 'certa', newPassword: 'novaSenha123' }))
    expect(res.status).toBe(200)
    expect(bcrypt.hash).toHaveBeenCalledWith('novaSenha123', 12)
  })

  it('409 quando o novo e-mail já pertence a outro usuário', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ id: 'outro-usuario' }]))
    const res = await PATCH(patchReq({ email: 'ja-existe@example.com' }))
    expect(res.status).toBe(409)
  })

  it('permite manter o próprio e-mail (unicidade não conflita consigo mesmo)', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ id: 'user-1' }]))
    ;(db.update as unknown as Mock).mockReturnValue(chain([{ id: 'user-1' }]))
    const res = await PATCH(patchReq({ email: 'meu-email@example.com' }))
    expect(res.status).toBe(200)
  })

  it('400 em payload que falha na validação zod (nome muito curto)', async () => {
    const res = await PATCH(patchReq({ name: 'A' }))
    expect(res.status).toBe(400)
  })
})
