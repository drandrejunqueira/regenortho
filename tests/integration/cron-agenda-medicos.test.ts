import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(() => ({ ok: true, remaining: 1, retryAfterSec: 0 })) }))
vi.mock('@/lib/db', () => ({ db: { select: vi.fn(), update: vi.fn() } }))
vi.mock('@/lib/doctorAgenda', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/doctorAgenda')>()
  return { ...actual, deliverDoctorAgenda: vi.fn() }
})

import { db } from '@/lib/db'
import { deliverDoctorAgenda } from '@/lib/doctorAgenda'
import { GET } from '@/app/api/cron/agenda-medicos/route'

function req(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers })
}

const ORIGINAL_SECRET = process.env.CRON_SECRET

describe('GET /api/cron/agenda-medicos', () => {
  beforeEach(() => {
  // O dedupe compara `dailyAgendaLastSent` com o dia de HOJE. Com o relógio real
  // este arquivo só passava em 06/08/2026 — a partir do dia seguinte o médico
  // voltava a ficar elegível e o teste caía num mock não configurado.
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-06T12:00:00.000Z'))
    process.env.CRON_SECRET = 'test-cron-secret'
    ;(db.update as unknown as Mock).mockReturnValue(chain(undefined))
  })
  afterEach(() => {
  vi.useRealTimers()
    process.env.CRON_SECRET = ORIGINAL_SECRET
    vi.clearAllMocks()
  })

  // Fail-closed: a rota expõe a agenda dos médicos e dispara envios de WhatsApp,
  // então sem segredo configurado ela precisa recusar SEMPRE, mesmo com header correto.
  it('401 quando o header Authorization não bate com o CRON_SECRET', async () => {
    const res = await GET(req('http://localhost/api/cron/agenda-medicos', { authorization: 'Bearer errado' }))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Não autorizado.' })
    expect(db.select).not.toHaveBeenCalled()
  })

  it('401 quando não há header Authorization nenhum', async () => {
    const res = await GET(req('http://localhost/api/cron/agenda-medicos'))
    expect(res.status).toBe(401)
  })

  it('401 fail-closed: mesmo com o header correto, sem CRON_SECRET no ambiente a rota recusa', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(req('http://localhost/api/cron/agenda-medicos', { authorization: 'Bearer test-cron-secret' }))
    expect(res.status).toBe(401)
  })

  it('sem médicos elegíveis, devolve sent: 0 e não chama deliverDoctorAgenda', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([]))
    const res = await GET(req('http://localhost/api/cron/agenda-medicos', { authorization: 'Bearer test-cron-secret' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, sent: 0, results: [] })
    expect(deliverDoctorAgenda).not.toHaveBeenCalled()
  })

  it('envia para médico cujo horário configurado já passou e ainda não recebeu hoje', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([
      { id: 'doc-1', name: 'Dra. Ana', hour: '08:00', whatsapp: '11999999999', phone: null, lastSent: null },
    ]))
    ;(deliverDoctorAgenda as unknown as Mock).mockResolvedValue({ ok: true })

    const res = await GET(req('http://localhost/api/cron/agenda-medicos?hora=09:00', { authorization: 'Bearer test-cron-secret' }))
    const body = await res.json()

    expect(body.sent).toBe(1)
    expect(body.results[0]).toMatchObject({ doctor: 'Dra. Ana', ok: true })
    expect(deliverDoctorAgenda).toHaveBeenCalledWith({ doctorId: 'doc-1', number: '11999999999', skipEmpty: true })
    expect(db.update).toHaveBeenCalled() // marca dailyAgendaLastSent
  })

  it('não envia de novo para quem já recebeu hoje (dedupe por dailyAgendaLastSent)', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([
      { id: 'doc-1', name: 'Dra. Ana', hour: '08:00', whatsapp: '11999999999', phone: null, lastSent: '2026-08-06' },
    ]))

    const res = await GET(req('http://localhost/api/cron/agenda-medicos?hora=09:00', { authorization: 'Bearer test-cron-secret' }))
    const body = await res.json()
    expect(body.sent).toBe(0)
    expect(deliverDoctorAgenda).not.toHaveBeenCalled()
  })

  it('não envia antes do horário configurado', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([
      { id: 'doc-1', name: 'Dra. Ana', hour: '10:00', whatsapp: '11999999999', phone: null, lastSent: null },
    ]))

    const res = await GET(req('http://localhost/api/cron/agenda-medicos?hora=09:00', { authorization: 'Bearer test-cron-secret' }))
    const body = await res.json()
    expect(body.sent).toBe(0)
    expect(deliverDoctorAgenda).not.toHaveBeenCalled()
  })

  it('médico sem whatsapp e sem telefone é ignorado', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([
      { id: 'doc-1', name: 'Dra. Ana', hour: '08:00', whatsapp: null, phone: null, lastSent: null },
    ]))

    const res = await GET(req('http://localhost/api/cron/agenda-medicos?hora=09:00', { authorization: 'Bearer test-cron-secret' }))
    const body = await res.json()
    expect(body.sent).toBe(0)
    expect(deliverDoctorAgenda).not.toHaveBeenCalled()
  })

  it('?force=1 ignora horário e dedupe (usado para testar fora da janela)', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([
      { id: 'doc-1', name: 'Dra. Ana', hour: '23:00', whatsapp: '11999999999', phone: null, lastSent: '2026-08-06' },
    ]))
    ;(deliverDoctorAgenda as unknown as Mock).mockResolvedValue({ ok: true })

    const res = await GET(req('http://localhost/api/cron/agenda-medicos?force=1&hora=09:00', { authorization: 'Bearer test-cron-secret' }))
    const body = await res.json()
    expect(body.sent).toBe(1)
    expect(deliverDoctorAgenda).toHaveBeenCalled()
  })

  it('429 com Retry-After quando o rate limit estoura', async () => {
    ;(rateLimit as unknown as Mock).mockReturnValueOnce({ ok: false, remaining: 0, retryAfterSec: 17 })

    const res = await GET(req('http://localhost/api/cron/agenda-medicos', { authorization: 'Bearer test-cron-secret' }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('17')
    expect(deliverDoctorAgenda).not.toHaveBeenCalled()
  })

  it('o rate limit é por rota, com teto de 2/min', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([]))
    await GET(req('http://localhost/api/cron/agenda-medicos', { authorization: 'Bearer test-cron-secret' }))
    expect(rateLimit).toHaveBeenCalledWith('cron:agenda-medicos', 2, 60_000)
  })

  it('em produção o ?force=1 não vale — respeita horário e dedupe', async () => {
    const original = process.env.VERCEL_ENV
    process.env.VERCEL_ENV = 'production'
    ;(db.select as unknown as Mock).mockReturnValue(chain([
      { id: 'doc-1', name: 'Dra. Ana', hour: '23:00', whatsapp: '11999999999', phone: null, lastSent: null },
    ]))

    const res = await GET(req('http://localhost/api/cron/agenda-medicos?force=1&hora=09:00', { authorization: 'Bearer test-cron-secret' }))
    const body = await res.json()
    expect(body.sent).toBe(0)
    expect(deliverDoctorAgenda).not.toHaveBeenCalled()
    process.env.VERCEL_ENV = original
  })
})
