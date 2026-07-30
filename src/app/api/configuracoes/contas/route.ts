import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { bankAccounts } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  bank: z.string().max(100).optional(),
  agency: z.string().max(20).optional(),
  account: z.string().max(30).optional(),
  type: z.enum(['checking', 'savings', 'pix_key']).default('checking'),
  pixKey: z.string().optional(),
  isDefault: z.boolean().default(false),
  currentBalance: z.number().default(0),
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

  const data = await db.select().from(bankAccounts).where(eq(bankAccounts.isActive, true)).orderBy(bankAccounts.name)
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

  // If setting as default, unset others
  if (parsed.data.isDefault) {
    await db.update(bankAccounts).set({ isDefault: false }).where(eq(bankAccounts.isActive, true))
  }

  const [account] = await db.insert(bankAccounts).values({
    name: parsed.data.name,
    bank: parsed.data.bank,
    agency: parsed.data.agency,
    account: parsed.data.account,
    type: parsed.data.type,
    pixKey: parsed.data.pixKey,
    isDefault: parsed.data.isDefault,
    currentBalance: String(parsed.data.currentBalance),
  }).returning()

  return NextResponse.json({ data: account }, { status: 201 })
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

  if (parsed.data.isDefault) {
    await db.update(bankAccounts).set({ isDefault: false }).where(and(eq(bankAccounts.isActive, true)))
  }

  const updates: Record<string, unknown> = {}
  const d = parsed.data
  if (d.name !== undefined) updates.name = d.name
  if (d.bank !== undefined) updates.bank = d.bank
  if (d.agency !== undefined) updates.agency = d.agency
  if (d.account !== undefined) updates.account = d.account
  if (d.type !== undefined) updates.type = d.type
  if (d.pixKey !== undefined) updates.pixKey = d.pixKey
  if (d.isDefault !== undefined) updates.isDefault = d.isDefault
  if (d.isActive !== undefined) updates.isActive = d.isActive
  if (d.currentBalance !== undefined) updates.currentBalance = String(d.currentBalance)
  updates.updatedAt = new Date()

  const [account] = await db.update(bankAccounts).set(updates).where(eq(bankAccounts.id, id)).returning()
  return NextResponse.json({ data: account })
}
