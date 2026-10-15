/**
 * SEC-07 — bot do WhatsApp entregava prontuário sem permissão nem auditoria.
 *
 * `dispatchGroupMessage(text)` recebia só o texto: qualquer participante do
 * grupo perguntava "informações sobre o paciente Fulano?" e recebia no grupo
 * CPF, notas de consulta e o prontuário completo — alcance maior que o de uma
 * recepcionista logada, que nem prontuário enxerga. Nada passava por
 * `logActivity`. Estar no grupo virou credencial de fato.
 *
 * Exigido, pelo caminho real (webhook → bot → resposta):
 * - remetente não identificado (inclui o número da própria clínica e @lid sem
 *   telefone) não recebe dado individual de paciente;
 * - remetente identificado pelo telefone do perfil recebe só o que o RBAC dele
 *   permite (prontuário exige patients:view_clinical);
 * - resposta com dado de paciente vai no privado de quem perguntou, não no grupo;
 * - toda leitura e toda recusa ficam em activity_logs, sem conteúdo clínico;
 * - a agenda respondida no grupo não leva as notas da consulta.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { chain } from '../helpers/dbChain'

const GRUPO = '120363000000000000@g.us'
const CONFIG: Record<string, string> = {
  wa_webhook_token: 'token-do-webhook',
  wa_bot_enabled: '1',
  wa_bot_group_jid: GRUPO,
}

vi.mock('@/lib/db/queries/configuracoes', () => ({
  getConfig: vi.fn(async (chave: string) => CONFIG[chave] ?? null),
}))
vi.mock('@/lib/evolution', () => ({
  evoFetch: vi.fn(),
  sendEvolutionText: vi.fn(async () => ({ key: { id: `enviada-${Math.random()}` } })),
}))
vi.mock('@/lib/transcribe', () => ({ transcribeAudio: vi.fn() }))
vi.mock('@/lib/ai', () => ({ callAi: vi.fn() }))
vi.mock('@/lib/clinicReport', () => ({
  buildClinicReport: vi.fn(async () => ({ context: 'Resumo agregado da clínica', whatsappText: '📋 Resumo agregado' })),
}))
vi.mock('@/lib/db', () => ({
  db: { select: vi.fn(), query: { users: { findMany: vi.fn() } } },
}))
vi.mock('@/lib/db/logger', () => ({ logActivity: vi.fn() }))

import { db } from '@/lib/db'
import { appointments, clinicalRecords, patients, treatments } from '@/lib/db/schema'
import { callAi } from '@/lib/ai'
import { sendEvolutionText } from '@/lib/evolution'
import { logActivity } from '@/lib/db/logger'
import { POST } from '@/app/api/whatsapp/webhook/route'
import { variantesTelefone } from '@/lib/whatsappRemetente'

const PACIENTE_ID = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f'
const PRONTUARIO = 'CONTEUDO-PRONTUARIO-SIGILOSO condropatia grau III'
const NOTA = 'NOTA-CLINICA-SIGILOSA dor ao subir escada'
const CPF = '123.456.789-09'

const MEDICO_JID = '5512988881111@s.whatsapp.net'
const RECEPCAO_JID = '5512977772222@s.whatsapp.net'
const ESTRANHO_JID = '5511900000000@s.whatsapp.net'

let tabelasConsultadas: unknown[] = []

interface UsuarioMock {
  id: string
  name: string
  role: string
  customPermissions: string[] | null
  phone: string | null
  dailyAgendaWhatsapp: string | null
}

function mockBanco(usuarios: UsuarioMock[] = [
  { id: 'u-medico', name: 'Dra. Ana Souza', role: 'doctor', customPermissions: null, phone: '(12) 98888-1111', dailyAgendaWhatsapp: null },
  { id: 'u-recepcao', name: 'Bia Recepção', role: 'receptionist', customPermissions: null, phone: null, dailyAgendaWhatsapp: '12977772222' },
]) {
  tabelasConsultadas = []
  const linhas = new Map<unknown, unknown[]>([
    [patients, [{ id: PACIENTE_ID, name: 'Maria Teste', phone: '12999990000', email: 'maria@x.com', cpf: CPF, birthDate: '1980-05-17', gender: 'F' }]],
    [appointments, [{ id: 'a1', startAt: new Date(), status: 'scheduled', type: 'consultation', notes: NOTA, title: null, patientName: 'Maria Teste', doctorName: 'Dra. Ana Souza' }]],
    [clinicalRecords, [{ id: 'r1', type: 'evolution', content: PRONTUARIO, createdAt: new Date(), doctorName: 'Dra. Ana Souza' }]],
    [treatments, [{ id: 't1', name: 'PRP joelho', status: 'in_progress', totalSale: '1500' }]],
  ])
  ;(db.select as unknown as Mock).mockImplementation(() => ({
    from: (tabela: unknown) => {
      tabelasConsultadas.push(tabela)
      return chain(linhas.get(tabela) ?? [])
    },
  }))
  ;(db.query.users.findMany as unknown as Mock).mockResolvedValue(usuarios)
}

// 1ª chamada: extração de parâmetros; 2ª: a resposta, que recebe o contexto.
function mockIa(params: Record<string, unknown>) {
  ;(callAi as unknown as Mock).mockImplementation(async (msgs: { content: string }[]) =>
    msgs[0].content.includes('coordenador de banco de dados')
      ? JSON.stringify({ searchPatientName: null, dateRange: null, needAllAppointments: false, ...params })
      : 'Resposta do assistente',
  )
}

function contextoEnviadoAoModelo(): string {
  const chamada = (callAi as unknown as Mock).mock.calls.find(c => c[0][0].content.startsWith('Você é o assistente'))
  return chamada ? String(chamada[0][1].content) : ''
}

let seq = 0
function mensagem(texto: string, key: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/whatsapp/webhook', {
    method: 'POST',
    headers: { 'x-webhook-token': 'token-do-webhook', 'content-type': 'application/json' },
    body: JSON.stringify({
      event: 'messages.upsert',
      instance: 'clinica',
      data: {
        key: { remoteJid: GRUPO, fromMe: false, id: `msg-${Date.now()}-${++seq}`, ...key },
        pushName: 'Alguém',
        message: { conversation: texto },
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    }),
  })
}

const enviadas = () => (sendEvolutionText as unknown as Mock).mock.calls.map(c => ({ para: c[0] as string, texto: c[1] as string }))
const registros = () => (logActivity as unknown as Mock).mock.calls.map(c => c[0])

describe('bot do WhatsApp — dado de paciente exige remetente identificado e permissão', () => {
  beforeEach(() => mockBanco())
  afterEach(() => vi.clearAllMocks())

  it.each([
    ['participante que não é usuário do sistema', { participant: ESTRANHO_JID }],
    ['o número da própria clínica (fromMe, aparelho compartilhado)', { fromMe: true, participant: MEDICO_JID }],
    ['participante só com id anônimo @lid', { participant: '99887766554433@lid' }],
  ])('%s não recebe nada do paciente', async (_, key) => {
    mockIa({ searchPatientName: 'Maria' })

    await POST(mensagem('Qual o prontuário da paciente Maria?', key))

    expect(tabelasConsultadas).not.toContain(patients)
    expect(tabelasConsultadas).not.toContain(clinicalRecords)
    const contexto = contextoEnviadoAoModelo()
    expect(contexto).toContain('NÃO autorizada')
    expect(contexto).not.toContain(PRONTUARIO)
    expect(contexto).not.toContain(CPF)
    expect(registros().map(r => r.action)).toEqual(['whatsapp:consulta_negada'])
    expect(enviadas()).toEqual([{ para: GRUPO, texto: '📊 Resposta do assistente' }])
  })

  it('médica identificada pelo telefone do perfil recebe o prontuário — no privado, com auditoria', async () => {
    mockIa({ searchPatientName: 'Maria' })

    // WhatsApp novo manda o @lid em `participant` e o telefone em `participantAlt`.
    await POST(mensagem('Qual o prontuário da paciente Maria?', { participant: '1234@lid', participantAlt: MEDICO_JID }))

    expect(contextoEnviadoAoModelo()).toContain(PRONTUARIO)

    const saida = enviadas()
    expect(saida).toHaveLength(2)
    expect(saida[0]).toEqual({ para: MEDICO_JID, texto: '📊 Resposta do assistente' })
    expect(saida[1].para).toBe(GRUPO)
    expect(saida[1].texto).toMatch(/^🩺 Dra\. Ana Souza, respondi no seu privado/)
    expect(saida[1].texto).not.toContain('Resposta do assistente')

    const [leitura] = registros()
    expect(leitura).toMatchObject({ action: 'prontuario:read', module: 'whatsapp', userId: 'u-medico', targetId: PACIENTE_ID })
    expect(JSON.stringify(registros())).not.toContain('CONTEUDO-PRONTUARIO')
    expect(JSON.stringify(registros())).not.toContain(CPF)
  })

  it('recepcionista identificada vê a ficha, mas não o prontuário (como no sistema)', async () => {
    mockIa({ searchPatientName: 'Maria' })

    await POST(mensagem('Telefone da paciente Maria?', { participant: RECEPCAO_JID }))

    const contexto = contextoEnviadoAoModelo()
    expect(contexto).toContain('Maria Teste')
    expect(contexto).not.toContain(PRONTUARIO)
    expect(tabelasConsultadas).not.toContain(clinicalRecords)
    expect(registros()[0]).toMatchObject({ action: 'paciente:read', userId: 'u-recepcao', targetId: PACIENTE_ID })
    expect(enviadas()[0].para).toBe(RECEPCAO_JID)
  })

  it('número cadastrado em dois usuários não identifica ninguém', async () => {
    mockBanco([
      { id: 'u1', name: 'A', role: 'doctor', customPermissions: null, phone: '12988881111', dailyAgendaWhatsapp: null },
      { id: 'u2', name: 'B', role: 'receptionist', customPermissions: null, phone: '+55 12 98888-1111', dailyAgendaWhatsapp: null },
    ])
    mockIa({ searchPatientName: 'Maria' })

    await POST(mensagem('Prontuário da paciente Maria?', { participant: MEDICO_JID }))

    expect(contextoEnviadoAoModelo()).not.toContain(PRONTUARIO)
    expect(registros()[0].action).toBe('whatsapp:consulta_negada')
  })

  it('customPermissions sem patients:view_clinical cortam o prontuário mesmo de médico', async () => {
    mockBanco([
      { id: 'u-medico', name: 'Dr. Restrito', role: 'doctor', customPermissions: ['patients:view', 'agenda:view'], phone: '12988881111', dailyAgendaWhatsapp: null },
    ])
    mockIa({ searchPatientName: 'Maria' })

    await POST(mensagem('Prontuário da paciente Maria?', { participant: MEDICO_JID }))

    expect(contextoEnviadoAoModelo()).not.toContain(PRONTUARIO)
    expect(registros()[0].action).toBe('paciente:read')
  })

  it('agenda respondida no grupo não leva as notas da consulta', async () => {
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
    mockIa({ dateRange: { start: hoje, end: hoje } })

    await POST(mensagem('Qual a agenda de hoje?', { participant: ESTRANHO_JID }))

    const contexto = contextoEnviadoAoModelo()
    expect(contexto).toContain('Maria Teste')
    expect(contexto).not.toContain('NOTA-CLINICA-SIGILOSA')
    expect(enviadas()).toEqual([{ para: GRUPO, texto: '📊 Resposta do assistente' }])
    // Agenda não consulta usuários nem grava leitura de ficha.
    expect(db.query.users.findMany).not.toHaveBeenCalled()
    expect(registros()).toEqual([])
  })
})

describe('variantesTelefone — casar o JID com o telefone do perfil', () => {
  it('JID com 55 e nono dígito casa com o telefone formatado', () => {
    expect(variantesTelefone('5512988881111')).toContain('12988881111')
    expect(variantesTelefone('(12) 98888-1111')).toContain('12988881111')
  })

  it('JID antigo sem o nono dígito casa com o celular cadastrado com 9', () => {
    const doJid = variantesTelefone('551288881111')
    const doPerfil = variantesTelefone('12 98888-1111')
    expect(doJid.some(v => doPerfil.includes(v))).toBe(true)
  })

  it('número curto ou vazio não vira chave de identificação', () => {
    expect(variantesTelefone('')).toEqual([])
    expect(variantesTelefone('1234')).toEqual([])
    expect(variantesTelefone(null)).toEqual([])
  })
})
