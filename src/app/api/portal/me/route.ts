import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patientAccessTokens, patients, appointments, treatments, examOrders, transactions, activityLogs } from '@/lib/db/schema'
import { eq, and, gt, inArray, count } from 'drizzle-orm'
import { z } from 'zod'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { logActivity } from '@/lib/db/logger'
import { notify } from '@/lib/notifications'
import {
  CAMINHO_COOKIE_PORTAL,
  COOKIE_SESSAO_PORTAL,
  DURACAO_SESSAO_PORTAL_MS,
  criarValorSessaoPortal,
  lerValorSessaoPortal,
} from '@/lib/portal/sessao'
import {
  ACAO_CODIGO_ANULADO,
  ACAO_CODIGO_FALHOU,
  ACAO_CODIGO_INVALIDO,
  JANELA_GLOBAL_CODIGO_MS,
  JANELA_PORTAL_IP_MS,
  LIMITE_GLOBAL_FALHAS_CODIGO,
  LIMITE_PORTAL_POR_IP,
  MAX_FALHAS_POR_CODIGO,
} from '@/lib/portal/entrada'

// Portal do paciente — rota pública (o paciente não tem sessão do CRM).
//
// POST troca a credencial de entrada (token do link, ou código + data de
// nascimento) por um cookie de sessão HttpOnly. GET lê os dados com esse cookie.
// A credencial nunca mais vai na query string: URL vaza em access log, Referer,
// histórico e print de tela. Limites da entrada por código: src/lib/portal/entrada.ts.

const ACESSO_INVALIDO = 'Acesso inválido ou expirado'

const entradaSchema = z.union([
  z.object({ token: z.string().min(32).max(128) }),
  z.object({
    code: z.string().regex(/^\d{6}$/),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
])

type Acesso = typeof patientAccessTokens.$inferSelect

function limitarPorIp(req: NextRequest): NextResponse | null {
  const rl = rateLimit(`portal:${getClientIp(req)}`, LIMITE_PORTAL_POR_IP, JANELA_PORTAL_IP_MS)
  if (rl.ok) return null
  return NextResponse.json(
    { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
    { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
  )
}

const acessoValido = () => [
  eq(patientAccessTokens.isActive, true),
  gt(patientAccessTokens.expiresAt, new Date()),
]

async function contarEventos(acoes: string[], desde: Date, targetId?: string): Promise<number> {
  const filtros = [inArray(activityLogs.action, acoes), gt(activityLogs.createdAt, desde)]
  if (targetId) filtros.push(eq(activityLogs.targetId, targetId))
  const [linha] = await db.select({ total: count() }).from(activityLogs).where(and(...filtros))
  return Number(linha?.total ?? 0)
}

async function registrarFalhaCodigo(acao: string, ip: string, acessoId: string | null): Promise<void> {
  // Nada da credencial vai para o log: nem o código digitado, nem o nascimento.
  await logActivity({
    userId: null,
    userName: null,
    action: acao,
    module: 'portal',
    targetId: acessoId,
    ip: ip.slice(0, 45),
  })
}

// Um aviso por instância a cada janela: o limite global costuma disparar em
// rajada, e o sino não pode virar spam.
let ultimoAvisoGlobal = 0

async function avisarLimiteGlobal(): Promise<void> {
  const agora = Date.now()
  if (agora - ultimoAvisoGlobal < JANELA_GLOBAL_CODIGO_MS) return
  ultimoAvisoGlobal = agora
  await notify({
    type: 'system',
    title: 'Portal do paciente: muitas tentativas de código',
    body: 'A entrada por código foi suspensa por 15 minutos após falhas seguidas de vários acessos. O link de acesso continua funcionando. Veja os registros em Configurações → Logs.',
    link: '/configuracoes/logs',
    priority: 'high',
  })
}

async function acessoPorToken(token: string): Promise<Acesso | null> {
  const acesso = await db.query.patientAccessTokens.findFirst({
    where: and(eq(patientAccessTokens.token, token), ...acessoValido()),
  })
  return acesso ?? null
}

async function acessoPorCodigo(
  req: NextRequest,
  entrada: { code: string; birthDate: string },
): Promise<Acesso | NextResponse | null> {
  const ip = getClientIp(req)

  const falhasRecentes = await contarEventos(
    [ACAO_CODIGO_INVALIDO, ACAO_CODIGO_FALHOU],
    new Date(Date.now() - JANELA_GLOBAL_CODIGO_MS),
  )
  if (falhasRecentes >= LIMITE_GLOBAL_FALHAS_CODIGO) {
    await avisarLimiteGlobal()
    return NextResponse.json(
      { error: 'Entrada por código temporariamente suspensa. Use o link de acesso enviado pela clínica ou tente mais tarde.' },
      { status: 429, headers: { 'Retry-After': String(JANELA_GLOBAL_CODIGO_MS / 1000) } },
    )
  }

  // Busca até 2 linhas de propósito: se o código casar com mais de um acesso
  // ativo, pegar "a primeira" abriria o portal de outra pessoa.
  const linhas = await db.query.patientAccessTokens.findMany({
    where: and(eq(patientAccessTokens.code, entrada.code), ...acessoValido()),
    with: { patient: { columns: { birthDate: true } } },
    limit: 2,
  })

  if (linhas.length > 1) {
    console.error('[portal] código ambíguo — mais de um acesso ativo com o mesmo código')
    return null
  }

  const linha = linhas[0]
  if (!linha) {
    await registrarFalhaCodigo(ACAO_CODIGO_INVALIDO, ip, null)
    return null
  }

  // Sem nascimento cadastrado não há segundo fator: o código sozinho não entra
  // (o link continua funcionando).
  const { patient, ...acesso } = linha
  if (!patient?.birthDate || patient.birthDate !== entrada.birthDate) {
    await registrarFalhaCodigo(ACAO_CODIGO_FALHOU, ip, acesso.id)
    const falhasDoCodigo = await contarEventos([ACAO_CODIGO_FALHOU], acesso.createdAt, acesso.id)
    if (falhasDoCodigo >= MAX_FALHAS_POR_CODIGO) {
      await db.update(patientAccessTokens).set({ code: null }).where(eq(patientAccessTokens.id, acesso.id))
      await logActivity({
        userId: null,
        userName: null,
        action: ACAO_CODIGO_ANULADO,
        module: 'portal',
        targetId: acesso.patientId,
        ip: ip.slice(0, 45),
        details: { patientId: acesso.patientId, motivo: 'falhas_de_data_de_nascimento' },
      })
    }
    return null
  }

  return acesso
}

async function carregarDadosPortal(patientId: string) {
  const [patient] = await db.select({
    id: patients.id,
    name: patients.name,
    email: patients.email,
    phone: patients.phone,
    birthDate: patients.birthDate,
    insurance: patients.insurance,
  }).from(patients).where(eq(patients.id, patientId))

  if (!patient) return null

  const [appts, treats, exams, txs] = await Promise.all([
    db.select({
      id: appointments.id,
      type: appointments.type,
      status: appointments.status,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      title: appointments.title,
      notes: appointments.notes,
    }).from(appointments).where(eq(appointments.patientId, patientId)).orderBy(appointments.startAt).limit(50),

    db.select({
      id: treatments.id,
      name: treatments.name,
      status: treatments.status,
      totalSale: treatments.totalSale,
      installments: treatments.installments,
      completedAt: treatments.completedAt,
      createdAt: treatments.createdAt,
    }).from(treatments).where(eq(treatments.patientId, patientId)).orderBy(treatments.createdAt).limit(50),

    db.select({
      id: examOrders.id,
      exams: examOrders.exams,
      urgency: examOrders.urgency,
      status: examOrders.status,
      resultUrl: examOrders.resultUrl,
      resultDate: examOrders.resultDate,
      validUntil: examOrders.validUntil,
      createdAt: examOrders.createdAt,
    }).from(examOrders).where(eq(examOrders.patientId, patientId)).orderBy(examOrders.createdAt).limit(50),

    db.select({
      id: transactions.id,
      description: transactions.description,
      amount: transactions.amount,
      type: transactions.type,
      date: transactions.date,
      dueDate: transactions.dueDate,
      isPaid: transactions.isPaid,
    }).from(transactions).where(eq(transactions.patientId, patientId)).orderBy(transactions.date).limit(50),
  ])

  return { patient, appointments: appts, treatments: treats, exams, transactions: txs }
}

function semCache(res: NextResponse): NextResponse {
  res.headers.set('Cache-Control', 'no-store')
  return res
}

function apagarCookie(res: NextResponse): NextResponse {
  res.cookies.set(COOKIE_SESSAO_PORTAL, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: CAMINHO_COOKIE_PORTAL,
    maxAge: 0,
  })
  return res
}

export async function POST(req: NextRequest) {
  const limitado = limitarPorIp(req)
  if (limitado) return limitado

  const body = await req.json().catch(() => null)
  const parsed = entradaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Informe o código de 6 dígitos e a data de nascimento' }, { status: 400 })
  }

  const entrada = parsed.data
  const resultado = 'token' in entrada
    ? await acessoPorToken(entrada.token)
    : await acessoPorCodigo(req, entrada)
  if (resultado instanceof NextResponse) return resultado
  if (!resultado) return NextResponse.json({ error: ACESSO_INVALIDO }, { status: 401 })

  await db.update(patientAccessTokens).set({ lastUsedAt: new Date() }).where(eq(patientAccessTokens.id, resultado.id))

  const dados = await carregarDadosPortal(resultado.patientId)
  if (!dados) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  // A sessão nunca dura mais que o próprio acesso emitido pela clínica.
  const expiraEm = Math.min(Date.now() + DURACAO_SESSAO_PORTAL_MS, new Date(resultado.expiresAt).getTime())
  const res = NextResponse.json({ data: dados })
  res.cookies.set(COOKIE_SESSAO_PORTAL, criarValorSessaoPortal(resultado.id, expiraEm), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: CAMINHO_COOKIE_PORTAL,
    expires: new Date(expiraEm),
  })
  return semCache(res)
}

export async function GET(req: NextRequest) {
  const limitado = limitarPorIp(req)
  if (limitado) return limitado

  const acessoId = lerValorSessaoPortal(req.cookies.get(COOKIE_SESSAO_PORTAL)?.value)
  if (!acessoId) return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 })

  // Reconfere o registro: acesso revogado ou vencido na clínica derruba a sessão.
  const acesso = await db.query.patientAccessTokens.findFirst({
    where: and(eq(patientAccessTokens.id, acessoId), ...acessoValido()),
  })
  if (!acesso) return apagarCookie(NextResponse.json({ error: ACESSO_INVALIDO }, { status: 401 }))

  const dados = await carregarDadosPortal(acesso.patientId)
  if (!dados) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  return semCache(NextResponse.json({ data: dados }))
}

export async function DELETE() {
  return apagarCookie(NextResponse.json({ ok: true }))
}
