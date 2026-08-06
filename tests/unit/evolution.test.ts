import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/db', () => ({ db: { select: vi.fn() } }))
vi.mock('@/lib/db/queries/configuracoes', () => ({ getConfig: vi.fn() }))

import { db } from '@/lib/db'
import { getConfig } from '@/lib/db/queries/configuracoes'
import { fetchGroups, sendEvolutionText, waNumber } from '@/lib/evolution'

const CONFIGURED = { url: 'https://evo.example.com/', key: 'secret-key', instance: 'clinica-01' }

function mockClinicSettingsRow(row: Partial<typeof CONFIGURED> | null) {
  ;(db.select as unknown as Mock).mockReturnValue(chain(row ? [row] : []))
}

function mockKvConfig(overrides: Record<string, string | null> = {}) {
  ;(getConfig as unknown as Mock).mockImplementation(async (chave: string) => overrides[chave] ?? null)
}

describe('waNumber', () => {
  it('adiciona DDI 55 quando ausente', () => {
    expect(waNumber('11987654321')).toBe('5511987654321')
  })

  it('não duplica o DDI quando já presente', () => {
    expect(waNumber('5511987654321')).toBe('5511987654321')
  })

  it('remove caracteres não numéricos (espaços, parênteses, hífen)', () => {
    expect(waNumber('(11) 98765-4321')).toBe('5511987654321')
  })

  it('string vazia ou só lixo devolve vazio', () => {
    expect(waNumber('')).toBe('')
    expect(waNumber('abc-def')).toBe('')
  })
})

describe('sendEvolutionText', () => {
  beforeEach(() => {
    mockClinicSettingsRow(CONFIGURED)
    mockKvConfig()
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('lança erro em português quando a instância não está configurada', async () => {
    mockClinicSettingsRow({ url: CONFIGURED.url, key: CONFIGURED.key, instance: '' })
    await expect(sendEvolutionText('11999999999', 'oi')).rejects.toThrow(
      'Instância do WhatsApp não configurada.',
    )
  })

  it('normaliza número de telefone mas preserva JID de grupo intacto', async () => {
    ;(fetch as unknown as Mock).mockResolvedValue({ ok: true, json: async () => ({ key: { id: '1' } }) })

    await sendEvolutionText('(11) 98765-4321', 'oi paciente')
    const [, phoneInit] = (fetch as unknown as Mock).mock.calls[0]
    expect(JSON.parse(phoneInit.body).number).toBe('5511987654321')

    await sendEvolutionText('12036@g.us', 'oi grupo')
    const [, groupInit] = (fetch as unknown as Mock).mock.calls[1]
    expect(JSON.parse(groupInit.body).number).toBe('12036@g.us')
  })

  it('monta a URL com a instância codificada e envia apikey no header', async () => {
    ;(fetch as unknown as Mock).mockResolvedValue({ ok: true, json: async () => ({ key: { id: '1' } }) })
    await sendEvolutionText('11999999999', 'oi')

    const [url, init] = (fetch as unknown as Mock).mock.calls[0]
    expect(url).toBe(`${CONFIGURED.url.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(CONFIGURED.instance)}`)
    expect(init.headers.apikey).toBe(CONFIGURED.key)
  })

  it('lança erro quando servidor/URL/chave não configurados (mas a instância sim)', async () => {
    mockClinicSettingsRow(null)
    mockKvConfig({ evolution_instance: 'clinica-01' })
    await expect(sendEvolutionText('11999999999', 'oi')).rejects.toThrow(
      'Configure a URL e a chave da Evolution API em Configurações → WhatsApp.',
    )
  })

  it('propaga a mensagem de erro da Evolution em resposta não-2xx (json.response.message)', async () => {
    ;(fetch as unknown as Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ response: { message: ['Número inválido'] } }),
    })
    await expect(sendEvolutionText('11999999999', 'oi')).rejects.toThrow('Número inválido')
  })

  it('cai para mensagem genérica com o status quando a resposta não tem corpo reconhecível', async () => {
    ;(fetch as unknown as Mock).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    await expect(sendEvolutionText('11999999999', 'oi')).rejects.toThrow('Falha na Evolution (500)')
  })

  it('config da clinicSettings tem prioridade sobre a KV e o env', async () => {
    mockClinicSettingsRow(CONFIGURED)
    mockKvConfig({ evolution_api_url: 'https://outra.example.com', evolution_instance: 'outra-instancia' })
    ;(fetch as unknown as Mock).mockResolvedValue({ ok: true, json: async () => ({}) })

    await sendEvolutionText('11999999999', 'oi')
    const [url] = (fetch as unknown as Mock).mock.calls[0]
    expect(url).toContain(CONFIGURED.instance)
    expect(url).not.toContain('outra-instancia')
  })
})

describe('fetchGroups', () => {
  beforeEach(() => {
    mockClinicSettingsRow(CONFIGURED)
    mockKvConfig()
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('normaliza a resposta em array direto', async () => {
    ;(fetch as unknown as Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ id: '1@g.us', subject: 'Clínica', size: 5 }],
    })
    const groups = await fetchGroups('clinica-01')
    expect(groups).toEqual([{ id: '1@g.us', subject: 'Clínica', size: 5 }])
  })

  it('normaliza a resposta envelopada em { groups: [...] }', async () => {
    ;(fetch as unknown as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ groups: [{ jid: '2@g.us', name: 'Equipe', participants: [1, 2, 3] }] }),
    })
    const groups = await fetchGroups('clinica-01')
    expect(groups).toEqual([{ id: '2@g.us', subject: 'Equipe', size: 3 }])
  })

  it('descarta grupos sem id', async () => {
    ;(fetch as unknown as Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ subject: 'Sem id' }, { id: '3@g.us', subject: 'Com id', size: 1 }],
    })
    const groups = await fetchGroups('clinica-01')
    expect(groups).toEqual([{ id: '3@g.us', subject: 'Com id', size: 1 }])
  })
})
