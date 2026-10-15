import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { chain } from '../helpers/dbChain'

/**
 * /api/prontuario — evolução clínica: o dado mais sensível do sistema (PHI/LGPD).
 *
 * Área descoberta (sem nenhum teste de integração antes deste arquivo). Cobre os
 * 5 casos obrigatórios: feliz, validação, authZ, "não encontrado" (adaptado —
 * ver nota abaixo) e efeito colateral (auditoria). Também documenta um GAP real
 * encontrado durante a auditoria: o POST não valida que o paciente exista antes
 * de inserir, então um patientId incorreto quebra sem controle em vez de 404.
 *
 * A rota não tem [id] (o registro clínico é imutável por design — sem PATCH/DELETE),
 * então o caso 4 do padrão é adaptado: para o GET, "não encontrado" vira "paciente
 * sem nenhum registro ainda" (200 + lista vazia, comportamento correto de listagem);
 * para o POST, vira o GAP documentado abaixo (nenhuma checagem de existência do paciente).
 */

vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { select: vi.fn(), insert: vi.fn() } }))
vi.mock('@/lib/db/logger', () => ({ logActivity: vi.fn(async () => undefined) }))

import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/db/logger'
import { GET, POST } from '@/app/api/prontuario/route'

const PATIENT_ID = '22222222-2222-4222-8222-222222222222'
const APPOINTMENT_ID = '33333333-3333-4333-8333-333333333333'
const DOCTOR_ID = '77777777-7777-4777-8777-777777777777'
const RECORD_ID = '88888888-8888-4888-8888-888888888888'
const GHOST_PATIENT_ID = '99999999-9999-4999-8999-999999999999'

const sessionAs = (role: string, customPermissions: string[] | null = null, id = DOCTOR_ID) =>
  (auth as unknown as Mock).mockResolvedValue({
    user: { id, role, customPermissions, name: 'Dr. Silva', email: 'medico@clinica.com' },
  })

const get = (qs: string) => new NextRequest(`http://localhost/api/prontuario${qs}`)

const post = (body: unknown) =>
  new NextRequest('http://localhost/api/prontuario', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

/** Plugga um insert e devolve o que a rota mandou gravar. */
function espiaInsert(retorno: Record<string, unknown>[]) {
  const c = chain(retorno)
  ;(db.insert as unknown as Mock).mockReturnValueOnce(c)
  return () => (c.values as unknown as Mock).mock.calls[0][0] as Record<string, unknown>
}

afterEach(() => vi.clearAllMocks())

describe('GET /api/prontuario', () => {
  it('401 sem sessão', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)
    const res = await GET(get('?patientId=' + PATIENT_ID))
    expect(res.status).toBe(401)
    expect(db.select).not.toHaveBeenCalled()
  })

  // 3. AuthZ — recepção e financeiro não têm patients:view_clinical.
  it('3. 403 para papéis sem patients:view_clinical (recepção e financeiro)', async () => {
    for (const role of ['receptionist', 'financial']) {
      sessionAs(role)
      const res = await GET(get('?patientId=' + PATIENT_ID))
      expect(res.status, `papel ${role}`).toBe(403)
    }
    expect(db.select).not.toHaveBeenCalled()
  })

  // 2. Validação — a guarda de LGPD: sem patientId a rota devolvia os 100
  // registros mais recentes de QUALQUER paciente. Isso é vazamento de PHI.
  it('2. 400 quando patientId não é informado — guarda contra vazamento de PHI entre pacientes', async () => {
    sessionAs('doctor')
    const res = await GET(get(''))
    expect(res.status).toBe(400)
    expect(db.select).not.toHaveBeenCalled()
  })

  // 1. Feliz
  it('1. feliz: devolve a evolução clínica com o médico responsável', async () => {
    sessionAs('doctor')
    ;(db.select as unknown as Mock).mockReturnValue(
      chain([
        {
          id: RECORD_ID,
          type: 'evolucao',
          content: 'Paciente evoluindo bem, sem sinais de infecção no sítio da punção.',
          createdAt: new Date('2026-08-20T10:00:00.000Z'),
          doctor: { id: DOCTOR_ID, name: 'Dr. Silva' },
        },
      ]),
    )

    const res = await GET(get('?patientId=' + PATIENT_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({
      id: RECORD_ID,
      content: 'Paciente evoluindo bem, sem sinais de infecção no sítio da punção.',
      doctor: { id: DOCTOR_ID, name: 'Dr. Silva' },
    })
  })

  // 4. "Não encontrado" adaptado: paciente válido sem nenhum registro ainda.
  // É uma listagem — o correto é 200 + [], nunca 404 nem 500.
  it('4. paciente sem nenhum registro clínico ainda devolve 200 com lista vazia (nunca 500)', async () => {
    sessionAs('doctor')
    ;(db.select as unknown as Mock).mockReturnValue(chain([]))

    const res = await GET(get('?patientId=' + PATIENT_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })
})

describe('POST /api/prontuario', () => {
  it('401 sem sessão', async () => {
    ;(auth as unknown as Mock).mockResolvedValue(null)
    const res = await POST(post({ patientId: PATIENT_ID, content: 'Evolução' }))
    expect(res.status).toBe(401)
    expect(db.insert).not.toHaveBeenCalled()
  })

  // 1. Feliz — e a armadilha do repo: patientId, appointmentId e doctorId têm
  // que chegar ao insert com o valor certo.
  it('1. feliz: grava a evolução com patientId + appointmentId + doctorId, e audita sem vazar o conteúdo', async () => {
    sessionAs('doctor')
    const gravado = espiaInsert([
      {
        id: RECORD_ID,
        patientId: PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
        doctorId: DOCTOR_ID,
        type: 'evolucao',
        content: 'Ferida cirúrgica limpa, sem secreção.',
      },
    ])

    const res = await POST(
      post({
        patientId: PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
        doctorId: DOCTOR_ID,
        content: 'Ferida cirúrgica limpa, sem secreção.',
      }),
    )

    expect(res.status).toBe(201)
    const { data } = await res.json()
    expect(data.id).toBe(RECORD_ID)

    const valores = gravado()
    // O vínculo é o que amarra a evolução à ficha certa — sem ele o registro
    // clínico fica órfão ou (pior) vinculado ao paciente errado.
    expect(valores.patientId).toBe(PATIENT_ID)
    expect(valores.appointmentId).toBe(APPOINTMENT_ID)
    expect(valores.doctorId).toBe(DOCTOR_ID)
    expect(valores.type).toBe('evolucao') // default do schema, não foi informado
    expect(valores.content).toBe('Ferida cirúrgica limpa, sem secreção.')

    // Auditoria: tem que rastrear quem escreveu, mas SEM duplicar o conteúdo
    // clínico na tabela de log (PHI não pode vazar para uma tabela de acesso
    // mais amplo que o prontuário).
    expect(logActivity).toHaveBeenCalledTimes(1)
    const logCall = (logActivity as unknown as Mock).mock.calls[0][0]
    expect(logCall).toMatchObject({ action: 'prontuario:create', module: 'prontuario', targetId: RECORD_ID })
    expect(logCall.details).toMatchObject({ patientId: PATIENT_ID, appointmentId: APPOINTMENT_ID, doctorId: DOCTOR_ID })
    expect(JSON.stringify(logCall.details)).not.toContain('Ferida cirúrgica')
  })

  // 2. Validação
  it('2. payload inválido (content vazio) devolve 400 sem tocar o banco', async () => {
    sessionAs('doctor')
    const res = await POST(post({ patientId: PATIENT_ID, content: '' }))
    expect(res.status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('2b. patientId que não é uuid devolve 400 sem tocar o banco', async () => {
    sessionAs('doctor')
    const res = await POST(post({ patientId: 'não-é-uuid', content: 'Evolução' }))
    expect(res.status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })

  // 3. AuthZ — recepção e financeiro não têm patients:create_clinical.
  it('3. 403 para papéis sem patients:create_clinical (recepção e financeiro)', async () => {
    for (const role of ['receptionist', 'financial']) {
      sessionAs(role)
      const res = await POST(post({ patientId: PATIENT_ID, content: 'Evolução' }))
      expect(res.status, `papel ${role}`).toBe(403)
    }
    expect(db.insert).not.toHaveBeenCalled()
  })

  // 4. GAP — encontrado durante esta auditoria, não corrigido aqui (fora do
  // escopo deste arquivo de testes): o handler não confere se o paciente
  // existe antes de inserir. Num banco real, um patientId incorreto viola a FK
  // (`clinical_records.patient_id` referencia `patients.id`) e a exceção sobe
  // sem tratamento — 500 em produção, em vez do 404 esperado pelo padrão desta
  // suíte. Este teste documenta o comportamento ATUAL (não o desejado): prova
  // que a rota não captura o erro do banco.
  it('4. GAP: patientId de paciente inexistente não é validado — erro do banco sobe sem tratamento', async () => {
    sessionAs('doctor')
    ;(db.insert as unknown as Mock).mockImplementation(() => {
      throw new Error(
        'insert or update on table "clinical_records" violates foreign key constraint "clinical_records_patient_id_fkey"',
      )
    })

    await expect(
      POST(post({ patientId: GHOST_PATIENT_ID, content: 'Evolução de paciente que não existe' })),
    ).rejects.toThrow(/foreign key/)
  })
})
