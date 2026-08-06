import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/db', () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() } }))
vi.mock('@/lib/evolution', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/evolution')>()
  return { ...actual, sendEvolutionText: vi.fn() }
})

import { db } from '@/lib/db'
import { sendEvolutionText } from '@/lib/evolution'
import { users, appointments, patients, leads, rooms } from '@/lib/db/schema'
import { brDay, brHourMinute, buildDoctorAgenda, deliverDoctorAgenda } from '@/lib/doctorAgenda'

// O servidor roda em UTC na Vercel, mas a clínica opera em BRT (UTC-3). Estas
// bordas são exatamente onde um bug de fuso mandaria a agenda do dia errado.
describe('conversão de data/hora para o fuso da clínica', () => {
  it('03:00 UTC ainda é o dia anterior no Brasil', () => {
    expect(brDay(new Date('2026-08-06T02:59:00.000Z'))).toBe('2026-08-05')
  })

  it('a partir de 03:00 UTC já virou o dia no Brasil', () => {
    expect(brDay(new Date('2026-08-06T03:00:00.000Z'))).toBe('2026-08-06')
  })

  it('11:00 UTC corresponde às 08:00 no horário da clínica', () => {
    expect(brHourMinute(new Date('2026-08-06T11:00:00.000Z'))).toBe('08:00')
  })

  it('meia-noite BR é reportada como 00:00, não 24:00', () => {
    expect(brHourMinute(new Date('2026-08-06T03:00:00.000Z'))).toBe('00:00')
  })
})

// Monta a tabela de resultados que o mock de db.select devolve conforme a
// tabela passada para `.from(tabela)` — imita o formato real da consulta.
function mockSelectByTable(byTable: Map<unknown, unknown[]>) {
  ;(db.select as unknown as Mock).mockImplementation(() => {
    const builder: Record<string, unknown> & { _rows: unknown[] } = { _rows: [] }
    builder.from = vi.fn((table: unknown) => {
      builder._rows = byTable.get(table) ?? []
      return builder
    })
    builder.where = vi.fn(() => builder)
    builder.orderBy = vi.fn(() => builder)
    builder.limit = vi.fn(() => builder)
    builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(builder._rows).then(resolve, reject)
    return builder
  })
}

describe('buildDoctorAgenda', () => {
  const doctorId = 'doc-1'
  const target = '2026-08-06'

  it('ordena por horário, exclui cancelled/no_show, resolve nomes/sala e conta confirmados', async () => {
    // O mock de db.select devolve as linhas na ordem em que estão listadas aqui —
    // igual ao Postgres real faria com `.orderBy(asc(startAt))`. Já entram
    // pré-ordenadas por horário para verificar que buildDoctorAgenda preserva
    // essa ordem (não faz — e não deveria fazer — nenhum re-sort em memória).
    const rows = [
      // 08:00 BRT, lead vinculado (sem paciente), sem sala.
      {
        id: 'a2', startAt: new Date('2026-08-06T11:00:00.000Z'), endAt: new Date('2026-08-06T11:30:00.000Z'),
        type: 'prp', status: 'scheduled', title: null, notes: null,
        room: null, roomId: null, patientId: null, leadId: 'lead-1', isPaid: false,
      },
      // 09:00 BRT, paciente vinculado, sala vinculada, confirmado.
      {
        id: 'a1', startAt: new Date('2026-08-06T12:00:00.000Z'), endAt: new Date('2026-08-06T12:30:00.000Z'),
        type: 'consultation', status: 'confirmed', title: null, notes: null,
        room: null, roomId: 'room-1', patientId: 'pat-1', leadId: null, isPaid: true,
      },
      // 10:00 BRT, sem paciente/lead/título — cai no fallback "Sem paciente vinculado".
      {
        id: 'a3', startAt: new Date('2026-08-06T13:00:00.000Z'), endAt: new Date('2026-08-06T13:30:00.000Z'),
        type: 'block', status: 'scheduled', title: null, notes: 'bloqueio de agenda',
        room: 'Sala Avulsa', roomId: null, patientId: null, leadId: null, isPaid: false,
      },
      // Cancelado no mesmo dia — deve ser excluído.
      {
        id: 'a4', startAt: new Date('2026-08-06T14:00:00.000Z'), endAt: new Date('2026-08-06T14:30:00.000Z'),
        type: 'consultation', status: 'cancelled', title: 'Não deveria aparecer', notes: null,
        room: null, roomId: null, patientId: null, leadId: null, isPaid: false,
      },
      // No-show no mesmo dia — deve ser excluído.
      {
        id: 'a5', startAt: new Date('2026-08-06T14:30:00.000Z'), endAt: new Date('2026-08-06T15:00:00.000Z'),
        type: 'consultation', status: 'no_show', title: 'Não deveria aparecer', notes: null,
        room: null, roomId: null, patientId: null, leadId: null, isPaid: false,
      },
      // Dentro da janela de busca, mas em outro dia-calendário BR — excluído pelo filtro fino em memória.
      {
        id: 'a6', startAt: new Date('2026-08-07T12:00:00.000Z'), endAt: new Date('2026-08-07T12:30:00.000Z'),
        type: 'consultation', status: 'scheduled', title: 'Dia seguinte', notes: null,
        room: null, roomId: null, patientId: null, leadId: null, isPaid: false,
      },
    ]

    mockSelectByTable(new Map<unknown, unknown[]>([
      [users, [{ id: doctorId, name: 'Dra. Ana' }]],
      [appointments, rows],
      [patients, [{ id: 'pat-1', name: 'João Silva', phone: '5511999999999' }]],
      [leads, [{ id: 'lead-1', name: 'Maria Lead', phone: '5511888888888' }]],
      [rooms, [{ id: 'room-1', name: 'Sala 1' }]],
    ]))

    const agenda = await buildDoctorAgenda(doctorId, target)

    expect(agenda.total).toBe(3)
    expect(agenda.slots.map((s) => s.id)).toEqual(['a2', 'a1', 'a3'])
    expect(agenda.slots.map((s) => s.time)).toEqual(['08:00', '09:00', '10:00'])

    const [slotLead, slotPatient, slotFallback] = agenda.slots
    expect(slotLead.patientName).toBe('Maria Lead')
    expect(slotPatient.patientName).toBe('João Silva')
    expect(slotPatient.room).toBe('Sala 1')
    expect(slotFallback.patientName).toBe('Sem paciente vinculado')
    expect(slotFallback.room).toBe('Sala Avulsa') // sem roomId, usa o texto livre a.room

    expect(agenda.confirmed).toBe(1)
    expect(agenda.doctorName).toBe('Dra. Ana')
    expect(agenda.whatsappText).not.toContain('**')

    // O telefone segue disponível no slot (o servidor usa no caminho do
    // WhatsApp), mas nunca é impresso no texto — `whatsappText` vira o campo
    // `preview` da resposta de /api/perfil/agenda-hoje e chega ao navegador.
    expect(slotPatient.patientPhone).toBe('5511999999999')
    expect(agenda.markdown).not.toContain('5511999999999')
    expect(agenda.markdown).not.toContain('5511888888888')
    expect(agenda.whatsappText).not.toContain('5511999999999')
    expect(agenda.whatsappText).not.toContain('5511888888888')
    expect(agenda.markdown).not.toContain('bloqueio de agenda')
  })

  it('agenda vazia gera markdown de "nenhuma consulta" e total zero', async () => {
    mockSelectByTable(new Map<unknown, unknown[]>([
      [users, [{ id: doctorId, name: 'Dr. Carlos' }]],
      [appointments, []],
    ]))

    const agenda = await buildDoctorAgenda(doctorId, target)
    expect(agenda.total).toBe(0)
    expect(agenda.confirmed).toBe(0)
    expect(agenda.markdown).toContain('Nenhuma consulta agendada para hoje')
  })

  it('médico não encontrado usa o fallback "Doutor(a)"', async () => {
    mockSelectByTable(new Map<unknown, unknown[]>([
      [users, []],
      [appointments, []],
    ]))

    const agenda = await buildDoctorAgenda(doctorId, target)
    expect(agenda.doctorName).toBe('Doutor(a)')
  })
})

describe('deliverDoctorAgenda', () => {
  const doctorId = 'doc-1'

  beforeEach(() => {
    mockSelectByTable(new Map<unknown, unknown[]>([
      [users, [{ id: doctorId, name: 'Dra. Ana' }]],
      [appointments, []],
    ]))
    ;(db.insert as unknown as Mock).mockReturnValue(chain(undefined))
  })
  afterEach(() => vi.clearAllMocks())

  it('número inválido é pulado sem tentar montar/enviar a agenda', async () => {
    const result = await deliverDoctorAgenda({ doctorId, number: '' })
    expect(result).toEqual({ ok: false, skipped: 'sem-numero', error: 'Número de WhatsApp não configurado.' })
    expect(sendEvolutionText).not.toHaveBeenCalled()
    expect(db.select).not.toHaveBeenCalled()
  })

  it('skipEmpty pula o envio quando a agenda do dia está vazia', async () => {
    const result = await deliverDoctorAgenda({ doctorId, number: '11999999999', skipEmpty: true })
    expect(result).toEqual({ ok: true, skipped: 'sem-agenda' })
    expect(sendEvolutionText).not.toHaveBeenCalled()
  })

  it('sem skipEmpty, envia mesmo com a agenda vazia (é o botão de teste manual)', async () => {
    ;(sendEvolutionText as unknown as Mock).mockResolvedValue({ key: { id: 'wamid-1' } })

    const result = await deliverDoctorAgenda({ doctorId, number: '11999999999', skipEmpty: false })
    expect(result).toEqual({ ok: true })
    expect(sendEvolutionText).toHaveBeenCalledWith('5511999999999', expect.any(String))

    const insertedValues = (db.insert as unknown as Mock).mock.results[0].value.values.mock.calls[0][0]
    expect(insertedValues).toMatchObject({ type: 'daily_agenda', status: 'sent', targetNumber: '5511999999999' })
  })

  it('falha da Evolution é registrada como failed e propagada no retorno', async () => {
    ;(sendEvolutionText as unknown as Mock).mockRejectedValue(new Error('Número bloqueado'))

    const result = await deliverDoctorAgenda({ doctorId, number: '11999999999', skipEmpty: false })
    expect(result).toEqual({ ok: false, error: 'Número bloqueado' })

    const insertedValues = (db.insert as unknown as Mock).mock.results[0].value.values.mock.calls[0][0]
    expect(insertedValues).toMatchObject({
      type: 'daily_agenda',
      status: 'failed',
      evolutionResponse: { error: 'Número bloqueado' },
    })
  })
})
