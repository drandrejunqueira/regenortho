import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { patientAccessTokens } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { z } from 'zod'
import { eq, and, gt } from 'drizzle-orm'
import crypto from 'crypto'

const schema = z.object({ patientId: z.string().uuid() })

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'portal:manage', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')
  if (!patientId) return NextResponse.json({ error: 'patientId requerido' }, { status: 400 })

  const [activeToken] = await db.select().from(patientAccessTokens)
    .where(and(
      eq(patientAccessTokens.patientId, patientId),
      eq(patientAccessTokens.isActive, true),
      gt(patientAccessTokens.expiresAt, new Date())
    ))

  if (!activeToken) return NextResponse.json({ data: null })

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

  return NextResponse.json({ token: row.token, code: row.code, expiresAt: row.expiresAt })
}
