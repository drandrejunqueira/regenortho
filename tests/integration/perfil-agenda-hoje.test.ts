import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(() => ({ ok: true, remaining: 2, retryAfterSec: 0 })) }))
vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { select: vi.fn() } }))
vi.mock('@/lib/doctorAgenda', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/doctorAgenda')>()
  return { ...actual, buildDoctorAgenda: vi.fn(), deliverDoctorAgenda: vi.fn() }
})

import { rateLimit } from '@/lib/rate-limit'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { buildDoctorAgenda, deliverDoctorAgenda } from '@/lib/doctorAgenda'
import { GET, POST } from '@/app/api/perfil/agenda-hoje/route'

function session(userId = 'user-1') {
  return { user: { id: userId, name: 'Dra. Ana', role: 'doctor', customPermissions: null } }
}

describe('GET /api/perfil/agenda-hoje', () => {
  afterEach(() => vi.clearAllMocks())

  it('401 sem sessão', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    expect(buildDoctorAgenda).not.toHaveBeenCalled()
  })

  it('monta a agenda escopada no próprio usuário logado', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('user-1'))
    ;(buildDoctorAgenda as unknown as Mock).mockResolvedValue({
      doctorId: 'user-1', doctorName: 'Dra. Ana', date: '2026-08-06', dateLabel: 'quinta-feira, 06 de agosto',
      slots: [], total: 0, confirmed: 0, markdown: 'md', whatsappText: 'wa',
    })

    const res = await GET()
    expect(res.status).toBe(200)
    expect(buildDoctorAgenda).toHaveBeenCalledWith('user-1')

    const body = await res.json()
    expect(body.data).toMatchObject({ date: '2026-08-06', total: 0, preview: 'wa' })
  })

  // Minimização de dados: `AgendaSlot` carrega telefone do paciente e notas
  // clínicas porque o caminho do WhatsApp (deliverDoctorAgenda) monta o texto a
  // partir do mesmo tipo. O card do perfil não renderiza nenhum dos dois, então
  // a rota projeta os campos e não devolve PII/dado de saúde sem finalidade.
  it('não devolve telefone do paciente nem notas clínicas ao navegador', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('user-1'))
    ;(buildDoctorAgenda as unknown as Mock).mockResolvedValue({
      doctorId: 'user-1', doctorName: 'Dra. Ana', date: '2026-08-06', dateLabel: 'x',
      slots: [
        {
          id: 'apt-1',
          time: '09:00',
          endTime: '09:30',
          patientName: 'João da Silva',
          patientPhone: '+5512999998888',
          type: 'consultation',
          typeLabel: 'Consulta',
          status: 'confirmed',
          statusLabel: 'Confirmado',
          room: 'Sala 2',
          notes: 'Paciente relata dor lombar há 3 meses; investigar hérnia.',
          isPaid: true,
        },
      ],
      total: 1, confirmed: 1, markdown: 'md', whatsappText: 'wa',
    })

    const res = await GET()
    const body = await res.json()
    const [slot] = body.data.slots

    expect(slot).not.toHaveProperty('patientPhone')
    expect(slot).not.toHaveProperty('notes')
    // O telefone/nota não pode reaparecer por outro campo da resposta.
    expect(JSON.stringify(body)).not.toContain('5512999998888')
    expect(JSON.stringify(body)).not.toContain('dor lombar')

    // O que o card consome continua chegando.
    expect(slot).toMatchObject({
      id: 'apt-1',
      time: '09:00',
      patientName: 'João da Silva',
      typeLabel: 'Consulta',
      statusLabel: 'Confirmado',
      room: 'Sala 2',
    })
  })

  it('nunca lê a agenda de outro usuário — o id vem sempre da sessão', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('user-2'))
    ;(buildDoctorAgenda as unknown as Mock).mockResolvedValue({
      doctorId: 'user-2', doctorName: 'Dr. Carlos', date: '2026-08-06', dateLabel: 'x',
      slots: [], total: 0, confirmed: 0, markdown: '', whatsappText: '',
    })
    await GET()
    expect(buildDoctorAgenda).toHaveBeenCalledWith('user-2')
    expect(buildDoctorAgenda).not.toHaveBeenCalledWith('user-1')
  })
})

describe('POST /api/perfil/agenda-hoje', () => {
  beforeEach(() => {
    ;(auth as unknown as Mock).mockResolvedValue(session('user-1'))
  })
  afterEach(() => vi.clearAllMocks())

  it('401 sem sessão', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('400 quando o usuário não tem WhatsApp nem telefone cadastrado', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ whatsapp: null, phone: null }]))
    const res = await POST()
    expect(res.status).toBe(400)
    expect(deliverDoctorAgenda).not.toHaveBeenCalled()
  })

  it('usa dailyAgendaWhatsapp com prioridade sobre phone, e envia com skipEmpty false (é um teste manual)', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ whatsapp: '11999999999', phone: '11888888888' }]))
    ;(deliverDoctorAgenda as unknown as Mock).mockResolvedValue({ ok: true })

    const res = await POST()
    expect(res.status).toBe(200)
    expect(deliverDoctorAgenda).toHaveBeenCalledWith({ doctorId: 'user-1', number: '11999999999', skipEmpty: false })
  })

  it('cai para phone quando dailyAgendaWhatsapp não está configurado', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ whatsapp: null, phone: '11888888888' }]))
    ;(deliverDoctorAgenda as unknown as Mock).mockResolvedValue({ ok: true })

    await POST()
    expect(deliverDoctorAgenda).toHaveBeenCalledWith({ doctorId: 'user-1', number: '11888888888', skipEmpty: false })
  })

  it('502 quando o envio falha, repassando a mensagem de erro', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ whatsapp: '11999999999', phone: null }]))
    ;(deliverDoctorAgenda as unknown as Mock).mockResolvedValue({ ok: false, error: 'Número bloqueado' })

    const res = await POST()
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'Número bloqueado' })
  })
})

describe('POST /api/perfil/agenda-hoje — rate limit', () => {
  afterEach(() => vi.clearAllMocks())

  it('429 com Retry-After quando o usuário estoura o limite', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('user-1'))
    // Caminho feliz mockado: a única razão possível para não dar 429 é a rota
    // não estar consultando o rate limit.
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ whatsapp: '5512999999999', phone: null }]))
    ;(deliverDoctorAgenda as unknown as Mock).mockResolvedValue({ ok: true })
    ;(rateLimit as unknown as Mock).mockReturnValueOnce({ ok: false, remaining: 0, retryAfterSec: 900 })

    const res = await POST()
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('900')
    expect(deliverDoctorAgenda).not.toHaveBeenCalled()
  })

  // A chave precisa ser por usuário: uma chave global deixaria um usuário
  // bloquear o envio manual de todos os outros.
  it('a chave do limite é por usuário, 3 por hora', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(session('user-42'))
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ whatsapp: '5512999999999', phone: null }]))
    ;(deliverDoctorAgenda as unknown as Mock).mockResolvedValue({ ok: true })

    await POST()
    expect(rateLimit).toHaveBeenCalledWith('agenda-manual:user-42', 3, 60 * 60 * 1000)
  })
})
