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
    query: { materials: { findFirst: vi.fn() } },
  },
}))
vi.mock('@/lib/db/logger', () => ({ logActivity: vi.fn(async () => undefined) }))
vi.mock('@/lib/notifications', () => ({ notify: vi.fn(async () => undefined) }))
// darBaixaEstoque devolve o resultado da baixa (saldo + quanto saiu + quanto
// faltou) — o número solto de antes não deixava a rota saber se o estoque tinha
// coberto o consumo.
vi.mock('@/lib/materials-stock', () => ({
  darBaixaEstoque: vi.fn(async () => ({ saldo: 0, baixado: 0, faltou: 0 })),
}))
vi.mock('@/lib/whatsapp', () => ({
  sendAndLog: vi.fn(async () => ({ ok: true })),
  tplTreatmentSummary: vi.fn(() => 'resumo do tratamento'),
}))

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/db/logger'
import { darBaixaEstoque } from '@/lib/materials-stock'
import { sendAndLog } from '@/lib/whatsapp'
import { POST as criarTratamento } from '@/app/api/tratamentos/route'
import { PATCH, DELETE } from '@/app/api/tratamentos/[id]/route'
import { GET as lerProntuario, POST as gravarProntuario } from '@/app/api/prontuario/route'

// UUIDs fixos: as rotas validam formato com zod, então string qualquer vira 400
// e mascararia o comportamento que se quer testar.
const TRAT_ID = '11111111-1111-4111-8111-111111111111'
const PACIENTE_ID = '22222222-2222-4222-8222-222222222222'
const MATERIAL_ID = '33333333-3333-4333-8333-333333333333'
const CONTA_ID = '44444444-4444-4444-8444-444444444444'

const sessionAs = (role: string, customPermissions: string[] | null = null) =>
  (auth as unknown as Mock).mockResolvedValue({
    user: { id: 'u1', role, customPermissions, name: 'Usuário', email: 'u@clinica.com' },
  })

const postReq = (body: unknown, url = 'http://localhost/api/tratamentos') =>
  new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

const patchReq = (body: unknown) =>
  new NextRequest(`http://localhost/api/tratamentos/${TRAT_ID}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

const params = { params: Promise.resolve({ id: TRAT_ID }) }

beforeEach(() => {
  // Vencimento de parcela é calculado a partir de `new Date()` dentro da rota:
  // sem relógio fixo o teste vira loteria de fuso e de virada de mês.
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-28T12:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

// ── POST /api/tratamentos ────────────────────────────────────────────────────

describe('POST /api/tratamentos — orçamento do paciente', () => {
  it('401 sem sessão', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)
    const res = await criarTratamento(postReq({ patientId: PACIENTE_ID, name: 'PRP' }))
    expect(res.status).toBe(401)
    expect(db.insert).not.toHaveBeenCalled()
  })

  // A recepção agenda e cadastra paciente, mas não abre plano de tratamento:
  // o valor cobrado é decisão clínica/financeira, não de quem atende o telefone.
  it('403 para recepcionista, que não tem treatments:create', async () => {
    sessionAs('receptionist')
    const res = await criarTratamento(postReq({ patientId: PACIENTE_ID, name: 'PRP Joelho' }))
    expect(res.status).toBe(403)
    expect(db.insert).not.toHaveBeenCalled()
  })

  // Sem validação de UUID o tratamento seria gravado apontando para paciente
  // inexistente e só quebraria depois, na tela de quem for cobrar.
  it('400 quando patientId não é UUID', async () => {
    sessionAs('admin')
    const res = await criarTratamento(postReq({ patientId: 'paciente-3', name: 'PRP Joelho' }))
    expect(res.status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('201 no caminho feliz, com os itens gravados', async () => {
    sessionAs('admin')
    const insTrat = chain([{ id: TRAT_ID, name: 'PRP Joelho', totalSale: '1200', installments: 1 }])
    const insItens = chain([{ id: 'i1' }, { id: 'i2' }])
    ;(db.insert as unknown as Mock).mockReturnValueOnce(insTrat).mockReturnValueOnce(insItens)

    const res = await criarTratamento(
      postReq({
        patientId: PACIENTE_ID,
        name: 'PRP Joelho',
        items: [
          { type: 'procedure', description: 'Sessão PRP', quantity: 2, unitPrice: 500, unitCost: 120, sortOrder: 0 },
          { type: 'fee', description: 'Taxa de sala', quantity: 1, unitPrice: 300, unitCost: 0, sortOrder: 1 },
        ],
      }),
    )

    expect(res.status).toBe(201)
    const itens = (insItens.values as unknown as Mock).mock.calls[0][0] as unknown[]
    expect(itens).toHaveLength(2)
  })

  // O total é a conta que vira cobrança: item errado aqui é dinheiro a mais ou
  // a menos na parcela do paciente. Valores são gravados como string (numeric).
  it('soma itens, aplica desconto e calcula o custo: 1300 − 100 = 1200, custo 240', async () => {
    sessionAs('admin')
    const insTrat = chain([{ id: TRAT_ID, name: 'PRP', totalSale: '1200', installments: 1 }])
    ;(db.insert as unknown as Mock).mockReturnValueOnce(insTrat).mockReturnValueOnce(chain([]))

    await criarTratamento(
      postReq({
        patientId: PACIENTE_ID,
        name: 'PRP Joelho',
        discount: 100,
        items: [
          { type: 'procedure', description: 'Sessão PRP', quantity: 2, unitPrice: 500, unitCost: 120, sortOrder: 0 },
          { type: 'fee', description: 'Taxa de sala', quantity: 1, unitPrice: 300, unitCost: 0, sortOrder: 1 },
        ],
      }),
    )

    const v = (insTrat.values as unknown as Mock).mock.calls[0][0] as Record<string, unknown>
    expect(v).toMatchObject({
      subtotal: '1300',
      discount: '100',
      totalSale: '1200',
      totalCost: '240',
    })
  })

  // Desconto acima do subtotal geraria receita negativa lançada no financeiro
  // na conclusão — o Math.max(0, ...) é o que impede isso.
  it('desconto maior que o subtotal zera o total, não fica negativo', async () => {
    sessionAs('admin')
    const insTrat = chain([{ id: TRAT_ID, name: 'PRP', totalSale: '0', installments: 1 }])
    ;(db.insert as unknown as Mock).mockReturnValueOnce(insTrat).mockReturnValueOnce(chain([]))

    await criarTratamento(
      postReq({
        patientId: PACIENTE_ID,
        name: 'Cortesia',
        discount: 500,
        items: [{ type: 'procedure', description: 'Sessão', quantity: 1, unitPrice: 100, unitCost: 0, sortOrder: 0 }],
      }),
    )

    const v = (insTrat.values as unknown as Mock).mock.calls[0][0] as Record<string, unknown>
    expect(v.subtotal).toBe('100')
    expect(v.totalSale).toBe('0')
    expect(Number(v.totalSale)).toBeGreaterThanOrEqual(0)
  })

  // Cliente mandando status é como um paciente já chegar "faturado": pularia
  // aprovação, baixa de estoque e o gate financeiro da conclusão.
  it('status inicial é sempre draft, mesmo com status vindo no corpo', async () => {
    sessionAs('admin')
    const insTrat = chain([{ id: TRAT_ID, name: 'PRP', totalSale: '100', installments: 1 }])
    ;(db.insert as unknown as Mock).mockReturnValueOnce(insTrat).mockReturnValueOnce(chain([]))

    await criarTratamento(
      postReq({
        patientId: PACIENTE_ID,
        name: 'PRP Joelho',
        status: 'completed',
        items: [{ type: 'procedure', description: 'Sessão', quantity: 1, unitPrice: 100, unitCost: 0, sortOrder: 0 }],
      }),
    )

    const v = (insTrat.values as unknown as Mock).mock.calls[0][0] as Record<string, unknown>
    expect(v.status).toBe('draft')
  })

  // O diálogo "Novo Tratamento" da ficha do paciente não envia `items`. O
  // schema aplica default [] e a rota caía em db.insert(treatmentItems).values([]),
  // que no Drizzle real lança "values() must be called with at least one value"
  // — 500 em produção numa criação válida. Agora o insert de itens nem chega a
  // acontecer: o único insert do fluxo é o do tratamento.
  it('tratamento sem itens é criado com total zero, sem insert de itens vazio', async () => {
    sessionAs('admin')
    const insTrat = chain([{ id: TRAT_ID, name: 'A definir', totalSale: '0', installments: 1 }])
    ;(db.insert as unknown as Mock).mockReturnValueOnce(insTrat)

    const res = await criarTratamento(postReq({ patientId: PACIENTE_ID, name: 'A definir' }))

    expect(res.status).toBe(201)
    expect(db.insert).toHaveBeenCalledTimes(1)
    const v = (insTrat.values as unknown as Mock).mock.calls[0][0] as Record<string, unknown>
    expect(v).toMatchObject({ subtotal: '0', totalSale: '0', totalCost: '0' })
    expect((await res.json()).data.items).toEqual([])
  })

  // Forma de pagamento e modelo são opcionais na tela, e os <select> mandam ''
  // quando ninguém escolhe. Com uuid estrito TODA criação pelo drawer voltava
  // 400 e o usuário só via "Erro ao criar tratamento".
  it('aceita string vazia nos uuid opcionais e grava null', async () => {
    sessionAs('admin')
    const insTrat = chain([{ id: TRAT_ID, name: 'PRP', totalSale: '100', installments: 1 }])
    ;(db.insert as unknown as Mock).mockReturnValueOnce(insTrat).mockReturnValueOnce(chain([]))

    const res = await criarTratamento(
      postReq({
        patientId: PACIENTE_ID,
        name: 'PRP Joelho',
        paymentMethodId: '',
        templateId: '',
        appointmentId: '',
        doctorId: '',
        items: [{ type: 'procedure', description: 'Sessão', quantity: 1, unitPrice: 100, unitCost: 0, sortOrder: 0 }],
      }),
    )

    expect(res.status).toBe(201)
    const v = (insTrat.values as unknown as Mock).mock.calls[0][0] as Record<string, unknown>
    expect(v).toMatchObject({
      paymentMethodId: null,
      templateId: null,
      appointmentId: null,
      doctorId: null,
    })
  })

  // Continua sendo 400 para lixo que não é uuid: aceitar '' não pode virar
  // "aceita qualquer coisa" e gravar referência quebrada.
  it('400 quando o uuid opcional vem preenchido com valor inválido', async () => {
    sessionAs('admin')
    const res = await criarTratamento(
      postReq({ patientId: PACIENTE_ID, name: 'PRP', paymentMethodId: 'pix' }),
    )
    expect(res.status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })

  // Tratamento é o documento que vira cobrança: sem log de auditoria não há
  // como saber quem abriu, para quem e por quanto.
  it('registra tratamento:create na auditoria', async () => {
    sessionAs('admin')
    const insTrat = chain([{ id: TRAT_ID, name: 'PRP Joelho', totalSale: '500', installments: 2 }])
    ;(db.insert as unknown as Mock).mockReturnValueOnce(insTrat).mockReturnValueOnce(chain([{ id: 'i1' }]))

    await criarTratamento(
      postReq({
        patientId: PACIENTE_ID,
        name: 'PRP Joelho',
        items: [{ type: 'procedure', description: 'Sessão', quantity: 1, unitPrice: 500, unitCost: 0, sortOrder: 0 }],
      }),
    )

    expect(logActivity).toHaveBeenCalledTimes(1)
    expect((logActivity as unknown as Mock).mock.calls[0][0]).toMatchObject({
      action: 'tratamento:create',
      module: 'tratamentos',
      targetId: TRAT_ID,
      targetName: 'PRP Joelho',
      userId: 'u1',
    })
  })
})

// ── PATCH /api/tratamentos/[id] — conclusão ──────────────────────────────────

const tratamento = (over: Record<string, unknown> = {}) => ({
  id: TRAT_ID,
  patientId: PACIENTE_ID,
  appointmentId: null,
  name: 'PRP Joelho',
  category: 'prp_procedure' as const,
  status: 'approved',
  subtotal: '1000',
  discount: '0',
  totalSale: '1000',
  totalCost: '240',
  installments: 1,
  paymentMethodId: null,
  ...over,
})

/**
 * Enfileira os mocks na ordem exata em que a conclusão consulta o banco:
 * select(tratamento) → update(reivindicação) → select(itens material) →
 * insert(stockMovements por item) → insert(transactions) →
 * [update(bankAccounts)] → select(paciente) → update(final).
 */
function prepararConclusao(opts: {
  existing?: Record<string, unknown>
  itensMateriais?: Array<Record<string, unknown>>
  reivindicado?: Array<{ id: string }>
  material?: Record<string, unknown> | null
  saldo?: number
  baixado?: number
  faltou?: number
  comConta?: boolean
} = {}) {
  const existing = tratamento(opts.existing)
  const reivindicado = opts.reivindicado ?? [{ id: TRAT_ID }]
  const selectMock = db.select as unknown as Mock
  const updateMock = db.update as unknown as Mock

  selectMock.mockReturnValueOnce(chain([existing]))
  updateMock.mockReturnValueOnce(chain(reivindicado))

  // Segundo clique: o UPDATE condicional não devolve linha e a rota sai em 409
  // antes de tocar em estoque, parcelas ou saldo — nada mais é consultado.
  if (reivindicado.length === 0) return { existing, inserts: [], transacoes: chain([]) }

  const itens = opts.itensMateriais ?? []
  selectMock.mockReturnValueOnce(chain(itens))

  ;(darBaixaEstoque as unknown as Mock).mockResolvedValue({
    saldo: opts.saldo ?? 99,
    baixado: opts.baixado ?? Number(itens[0]?.quantity ?? 0),
    faltou: opts.faltou ?? 0,
  })
  ;(db.query.materials.findFirst as unknown as Mock).mockResolvedValue(
    opts.material === undefined ? { name: 'Kit PRP', minimumStock: 1, unit: 'un' } : opts.material,
  )

  const inserts = Array.from({ length: itens.length + 1 }, () => chain([]))
  for (const b of inserts) (db.insert as unknown as Mock).mockReturnValueOnce(b)

  if (opts.comConta) updateMock.mockReturnValueOnce(chain([]))

  selectMock.mockReturnValueOnce(chain([{ name: 'Ana', phone: '5511999998888' }]))
  updateMock.mockReturnValueOnce(chain([{ ...existing, status: 'completed' }]))

  return { existing, inserts, transacoes: inserts[inserts.length - 1] }
}

describe('PATCH /api/tratamentos/[id] — baixa de estoque', () => {
  // O item de material sai do estoque no momento em que o tratamento é
  // concluído. Sem isso a clínica opera com saldo fantasma e só descobre a
  // falta de insumo no dia do procedimento.
  it('dá baixa via darBaixaEstoque e registra a movimentação de saída', async () => {
    sessionAs('admin')
    const { inserts } = prepararConclusao({
      itensMateriais: [{ id: 'it1', materialId: MATERIAL_ID, type: 'material', quantity: '2' }],
    })

    const res = await PATCH(patchReq({ status: 'completed' }), params)

    expect(res.status).toBe(200)
    expect(darBaixaEstoque).toHaveBeenCalledTimes(1)
    expect(darBaixaEstoque).toHaveBeenCalledWith(MATERIAL_ID, 2)

    const mov = (inserts[0].values as unknown as Mock).mock.calls[0][0] as Record<string, unknown>
    expect(mov).toMatchObject({ materialId: MATERIAL_ID, type: 'out', quantity: -2 })
  })

  // A quantidade do item é numeric(8,3) e a tela aceita passo 0,001. O
  // Math.round que havia na rota transformava "0,4 frasco" em 0: nada saía do
  // estoque e o movimento era gravado com -0.
  it('quantidade fracionada chega inteira na baixa e o movimento registra o que saiu', async () => {
    sessionAs('admin')
    const { inserts } = prepararConclusao({
      itensMateriais: [{ id: 'it1', materialId: MATERIAL_ID, type: 'material', quantity: '0.400' }],
      baixado: 1,
    })

    const res = await PATCH(patchReq({ status: 'completed' }), params)

    expect(res.status).toBe(200)
    expect(darBaixaEstoque).toHaveBeenCalledWith(MATERIAL_ID, 0.4)

    const mov = (inserts[0].values as unknown as Mock).mock.calls[0][0] as Record<string, unknown>
    expect(mov.quantity).toBe(-1)
    expect(mov.quantity).not.toBe(0)
  })

  // Antes o excedente sem saldo era descartado em silêncio: a tela dizia
  // "concluído com sucesso" e o inventário ficava divergente sem aviso.
  it('estoque insuficiente conclui, mas devolve aviso explícito na resposta', async () => {
    sessionAs('admin')
    prepararConclusao({
      itensMateriais: [{ id: 'it1', materialId: MATERIAL_ID, type: 'material', quantity: '5' }],
      baixado: 2,
      faltou: 3,
      saldo: 0,
    })

    const res = await PATCH(patchReq({ status: 'completed' }), params)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.avisos).toHaveLength(1)
    expect(body.avisos[0]).toContain('Estoque insuficiente')
    expect(body.avisos[0]).toContain('Kit PRP')
  })

  it('baixa completa não gera aviso nenhum', async () => {
    sessionAs('admin')
    prepararConclusao({
      itensMateriais: [{ id: 'it1', materialId: MATERIAL_ID, type: 'material', quantity: '2' }],
    })

    const res = await PATCH(patchReq({ status: 'completed' }), params)

    expect((await res.json()).avisos).toBeUndefined()
  })

  // Procedimento e taxa não têm lastro físico: baixar estoque por eles zeraria
  // material que ninguém usou. O filtro é SQL (eq(type,'material')), então o
  // mock devolve [] — que é exatamente o que o Postgres devolveria.
  it('tratamento só com procedure/fee não movimenta estoque', async () => {
    sessionAs('admin')
    const { inserts } = prepararConclusao({ itensMateriais: [] })

    const res = await PATCH(patchReq({ status: 'completed' }), params)

    expect(res.status).toBe(200)
    expect(darBaixaEstoque).not.toHaveBeenCalled()
    // O único insert do fluxo é o das parcelas.
    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(inserts).toHaveLength(1)
  })
})

describe('PATCH /api/tratamentos/[id] — parcelas', () => {
  // Parcelamento que não fecha no centavo é diferença de caixa todo mês. A
  // última parcela precisa absorver o arredondamento das anteriores.
  it('3x de 1000 gera 3 parcelas que somam exatamente o total', async () => {
    sessionAs('admin')
    const { transacoes } = prepararConclusao()

    const res = await PATCH(patchReq({ status: 'completed', installments: 3 }), params)
    expect(res.status).toBe(200)

    const rows = (transacoes.values as unknown as Mock).mock.calls[0][0] as Array<Record<string, unknown>>
    expect(rows).toHaveLength(3)
    expect(rows.map(r => r.amount)).toEqual(['333.33', '333.33', '333.34'])

    const soma = rows.reduce((s, r) => s + Math.round(Number(r.amount) * 100), 0)
    expect(soma).toBe(100000)

    expect(rows.map(r => r.installmentNumber)).toEqual([1, 2, 3])
    expect(rows.every(r => r.installmentTotal === 3)).toBe(true)
    expect(rows.every(r => r.type === 'income' && r.isPaid === false)).toBe(true)
    expect(rows.every(r => r.treatmentId === TRAT_ID && r.patientId === PACIENTE_ID)).toBe(true)
  })

  // Vencimento vem de lib/parcelas (não mockada). O erro que ela evita é o mês
  // pulado: dia 31 + 1 mês caindo no dia 1º do mês seguinte, deixando um mês
  // sem parcela e outro com duas.
  it('vencimentos avançam exatamente um mês por parcela, mantendo o dia', async () => {
    sessionAs('admin')
    const { transacoes } = prepararConclusao()

    await PATCH(patchReq({ status: 'completed', installments: 3 }), params)

    const rows = (transacoes.values as unknown as Mock).mock.calls[0][0] as Array<Record<string, unknown>>
    const partes = rows.map(r => String(r.dueDate).split('-').map(Number))
    const meses = partes.map(([ano, mes]) => ano * 12 + mes)

    expect(meses[1] - meses[0]).toBe(1)
    expect(meses[2] - meses[1]).toBe(1)
    expect(partes.map(p => p[2])).toEqual([partes[0][2], partes[0][2], partes[0][2]])
  })

  // Marcar a 1ª parcela como paga precisa vincular a conta só nela: vincular em
  // todas faria as parcelas futuras parecerem já recebidas no extrato.
  it('first_paid marca só a primeira parcela e credita o saldo da conta', async () => {
    sessionAs('admin')
    const { transacoes } = prepararConclusao({ comConta: true })

    const res = await PATCH(
      patchReq({ status: 'completed', installments: 2, paymentStatus: 'first_paid', bankAccountId: CONTA_ID }),
      params,
    )
    expect(res.status).toBe(200)

    const rows = (transacoes.values as unknown as Mock).mock.calls[0][0] as Array<Record<string, unknown>>
    expect(rows.map(r => r.isPaid)).toEqual([true, false])
    expect(rows.map(r => r.bankAccountId)).toEqual([CONTA_ID, null])
    // reivindicação + crédito na conta + update final
    expect(db.update).toHaveBeenCalledTimes(3)
  })

  it('avisa o paciente por WhatsApp quando há telefone', async () => {
    sessionAs('admin')
    prepararConclusao()

    await PATCH(patchReq({ status: 'completed' }), params)

    expect(sendAndLog).toHaveBeenCalledTimes(1)
    expect((sendAndLog as unknown as Mock).mock.calls[0][1]).toBe('5511999998888')
  })
})

describe('PATCH /api/tratamentos/[id] — guardas da conclusão', () => {
  // Duplo clique / retry após timeout duplicava parcelas e crédito no saldo:
  // as duas requisições liam o tratamento ainda como 'approved' e as duas
  // entravam no bloco. O UPDATE condicional é o desempate — a perdedora não
  // recebe linha de volta e sai em 409 sem lançar nada.
  it('409 na conclusão concorrente, sem lançar parcelas nem baixar estoque', async () => {
    sessionAs('admin')
    prepararConclusao({ reivindicado: [] })

    const res = await PATCH(patchReq({ status: 'completed', installments: 3 }), params)

    expect(res.status).toBe(409)
    expect(db.insert).not.toHaveBeenCalled()
    expect(darBaixaEstoque).not.toHaveBeenCalled()
    expect(sendAndLog).not.toHaveBeenCalled()
  })

  // GAP: reenvio depois que a conclusão já terminou não cai no 409 — a guarda
  // `existing.status !== 'completed'` pula o bloco inteiro e a rota devolve 200
  // como se tivesse concluído de novo. Não duplica nada (que é o que importa),
  // mas a tela recebe sucesso e o usuário não sabe que nada foi refeito.
  it('reenvio de tratamento já concluído devolve 200 e não relança financeiro', async () => {
    sessionAs('admin')
    ;(db.select as unknown as Mock).mockReturnValueOnce(chain([tratamento({ status: 'completed' })]))
    ;(db.update as unknown as Mock).mockReturnValueOnce(chain([tratamento({ status: 'completed' })]))

    const res = await PATCH(patchReq({ status: 'completed', installments: 3 }), params)

    expect(res.status).toBe(200)
    expect(db.insert).not.toHaveBeenCalled()
    expect(darBaixaEstoque).not.toHaveBeenCalled()
    expect(sendAndLog).not.toHaveBeenCalled()
  })

  // O médico conduz o tratamento e tem treatments:edit; exigir também
  // financial:create travava o fluxo inteiro (ele não tem, e o financeiro — que
  // tem — parava antes, na guarda de treatments:edit). Lançar os recebíveis é
  // parte de concluir, então quem conclui é quem conduz.
  it('médico conclui o tratamento e lança as parcelas', async () => {
    sessionAs('doctor')
    const { transacoes } = prepararConclusao()

    const res = await PATCH(patchReq({ status: 'completed', installments: 2 }), params)

    expect(res.status).toBe(200)
    const rows = (transacoes.values as unknown as Mock).mock.calls[0][0] as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows.every(r => r.type === 'income')).toBe(true)
  })

  // Creditar saldo em conta bancária continua sendo ato do financeiro: o médico
  // conclui, mas não mexe no extrato.
  it('médico segue barrado ao tentar creditar conta bancária na conclusão', async () => {
    sessionAs('doctor')
    ;(db.select as unknown as Mock).mockReturnValueOnce(chain([tratamento()]))

    const res = await PATCH(
      patchReq({ status: 'completed', paymentStatus: 'first_paid', bankAccountId: CONTA_ID }),
      params,
    )

    expect(res.status).toBe(403)
    expect(db.update).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
    expect(darBaixaEstoque).not.toHaveBeenCalled()
  })

  it('financeiro não conclui tratamento: não tem treatments:edit', async () => {
    sessionAs('financial')
    const res = await PATCH(patchReq({ status: 'completed' }), params)

    expect(res.status).toBe(403)
    expect(db.select).not.toHaveBeenCalled()
  })

  // Sem transação interativa no neon-http, uma falha depois da reivindicação
  // deixava o tratamento 'completed' com ZERO recebíveis — e o retry batia no
  // 409, exigindo UPDATE manual no banco. A compensação devolve o status.
  it('falha ao lançar as parcelas devolve 500 e reverte o status do tratamento', async () => {
    sessionAs('admin')
    const existente = tratamento({ status: 'approved', completedAt: null })
    ;(db.select as unknown as Mock)
      .mockReturnValueOnce(chain([existente])) // tratamento atual
      .mockReturnValueOnce(chain([])) // itens de material
    const reivindicacao = chain([{ id: TRAT_ID }])
    const rollback = chain([])
    ;(db.update as unknown as Mock).mockReturnValueOnce(reivindicacao).mockReturnValueOnce(rollback)
    ;(db.insert as unknown as Mock).mockImplementationOnce(() => {
      throw new Error('timeout ao gravar transações')
    })

    const res = await PATCH(patchReq({ status: 'completed', installments: 3 }), params)

    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/faturamento/i)

    // O status volta ao anterior para o reenvio ser possível de novo.
    expect(rollback.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved', completedAt: null }),
    )
    expect(sendAndLog).not.toHaveBeenCalled()
  })
})

describe('PATCH/DELETE /api/tratamentos/[id] — auditoria', () => {
  // Conclusão é o evento que move dinheiro e estoque: precisa ser distinguível
  // de uma edição qualquer na trilha de auditoria.
  it('conclusão é registrada como tratamento:complete, não como edição', async () => {
    sessionAs('admin')
    prepararConclusao()

    await PATCH(patchReq({ status: 'completed', installments: 3 }), params)

    const acoes = (logActivity as unknown as Mock).mock.calls.map(c => c[0].action)
    expect(acoes).toEqual(['tratamento:complete'])
    expect((logActivity as unknown as Mock).mock.calls[0][0]).toMatchObject({
      module: 'tratamentos',
      targetId: TRAT_ID,
      details: expect.objectContaining({ parcelas: 3 }),
    })
  })

  it('edição comum registra tratamento:edit', async () => {
    sessionAs('admin')
    ;(db.select as unknown as Mock).mockReturnValueOnce(chain([tratamento()]))
    ;(db.update as unknown as Mock).mockReturnValueOnce(chain([tratamento({ name: 'PRP Joelho D' })]))

    const res = await PATCH(patchReq({ name: 'PRP Joelho D' }), params)

    expect(res.status).toBe(200)
    expect((logActivity as unknown as Mock).mock.calls[0][0]).toMatchObject({
      action: 'tratamento:edit',
      module: 'tratamentos',
      targetId: TRAT_ID,
    })
  })

  // Exclusão apaga os itens em cascata: sem log não sobra rastro de que o
  // orçamento existiu nem de quem o removeu.
  it('exclusão registra tratamento:delete', async () => {
    sessionAs('admin')
    ;(db.select as unknown as Mock).mockReturnValueOnce(chain([tratamento({ status: 'draft' })]))
    ;(db.delete as unknown as Mock).mockReturnValueOnce(chain([]))

    const res = await DELETE(
      new NextRequest(`http://localhost/api/tratamentos/${TRAT_ID}`, { method: 'DELETE' }),
      params,
    )

    expect(res.status).toBe(200)
    expect((logActivity as unknown as Mock).mock.calls[0][0]).toMatchObject({
      action: 'tratamento:delete',
      module: 'tratamentos',
      targetId: TRAT_ID,
      details: expect.objectContaining({ status: 'draft' }),
    })
  })

  it('exclusão barrada de tratamento concluído não registra nada', async () => {
    sessionAs('admin')
    ;(db.select as unknown as Mock).mockReturnValueOnce(chain([tratamento({ status: 'completed' })]))

    const res = await DELETE(
      new NextRequest(`http://localhost/api/tratamentos/${TRAT_ID}`, { method: 'DELETE' }),
      params,
    )

    expect(res.status).toBe(400)
    expect(db.delete).not.toHaveBeenCalled()
    expect(logActivity).not.toHaveBeenCalled()
  })
})

// ── /api/prontuario — LGPD ───────────────────────────────────────────────────

describe('/api/prontuario — acesso ao registro clínico', () => {
  it('GET 401 sem sessão', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)
    const res = await lerProntuario(new NextRequest(`http://localhost/api/prontuario?patientId=${PACIENTE_ID}`))
    expect(res.status).toBe(401)
  })

  // Sem patientId a consulta devolvia os 100 registros clínicos mais recentes
  // de qualquer paciente — vazamento de PHI numa tela só de leitura.
  it('GET sem patientId é rejeitado antes de tocar no banco', async () => {
    sessionAs('admin')
    const res = await lerProntuario(new NextRequest('http://localhost/api/prontuario'))

    expect(res.status).toBe(400)
    expect(db.select).not.toHaveBeenCalled()
  })

  // Recepção agenda e cadastra, mas evolução clínica é dado sensível: ver o
  // prontuário exige patients:view_clinical, que o preset dela não tem.
  it('GET 403 para recepcionista, sem patients:view_clinical', async () => {
    sessionAs('receptionist')
    const res = await lerProntuario(new NextRequest(`http://localhost/api/prontuario?patientId=${PACIENTE_ID}`))

    expect(res.status).toBe(403)
    expect(db.select).not.toHaveBeenCalled()
  })

  it('GET do médico volta escopado ao paciente pedido', async () => {
    sessionAs('doctor')
    ;(db.select as unknown as Mock).mockReturnValue(
      chain([{ id: 'r1', type: 'evolucao', content: 'Paciente evoluiu bem', doctor: { id: 'd1', name: 'Dr. X' } }]),
    )

    const res = await lerProntuario(new NextRequest(`http://localhost/api/prontuario?patientId=${PACIENTE_ID}`))

    expect(res.status).toBe(200)
    expect((await res.json()).data).toHaveLength(1)
  })

  // Escrever no prontuário é ato clínico: quem só lê (view_clinical) não pode
  // registrar evolução em nome do médico.
  it('POST 403 para quem tem só leitura clínica', async () => {
    sessionAs('doctor', ['patients:view_clinical'])
    const res = await gravarProntuario(
      postReq({ patientId: PACIENTE_ID, content: 'Evolução' }, 'http://localhost/api/prontuario'),
    )

    expect(res.status).toBe(403)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('POST 201 para o médico, com patients:create_clinical', async () => {
    sessionAs('doctor')
    ;(db.insert as unknown as Mock).mockReturnValue(
      chain([{ id: 'r1', patientId: PACIENTE_ID, type: 'evolucao', content: 'Evolução pós-PRP' }]),
    )

    const res = await gravarProntuario(
      postReq(
        { patientId: PACIENTE_ID, content: 'Evolução pós-PRP' },
        'http://localhost/api/prontuario',
      ),
    )

    expect(res.status).toBe(201)
    const v = (db.insert as unknown as Mock).mock.results[0].value.values.mock.calls[0][0]
    expect(v).toMatchObject({ patientId: PACIENTE_ID, type: 'evolucao', content: 'Evolução pós-PRP' })
  })
})
