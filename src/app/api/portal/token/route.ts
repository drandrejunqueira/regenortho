import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { patientAccessTokens } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'

const schema = z.object({ patientId: z.string().uuid() })

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'portal:manage')) {
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

  const [row] = await db.insert(patientAccessTokens).values({
    patientId,
    token,
    expiresAt,
    isActive: true,
  }).returning()

  return NextResponse.json({ token: row.token, expiresAt: row.expiresAt })
}
