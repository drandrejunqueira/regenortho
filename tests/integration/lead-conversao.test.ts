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
    query: { leads: { findFirst: vi.fn() }, appointments: { findMany: vi.fn() } },
  },
}))
vi.mock('@/lib/db/logger', () => ({ logActivity: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ notify: vi.fn(async () => undefined) }))
vi.mock('@/lib/google/calendar', () => ({
  syncAppointment: vi.fn(async () => null),
  removeAppointment: vi.fn(async () => undefined),
}))

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { notify } from '@/lib/notifications'
import { syncAppointment } from '@/lib/google/calendar'
import { appointments, patients, transactions } from '@/lib/db/schema'
import { POST as CONVERTER } from '@/app/api/leads/[id]/converter/route'
import { POST as POST_PACIENTE } from '@/app/api/pacientes/route'

// UUIDs de verdade: as rotas validam com z.string().uuid() e rejeitariam 'l1'.
const LEAD_ID = '11111111-1111-4111-8111-111111111111'
const PATIENT_ID = '22222222-2222-4222-8222-222222222222'
const DOCTOR_ID = '33333333-3333-4333-8333-333333333333'
const APT_ID = '44444444-4444-4444-8444-444444444444'

const START = '2026-09-01T13:00:00.000Z'
const END = '2026-09-01T14:00:00.000Z'

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

const converterReq = (body: unknown) =>
  req(`http://localhost/api/leads/${LEAD_ID}/converter`, 'POST', body)
const pacienteReq = (body: unknown) => req('http://localhost/api/pacientes', 'POST', body)

const params = (id: string) => ({ params: Promise.resolve({ id }) })

/** Corpo mínimo válido que o ScheduleLeadDialog manda. */
const converterBody = (over: Record<string, unknown> = {}) => ({
  type: 'consultation',
  doctorId: DOCTOR_ID,
  startAt: START,
  endAt: END,
  ...over,
})

const leadRow = (over: Record<string, unknown> = {}) => ({
  id: LEAD_ID,
  name: 'Ana Souza',
  // Formatado de propósito: a busca por duplicado tem de comparar só os dígitos.
  phone: '(12) 98176-7896',
  email: 'ana@exemplo.com',
  status: 'contacted',
  source: 'meta_ads',
  specialty: 'Ortopedia',
  complaint: 'Dor no joelho direito',
  notes: null,
  assignedToId: null,
  convertedAt: null,
  patientId: null,
  lostReason: null,
  utmSource: null,
  utmCampaign: null,
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
})

const patientRow = (over: Record<string, unknown> = {}) => ({
  id: PATIENT_ID,
  name: 'Ana Souza',
  phone: '12981767896',
  email: 'ana@exemplo.com',
  ...over,
})

const aptRow = (over: Record<string, unknown> = {}) => ({
  id: APT_ID,
  patientId: PATIENT_ID,
  leadId: LEAD_ID,
  doctorId: DOCTOR_ID,
  type: 'consultation',
  status: 'scheduled',
  title: 'Consulta: Ana Souza',
  startAt: new Date(START),
  endAt: new Date(END),
  googleEventId: null,
  isPaidConsultation: false,
  consultationPrice: null,
  paymentStatus: null,
  paymentReceiptUrl: null,
  ...over,
})

// Nomes em vez dos objetos do schema: comparar as tabelas do Drizzle direto no
// expect imprime centenas de linhas de metadado quando o teste falha.
const TABLE_NAMES = new Map<unknown, string>([
  [patients, 'patients'],
  [appointments, 'appointments'],
  [transactions, 'transactions'],
])

/** Tabelas passadas para db.insert(), na ordem — revela se a ficha foi criada. */
const insertCalls = () =>
  (db.insert as unknown as Mock).mock.calls.map((c) => TABLE_NAMES.get(c[0]) ?? 'desconhecida')

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

// ─────────────────────────────────────────────────────────────
// Guardas de acesso
// ─────────────────────────────────────────────────────────────

describe('POST /api/leads/[id]/converter — autenticação e permissão', () => {
  it('401 sem sessão, sem tocar no banco', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)
    const res = await CONVERTER(converterReq(converterBody()), params(LEAD_ID))
    expect(res.status).toBe(401)
    expect(db.query.leads.findFirst).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })

  // O médico enxerga a agenda, mas não abre ficha nem mexe no funil comercial.
  it('403 para o médico', async () => {
    sessionAs('doctor')
    const res = await CONVERTER(converterReq(converterBody()), params(LEAD_ID))
    expect(res.status).toBe(403)
    expect(db.insert).not.toHaveBeenCalled()
  })

  // A rota faz o trabalho de três rotas: quem não tem TODAS as permissões delas não
  // pode entrar por esta porta e conseguir o que as outras três negariam.
  it('403 para quem tem leads:edit mas não tem patients:create nem agenda:create', async () => {
    sessionAs('receptionist', ['leads:view', 'leads:edit'])
    const res = await CONVERTER(converterReq(converterBody()), params(LEAD_ID))
    expect(res.status).toBe(403)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('403 para o financeiro, que não tem agenda:create', async () => {
    sessionAs('financial')
    const res = await CONVERTER(converterReq(converterBody()), params(LEAD_ID))
    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────
// Validação do corpo
// ─────────────────────────────────────────────────────────────

describe('POST /api/leads/[id]/converter — validação', () => {
  beforeEach(() => {
    sessionAs('receptionist')
    // Sem conflito de horário por padrão: a conversão consulta a agenda antes de
    // escrever qualquer coisa, como o POST /api/agenda faz.
    ;(db.query.appointments.findMany as unknown as Mock).mockResolvedValue([])
  })

  it('404 quando o lead não existe', async () => {
    ;(db.query.leads.findFirst as unknown as Mock).mockResolvedValue(undefined)
    const res = await CONVERTER(converterReq(converterBody()), params(LEAD_ID))
    expect(res.status).toBe(404)
    expect(db.insert).not.toHaveBeenCalled()
  })

  // Consulta que termina antes de começar some do calendário e quebra o cálculo
  // de ocupação da agenda.
  it('400 quando endAt não é posterior a startAt', async () => {
    ;(db.query.leads.findFirst as unknown as Mock).mockResolvedValue(leadRow())
    const res = await CONVERTER(converterReq(converterBody({ endAt: START })), params(LEAD_ID))
    expect(res.status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('400 sem data de início', async () => {
    ;(db.query.leads.findFirst as unknown as Mock).mockResolvedValue(leadRow())
    const res = await CONVERTER(converterReq({ type: 'consultation', endAt: END }), params(LEAD_ID))
    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────
// Conversão feliz
// ─────────────────────────────────────────────────────────────

describe('POST /api/leads/[id]/converter — conversão completa', () => {
  beforeEach(() => {
    sessionAs('receptionist')
    // Sem conflito de horário por padrão: a conversão consulta a agenda antes de
    // escrever qualquer coisa, como o POST /api/agenda faz.
    ;(db.query.appointments.findMany as unknown as Mock).mockResolvedValue([])
  })

  it('cria ficha, agendamento e grava o vínculo no lead em uma requisição', async () => {
    ;(db.query.leads.findFirst as unknown as Mock).mockResolvedValue(leadRow())
    ;(db.select as unknown as Mock).mockReturnValue(chain([])) // nenhum paciente com este telefone
    const patientBuilder = chain([patientRow()])
    const aptBuilder = chain([aptRow()])
    ;(db.insert as unknown as Mock)
      .mockReturnValueOnce(patientBuilder)
      .mockReturnValueOnce(aptBuilder)
    const leadBuilder = chain(undefined)
    ;(db.update as unknown as Mock).mockReturnValue(leadBuilder)

    const res = await CONVERTER(converterReq(converterBody()), params(LEAD_ID))
    expect(res.status).toBe(201)

    const json = await res.json()
    expect(json.data.patient.id).toBe(PATIENT_ID)
    expect(json.data.appointment.id).toBe(APT_ID)
    expect(json.data.patientCreated).toBe(true)

    expect(insertCalls()).toEqual(['patients', 'appointments'])

    // A ficha nasce com o agendamento apontando para ela e para o lead de origem.
    const aptValues = (aptBuilder.values as unknown as Mock).mock.calls[0][0]
    expect(aptValues.patientId).toBe(PATIENT_ID)
    expect(aptValues.leadId).toBe(LEAD_ID)
    expect(aptValues.startAt).toBeInstanceOf(Date)
    expect(aptValues.endAt).toBeInstanceOf(Date)

    // Vínculo gravado: sem isto, a próxima conversão abriria outro prontuário.
    const setArg = (leadBuilder.set as unknown as Mock).mock.calls[0][0]
    expect(setArg.patientId).toBe(PATIENT_ID)
    expect(setArg.status).toBe('scheduled')
    expect(setArg.convertedAt).toBeInstanceOf(Date)

    // O sino do topo é como o resto da equipe descobre o agendamento.
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'appointment_new', entityId: APT_ID, link: '/agenda' }),
    )
  })

  // A conversão antiga levava só 4 campos: origem, especialidade e queixa morriam
  // na passagem e o prontuário nascia sem saber de onde o paciente veio.
  it('leva queixa, origem e especialidade do lead para a ficha', async () => {
    ;(db.query.leads.findFirst as unknown as Mock).mockResolvedValue(leadRow())
    ;(db.select as unknown as Mock).mockReturnValue(chain([]))
    const patientBuilder = chain([patientRow()])
    ;(db.insert as unknown as Mock)
      .mockReturnValueOnce(patientBuilder)
      .mockReturnValueOnce(chain([aptRow()]))
    ;(db.update as unknown as Mock).mockReturnValue(chain(undefined))

    await CONVERTER(converterReq(converterBody()), params(LEAD_ID))

    const values = (patientBuilder.values as unknown as Mock).mock.calls[0][0]
    expect(values.name).toBe('Ana Souza')
    expect(values.phone).toBe('(12) 98176-7896')
    expect(values.email).toBe('ana@exemplo.com')
    expect(values.notes).toContain('Dor no joelho direito')
    expect(values.internalNotes).toContain('Meta Ads')
    expect(values.internalNotes).toContain('Ortopedia')
  })

  // Campos que o lead não tem (CPF, convênio) são digitados na hora do agendamento.
  it('aceita os dados complementares da ficha enviados no corpo', async () => {
    ;(db.query.leads.findFirst as unknown as Mock).mockResolvedValue(leadRow())
    ;(db.select as unknown as Mock).mockReturnValue(chain([]))
    const patientBuilder = chain([patientRow()])
    ;(db.insert as unknown as Mock)
      .mockReturnValueOnce(patientBuilder)
      .mockReturnValueOnce(chain([aptRow()]))
    ;(db.update as unknown as Mock).mockReturnValue(chain(undefined))

    await CONVERTER(
      converterReq(
        converterBody({ patient: { cpf: '123.456.789-00', insurance: 'Unimed', city: 'Taubaté' } }),
      ),
      params(LEAD_ID),
    )

    const values = (patientBuilder.values as unknown as Mock).mock.calls[0][0]
    expect(values.cpf).toBe('123.456.789-00')
    expect(values.insurance).toBe('Unimed')
    expect(values.city).toBe('Taubaté')
  })

  // Espelha POST /api/agenda: consulta paga tem de virar receita no mesmo ato,
  // senão a consulta é atendida e o dinheiro nunca entra no contas a receber.
  it('lança a taxa da consulta quando a consulta é paga', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-28T12:00:00.000Z'))
    ;(db.query.leads.findFirst as unknown as Mock).mockResolvedValue(leadRow())
    ;(db.select as unknown as Mock).mockReturnValue(chain([]))
    const txBuilder = chain(undefined)
    ;(db.insert as unknown as Mock)
      .mockReturnValueOnce(chain([patientRow()]))
      .mockReturnValueOnce(
        chain([aptRow({ isPaidConsultation: true, consultationPrice: '350.00', paymentStatus: 'paid' })]),
      )
      .mockReturnValueOnce(txBuilder)
    ;(db.update as unknown as Mock).mockReturnValue(chain(undefined))

    const res = await CONVERTER(
      converterReq(
        converterBody({ isPaidConsultation: true, consultationPrice: '350.00', paymentStatus: 'paid' }),
      ),
      params(LEAD_ID),
    )
    expect(res.status).toBe(201)

    expect(insertCalls()).toEqual(['patients', 'appointments', 'transactions'])
    const tx = (txBuilder.values as unknown as Mock).mock.calls[0][0]
    expect(tx.category).toBe('consultation_fee')
    expect(tx.amount).toBe('350.00')
    expect(tx.isPaid).toBe(true)
    expect(tx.patientId).toBe(PATIENT_ID)
    expect(tx.appointmentId).toBe(APT_ID)
  })

  // Sem gravar o googleEventId o sistema perde o vínculo e duplica o evento na
  // agenda do médico a cada edição.
  it('sincroniza com o Google e persiste o googleEventId', async () => {
    ;(syncAppointment as unknown as Mock).mockResolvedValue('gcal-evt-1')
    ;(db.query.leads.findFirst as unknown as Mock).mockResolvedValue(leadRow())
    ;(db.select as unknown as Mock).mockReturnValue(chain([]))
    ;(db.insert as unknown as Mock)
      .mockReturnValueOnce(chain([patientRow()]))
      .mockReturnValueOnce(chain([aptRow()]))
    ;(db.update as unknown as Mock).mockReturnValue(chain(undefined))

    const res = await CONVERTER(converterReq(converterBody()), params(LEAD_ID))
    expect(res.status).toBe(201)
    expect(syncAppointment).toHaveBeenCalledTimes(1)
    expect((await res.json()).data.appointment.googleEventId).toBe('gcal-evt-1')
  })
})

// ─────────────────────────────────────────────────────────────
// Idempotência da ficha (F-04)
// ─────────────────────────────────────────────────────────────

describe('POST /api/leads/[id]/converter — reuso da ficha', () => {
  beforeEach(() => {
    sessionAs('receptionist')
    // Sem conflito de horário por padrão: a conversão consulta a agenda antes de
    // escrever qualquer coisa, como o POST /api/agenda faz.
    ;(db.query.appointments.findMany as unknown as Mock).mockResolvedValue([])
  })

  it('reusa a ficha quando o lead já tem patientId', async () => {
    ;(db.query.leads.findFirst as unknown as Mock).mockResolvedValue(leadRow({ patientId: PATIENT_ID }))
    ;(db.select as unknown as Mock).mockReturnValue(chain([patientRow()]))
    const aptBuilder = chain([aptRow()])
    ;(db.insert as unknown as Mock).mockReturnValue(aptBuilder)
    ;(db.update as unknown as Mock).mockReturnValue(chain(undefined))

    const res = await CONVERTER(converterReq(converterBody()), params(LEAD_ID))
    expect(res.status).toBe(201)

    // Só o agendamento foi inserido — nenhum prontuário novo.
    expect(insertCalls()).toEqual(['appointments'])
    expect((await res.json()).data.patientCreated).toBe(false)
    expect((aptBuilder.values as unknown as Mock).mock.calls[0][0].patientId).toBe(PATIENT_ID)
  })

  // Landing page hoje, WhatsApp amanhã: dois leads, uma pessoa só. Sem a busca por
  // telefone o segundo lead abre um segundo prontuário para o mesmo paciente.
  it('reusa a ficha achada pelo telefone quando o lead ainda não tem vínculo', async () => {
    ;(db.query.leads.findFirst as unknown as Mock).mockResolvedValue(leadRow({ patientId: null }))
    ;(db.select as unknown as Mock).mockReturnValue(chain([patientRow({ phone: '12981767896' })]))
    ;(db.insert as unknown as Mock).mockReturnValue(chain([aptRow()]))
    const leadBuilder = chain(undefined)
    ;(db.update as unknown as Mock).mockReturnValue(leadBuilder)

    const res = await CONVERTER(converterReq(converterBody()), params(LEAD_ID))
    expect(res.status).toBe(201)

    expect(db.select).toHaveBeenCalledTimes(1) // a busca por telefone aconteceu
    expect(insertCalls()).toEqual(['appointments'])
    expect((leadBuilder.set as unknown as Mock).mock.calls[0][0].patientId).toBe(PATIENT_ID)
  })
})

// ─────────────────────────────────────────────────────────────
// Falha no meio do caminho (F-01)
// ─────────────────────────────────────────────────────────────

describe('POST /api/leads/[id]/converter — falha no agendamento', () => {
  beforeEach(() => {
    sessionAs('receptionist')
    // Sem conflito de horário por padrão: a conversão consulta a agenda antes de
    // escrever qualquer coisa, como o POST /api/agenda faz.
    ;(db.query.appointments.findMany as unknown as Mock).mockResolvedValue([])
  })

  // Este é o coração do F-01: com as três requisições antigas, uma falha no
  // agendamento deixava o lead como "Agendado" sem consulta nenhuma — um card
  // indistinguível de um agendamento real.
  it('não marca o lead como convertido quando o agendamento falha', async () => {
    ;(db.query.leads.findFirst as unknown as Mock).mockResolvedValue(leadRow())
    ;(db.select as unknown as Mock).mockReturnValue(chain([]))
    ;(db.insert as unknown as Mock)
      .mockReturnValueOnce(chain([patientRow()]))
      .mockImplementationOnce(() => {
        throw new Error('timeout do Neon')
      })

    const res = await CONVERTER(converterReq(converterBody()), params(LEAD_ID))
    expect(res.status).toBe(500)

    // Nem status 'scheduled', nem convertedAt, nem vínculo: o lead segue no funil.
    expect(db.update).not.toHaveBeenCalled()
    // Ninguém é avisado de um agendamento que não existe.
    expect(notify).not.toHaveBeenCalled()

    // A mensagem diz o que ficou de pé e o que não ficou, em pt-BR.
    const json = await res.json()
    expect(json.error).toContain('ficha')
    expect(json.error).toContain('NÃO foi agendada')
  })

  // Repetir depois do erro é o comportamento natural de quem está na recepção:
  // não pode virar um segundo prontuário para a mesma pessoa.
  it('repetir a chamada após a falha não cria uma segunda ficha', async () => {
    ;(db.query.leads.findFirst as unknown as Mock).mockResolvedValue(leadRow())

    // 1ª tentativa: ninguém com este telefone → cria a ficha, agendamento explode.
    ;(db.select as unknown as Mock).mockReturnValueOnce(chain([]))
    ;(db.insert as unknown as Mock)
      .mockReturnValueOnce(chain([patientRow()]))
      .mockImplementationOnce(() => {
        throw new Error('timeout do Neon')
      })

    const primeira = await CONVERTER(converterReq(converterBody()), params(LEAD_ID))
    expect(primeira.status).toBe(500)
    // Uma ficha criada; o insert do agendamento chegou a ser chamado e explodiu.
    expect(insertCalls().filter((t) => t === 'patients')).toHaveLength(1)

    // 2ª tentativa: a ficha da 1ª agora aparece na busca por telefone.
    ;(db.insert as unknown as Mock).mockReset()
    ;(db.select as unknown as Mock).mockReturnValueOnce(chain([patientRow()]))
    ;(db.insert as unknown as Mock).mockReturnValue(chain([aptRow()]))
    ;(db.update as unknown as Mock).mockReturnValue(chain(undefined))

    const segunda = await CONVERTER(converterReq(converterBody()), params(LEAD_ID))
    expect(segunda.status).toBe(201)
    expect(insertCalls()).toEqual(['appointments'])
    expect((await segunda.json()).data.patientCreated).toBe(false)
  })

  // Falhar antes de criar a ficha não pode deixar rastro nenhum.
  it('não agenda nada quando a ficha do paciente não pôde ser criada', async () => {
    ;(db.query.leads.findFirst as unknown as Mock).mockResolvedValue(leadRow())
    ;(db.select as unknown as Mock).mockReturnValue(chain([]))
    ;(db.insert as unknown as Mock).mockImplementationOnce(() => {
      throw new Error('coluna inexistente')
    })

    const res = await CONVERTER(converterReq(converterBody()), params(LEAD_ID))
    expect(res.status).toBe(500)
    expect(db.update).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
    expect((await res.json()).error).toContain('Nada foi alterado')
  })
})

// ─────────────────────────────────────────────────────────────
// Deduplicação em POST /api/pacientes (F-04)
// ─────────────────────────────────────────────────────────────

describe('POST /api/pacientes — deduplicação por telefone', () => {
  beforeEach(() => {
    sessionAs('receptionist')
    // Sem conflito de horário por padrão: a conversão consulta a agenda antes de
    // escrever qualquer coisa, como o POST /api/agenda faz.
    ;(db.query.appointments.findMany as unknown as Mock).mockResolvedValue([])
  })

  // A tabela não tem UNIQUE nenhuma: sem esta checagem o mesmo indivíduo vira dois
  // prontuários e o histórico clínico/financeiro racha em dois.
  it('409 com a ficha existente no corpo quando o telefone já está cadastrado', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([patientRow()]))

    const res = await POST_PACIENTE(pacienteReq({ name: 'Ana S.', phone: '(12) 98176-7896' }))
    expect(res.status).toBe(409)

    const json = await res.json()
    expect(json.error).toContain('telefone')
    // A tela usa esta ficha para oferecer "usar o cadastro existente".
    expect(json.data.id).toBe(PATIENT_ID)
    expect(db.insert).not.toHaveBeenCalled()
  })

  // A comparação é por dígitos: máscara diferente é a mesma pessoa.
  it('detecta o duplicado mesmo com máscara diferente do cadastro', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([patientRow({ phone: '12981767896' })]))

    const res = await POST_PACIENTE(pacienteReq({ name: 'Ana S.', phone: '12 98176 7896' }))
    expect(res.status).toBe(409)
  })

  it('201 quando o telefone ainda não existe', async () => {
    ;(db.select as unknown as Mock).mockReturnValue(chain([]))
    ;(db.insert as unknown as Mock).mockReturnValue(chain([patientRow()]))

    const res = await POST_PACIENTE(pacienteReq({ name: 'Ana Souza', phone: '11999990000' }))
    expect(res.status).toBe(201)
    expect((await res.json()).data.id).toBe(PATIENT_ID)
  })
})
