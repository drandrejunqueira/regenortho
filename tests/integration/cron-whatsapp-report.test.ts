import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(() => ({ ok: true, remaining: 1, retryAfterSec: 0 })) }))
vi.mock('@/lib/db/queries/configuracoes', () => ({ getConfig: vi.fn(), setConfig: vi.fn() }))
vi.mock('@/lib/clinicReport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/clinicReport')>()
  return { ...actual, deliverClinicReport: vi.fn() }
})

import { rateLimit } from '@/lib/rate-limit'
import { getConfig, setConfig } from '@/lib/db/queries/configuracoes'
import { deliverClinicReport } from '@/lib/clinicReport'
import { GET } from '@/app/api/cron/whatsapp-report/route'

function req(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers })
}

function mockConfig(values: Record<string, string | null>) {
  ;(getConfig as unknown as Mock).mockImplementation(async (chave: string) => values[chave] ?? null)
}

const ORIGINAL_SECRET = process.env.CRON_SECRET
const AUTH = { authorization: 'Bearer test-cron-secret' }

describe('GET /api/cron/whatsapp-report', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-cron-secret'
  })
  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_SECRET
    vi.clearAllMocks()
  })

  it('401 sem CRON_SECRET configurado, mesmo com header correto', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(req('http://localhost/api/cron/whatsapp-report', AUTH))
    expect(res.status).toBe(401)
  })

  it('401 com header ausente ou errado', async () => {
    const res = await GET(req('http://localhost/api/cron/whatsapp-report'))
    expect(res.status).toBe(401)
  })

  it('pula quando o relatório está desabilitado', async () => {
    mockConfig({ wa_report_enabled: '0' })
    const res = await GET(req('http://localhost/api/cron/whatsapp-report', AUTH))
    expect(await res.json()).toEqual({ ok: true, skipped: 'disabled' })
    expect(deliverClinicReport).not.toHaveBeenCalled()
  })

  it('pula em dia fora da configuração (mon-fri não roda no fim de semana)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-08T12:00:00.000Z')) // sábado em BRT
    mockConfig({ wa_report_enabled: '1', wa_report_days: 'mon-fri' })
    const res = await GET(req('http://localhost/api/cron/whatsapp-report', AUTH))
    expect(await res.json()).toEqual({ ok: true, skipped: 'day-off' })
    vi.useRealTimers()
  })

  it('pula quando já enviou hoje (dedupe por wa_report_last_sent)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-06T12:00:00.000Z'))
    mockConfig({ wa_report_enabled: '1', wa_report_days: 'daily', wa_report_last_sent: '2026-08-06' })
    const res = await GET(req('http://localhost/api/cron/whatsapp-report', AUTH))
    expect(await res.json()).toEqual({ ok: true, skipped: 'already-sent' })
    vi.useRealTimers()
  })

  it('400 quando não há grupo/número de destino configurado', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-06T12:00:00.000Z'))
    mockConfig({ wa_report_enabled: '1', wa_report_days: 'daily' })
    const res = await GET(req('http://localhost/api/cron/whatsapp-report', AUTH))
    expect(res.status).toBe(400)
    vi.useRealTimers()
  })

  it('envia, marca wa_report_last_sent e devolve ok', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-06T12:00:00.000Z'))
    mockConfig({ wa_report_enabled: '1', wa_report_days: 'daily', wa_report_target: '12036@g.us' })
    ;(deliverClinicReport as unknown as Mock).mockResolvedValue({ ok: true })

    const res = await GET(req('http://localhost/api/cron/whatsapp-report', AUTH))
    const body = await res.json()

    expect(body).toMatchObject({ ok: true, sent: true, date: '2026-08-06' })
    expect(deliverClinicReport).toHaveBeenCalledWith(
      expect.objectContaining({ target: '12036@g.us', refine: true }),
    )
    expect(setConfig).toHaveBeenCalledWith('wa_report_last_sent', '2026-08-06', expect.any(String))
    vi.useRealTimers()
  })

  it('502 quando o envio falha, e não marca como enviado', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-06T12:00:00.000Z'))
    mockConfig({ wa_report_enabled: '1', wa_report_days: 'daily', wa_report_target: '12036@g.us' })
    ;(deliverClinicReport as unknown as Mock).mockResolvedValue({ ok: false, error: 'falhou' })

    const res = await GET(req('http://localhost/api/cron/whatsapp-report', AUTH))
    expect(res.status).toBe(502)
    expect(setConfig).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('?force=1 ignora dia e dedupe, mas NUNCA o interruptor administrativo', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-08T12:00:00.000Z')) // sábado + já enviado
    mockConfig({
      wa_report_enabled: '1',
      wa_report_days: 'mon-fri',
      wa_report_last_sent: '2026-08-08',
      wa_report_target: '12036@g.us',
    })
    ;(deliverClinicReport as unknown as Mock).mockResolvedValue({ ok: true })

    const res = await GET(req('http://localhost/api/cron/whatsapp-report?force=1', AUTH))
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(deliverClinicReport).toHaveBeenCalled()
    vi.useRealTimers()
  })

  // Antes, `force` sobrepunha `wa_report_enabled`. Disparar relatório com a
  // funcionalidade desligada pelo admin é ignorar uma decisão administrativa —
  // e cada disparo roda a IA e publica no grupo.
  it('?force=1 NÃO dispara relatório com wa_report_enabled desligado', async () => {
    mockConfig({ wa_report_enabled: '0', wa_report_target: '12036@g.us' })

    const res = await GET(req('http://localhost/api/cron/whatsapp-report?force=1', AUTH))
    const body = await res.json()
    expect(body.skipped).toBe('disabled')
    expect(deliverClinicReport).not.toHaveBeenCalled()
  })

  it('em produção o ?force=1 não vale — não pula o dedupe do dia', async () => {
    const original = process.env.VERCEL_ENV
    process.env.VERCEL_ENV = 'production'
    vi.setSystemTime?.(undefined as never)
    mockConfig({
      wa_report_enabled: '1',
      wa_report_days: 'daily',
      wa_report_last_sent: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
      wa_report_target: '12036@g.us',
    })

    const res = await GET(req('http://localhost/api/cron/whatsapp-report?force=1', AUTH))
    const body = await res.json()
    expect(body.skipped).toBe('already-sent')
    expect(deliverClinicReport).not.toHaveBeenCalled()
    process.env.VERCEL_ENV = original
  })

  it('429 com Retry-After quando o rate limit estoura', async () => {
    ;(rateLimit as unknown as Mock).mockReturnValueOnce({ ok: false, remaining: 0, retryAfterSec: 42 })
    mockConfig({ wa_report_enabled: '1', wa_report_target: '12036@g.us' })

    const res = await GET(req('http://localhost/api/cron/whatsapp-report?force=1', AUTH))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('42')
    expect(deliverClinicReport).not.toHaveBeenCalled()
    expect(getConfig).not.toHaveBeenCalled()
  })

  it('o rate limit é por rota, com teto de 2/min', async () => {
    mockConfig({ wa_report_enabled: '0' })
    await GET(req('http://localhost/api/cron/whatsapp-report', AUTH))
    expect(rateLimit).toHaveBeenCalledWith('cron:whatsapp-report', 2, 60_000)
  })
})
