import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { patientAccessTokens } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { logActivity } from '@/lib/db/logger'
import type { UserRole } from '@/types'
import { z } from 'zod'
import { eq, and, gt } from 'drizzle-orm'
import crypto from 'crypto'

const schema = z.object({ patientId: z.string().uuid() })

type SessaoPortal = { user: { id: string; name?: string | null; email?: string | null } }

/**
 * Rastro de auditoria do portal. `details` guarda só o que identifica a emissão/leitura:
 * o token e o código de 6 dígitos SÃO a credencial e não podem ser replicados numa tabela
 * de acesso mais amplo — quem lesse o log entraria no portal do paciente.
 */
async function registrarAcessoPortal(
  req: NextRequest,
  session: SessaoPortal,
  dados: { action: string; patientId: string; expiresAt: Date },
) {
  await logActivity({
    userId: session.user.id,
    userName: session.user.name || session.user.email || null,
    action: dados.action,
    module: 'portal',
    targetId: dados.patientId,
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    details: {
      patientId: dados.patientId,
      expiresAt: dados.expiresAt,
    },
  })
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'portal:manage', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')
  if (!patientId) return NextResponse.json({ error: 'patientId requerido' }, { status: 400 })
  // Valor fora do formato de UUID nunca casaria com um paciente: barra antes de virar
  // consulta, em vez de deixar o banco receber texto arbitrário vindo da query string.
  if (!schema.shape.patientId.safeParse(patientId).success) {
    return NextResponse.json({ error: 'patientId inválido' }, { status: 400 })
  }

  const [activeToken] = await db.select().from(patientAccessTokens)
    .where(and(
      eq(patientAccessTokens.patientId, patientId),
      eq(patientAccessTokens.isActive, true),
      gt(patientAccessTokens.expiresAt, new Date())
    ))

  if (!activeToken) return NextResponse.json({ data: null })

  // Ler o token ativo é ver a credencial de acesso ao prontuário e ao financeiro de outra
  // pessoa — mesma sensibilidade da emissão, mesmo rastro. Só a consulta que de fato
  // devolve a credencial é registrada; a que não acha nada não revelou nada.
  await registrarAcessoPortal(req, session, {
    action: 'portal:token_consultado',
    patientId,
    expiresAt: activeToken.expiresAt,
  })

  return NextResponse.json({
    data: {
      token: activeToken.token,
      code: activeToken.code,
      expiresAt: activeToken.expiresAt,
    }
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'portal:manage', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'patientId inválido' }, { status: 400 })

  const { patientId } = parsed.data

  // Deactivate existing tokens for this patient
  await db.update(patientAccessTokens)
    .set({ isActive: false })
    .where(and(eq(patientAccessTokens.patientId, patientId), eq(patientAccessTokens.isActive, true)))

  // Create new token — 7 days expiry
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  // O código de 6 dígitos é a credencial de acesso ao prontuário. Antes vinha de
  // Math.random (não criptográfico) e sem nenhuma checagem de colisão: dois
  // pacientes podiam ficar com o mesmo código ativo e quem digitasse abriria a
  // ficha do outro, porque a consulta pega a primeira linha que casar.
  let code = ''
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const candidato = String(crypto.randomInt(100000, 1000000))
    const emUso = await db.query.patientAccessTokens.findFirst({
      where: and(
        eq(patientAccessTokens.code, candidato),
        eq(patientAccessTokens.isActive, true),
        gt(patientAccessTokens.expiresAt, new Date()),
      ),
      columns: { id: true },
    })
    if (!emUso) {
      code = candidato
      break
    }
  }
  if (!code) {
    return NextResponse.json(
      { error: 'Não foi possível gerar um código livre. Tente novamente.' },
      { status: 503 }
    )
  }

  const [row] = await db.insert(patientAccessTokens).values({
    patientId,
    token,
    code,
    expiresAt,
    isActive: true,
  }).returning()

  // Emitir acesso ao portal entrega prontuário e financeiro do paciente a quem tiver a
  // credencial, e antes não deixava rastro nenhum: não havia como responder quem gerou o
  // acesso do paciente X e quando. Registra igual /api/prontuario POST já faz.
  await registrarAcessoPortal(req, session, {
    action: 'portal:token_emitido',
    patientId,
    expiresAt: row.expiresAt,
  })

  return NextResponse.json({ token: row.token, code: row.code, expiresAt: row.expiresAt })
}
