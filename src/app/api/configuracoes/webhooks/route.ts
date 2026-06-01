import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { webhooks } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'

const createSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  events: z.array(z.string()),
  secret: z.string().nullable().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'settings:view')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const data = await db.query.webhooks.findMany({ orderBy: [desc(webhooks.createdAt)] })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'settings:edit')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const [created] = await db.insert(webhooks).values(parsed.data).returning()
  return NextResponse.json({ data: created }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'settings:edit')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id, ...data } = await req.json()
  await db.update(webhooks).set({ ...data, updatedAt: new Date() }).where(eq(webhooks.id, id))
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'settings:edit')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await req.json()
  await db.delete(webhooks).where(eq(webhooks.id, id))
  return NextResponse.json({ success: true })
}
