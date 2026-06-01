import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const updateSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).nullable().optional(),
  avatar: z.string().url().nullable().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  // Change password
  if (d.newPassword) {
    if (!d.currentPassword) return NextResponse.json({ error: 'Senha atual obrigatória' }, { status: 400 })
    const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, session.user.id))
    const valid = await bcrypt.compare(d.currentPassword, user.passwordHash)
    if (!valid) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })
    updates.passwordHash = await bcrypt.hash(d.newPassword, 12)
  }

  if (d.name  !== undefined) updates.name  = d.name
  if (d.email !== undefined) {
    // Check uniqueness
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email))
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json({ error: 'E-mail já em uso' }, { status: 409 })
    }
    updates.email = d.email
  }
  if (d.phone  !== undefined) updates.phone  = d.phone
  if (d.avatar !== undefined) updates.avatar = d.avatar

  const [updated] = await db.update(users).set(updates).where(eq(users.id, session.user.id)).returning({
    id: users.id, name: users.name, email: users.email, phone: users.phone, avatar: users.avatar, role: users.role,
  })

  return NextResponse.json({ data: updated })
}
