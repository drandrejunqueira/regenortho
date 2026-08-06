// Registro de tags do sistema.
// GET é liberado a quem vê leads (o CRM precisa da lista para filtrar e marcar);
// criar/editar exige settings:edit, porque o vocabulário é decisão da clínica.
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { tags } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'
import { TAG_NAME_RE } from '@/lib/promptSafety'

const createSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(40).regex(TAG_NAME_RE, 'Nome inválido'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida').optional(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const role = session.user.role as UserRole
  const custom = session.user.customPermissions
  if (!hasPermission(role, 'leads:view', custom) && !hasPermission(role, 'settings:view', custom)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const data = await db
    .select({ id: tags.id, name: tags.name, color: tags.color, isActive: tags.isActive })
    .from(tags)
    .orderBy(asc(tags.name))

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'settings:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const [existing] = await db.select({ id: tags.id }).from(tags).where(eq(tags.name, parsed.data.name))
  if (existing) return NextResponse.json({ error: 'Já existe uma tag com esse nome.' }, { status: 409 })

  const [created] = await db
    .insert(tags)
    .values({ name: parsed.data.name, color: parsed.data.color ?? '#00BCE4' })
    .returning({ id: tags.id, name: tags.name, color: tags.color, isActive: tags.isActive })

  return NextResponse.json({ data: created }, { status: 201 })
}
