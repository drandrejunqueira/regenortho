import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { chain } from '../helpers/dbChain'

/**
 * A jornada do paciente, ponta a ponta, numa corrida só.
 *
 * Os testes por rota (jornada-1/2/3) provam cada etapa isolada. Este prova a
 * COSTURA entre elas: que o id devolvido por uma etapa chega íntegro à seguinte
 * e é gravado no campo certo. Foi exatamente aí que o sistema já quebrou — o
 * zod de PATCH /api/leads/[id] descartava `patientId` em silêncio e cada
 * agendamento abria uma ficha nova para o mesmo paciente. Nenhum teste de rota
 * isolada pegava isso; um teste de costura pega.
 *
 * A conversão agora acontece num endpoint único (POST /api/leads/[id]/converter),
 * e não mais em três requisições orquestradas pelo navegador — a jornada abaixo
 * reflete o caminho real.
 */

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      leads: { findFirst: vi.fn() },
      appointments: { findFirst: vi.fn(), findMany: vi.fn() },
      materials: { findFirst: vi.fn() },
    },
  },
}))
vi.mock('@/lib/db/logger', () => ({ logActivity: vi.fn(async () => undefined) }))
vi.mock('@/lib/notifications', () => ({ notify: vi.fn(async () => undefined) }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ ok: true, remaining: 4, retryAfterSec: 0 })),
  getClientIp: vi.fn(() => '203.0.113.9'),
}))
vi.mock('@/lib/google/calendar', () => ({
  syncAppointment: vi.fn(async () => null),
  removeAppointment: vi.fn(async () => undefined),
}))
vi.mock('@/lib/materials-stock', () => ({
  darBaixaEstoque: vi.fn(async () => ({ saldo: 99, baixado: 1, faltou: 0 })),
  unidadesDeBaixa: vi.fn((q: number) => Math.ceil(Number(q) || 0)),
}))
vi.mock('@/lib/whatsapp', () => ({
  sendAndLog: vi.fn(async () => ({ ok: true })),
  tplNewLead: vi.fn(() => 'novo lead'),
  tplTreatmentSummary: vi.fn(() => 'resumo do tratamento'),
}))

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { appointments, leads, patients } from '@/lib/db/schema'
import { POST as leadPublico } from '@/app/api/public/leads/route'
import { POST as converterLead } from '@/app/api/leads/[id]/converter/route'
import { PATCH as editarAgendamento } from '@/app/api/agenda/[id]/route'
import { POST as criarTratamento } from '@/app/api/tratamentos/route'
import { PATCH as editarTratamento } from '@/app/api/tratamentos/[id]/route'

// UUIDs reais: as rotas validam com z.string().uuid().
const LEAD_ID = '11111111-1111-4111-8111-111111111111'
const PACIENTE_ID = '22222222-2222-4222-8222-222222222222'
const MEDICO_ID = '33333333-3333-4333-8333-333333333333'
const CONSULTA_ID = '44444444-4444-4444-8444-444444444444'
const TRATAMENTO_ID = '55555555-5555-4555-8555-555555555555'

const START = '2026-09-01T13:00:00.000Z'
const END = '2026-09-01T14:00:00.000Z'

const sessionAs = (role: string) =>
  (auth as unknown as Mock).mockResolvedValue({
    user: { id: 'u1', role, customPermissions: null, name: 'Recepção', email: 'recep@clinica.com' },
  })

const post = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

const patch = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

const params = (id: string) => ({ params: Promise.resolve({ id }) })

/** Plugga um insert e devolve o que a rota mandou gravar. */
function espiaInsert(retorno: Record<string, unknown>[]) {
  const c = chain(retorno)
  ;(db.insert as unknown as Mock).mockReturnValueOnce(c)
  return () => (c.values as unknown as Mock).mock.calls[0][0]
}

function espiaUpdate(retorno: Record<string, unknown>[]) {
  const c = chain(retorno)
  ;(db.update as unknown as Mock).mockReturnValueOnce(c)
  return () => (c.set as unknown as Mock).mock.calls[0][0] as Record<string, unknown>
}

/**
 * O que a jornada foi carregando. Cada etapa preenche a sua parte e a seguinte
 * consome — é o encadeamento que este arquivo existe para provar.
 */
const jornada: {
  leadId?: string
  pacienteId?: string
  consultaId?: string
  tratamentoId?: string
} = {}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-28T12:00:00.000Z'))
  sessionAs('admin')
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('Jornada do paciente — do site ao tratamento concluído', () => {
  /** Linha de `leads` como o banco a devolveria. */
  const leadRow = (over: Record<string, unknown> = {}) => ({
    id: LEAD_ID,
    name: 'Ana Souza',
    phone: '(12) 98176-7896',
    email: null,
    complaint: 'Dor no joelho há 3 meses',
    specialty: 'Joelho',
    source: 'google_ads',
    status: 'new',
    patientId: null,
    convertedAt: null,
    ...over,
  })

  /** Linha de `appointments` como o banco a devolveria. */
  const aptRow = (over: Record<string, unknown> = {}) => ({
    id: CONSULTA_ID,
    patientId: PACIENTE_ID,
    leadId: LEAD_ID,
    doctorId: MEDICO_ID,
    roomId: null,
    type: 'consultation',
    status: 'scheduled',
    title: 'Consulta: Ana Souza',
    startAt: new Date(START),
    endAt: new Date(END),
    googleEventId: null,
    isPaidConsultation: true,
    consultationPrice: '350.00',
    paymentMethodId: null,
    paymentStatus: 'paid',
    paymentReceiptUrl: null,
    ...over,
  })

  const converterBody = (over: Record<string, unknown> = {}) => ({
    startAt: START,
    endAt: END,
    doctorId: MEDICO_ID,
    type: 'consultation',
    isPaidConsultation: true,
    consultationPrice: '350.00',
    paymentStatus: 'paid',
    ...over,
  })

  /** Tabelas que a rota mandou atualizar, na ordem. */
  const tabelasAtualizadas = () => (db.update as unknown as Mock).mock.calls.map((c) => c[0])

  it('1. o visitante preenche o formulário do site e vira lead no CRM', async () => {
    const gravado = espiaInsert([
      { id: LEAD_ID, name: 'Ana Souza', phone: '12981767896', source: 'google_ads', specialty: 'Joelho' },
    ])

    const res = await leadPublico(
      post('http://localhost/api/public/leads', {
        name: 'Ana Souza',
        phone: '12981767896',
        complaint: 'Dor no joelho há 3 meses',
        tracking: { gclid: 'Cj0KCQ', utm_source: 'google', utm_campaign: 'joelho-2026' },
      }),
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe(LEAD_ID)

    // O lead entra no topo do funil com a origem derivada da atribuição paga — é o
    // que liga a consulta ao anúncio que a pagou.
    expect(gravado()).toMatchObject({ status: 'new', source: 'google_ads', utmCampaign: 'joelho-2026' })

    jornada.leadId = body.id
  })

  it('2. a conversão abre a ficha, marca a consulta e vincula o lead numa requisição só', async () => {
    expect(jornada.leadId).toBe(LEAD_ID)

    ;(db.query.leads.findFirst as unknown as Mock).mockResolvedValue(leadRow())
    ;(db.query.appointments.findMany as unknown as Mock).mockResolvedValue([]) // sem conflito
    ;(db.select as unknown as Mock).mockReturnValue(chain([])) // nenhuma ficha com este telefone

    const fichaGravada = espiaInsert([{ id: PACIENTE_ID, name: 'Ana Souza', phone: '(12) 98176-7896' }])
    const consultaGravada = espiaInsert([aptRow()])
    const vinculoGravado = espiaUpdate([leadRow({ status: 'scheduled', patientId: PACIENTE_ID })])
    const receitaGravada = espiaInsert([])

    const res = await converterLead(
      post(`http://localhost/api/leads/${jornada.leadId}/converter`, converterBody()),
      params(jornada.leadId!),
    )

    expect(res.status).toBe(201)
    const { data } = await res.json()

    // Antes isto eram três requisições do navegador sem rollback: falhar na terceira
    // deixava ficha órfã e lead "Agendado" sem consulta nenhuma por trás.
    expect(fichaGravada()).toMatchObject({ name: 'Ana Souza', phone: '(12) 98176-7896' })
    expect(consultaGravada()).toMatchObject({ patientId: PACIENTE_ID, leadId: LEAD_ID, doctorId: MEDICO_ID })

    const vinculo = vinculoGravado()
    expect(vinculo.patientId).toBe(PACIENTE_ID)
    expect(vinculo.status).toBe('scheduled')
    expect(vinculo.convertedAt).toBeInstanceOf(Date)

    // A taxa nasce amarrada aos dois lados: sem `patientId` na transação o extrato do
    // paciente fica sem a consulta que ele pagou.
    expect(receitaGravada()).toMatchObject({
      type: 'income',
      category: 'consultation_fee',
      amount: '350.00',
      isPaid: true,
      patientId: PACIENTE_ID,
      appointmentId: CONSULTA_ID,
    })

    jornada.pacienteId = data.patient.id
    jornada.consultaId = data.appointment.id
  })

  it('3. repetir a conversão reaproveita a ficha em vez de abrir um segundo prontuário', async () => {
    // O retry depois de um erro era o caminho para prontuário duplicado: sem vínculo
    // gravado, a segunda tentativa cadastrava a mesma pessoa de novo.
    ;(db.query.leads.findFirst as unknown as Mock).mockResolvedValue(
      leadRow({ patientId: PACIENTE_ID, status: 'scheduled' }),
    )
    ;(db.query.appointments.findMany as unknown as Mock).mockResolvedValue([])
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ id: PACIENTE_ID, name: 'Ana Souza' }]))
    ;(db.insert as unknown as Mock).mockReturnValue(chain([aptRow({ isPaidConsultation: false })]))
    ;(db.update as unknown as Mock).mockReturnValue(chain([leadRow({ patientId: PACIENTE_ID })]))

    const res = await converterLead(
      post(
        `http://localhost/api/leads/${LEAD_ID}/converter`,
        converterBody({ isPaidConsultation: false, consultationPrice: undefined, paymentStatus: undefined }),
      ),
      params(LEAD_ID),
    )

    expect(res.status).toBe(201)
    const { data } = await res.json()
    expect(data.patient.id).toBe(PACIENTE_ID)
    expect(data.patientCreated).toBe(false)

    // Nenhum insert em `patients`: só o agendamento foi criado.
    const tabelasInseridas = (db.insert as unknown as Mock).mock.calls.map((c) => c[0])
    expect(tabelasInseridas).not.toContain(patients)
    expect(tabelasInseridas).toContain(appointments)
  })

  it('4. converter não fura a regra de conflito de horário', async () => {
    // Esta porta cria uma consulta como qualquer outra. Se ela escapasse da checagem,
    // bastaria agendar pelo CRM para dobrar o médico no mesmo horário.
    ;(db.query.leads.findFirst as unknown as Mock).mockResolvedValue(leadRow())
    ;(db.query.appointments.findMany as unknown as Mock).mockResolvedValue([
      { id: 'outro', startAt: new Date(START), endAt: new Date(END), doctorId: MEDICO_ID, roomId: null },
    ])

    const res = await converterLead(
      post(`http://localhost/api/leads/${LEAD_ID}/converter`, converterBody()),
      params(LEAD_ID),
    )

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/conflito/i)
    // E nada foi escrito: nem ficha, nem consulta.
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('5. o paciente comparece e o lead avança no funil junto com a consulta', async () => {
    ;(db.query.appointments.findFirst as unknown as Mock).mockResolvedValue(aptRow())
    ;(db.query.appointments.findMany as unknown as Mock).mockResolvedValue([])
    ;(db.select as unknown as Mock).mockReturnValue(chain([{ name: 'Ana Souza', id: 'tx-1' }]))
    ;(db.update as unknown as Mock).mockReturnValue(chain([aptRow({ status: 'attended' })]))
    ;(db.insert as unknown as Mock).mockReturnValue(chain([]))

    const res = await editarAgendamento(
      patch(`http://localhost/api/agenda/${jornada.consultaId}`, { status: 'attended' }),
      params(jornada.consultaId!),
    )

    expect(res.status).toBe(200)

    // O card ficava preso em "Agendado" para sempre: marcar a consulta como atendida
    // não tocava no lead, e a etapa seguinte do funil nunca era alcançada.
    expect(tabelasAtualizadas()).toContain(leads)
    expect(tabelasAtualizadas()).toContain(appointments)
  })

  it('6. da consulta atendida nasce o tratamento, amarrado a ela e à ficha', async () => {
    const tratGravado = espiaInsert([
      {
        id: TRATAMENTO_ID,
        patientId: PACIENTE_ID,
        appointmentId: CONSULTA_ID,
        name: 'PRP Joelho',
        status: 'draft',
        subtotal: '1200',
        discount: '0',
        totalSale: '1200',
        totalCost: '240',
        installments: 3,
      },
    ])
    const itensGravados = espiaInsert([])

    const res = await criarTratamento(
      post('http://localhost/api/tratamentos', {
        patientId: jornada.pacienteId,
        appointmentId: jornada.consultaId,
        doctorId: MEDICO_ID,
        name: 'PRP Joelho',
        category: 'prp_procedure',
        installments: 3,
        items: [
          { type: 'procedure', description: 'Sessão de PRP', quantity: 2, unitPrice: 500, unitCost: 120 },
          { type: 'fee', description: 'Taxa de sala', quantity: 1, unitPrice: 200, unitCost: 0 },
        ],
      }),
    )

    expect(res.status).toBe(201)
    const { data } = await res.json()

    // A rastreabilidade "esta consulta gerou este tratamento" mora nestes dois campos.
    // Perdê-los quebra a linha do tempo da ficha do paciente.
    expect(tratGravado()).toMatchObject({
      patientId: PACIENTE_ID,
      appointmentId: CONSULTA_ID,
      status: 'draft',
      subtotal: '1200',
      totalSale: '1200',
      totalCost: '240',
    })
    expect(itensGravados()).toHaveLength(2)

    jornada.tratamentoId = data.id
  })

  it('7. concluir o tratamento fecha o ciclo lançando as parcelas do mesmo paciente', async () => {
    const existente = {
      id: TRATAMENTO_ID,
      patientId: PACIENTE_ID,
      appointmentId: CONSULTA_ID,
      name: 'PRP Joelho',
      category: 'prp_procedure',
      status: 'approved',
      subtotal: '1200',
      discount: '0',
      totalSale: '1200',
      totalCost: '240',
      installments: 3,
      paymentMethodId: null,
    }

    ;(db.select as unknown as Mock)
      .mockReturnValueOnce(chain([existente])) // tratamento atual
      .mockReturnValueOnce(chain([])) // itens de material (nenhum)
      .mockReturnValue(chain([{ name: 'Ana Souza', phone: '5512981767896' }])) // paciente p/ WhatsApp
    ;(db.update as unknown as Mock)
      .mockReturnValueOnce(chain([{ id: TRATAMENTO_ID }])) // reivindicação atômica
      .mockReturnValue(chain([{ ...existente, status: 'completed' }]))

    const parcelasGravadas = espiaInsert([])

    const res = await editarTratamento(
      patch(`http://localhost/api/tratamentos/${jornada.tratamentoId}`, {
        status: 'completed',
        paymentStatus: 'pending',
      }),
      params(jornada.tratamentoId!),
    )

    expect(res.status).toBe(200)

    const parcelas = parcelasGravadas() as Array<Record<string, unknown>>
    expect(parcelas).toHaveLength(3)

    // Todo recebível carrega paciente, tratamento E consulta: é o que permite
    // reconciliar o dinheiro com o atendimento que o gerou.
    for (const p of parcelas) {
      expect(p).toMatchObject({
        patientId: PACIENTE_ID,
        treatmentId: TRATAMENTO_ID,
        appointmentId: CONSULTA_ID,
        installmentTotal: 3,
      })
    }

    // A soma das parcelas fecha o total exato — sem centavo perdido no rateio.
    const somaCentavos = parcelas.reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0)
    expect(somaCentavos).toBe(120000)
  })

  it('8. a mesma ficha atravessou a jornada inteira', () => {
    // Se qualquer elo tivesse quebrado, a jornada teria seguido com id novo e o
    // paciente apareceria duplicado no sistema — sem nenhum erro visível.
    expect(jornada).toEqual({
      leadId: LEAD_ID,
      pacienteId: PACIENTE_ID,
      consultaId: CONSULTA_ID,
      tratamentoId: TRATAMENTO_ID,
    })
  })
})
