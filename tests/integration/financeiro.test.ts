import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { chain } from '../helpers/dbChain'

/**
 * /api/financeiro e /api/financeiro/[id] — a rota que mexe em dinheiro de verdade.
 *
 * Área descoberta (sem nenhum teste de integração antes deste arquivo). Cobre os
 * 5 casos obrigatórios por rota: feliz, validação, authZ, não encontrado e efeito
 * colateral — e a armadilha do repo: todo insert de criação precisa provar que
 * `patientId`/`appointmentId` chegaram ao banco, porque o zod deste projeto já
 * descartou campo de vínculo em silêncio (ver histórico em jornada-completa.test.ts).
 */

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      transactions: { findFirst: vi.fn(), findMany: vi.fn() },
      bankAccounts: { findFirst: vi.fn() },
    },
  },
}))
vi.mock('@/lib/db/logger', () => ({ logActivity: vi.fn(async () => undefined) }))

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/db/logger'
import { bankAccounts } from '@/lib/db/schema'
import { GET, POST } from '@/app/api/financeiro/route'
import { DELETE, PATCH } from '@/app/api/financeiro/[id]/route'

const TX_ID = '11111111-1111-4111-8111-111111111111'
const PATIENT_ID = '22222222-2222-4222-8222-222222222222'
const APPOINTMENT_ID = '33333333-3333-4333-8333-333333333333'
const BANK_ACCOUNT_ID = '44444444-4444-4444-8444-444444444444'
const PAYMENT_METHOD_ID = '55555555-5555-4555-8555-555555555555'
const TREATMENT_ID = '66666666-6666-4666-8666-666666666666'

const sessionAs = (role: string, customPermissions: string[] | null = null, id = 'u1') =>
  (auth as unknown as Mock).mockResolvedValue({
    user: { id, role, customPermissions, name: 'Fulano', email: 'f@clinica.com' },
  })

const post = (body: unknown) =>
  new NextRequest('http://localhost/api/financeiro', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

const patch = (id: string, body: unknown) =>
  new NextRequest(`http://localhost/api/financeiro/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

const del = (id: string) => new NextRequest(`http://localhost/api/financeiro/${id}`, { method: 'DELETE' })

const params = (id: string) => ({ params: Promise.resolve({ id }) })

/** Plugga um insert e devolve o que a rota mandou gravar. */
function espiaInsert(retorno: Record<string, unknown>[]) {
  const c = chain(retorno)
  ;(db.insert as unknown as Mock).mockReturnValueOnce(c)
  return () => (c.values as unknown as Mock).mock.calls[0][0] as Record<string, unknown>
}

afterEach(() => vi.clearAllMocks())

describe('POST /api/financeiro', () => {
  it('401 sem sessão', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)
    const res = await POST(post({}))
    expect(res.status).toBe(401)
    expect(db.insert).not.toHaveBeenCalled()
  })

  // 1. Feliz — e a armadilha do repo: patientId e appointmentId têm que chegar
  // ao insert. Se o zod não declarasse esses campos, eles sumiriam em silêncio.
  it('1. feliz: lança receita e grava patientId + appointmentId no insert', async () => {
    sessionAs('admin')
    const gravado = espiaInsert([
      {
        id: TX_ID,
        type: 'income',
        category: 'prp_procedure',
        description: 'Sessão de PRP - Joelho',
        amount: '500.00',
        isPaid: true,
        patientId: PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
      },
    ])

    const res = await POST(
      post({
        type: 'income',
        category: 'prp_procedure',
        description: 'Sessão de PRP - Joelho',
        amount: '500.00',
        date: '2026-09-01',
        isPaid: true,
        patientId: PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
        paymentMethodId: PAYMENT_METHOD_ID,
      }),
    )

    expect(res.status).toBe(201)
    const { data } = await res.json()
    expect(data.id).toBe(TX_ID)

    const valores = gravado()
    // O vínculo é o que permite reconciliar a receita com o paciente e a consulta
    // que a gerou — sem ele a aba Financeiro da ficha do paciente fica vazia.
    expect(valores.patientId).toBe(PATIENT_ID)
    expect(valores.appointmentId).toBe(APPOINTMENT_ID)
    expect(valores.paymentMethodId).toBe(PAYMENT_METHOD_ID)
    expect(valores).toMatchObject({ type: 'income', category: 'prp_procedure', amount: '500.00', isPaid: true })
    expect(valores.createdById).toBe('u1')
    expect(valores.paidAt).toBeNull()

    expect(logActivity).toHaveBeenCalledTimes(1)
    expect((logActivity as unknown as Mock).mock.calls[0][0]).toMatchObject({
      action: 'financial:create',
      module: 'financial',
      targetId: TX_ID,
    })
  })

  // 2. Validação — amount fora do regex e descrição vazia: nada toca o banco.
  it('2. payload inválido (amount fora do formato) devolve 400 sem tocar o banco', async () => {
    sessionAs('admin')
    const res = await POST(
      post({
        type: 'income',
        category: 'prp_procedure',
        description: '',
        amount: 'cem reais',
        date: '2026-09-01',
      }),
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.select).not.toHaveBeenCalled()
  })

  // 3. AuthZ — médico não tem financial:create.
  it('3. 403 para papel sem financial:create (médico)', async () => {
    sessionAs('doctor')
    const res = await POST(
      post({
        type: 'income',
        category: 'consultation_fee',
        description: 'Consulta',
        amount: '350.00',
        date: '2026-09-01',
      }),
    )

    expect(res.status).toBe(403)
    expect(db.insert).not.toHaveBeenCalled()
  })

  // 5. Efeito colateral — guarda anti-duplicação: a taxa de consulta já nasce no
  // agendamento. Reenviar a mesma consulta pela tela de "Finalizar consulta"
  // tem que ATUALIZAR o lançamento existente, nunca duplicar a receita.
  it('5. reenviar a taxa da mesma consulta atualiza o lançamento em vez de duplicar', async () => {
    sessionAs('admin')
    ;(db.select as unknown as Mock).mockReturnValueOnce(chain([{ id: TX_ID }]))
    const atualizadaBuilder = chain([
      { id: TX_ID, isPaid: true, paymentMethodId: PAYMENT_METHOD_ID, amount: '350.00', description: 'Consulta' },
    ])
    ;(db.update as unknown as Mock).mockReturnValueOnce(atualizadaBuilder)

    const res = await POST(
      post({
        type: 'income',
        category: 'consultation_fee',
        description: 'Consulta',
        amount: '350.00',
        date: '2026-09-01',
        isPaid: true,
        paymentMethodId: PAYMENT_METHOD_ID,
        appointmentId: APPOINTMENT_ID,
      }),
    )

    expect(res.status).toBe(200) // não é 201: não criou nada novo
    const { data } = await res.json()
    expect(data.id).toBe(TX_ID)

    // A prova do efeito colateral: NENHUM insert novo, e o update carrega o
    // appointmentId original no log de auditoria (rastreável).
    expect(db.insert).not.toHaveBeenCalled()
    expect(logActivity).toHaveBeenCalledTimes(1)
    expect((logActivity as unknown as Mock).mock.calls[0][0]).toMatchObject({
      action: 'financial:update',
      targetId: TX_ID,
      details: expect.objectContaining({ appointmentId: APPOINTMENT_ID }),
    })
  })
})

describe('GET /api/financeiro', () => {
  it('401 sem sessão', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)
    const res = await GET(new NextRequest('http://localhost/api/financeiro'))
    expect(res.status).toBe(401)
  })

  it('403 para papel sem financial:view (médico)', async () => {
    sessionAs('doctor')
    const res = await GET(new NextRequest('http://localhost/api/financeiro'))
    expect(res.status).toBe(403)
  })

  // Os KPIs eram somados no cliente sobre a lista já cortada em 100 linhas —
  // a partir do 101º lançamento os totais ficavam errados. Este teste prova que
  // a agregação vem do banco, independente de quantas linhas a listagem trouxe.
  it('feliz: totais vêm agregados do banco, não da lista cortada em 100', async () => {
    sessionAs('financial')
    const cemLinhas = Array.from({ length: 100 }, (_, i) => ({ id: `tx-${i}` }))
    ;(db.query.transactions.findMany as unknown as Mock).mockResolvedValue(cemLinhas)
    ;(db.select as unknown as Mock).mockReturnValue(
      chain([{ receitas: '50000.00', despesas: '12000.00', recebido: '40000.00', aReceber: '10000.00', total: 150 }]),
    )

    const res = await GET(new NextRequest('http://localhost/api/financeiro'))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.data).toHaveLength(100)
    expect(body.totais).toMatchObject({ receitas: 50000, despesas: 12000, recebido: 40000, aReceber: 10000, total: 150 })
    // 150 lançamentos no total, só 100 vieram na lista: 50 não listados.
    expect(body.totais.naoListados).toBe(50)
  })
})

describe('PATCH /api/financeiro/[id]', () => {
  it('401 sem sessão', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)
    const res = await PATCH(patch(TX_ID, { isPaid: true }), params(TX_ID))
    expect(res.status).toBe(401)
    expect(db.update).not.toHaveBeenCalled()
  })

  // 1. Feliz
  it('1. feliz: edita descrição e valor de um lançamento comum', async () => {
    sessionAs('financial')
    ;(db.query.transactions.findFirst as unknown as Mock).mockResolvedValueOnce({
      id: TX_ID,
      description: 'Antigo',
      amount: '100.00',
      isPaid: false,
      bankAccountId: null,
      treatmentId: null,
      paidAt: null,
    })
    const builder = chain([
      { id: TX_ID, description: 'Sessão de PRP - reagendada', amount: '550.00', isPaid: false, bankAccountId: null },
    ])
    ;(db.update as unknown as Mock).mockReturnValueOnce(builder)

    const res = await PATCH(
      patch(TX_ID, { description: 'Sessão de PRP - reagendada', amount: '550.00' }),
      params(TX_ID),
    )

    expect(res.status).toBe(200)
    const setArg = (builder.set as unknown as Mock).mock.calls[0][0] as Record<string, unknown>
    expect(setArg).toMatchObject({ description: 'Sessão de PRP - reagendada', amount: '550.00' })
    expect(logActivity).toHaveBeenCalledTimes(1)
    expect((logActivity as unknown as Mock).mock.calls[0][0]).toMatchObject({ action: 'financial:edit', targetId: TX_ID })
  })

  // 2. Validação
  it('2. payload inválido (amount fora do formato) devolve 400 sem tocar o banco', async () => {
    sessionAs('financial')
    ;(db.query.transactions.findFirst as unknown as Mock).mockResolvedValueOnce({
      id: TX_ID,
      isPaid: false,
      bankAccountId: null,
      treatmentId: null,
    })

    const res = await PATCH(patch(TX_ID, { amount: 'não é number' }), params(TX_ID))
    expect(res.status).toBe(400)
    expect(db.update).not.toHaveBeenCalled()
  })

  // 3. AuthZ
  it('3. 403 para papel sem financial:edit (médico) — nem chega a consultar o lançamento', async () => {
    sessionAs('doctor')
    const res = await PATCH(patch(TX_ID, { isPaid: true }), params(TX_ID))
    expect(res.status).toBe(403)
    expect(db.query.transactions.findFirst).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })

  // 3b. AuthZ — regra específica: recebimento de tratamento só admin mexe.
  it('3b. 403 quando financeiro tenta alterar recebimento gerado por tratamento', async () => {
    sessionAs('financial')
    ;(db.query.transactions.findFirst as unknown as Mock).mockResolvedValueOnce({
      id: TX_ID,
      isPaid: false,
      bankAccountId: null,
      treatmentId: TREATMENT_ID,
    })

    const res = await PATCH(patch(TX_ID, { isPaid: true }), params(TX_ID))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(String(body.error)).toMatch(/administrador/i)
    expect(db.update).not.toHaveBeenCalled()
  })

  // 4. Não encontrado
  it('4. 404 quando o lançamento não existe — nunca 500', async () => {
    sessionAs('admin')
    ;(db.query.transactions.findFirst as unknown as Mock).mockResolvedValueOnce(undefined)

    const res = await PATCH(patch('id-fantasma', { isPaid: true }), params('id-fantasma'))
    expect(res.status).toBe(404)
    expect(db.update).not.toHaveBeenCalled()
  })

  // 5. Efeito colateral — a parcela 2+ de um tratamento nasce sem bankAccountId.
  // Marcar como paga sem conta própria tinha que herdar a conta da parcela irmã
  // já recebida, e o saldo bancário tinha que refletir a entrada.
  it('5. marcar parcela de tratamento como paga herda a conta bancária e credita o saldo', async () => {
    sessionAs('admin')
    ;(db.query.transactions.findFirst as unknown as Mock)
      .mockResolvedValueOnce({
        id: TX_ID,
        isPaid: false,
        bankAccountId: null,
        treatmentId: TREATMENT_ID,
        amount: '400.00',
        paidAt: null,
      })
      .mockResolvedValueOnce({ bankAccountId: BANK_ACCOUNT_ID }) // parcela irmã já paga

    const builderTx = chain([
      { id: TX_ID, isPaid: true, bankAccountId: BANK_ACCOUNT_ID, amount: '400.00' },
    ])
    const builderBanco = chain(undefined)
    ;(db.update as unknown as Mock).mockReturnValueOnce(builderTx).mockReturnValueOnce(builderBanco)

    const res = await PATCH(patch(TX_ID, { isPaid: true }), params(TX_ID))

    expect(res.status).toBe(200)
    // Não perguntou por conta bancária: a rota tinha que descobrir sozinha.
    expect(db.query.bankAccounts.findFirst).not.toHaveBeenCalled() // achou a da irmã, nem precisou da padrão

    const setArgTx = (builderTx.set as unknown as Mock).mock.calls[0][0] as Record<string, unknown>
    expect(setArgTx.bankAccountId).toBe(BANK_ACCOUNT_ID)
    expect(setArgTx.paidAt).toBeInstanceOf(Date)

    // Segunda chamada de update tem que ser na tabela de contas bancárias — é o
    // crédito do saldo. Sem isso a baixa acontecia no financeiro e nunca
    // aparecia na conta.
    expect((db.update as unknown as Mock).mock.calls[1][0]).toBe(bankAccounts)
    expect((builderBanco.set as unknown as Mock).mock.calls.length).toBe(1)

    expect(logActivity).toHaveBeenCalledTimes(1)
  })
})

describe('DELETE /api/financeiro/[id]', () => {
  it('401 sem sessão', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)
    const res = await DELETE(del(TX_ID), params(TX_ID))
    expect(res.status).toBe(401)
    expect(db.delete).not.toHaveBeenCalled()
  })

  // 1. Feliz
  it('1. feliz: exclui lançamento não pago e sem vínculo de tratamento', async () => {
    sessionAs('admin')
    ;(db.query.transactions.findFirst as unknown as Mock).mockResolvedValueOnce({
      id: TX_ID,
      isPaid: false,
      bankAccountId: null,
      treatmentId: null,
      amount: '200.00',
      description: 'Compra avulsa',
      category: 'other_expense',
    })
    ;(db.delete as unknown as Mock).mockReturnValue(chain(undefined))

    const res = await DELETE(del(TX_ID), params(TX_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(db.delete).toHaveBeenCalledTimes(1)
    expect(db.update).not.toHaveBeenCalled() // não pago: nenhum saldo a estornar
    expect((logActivity as unknown as Mock).mock.calls[0][0]).toMatchObject({ action: 'financial:delete', targetId: TX_ID })
  })

  // 3. AuthZ — financeiro não tem financial:delete (só admin tem, por preset).
  it('3. 403 para papel sem financial:delete (financeiro)', async () => {
    sessionAs('financial')
    const res = await DELETE(del(TX_ID), params(TX_ID))
    expect(res.status).toBe(403)
    expect(db.query.transactions.findFirst).not.toHaveBeenCalled()
    expect(db.delete).not.toHaveBeenCalled()
  })

  // 3b. AuthZ — mesmo que uma permissão customizada conceda financial:delete a
  // quem não é admin, a regra de negócio "só admin mexe em recebimento de
  // tratamento" continua valendo — a checagem é por role, não por permissão.
  it('3b. 403 mesmo com financial:delete customizado, se o lançamento é de tratamento', async () => {
    sessionAs('financial', ['financial:delete'])
    ;(db.query.transactions.findFirst as unknown as Mock).mockResolvedValueOnce({
      id: TX_ID,
      isPaid: true,
      bankAccountId: BANK_ACCOUNT_ID,
      treatmentId: TREATMENT_ID,
      amount: '400.00',
      description: 'Parcela 1/3',
      category: 'prp_procedure',
    })

    const res = await DELETE(del(TX_ID), params(TX_ID))
    expect(res.status).toBe(403)
    expect(db.delete).not.toHaveBeenCalled()
  })

  // 4. Não encontrado
  it('4. 404 quando o lançamento não existe — nunca 500', async () => {
    sessionAs('admin')
    ;(db.query.transactions.findFirst as unknown as Mock).mockResolvedValueOnce(undefined)

    const res = await DELETE(del('id-fantasma'), params('id-fantasma'))
    expect(res.status).toBe(404)
    expect(db.delete).not.toHaveBeenCalled()
  })

  // 5. Efeito colateral — excluir um recebimento PAGO e vinculado a uma conta
  // tem que estornar o saldo antes de apagar a linha, senão a conta fica com
  // dinheiro que não existe mais.
  it('5. excluir recebimento pago estorna o saldo da conta bancária', async () => {
    sessionAs('admin')
    ;(db.query.transactions.findFirst as unknown as Mock).mockResolvedValueOnce({
      id: TX_ID,
      isPaid: true,
      bankAccountId: BANK_ACCOUNT_ID,
      treatmentId: null,
      amount: '350.00',
      description: 'Consulta',
      category: 'consultation_fee',
    })
    const builderBanco = chain(undefined)
    ;(db.update as unknown as Mock).mockReturnValueOnce(builderBanco)
    ;(db.delete as unknown as Mock).mockReturnValue(chain(undefined))

    const res = await DELETE(del(TX_ID), params(TX_ID))
    expect(res.status).toBe(200)

    expect((db.update as unknown as Mock).mock.calls[0][0]).toBe(bankAccounts)
    expect((builderBanco.set as unknown as Mock).mock.calls.length).toBe(1)
    expect(db.delete).toHaveBeenCalledTimes(1)
    expect((logActivity as unknown as Mock).mock.calls[0][0]).toMatchObject({ action: 'financial:delete' })
  })
})
