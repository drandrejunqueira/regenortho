import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { and, ilike, or, eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'

const createSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  phone: z.string().min(8, 'Telefone inválido'),
  email: z.string().email().nullable().optional(),
  cpf: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  insurance: z.string().nullable().optional(),
  insuranceNum: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'patients:view')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const offset = (page - 1) * limit

  const conditions = []
  if (search) {
    conditions.push(or(
      ilike(patients.name, `%${search}%`),
      ilike(patients.phone, `%${search}%`),
      ilike(patients.cpf, `%${search}%`),
    ))
  }

  const data = await db.query.patients.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: [desc(patients.createdAt)],
    limit,
    offset,
  })

  return NextResponse.json({ data, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'patients:create')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const [patient] = await db.insert(patients).values(parsed.data).returning()
  return NextResponse.json({ data: patient }, { status: 201 })
}
