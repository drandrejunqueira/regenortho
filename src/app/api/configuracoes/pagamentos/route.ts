import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { paymentMethods } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['cash', 'credit_card', 'debit_card', 'pix', 'bank_transfer', 'insurance', 'check']),
  feePercent: z.number().min(0).max(100).default(0),
  maxInstallments: z.number().int().min(1).max(24).default(1),
})

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'payments:view', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const data = await db.select().from(paymentMethods).orderBy(paymentMethods.name)
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'payments:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [pm] = await db.insert(paymentMethods).values({
    name: parsed.data.name,
    type: parsed.data.type,
    feePercent: String(parsed.data.feePercent),
    maxInstallments: parsed.data.maxInstallments,
  }).returning()

  return NextResponse.json({ data: pm }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'payments:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const { id, ...rest } = body
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const parsed = updateSchema.safeParse(rest)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) updates.name = parsed.data.name
  if (parsed.data.type !== undefined) updates.type = parsed.data.type
  if (parsed.data.feePercent !== undefined) updates.feePercent = String(parsed.data.feePercent)
  if (parsed.data.maxInstallments !== undefined) updates.maxInstallments = parsed.data.maxInstallments
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive

  const [pm] = await db.update(paymentMethods).set(updates).where(eq(paymentMethods.id, id)).returning()
  return NextResponse.json({ data: pm })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'payments:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  await db.update(paymentMethods).set({ isActive: false }).where(eq(paymentMethods.id, id))
  return NextResponse.json({ ok: true })
}
