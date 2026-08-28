import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: { appointments: { findFirst: vi.fn(), findMany: vi.fn() } },
  },
}))
vi.mock('@/lib/db/logger', () => ({ logActivity: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ notify: vi.fn(async () => undefined) }))
vi.mock('@/lib/google/calendar', () => ({
  syncAppointment: vi.fn(async () => null),
  removeAppointment: vi.fn(async () => undefined),
}))

import { PgDialect } from 'drizzle-orm/pg-core'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { notify } from '@/lib/notifications'
import { syncAppointment, removeAppointment } from '@/lib/google/calendar'
import { PATCH as PATCH_LEAD } from '@/app/api/leads/[id]/route'
import { POST as POST_PACIENTE } from '@/app/api/pacientes/route'
import { POST as POST_AGENDA } from '@/app/api/agenda/route'
import { PATCH as PATCH_AGENDA } from '@/app/api/agenda/[id]/route'
import { POST as POST_FINANCEIRO } from '@/app/api/financeiro/route'

// UUIDs de verdade: as rotas validam com z.string().uuid() e rejeitariam 'l1'.
const LEAD_ID = '11111111-1111-4111-8111-111111111111'
const PATIENT_ID = '22222222-2222-4222-8222-222222222222'
const DOCTOR_ID = '33333333-3333-4333-8333-333333333333'
const APT_ID = '44444444-4444-4444-8444-444444444444'
const OUTRO_APT_ID = '55555555-5555-4555-8555-555555555555'
const ROOM_ID = '66666666-6666-4666-8666-666666666666'
const PIX_ID = '77777777-7777-4777-8777-777777777777'
const TX_ID = '88888888-8888-4888-8888-888888888888'

const sessionAs = (role: string, customPermissions: string[] | null = null) =>
  (auth as unknown as Mock).mockResolvedValue({
    user: { id: 'u1', role, customPermissions, name: 'Recepção', email: 'recep@clinica.com' },
  })

const req = (url: string, method: string, body?: unknown) =>
  new NextRequest(url, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { 'Content-Type': 'application/json' },
  })

const leadReq = (body: unknown) => req(`http://localhost/api/leads/${LEAD_ID}`, 'PATCH', body)
const pacienteReq = (body: unknown) => req('http://localhost/api/pacientes', 'POST', body)
const agendaReq = (body: unknown) => req('http://localhost/api/agenda', 'POST', body)
const agendaPatchReq = (body: unknown) => req(`http://localhost/api/agenda/${APT_ID}`, 'PATCH', body)
const financeiroReq = (body: unknown) => req('http://localhost/api/financeiro', 'POST', body)

const params = (id: string) => ({ params: Promise.resolve({ id }) })

const START = '2026-09-01T13:00:00.000Z'
const END = '2026-09-01T14:00:00.000Z'

/** Linha que o Postgres devolveria no .returning() do insert/update de agendamento. */
const aptRow = (over: Record<string, unknown> = {}) => ({
  id: APT_ID,
  patientId: PATIENT_ID,
  leadId: null,
  doctorId: DOCTOR_ID,
  type: 'consultation',
  status: 'scheduled',
  title: null,
  startAt: new Date(START),
  endAt: new Date(END),
  googleEventId: null,
  roomId: null,
  isPaidConsultation: false,
  consultationPrice: null,
  paymentMethodId: null,
  paymentStatus: null,
  paymentReceiptUrl: null,
  ...over,
})

/** Linha devolvida pela busca de choque de horário. 10h30–11h30 BRT. */
const conflitoRow = (over: Record<string, unknown> = {}) => ({
  id: OUTRO_APT_ID,
  startAt: new Date('2026-09-01T13:30:00.000Z'),
  endAt: new Date('2026-09-01T14:30:00.000Z'),
  doctorId: DOCTOR_ID,
  roomId: null,
  ...over,
})

/** Agenda livre — default de todo teste que não está exercitando conflito. */
const semConflitos = () =>
  (db.query.appointments.findMany as unknown as Mock).mockResolvedValue([])

/**
 * O SQL que a rota realmente mandou ao banco. A regra de sobreposição vive no
 * WHERE (não em JS), então é só aqui que dá para provar `<`/`>` estritos,
 * cancelados de fora e o próprio agendamento ignorado.
 */
const sqlDo = (where: unknown) => new PgDialect().sqlToQuery(where as never)

const whereDoConflito = () =>
  sqlDo((db.query.appointments.findMany as unknown as Mock).mock.calls[0][0].where)

/** Corpo mínimo válido para POST /api/agenda. */
const agendaBody = (over: Record<string, unknown> = {}) => ({
  patientId: PATIENT_ID,
  doctorId: DOCTOR_ID,
  type: 'consultation',
  startAt: START,
  endAt: END,
  ...over,
})

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

// ─────────────────────────────────────────────────────────────
// 1. Conversão lead → paciente
// ─────────────────────────────────────────────────────────────

describe('PATCH /api/leads/[id] — conversão lead → paciente', () => {
  beforeEach(() => sessionAs('receptionist'))

  // REGRESSÃO REAL: patientId e convertedAt não existiam no zod do PATCH. O
  // safeParse descartava os dois em silêncio (200 na resposta, vínculo nunca
  // gravado) e o próximo agendamento cadastrava OUTRO paciente para a mesma
  // pessoa — prontuário e financeiro do paciente racham em dois.
  it('grava patientId, convertedAt e status ao converter o lead', async () => {
    const builder = chain([{ id: LEAD_ID, name: 'Ana Souza', status: 'scheduled', phone: '11999990000' }])
    ;(db.update as unknown as Mock).mockReturnValue(builder)

    const res = await PATCH_LEAD(
      leadReq({ patientId: PATIENT_ID, convertedAt: '2026-08-28T12:00:00.000Z', status: 'scheduled' }),
      params(LEAD_ID),
    )
    expect(res.status).toBe(200)

    const setArg = (builder.set as unknown as Mock).mock.calls[0][0]
    expect(setArg.patientId).toBe(PATIENT_ID)
    expect(setArg.status).toBe('scheduled')
    // A coluna é timestamp: string ISO precisa virar Date, senão o driver quebra.
    expect(setArg.convertedAt).toBeInstanceOf(Date)
    expect((setArg.convertedAt as Date).toISOString()).toBe('2026-08-28T12:00:00.000Z')
  })

  // Um PATCH corriqueiro (mudar telefone, mover card no Kanban) não pode zerar
  // a conversão já feita — o lead voltaria a ser "não convertido".
  it('não encosta em convertedAt quando o campo não vem no corpo', async () => {
    const builder = chain([{ id: LEAD_ID, name: 'Ana Souza', status: 'contacted', phone: '11999990000' }])
    ;(db.update as unknown as Mock).mockReturnValue(builder)

    const res = await PATCH_LEAD(leadReq({ status: 'contacted' }), params(LEAD_ID))
    expect(res.status).toBe(200)

    const setArg = (builder.set as unknown as Mock).mock.calls[0][0]
    expect('convertedAt' in setArg).toBe(false)
    expect(setArg.updatedAt).toBeInstanceOf(Date)
  })

  // convertedAt: null é o "desfazer conversão" — precisa chegar como null, não sumir.
  it('convertedAt null limpa a data de conversão', async () => {
    const builder = chain([{ id: LEAD_ID, name: 'Ana Souza', status: 'new', phone: '11999990000' }])
    ;(db.update as unknown as Mock).mockReturnValue(builder)

    const res = await PATCH_LEAD(leadReq({ patientId: null, convertedAt: null }), params(LEAD_ID))
    expect(res.status).toBe(200)

    const setArg = (builder.set as unknown as Mock).mock.calls[0][0]
    expect(setArg.patientId).toBeNull()
    expect(setArg.convertedAt).toBeNull()
  })

  it('401 sem sessão, sem tocar no banco', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)
    const res = await PATCH_LEAD(leadReq({ status: 'contacted' }), params(LEAD_ID))
    expect(res.status).toBe(401)
    expect(db.update).not.toHaveBeenCalled()
  })

  // O médico enxerga a agenda, mas não pode mexer no funil comercial.
  it('403 para quem não tem leads:edit', async () => {
    sessionAs('doctor')
    const res = await PATCH_LEAD(leadReq({ status: 'contacted' }), params(LEAD_ID))
    expect(res.status).toBe(403)
    expect(db.update).not.toHaveBeenCalled()
  })

  // Sem o 404 o front acharia que converteu um lead que já foi excluído.
  it('404 quando o lead não existe', async () => {
    ;(db.update as unknown as Mock).mockReturnValue(chain([]))
    const res = await PATCH_LEAD(leadReq({ patientId: PATIENT_ID }), params(LEAD_ID))
    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────
// 2. Cadastro do paciente
// ─────────────────────────────────────────────────────────────

describe('POST /api/pacientes', () => {
  it('401 sem sessão', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)
    const res = await POST_PACIENTE(pacienteReq({ name: 'Ana Souza', phone: '11999990000' }))
    expect(res.status).toBe(401)
    expect(db.insert).not.toHaveBeenCalled()
  })

  // Médico tem patients:view, mas cadastrar é trabalho da recepção.
  it('403 para quem não tem patients:create', async () => {
    sessionAs('doctor')
    const res = await POST_PACIENTE(pacienteReq({ name: 'Ana Souza', phone: '11999990000' }))
    expect(res.status).toBe(403)
    expect(db.insert).not.toHaveBeenCalled()
  })

  // Paciente sem telefone válido é paciente que a clínica não consegue confirmar.
  it('400 com telefone curto demais', async () => {
    sessionAs('receptionist')
    const res = await POST_PACIENTE(pacienteReq({ name: 'Ana Souza', phone: '119' }))
    expect(res.status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('201 e devolve o paciente criado', async () => {
    sessionAs('receptionist')
    // A rota checa telefone duplicado antes de inserir: nenhum resultado = ficha nova.
    ;(db.select as unknown as Mock).mockReturnValue(chain([]))
    ;(db.insert as unknown as Mock).mockReturnValue(
      chain([{ id: PATIENT_ID, name: 'Ana Souza', phone: '11999990000', email: null }]),
    )

    const res = await POST_PACIENTE(pacienteReq({ name: 'Ana Souza', phone: '11999990000' }))
    expect(res.status).toBe(201)
    expect((await res.json()).data.id).toBe(PATIENT_ID)
  })
})

// ─────────────────────────────────────────────────────────────
// 3. Agendamento
// ─────────────────────────────────────────────────────────────

describe('POST /api/agenda', () => {
  beforeEach(() => {
    sessionAs('receptionist')
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ name: 'Ana Souza' }]))
    semConflitos()
  })

  it('201 no caminho feliz e avisa a equipe com o tipo do agendamento', async () => {
    ;(db.insert as unknown as Mock).mockReturnValue(chain([aptRow()]))

    const res = await POST_AGENDA(agendaReq(agendaBody()))
    expect(res.status).toBe(201)
    expect((await res.json()).data.id).toBe(APT_ID)

    // O sino do topo é como a recepção descobre agendamento feito por outra pessoa.
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'appointment_new',
        entityId: APT_ID,
        link: '/agenda',
        body: expect.stringContaining('Consulta'),
      }),
    )
  })

  // Sem gravar o googleEventId o sistema perde o vínculo e passa a duplicar
  // o evento na agenda do médico a cada edição.
  it('sincroniza com o Google e persiste o googleEventId devolvido', async () => {
    ;(syncAppointment as unknown as Mock).mockResolvedValue('gcal-evt-1')
    ;(db.insert as unknown as Mock).mockReturnValue(chain([aptRow()]))
    const updateBuilder = chain(undefined)
    ;(db.update as unknown as Mock).mockReturnValue(updateBuilder)

    const res = await POST_AGENDA(agendaReq(agendaBody()))
    expect(res.status).toBe(201)

    expect(syncAppointment).toHaveBeenCalledTimes(1)
    expect((syncAppointment as unknown as Mock).mock.calls[0][1]).toBe('Ana Souza')
    expect((updateBuilder.set as unknown as Mock).mock.calls[0][0]).toEqual({ googleEventId: 'gcal-evt-1' })
    expect((await res.json()).data.googleEventId).toBe('gcal-evt-1')
  })

  // Compromisso sem médico não tem agenda do Google para onde ir.
  it('não chama o Google quando não há médico', async () => {
    ;(db.insert as unknown as Mock).mockReturnValue(chain([aptRow({ doctorId: null })]))

    const res = await POST_AGENDA(agendaReq(agendaBody({ doctorId: null })))
    expect(res.status).toBe(201)
    expect(syncAppointment).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })

  // Publicar na agenda do médico um evento que já nasce cancelado obrigaria
  // alguém a apagar manualmente do Google.
  it('não chama o Google quando o agendamento já nasce cancelado', async () => {
    ;(db.insert as unknown as Mock).mockReturnValue(chain([aptRow({ status: 'cancelled' })]))

    const res = await POST_AGENDA(agendaReq(agendaBody()))
    expect(res.status).toBe(201)
    expect(syncAppointment).not.toHaveBeenCalled()
  })

  // Um agendamento que termina antes de começar some do calendário e quebra
  // qualquer cálculo de duração/ocupação.
  it('400 quando endAt é anterior ou igual a startAt', async () => {
    const anterior = await POST_AGENDA(agendaReq(agendaBody({ endAt: '2026-09-01T12:00:00.000Z' })))
    expect(anterior.status).toBe(400)

    const igual = await POST_AGENDA(agendaReq(agendaBody({ endAt: START })))
    expect(igual.status).toBe(400)

    expect(db.insert).not.toHaveBeenCalled()
  })

  it('403 para o financeiro, que não tem agenda:create', async () => {
    sessionAs('financial')
    const res = await POST_AGENDA(agendaReq(agendaBody()))
    expect(res.status).toBe(403)
    expect(db.insert).not.toHaveBeenCalled()
  })

  // Duas recepcionistas marcavam o mesmo médico às 14h da mesma terça e as duas
  // recebiam 201 — o choque só aparecia quando os dois pacientes batiam na porta
  // do consultório.
  it('409 quando o médico já tem agendamento sobreposto', async () => {
    ;(db.query.appointments.findMany as unknown as Mock).mockResolvedValue([conflitoRow()])

    const res = await POST_AGENDA(agendaReq(agendaBody()))
    expect(res.status).toBe(409)
    expect(db.insert).not.toHaveBeenCalled()

    // A recepção precisa saber O QUE remarcar e EM QUE horário, não só que falhou.
    const { error } = await res.json()
    expect(error).toContain('médico')
    expect(error).toContain('01/09/2026')
    expect(error).toContain('10:30')
    expect(error).toContain('11:30')
  })

  // Sala é recurso disputado igual ao médico: barrar só por médico deixava dois
  // médicos diferentes usando a mesma sala no mesmo horário.
  it('409 quando a sala já está ocupada, mesmo sem médico', async () => {
    ;(db.query.appointments.findMany as unknown as Mock).mockResolvedValue([
      conflitoRow({ doctorId: null, roomId: ROOM_ID }),
    ])

    const res = await POST_AGENDA(agendaReq(agendaBody({ doctorId: null, roomId: ROOM_ID })))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('sala')
    expect(db.insert).not.toHaveBeenCalled()
  })

  // A regra de sobreposição mora no WHERE, não em JS: é aqui que se prova que
  // encostar não conflita (14h–15h + 15h–16h) e que cancelado não ocupa horário.
  it('procura choque com janela estrita, por médico ou sala, ignorando cancelados', async () => {
    ;(db.insert as unknown as Mock).mockReturnValue(chain([aptRow()]))

    const res = await POST_AGENDA(agendaReq(agendaBody({ roomId: ROOM_ID })))
    expect(res.status).toBe(201)

    const { sql, params: p } = whereDoConflito()
    // `<` e `>` estritos: 15h–16h encostando em 14h–15h passa.
    expect(sql).toContain('"start_at" <')
    expect(sql).toContain('"end_at" >')
    expect(sql).not.toContain('"start_at" <=')
    expect(sql).not.toContain('"end_at" >=')
    // Médico OU sala — não é só o médico.
    expect(sql).toContain('"doctor_id" =')
    expect(sql).toContain('"room_id" =')
    expect(sql).toContain(' or ')
    // Cancelado libera o horário.
    expect(sql).toContain('"status" <>')
    expect(p).toContain('cancelled')
    expect(p).toContain(DOCTOR_ID)
    expect(p).toContain(ROOM_ID)
    expect(p).toContain(END) // fim existente > novo início e vice-versa
    expect(p).toContain(START)
  })

  // Compromisso sem médico e sem sala não disputa recurso nenhum: consultar o
  // banco só para descobrir isso é ida perdida em toda marcação pessoal.
  it('não consulta a agenda quando não há médico nem sala', async () => {
    ;(db.insert as unknown as Mock).mockReturnValue(chain([aptRow({ doctorId: null })]))

    const res = await POST_AGENDA(agendaReq(agendaBody({ doctorId: null })))
    expect(res.status).toBe(201)
    expect(db.query.appointments.findMany).not.toHaveBeenCalled()
  })
})

describe('POST /api/agenda — lançamento financeiro da consulta paga', () => {
  beforeEach(() => {
    sessionAs('receptionist')
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ name: 'Ana Souza' }]))
    semConflitos()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-28T12:00:00.000Z'))
  })

  // Se o lançamento não sai junto do agendamento, a consulta é atendida e a
  // receita nunca entra no contas a receber.
  it('cria a transação de consultation_fee com valor e baixa corretos', async () => {
    const aptBuilder = chain([
      aptRow({ isPaidConsultation: true, consultationPrice: '350.00', paymentStatus: 'paid' }),
    ])
    const txBuilder = chain(undefined)
    ;(db.insert as unknown as Mock)
      .mockReturnValueOnce(aptBuilder) // appointments
      .mockReturnValueOnce(txBuilder) // transactions

    const res = await POST_AGENDA(
      agendaReq(agendaBody({ isPaidConsultation: true, consultationPrice: '350.00', paymentStatus: 'paid' })),
    )
    expect(res.status).toBe(201)

    const tx = (txBuilder.values as unknown as Mock).mock.calls[0][0]
    expect(tx.type).toBe('income')
    expect(tx.category).toBe('consultation_fee')
    expect(tx.amount).toBe('350.00')
    expect(tx.isPaid).toBe(true)
    expect(tx.paidAt).toBeInstanceOf(Date)
    expect(tx.patientId).toBe(PATIENT_ID)
    expect(tx.appointmentId).toBe(APT_ID)
    expect(tx.date).toBe('2026-08-28')
    expect(tx.dueDate).toBe('2026-09-01') // vence no dia da consulta
    expect(tx.description).toContain('(Pago)')
  })

  // Consulta paga mas ainda não recebida tem que ficar em aberto no financeiro.
  it('paymentStatus pending entra como a receber, sem paidAt', async () => {
    const aptBuilder = chain([
      aptRow({ isPaidConsultation: true, consultationPrice: '350.00', paymentStatus: 'pending' }),
    ])
    const txBuilder = chain(undefined)
    ;(db.insert as unknown as Mock).mockReturnValueOnce(aptBuilder).mockReturnValueOnce(txBuilder)

    const res = await POST_AGENDA(
      agendaReq(agendaBody({ isPaidConsultation: true, consultationPrice: '350.00', paymentStatus: 'pending' })),
    )
    expect(res.status).toBe(201)

    const tx = (txBuilder.values as unknown as Mock).mock.calls[0][0]
    expect(tx.isPaid).toBe(false)
    expect(tx.paidAt).toBeNull()
    expect(tx.description).toContain('(A receber)')
  })

  // A forma de pagamento parava em `appointments`: o relatório por meio de
  // recebimento não enxergava um centavo das taxas de consulta.
  it('propaga a forma de pagamento para o lançamento', async () => {
    const txBuilder = chain(undefined)
    ;(db.insert as unknown as Mock)
      .mockReturnValueOnce(
        chain([
          aptRow({
            isPaidConsultation: true,
            consultationPrice: '350.00',
            paymentStatus: 'paid',
            paymentMethodId: PIX_ID,
          }),
        ]),
      )
      .mockReturnValueOnce(txBuilder)

    const res = await POST_AGENDA(
      agendaReq(
        agendaBody({
          isPaidConsultation: true,
          consultationPrice: '350.00',
          paymentStatus: 'paid',
          paymentMethodId: PIX_ID,
        }),
      ),
    )
    expect(res.status).toBe(201)
    expect((txBuilder.values as unknown as Mock).mock.calls[0][0].paymentMethodId).toBe(PIX_ID)
  })

  // Consulta das 21h de 01/09 (BRT) é 02/09 em UTC: o recebível vencia no dia
  // seguinte e o contas a receber do dia nascia furado.
  it('consulta noturna vence no dia da consulta em BRT, não no dia seguinte', async () => {
    const NOITE_START = '2026-09-02T00:00:00.000Z' // 01/09 às 21h em Brasília
    const NOITE_END = '2026-09-02T01:00:00.000Z'
    const txBuilder = chain(undefined)
    ;(db.insert as unknown as Mock)
      .mockReturnValueOnce(
        chain([
          aptRow({
            startAt: new Date(NOITE_START),
            endAt: new Date(NOITE_END),
            isPaidConsultation: true,
            consultationPrice: '350.00',
            paymentStatus: 'pending',
          }),
        ]),
      )
      .mockReturnValueOnce(txBuilder)

    const res = await POST_AGENDA(
      agendaReq(
        agendaBody({
          startAt: NOITE_START,
          endAt: NOITE_END,
          isPaidConsultation: true,
          consultationPrice: '350.00',
          paymentStatus: 'pending',
        }),
      ),
    )
    expect(res.status).toBe(201)
    expect((txBuilder.values as unknown as Mock).mock.calls[0][0].dueDate).toBe('2026-09-01')
  })

  // Marcar consulta paga para um LEAD (sem ficha) gravava o preço no agendamento
  // e não gerava transação nenhuma: R$ 350 sumiam em silêncio, sem erro nem
  // aviso, e ninguém no financeiro ficava sabendo da cobrança. Falhar alto é
  // melhor que perder receita calado.
  it('400 em consulta paga sem paciente com ficha, sem gravar nada', async () => {
    const res = await POST_AGENDA(
      agendaReq(
        agendaBody({
          patientId: null,
          leadId: LEAD_ID,
          isPaidConsultation: true,
          consultationPrice: '350.00',
          paymentStatus: 'paid',
        }),
      ),
    )
    expect(res.status).toBe(400)
    // A mensagem tem que dizer o que fazer: criar a ficha do paciente.
    expect((await res.json()).error).toContain('ficha')
    // Nem o agendamento entra: preço cobrado sem receita é pior que falhar.
    expect(db.insert).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────
// 4. Consulta atendida / cancelada
// ─────────────────────────────────────────────────────────────

describe('PATCH /api/agenda/[id] — transições de status', () => {
  beforeEach(() => {
    sessionAs('receptionist')
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ name: 'Ana Souza' }]))
    semConflitos()
  })

  // Marcar como atendida é um PATCH de status puro: não pode disparar
  // recálculo de financeiro nem aviso de cancelamento.
  it('marca a consulta como atendida sem mexer no financeiro', async () => {
    const builder = chain([aptRow({ status: 'attended', doctorId: null })])
    ;(db.update as unknown as Mock).mockReturnValue(builder)

    const res = await PATCH_AGENDA(agendaPatchReq({ status: 'attended' }), params(APT_ID))
    expect(res.status).toBe(200)

    const setArg = (builder.set as unknown as Mock).mock.calls[0][0]
    expect(setArg.status).toBe('attended')
    expect(setArg.updatedAt).toBeInstanceOf(Date)
    // Não mexeu em horário, então não precisa reler o agendamento para validar.
    expect(db.query.appointments.findFirst).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.delete).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  // Cancelar sem remover do Google deixa o médico com um horário fantasma
  // bloqueado na agenda pessoal dele.
  it('cancelar remove o evento do Google e avisa a equipe', async () => {
    const builder = chain([aptRow({ status: 'cancelled', googleEventId: 'gcal-evt-1' })])
    ;(db.update as unknown as Mock)
      .mockReturnValueOnce(builder) // appointments .returning()
      .mockReturnValueOnce(chain(undefined)) // limpeza do googleEventId

    const res = await PATCH_AGENDA(agendaPatchReq({ status: 'cancelled' }), params(APT_ID))
    expect(res.status).toBe(200)

    expect(removeAppointment).toHaveBeenCalledWith(DOCTOR_ID, 'gcal-evt-1')
    expect(syncAppointment).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'appointment_cancelled', priority: 'high', entityId: APT_ID }),
    )
    expect((await res.json()).data.googleEventId).toBeNull()
  })

  it('403 para o financeiro, que não tem agenda:edit', async () => {
    sessionAs('financial')
    const res = await PATCH_AGENDA(agendaPatchReq({ status: 'attended' }), params(APT_ID))
    expect(res.status).toBe(403)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('404 quando o agendamento não existe', async () => {
    ;(db.update as unknown as Mock).mockReturnValue(chain([]))
    const res = await PATCH_AGENDA(agendaPatchReq({ status: 'attended' }), params(APT_ID))
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/agenda/[id] — remarcação e choque de horário', () => {
  const NOVO_START = '2026-09-01T13:30:00.000Z'
  const NOVO_END = '2026-09-01T14:30:00.000Z'

  beforeEach(() => {
    sessionAs('receptionist')
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ name: 'Ana Souza' }]))
    semConflitos()
    ;(db.query.appointments.findFirst as unknown as Mock).mockResolvedValue({
      startAt: new Date(START),
      endAt: new Date(END),
      doctorId: DOCTOR_ID,
      roomId: null,
    })
  })

  // Arrastar o card na agenda por cima do horário de outro paciente gravava sem
  // reclamar: os dois só descobriam o choque na recepção.
  it('409 ao remarcar por cima de outro agendamento do mesmo médico', async () => {
    ;(db.query.appointments.findMany as unknown as Mock).mockResolvedValue([conflitoRow()])

    const res = await PATCH_AGENDA(
      agendaPatchReq({ startAt: NOVO_START, endAt: NOVO_END }),
      params(APT_ID),
    )
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('médico')
    // Nada foi gravado: o horário antigo continua valendo.
    expect(db.update).not.toHaveBeenCalled()
  })

  // Sem ignorar o próprio registro, esticar o fim da consulta daria 409 contra
  // ela mesma e ninguém conseguiria mais remarcar nada.
  it('o próprio agendamento não conta como conflito consigo mesmo', async () => {
    ;(db.update as unknown as Mock).mockReturnValue(chain([aptRow({ doctorId: null })]))

    const res = await PATCH_AGENDA(
      agendaPatchReq({ startAt: NOVO_START, endAt: NOVO_END }),
      params(APT_ID),
    )
    expect(res.status).toBe(200)

    const { sql, params: p } = whereDoConflito()
    expect(sql).toContain('"id" <>')
    expect(p).toContain(APT_ID)
    // A janela pesquisada é a NOVA, não a que estava no banco.
    expect(p).toContain(NOVO_START)
    expect(p).toContain(NOVO_END)
  })

  // Trocar só a sala também disputa recurso: sem checar aqui, dois procedimentos
  // caíam na mesma sala no mesmo horário.
  it('checa conflito quando só a sala muda, usando o horário já gravado', async () => {
    ;(db.query.appointments.findMany as unknown as Mock).mockResolvedValue([
      conflitoRow({ doctorId: null, roomId: ROOM_ID }),
    ])

    const res = await PATCH_AGENDA(agendaPatchReq({ roomId: ROOM_ID }), params(APT_ID))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('sala')

    const { params: p } = whereDoConflito()
    expect(p).toContain(ROOM_ID)
    expect(p).toContain(START)
    expect(p).toContain(END)
  })

  // Cancelar libera o horário. Se o cancelamento fosse barrado por conflito,
  // uma marcação duplicada viraria impossível de desfazer.
  it('cancelar remarcando não é barrado por conflito', async () => {
    ;(db.query.appointments.findMany as unknown as Mock).mockResolvedValue([conflitoRow()])
    ;(db.update as unknown as Mock).mockReturnValue(
      chain([aptRow({ status: 'cancelled', doctorId: null })]),
    )

    const res = await PATCH_AGENDA(
      agendaPatchReq({ status: 'cancelled', startAt: NOVO_START, endAt: NOVO_END }),
      params(APT_ID),
    )
    expect(res.status).toBe(200)
    expect(db.query.appointments.findMany).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/agenda/[id] — funil e reconciliação financeira', () => {
  beforeEach(() => {
    sessionAs('receptionist')
    semConflitos()
  })

  // O funil morria em "Agendado": o PATCH mexia só no agendamento e o card ficava
  // preso no Kanban para sempre, mesmo com o paciente já atendido.
  it('marcar como atendida promove o lead vinculado para attended', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ name: 'Ana Souza' }]))
    const leadBuilder = chain(undefined)
    ;(db.update as unknown as Mock)
      .mockReturnValueOnce(chain([aptRow({ status: 'attended', doctorId: null, leadId: LEAD_ID })]))
      .mockReturnValueOnce(leadBuilder)

    const res = await PATCH_AGENDA(agendaPatchReq({ status: 'attended' }), params(APT_ID))
    expect(res.status).toBe(200)

    const setLead = (leadBuilder.set as unknown as Mock).mock.calls[0][0]
    expect(setLead.status).toBe('attended')
    expect(setLead.updatedAt).toBeInstanceOf(Date)

    const { sql, params: p } = sqlDo((leadBuilder.where as unknown as Mock).mock.calls[0][0])
    expect(p).toContain(LEAD_ID)
    // Quem já é paciente ativo está ADIANTE no funil: promover seria regredir.
    expect(sql).toContain('not in')
    expect(p).toContain('active_patient')
  })

  // Agendamento criado direto pela ficha não tem leadId: o card do lead precisa
  // ser encontrado pelo paciente, senão o funil trava do mesmo jeito.
  it('acha o lead pelo paciente quando o agendamento não tem leadId', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ name: 'Ana Souza' }]))
    const leadBuilder = chain(undefined)
    ;(db.update as unknown as Mock)
      .mockReturnValueOnce(chain([aptRow({ status: 'attended', doctorId: null, leadId: null })]))
      .mockReturnValueOnce(leadBuilder)

    const res = await PATCH_AGENDA(agendaPatchReq({ status: 'attended' }), params(APT_ID))
    expect(res.status).toBe(200)

    const { sql, params: p } = sqlDo((leadBuilder.where as unknown as Mock).mock.calls[0][0])
    expect(sql).toContain('"patient_id" =')
    expect(p).toContain(PATIENT_ID)
  })

  // Cancelar, confirmar ou remarcar não é comparecer: promover o lead aí seria
  // mentir para o funil.
  it('não promove o lead em transição que não é comparecimento', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ name: 'Ana Souza' }]))
    ;(db.update as unknown as Mock).mockReturnValue(
      chain([aptRow({ status: 'confirmed', doctorId: null, leadId: LEAD_ID })]),
    )

    const res = await PATCH_AGENDA(agendaPatchReq({ status: 'confirmed' }), params(APT_ID))
    expect(res.status).toBe(200)
    expect(db.update).toHaveBeenCalledTimes(1)
  })

  // Mesma dupla de furos do POST: taxa vencendo no dia errado e forma de
  // pagamento que nunca chegava ao financeiro.
  it('a reconciliação da taxa leva a forma de pagamento e vence em BRT', async () => {
    const txBuilder = chain(undefined)
    ;(db.update as unknown as Mock).mockReturnValueOnce(
      chain([
        aptRow({
          doctorId: null,
          startAt: new Date('2026-09-02T00:00:00.000Z'), // 01/09 às 21h em Brasília
          endAt: new Date('2026-09-02T01:00:00.000Z'),
          isPaidConsultation: true,
          consultationPrice: '350.00',
          paymentStatus: 'paid',
          paymentMethodId: PIX_ID,
        }),
      ]),
    )
    ;(db.select as unknown as Mock)
      .mockReturnValueOnce(chain([{ name: 'Ana Souza' }])) // paciente
      .mockReturnValueOnce(chain([])) // nenhuma taxa lançada ainda
      .mockReturnValue(chain([{ name: 'Ana Souza' }]))
    ;(db.insert as unknown as Mock).mockReturnValue(txBuilder)

    const res = await PATCH_AGENDA(agendaPatchReq({ paymentStatus: 'paid' }), params(APT_ID))
    expect(res.status).toBe(200)

    const tx = (txBuilder.values as unknown as Mock).mock.calls[0][0]
    expect(tx.paymentMethodId).toBe(PIX_ID)
    expect(tx.dueDate).toBe('2026-09-01')
  })
})

// ─────────────────────────────────────────────────────────────
// 5. Financeiro: a taxa da consulta não pode entrar duas vezes
// ─────────────────────────────────────────────────────────────

describe('POST /api/financeiro — guarda contra taxa de consulta duplicada', () => {
  beforeEach(() => sessionAs('admin'))

  const finBody = (over: Record<string, unknown> = {}) => ({
    type: 'income',
    category: 'consultation_fee',
    description: 'Consulta: Ana Souza',
    amount: '350.00',
    date: '2026-08-28',
    isPaid: true,
    paidAt: '2026-08-28T12:00:00.000Z',
    paymentMethodId: PIX_ID,
    patientId: PATIENT_ID,
    appointmentId: APT_ID,
    ...over,
  })

  // A taxa já entra no contas a receber no momento do agendamento. Clicar
  // "Compareceu" postava uma SEGUNDA transação com o mesmo appointmentId e
  // R$ 350 viravam R$ 700 a receber.
  it('atualiza a taxa existente em vez de lançar a segunda', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ id: TX_ID, amount: '350.00' }]))
    const updBuilder = chain([{ id: TX_ID, amount: '350.00', description: 'Consulta: Ana Souza' }])
    ;(db.update as unknown as Mock).mockReturnValue(updBuilder)

    const res = await POST_FINANCEIRO(financeiroReq(finBody()))
    expect(res.status).toBe(200)
    expect(db.insert).not.toHaveBeenCalled()

    // A baixa e a forma de pagamento da tela de finalizar consulta são
    // exatamente o que precisa ser gravado na transação que já existe.
    const set = (updBuilder.set as unknown as Mock).mock.calls[0][0]
    expect(set.isPaid).toBe(true)
    expect(set.paidAt).toBeInstanceOf(Date)
    expect(set.paymentMethodId).toBe(PIX_ID)
    expect((await res.json()).data.id).toBe(TX_ID)
  })

  // Um POST sem paidAt não pode apagar a data de recebimento já registrada —
  // a consulta viraria "paga sem data" no extrato.
  it('não zera a data de recebimento quando o corpo não traz paidAt', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ id: TX_ID, amount: '350.00' }]))
    const updBuilder = chain([{ id: TX_ID, amount: '350.00', description: 'Consulta: Ana Souza' }])
    ;(db.update as unknown as Mock).mockReturnValue(updBuilder)

    const { paidAt: _omitido, ...semPaidAt } = finBody()
    const res = await POST_FINANCEIRO(financeiroReq(semPaidAt))
    expect(res.status).toBe(200)
    expect('paidAt' in (updBuilder.set as unknown as Mock).mock.calls[0][0]).toBe(false)
  })

  // Parcelas de tratamento herdam o mesmo appointmentId: sem o recorte por
  // categoria e treatment_id, a guarda sobrescreveria uma parcela do tratamento.
  it('procura a duplicata só entre taxas de consulta sem tratamento', async () => {
    const selBuilder = chain([])
    ;(db.select as unknown as Mock).mockReturnValue(selBuilder)
    ;(db.insert as unknown as Mock).mockReturnValue(
      chain([{ id: TX_ID, amount: '350.00', description: 'Consulta: Ana Souza', type: 'income', category: 'consultation_fee', isPaid: true }]),
    )

    const res = await POST_FINANCEIRO(financeiroReq(finBody()))
    expect(res.status).toBe(201)

    const { sql, params: p } = sqlDo((selBuilder.where as unknown as Mock).mock.calls[0][0])
    expect(sql).toContain('"treatment_id" is null')
    expect(sql).toContain('"category" =')
    expect(p).toContain(APT_ID)
    expect(p).toContain('consultation_fee')
  })

  // Aluguel, material, procedimento: nada disso é taxa de consulta e não pode
  // pagar o pedágio de uma consulta extra ao banco.
  it('lançamento que não é taxa de consulta nem procura duplicata', async () => {
    ;(db.insert as unknown as Mock).mockReturnValue(
      chain([{ id: TX_ID, amount: '1200.00', description: 'Aluguel', type: 'expense', category: 'rent', isPaid: true }]),
    )

    const res = await POST_FINANCEIRO(
      financeiroReq(finBody({ type: 'expense', category: 'rent', description: 'Aluguel', amount: '1200.00', patientId: null, appointmentId: null })),
    )
    expect(res.status).toBe(201)
    expect(db.select).not.toHaveBeenCalled()
  })

  it('403 para o médico, que não tem financial:create', async () => {
    sessionAs('doctor')
    const res = await POST_FINANCEIRO(financeiroReq(finBody()))
    expect(res.status).toBe(403)
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })
})
