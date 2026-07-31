import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import type { UserRole } from '@/types'

const updateSchema = z.object({
  email: z.string().email('E-mail inválido').optional(),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres').optional(),
  role: z.enum(['admin', 'receptionist', 'financial', 'doctor']).optional(),
  isActive: z.boolean().optional(),
  phone: z.string().nullable().optional(),
  customPermissions: z.array(z.string()).nullable().optional(),
  googleCalendarId: z.string().nullable().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'users:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const { email, password, ...rest } = parsed.data
  const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() }

  // E-mail: validar unicidade antes de alterar
  if (email !== undefined) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
    }
    updates.email = email
  }

  // Senha: re-hash quando informada
  if (password !== undefined) {
    updates.passwordHash = await bcrypt.hash(password, 12)
  }

  const [updated] = await db.update(users)
    .set(updates)
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      customPermissions: users.customPermissions,
      googleCalendarId: users.googleCalendarId,
    })

  if (!updated) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  return NextResponse.json({ data: updated })
}
