import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import type { UserRole } from '@/types'

const createSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
  role: z.enum(['admin', 'receptionist', 'financial', 'doctor']),
  phone: z.string().nullable().optional(),
  googleCalendarId: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const role = session.user.role as UserRole
  const custom = session.user.customPermissions
  const soMedicos = new URL(req.url).searchParams.get('role') === 'doctor'

  // Agendar exige escolher o médico, mas recepção e o próprio médico não têm
  // users:view — o campo "Médico responsável *" ficava vazio e o agendamento
  // travava. Quem pode ver a agenda recebe apenas a lista de médicos ativos,
  // com projeção mínima (sem e-mail, telefone, papel ou permissões).
  if (soMedicos && hasPermission(role, 'agenda:view', custom)) {
    const medicos = await db.query.users.findMany({
      where: and(eq(users.role, 'doctor'), eq(users.isActive, true)),
      columns: { id: true, name: true, googleCalendarId: true },
      orderBy: [desc(users.createdAt)],
    })
    return NextResponse.json({ data: medicos })
  }

  // O CRM precisa da lista de quem pode ser responsável por um lead, mas a
  // recepção não tem users:view. Mesmo tratamento dado a ?role=doctor: quem já
  // vê leads recebe só id e nome dos usuários ativos, sem e-mail, papel ou
  // permissões.
  if (new URL(req.url).searchParams.get('assignable') === '1' && hasPermission(role, 'leads:view', custom)) {
    const atribuiveis = await db.query.users.findMany({
      where: eq(users.isActive, true),
      columns: { id: true, name: true },
      orderBy: [users.name],
    })
    return NextResponse.json({ data: atribuiveis })
  }

  if (!hasPermission(role, 'users:view', custom)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const data = await db.query.users.findMany({
    columns: { passwordHash: false },
    orderBy: [desc(users.createdAt)],
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'users:create', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email) })
  if (existing) {
    return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const [user] = await db.insert(users).values({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash,
    role: parsed.data.role,
    phone: parsed.data.phone ?? null,
    googleCalendarId: parsed.data.googleCalendarId ?? null,
  }).returning({ id: users.id, name: users.name, email: users.email, role: users.role, googleCalendarId: users.googleCalendarId, createdAt: users.createdAt })

  return NextResponse.json({ data: user }, { status: 201 })
}
