// Mesma classe que `next-auth` reexporta; importada da origem porque o índice do
// next-auth puxa `next/server` em ESM e não carrega fora do runtime do Next (testes).
import { CredentialsSignin } from '@auth/core/errors'
import { NextResponse } from 'next/server'
import { and, count, eq, gt, max } from 'drizzle-orm'
import { db } from '@/lib/db'
import { activityLogs } from '@/lib/db/schema'
import { logActivity } from '@/lib/db/logger'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// Freio de força bruta do login em duas camadas.
//
// 1. Em memória (por instância), por IP e por e-mail: barato, corta rajada antes
//    de qualquer consulta ao banco e devolve 429 de verdade. Sozinho não basta —
//    em serverless o teto real é limite × instâncias quentes.
// 2. Bloqueio da conta contado em `activity_logs`: as falhas ficam no banco,
//    então o limite vale para todas as instâncias ao mesmo tempo, sem depender
//    de KV/Redis e sem coluna nova em `users` (migration manual não aplicada
//    derrubaria o login inteiro em produção).

export const LIMITE_LOGIN_POR_IP = 20
export const LIMITE_LOGIN_POR_EMAIL = 10
export const JANELA_LOGIN_MS = 15 * 60 * 1000

export const FALHAS_ATE_BLOQUEIO = 5
export const BLOQUEIO_BASE_MS = 15 * 60 * 1000
export const BLOQUEIO_TETO_MS = 60 * 60 * 1000
// Falhas mais antigas que isto não pesam mais no bloqueio.
export const JANELA_FALHAS_MS = 24 * 60 * 60 * 1000

export const ACAO_LOGIN_FALHOU = 'auth:login_falhou'
export const ACAO_LOGIN_BLOQUEADO = 'auth:login_bloqueado'

export const CODIGO_MUITAS_TENTATIVAS = 'muitas_tentativas'

/** Erro que o NextAuth repassa ao cliente como `code=muitas_tentativas`. */
export class LoginBloqueado extends CredentialsSignin {
  code = CODIGO_MUITAS_TENTATIVAS
}

export type MotivoFalhaLogin = 'senha' | 'usuario' | 'inativo' | 'bloqueado'

/** Chave do contador: o mesmo e-mail com caixa diferente é a mesma conta. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Início da contagem de falhas: o último login bem-sucedido zera o histórico,
 * e nada além de 24h atrás conta.
 */
export function inicioJanelaFalhas(ultimoLogin: Date | null | undefined, agora = Date.now()): Date {
  return new Date(Math.max(ultimoLogin?.getTime() ?? 0, agora - JANELA_FALHAS_MS))
}

/**
 * Quanto falta para a conta destravar. A partir da 5ª falha o bloqueio dobra a
 * cada nova falha (15 min, 30 min, 60 min...), com teto de 1h para que um
 * atacante não consiga trancar a conta legítima por um dia inteiro.
 */
export function bloqueioRestanteMs(falhas: number, ultimaFalha: Date | null, agora = Date.now()): number {
  if (falhas < FALHAS_ATE_BLOQUEIO || !ultimaFalha) return 0
  const duracao = Math.min(BLOQUEIO_BASE_MS * 2 ** (falhas - FALHAS_ATE_BLOQUEIO), BLOQUEIO_TETO_MS)
  return Math.max(0, ultimaFalha.getTime() + duracao - agora)
}

/**
 * Tempo restante de bloqueio do e-mail, contado no banco. Vale também para
 * e-mail que não existe: se só a conta real travasse, a mensagem de bloqueio
 * viraria um oráculo de "este e-mail está cadastrado".
 */
export async function tempoDeBloqueio(
  email: string,
  ultimoLogin: Date | null | undefined,
  agora = Date.now(),
): Promise<number> {
  const [linha] = await db
    .select({ total: count(), ultima: max(activityLogs.createdAt) })
    .from(activityLogs)
    .where(and(
      eq(activityLogs.action, ACAO_LOGIN_FALHOU),
      eq(activityLogs.targetName, email),
      gt(activityLogs.createdAt, inicioJanelaFalhas(ultimoLogin, agora)),
    ))
  const ultima = linha?.ultima ? new Date(linha.ultima) : null
  return bloqueioRestanteMs(Number(linha?.total ?? 0), ultima, agora)
}

/**
 * Registra a tentativa recusada. Além de alimentar o bloqueio, é o que torna
 * uma campanha de força bruta visível na tela de logs — antes só o sucesso
 * (`lastLoginAt`) deixava rastro.
 */
export async function registrarFalhaLogin(dados: {
  email: string
  ip: string
  userId: string | null
  motivo: MotivoFalhaLogin
}): Promise<void> {
  await logActivity({
    userId: dados.userId,
    userName: null,
    // Tentativa barrada pelo bloqueio vai com outra ação: se contasse como
    // falha, cada tentativa durante o bloqueio o estenderia para sempre.
    action: dados.motivo === 'bloqueado' ? ACAO_LOGIN_BLOQUEADO : ACAO_LOGIN_FALHOU,
    module: 'auth',
    targetId: dados.userId,
    targetName: dados.email.slice(0, 255),
    ip: dados.ip.slice(0, 45),
    details: { motivo: dados.motivo },
  })
}

async function emailDoFormulario(req: Request): Promise<string> {
  try {
    const form = await req.clone().formData()
    const email = form.get('email')
    return typeof email === 'string' ? normalizarEmail(email) : ''
  } catch {
    return ''
  }
}

/**
 * Camada em memória, aplicada na rota `/api/auth/callback/credentials` antes do
 * NextAuth. Devolve a resposta 429 quando o IP ou o e-mail estourou o limite, ou
 * `null` para seguir. O corpo traz `url` com `code=muitas_tentativas` porque é
 * isso que o `signIn()` do cliente lê para montar o erro.
 */
export async function limitarTentativaLogin(req: Request): Promise<NextResponse | null> {
  const ip = getClientIp(req)
  const email = await emailDoFormulario(req)

  const porIp = rateLimit(`login:ip:${ip}`, LIMITE_LOGIN_POR_IP, JANELA_LOGIN_MS)
  // A chave por e-mail é a que protege a conta quando o atacante distribui IPs.
  const porEmail = email
    ? rateLimit(`login:email:${email}`, LIMITE_LOGIN_POR_EMAIL, JANELA_LOGIN_MS)
    : porIp
  if (porIp.ok && porEmail.ok) return null

  const retryAfterSec = Math.max(porIp.retryAfterSec, porEmail.retryAfterSec)
  const url = new URL(`/login?error=CredentialsSignin&code=${CODIGO_MUITAS_TENTATIVAS}`, req.url)
  return NextResponse.json(
    { url: url.toString(), error: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
  )
}
