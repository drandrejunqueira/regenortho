import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { appointments } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { and, gte, lte, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'

const createSchema = z.object({
  patientId: z.string().uuid().nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  doctorId: z.string().uuid().nullable().optional(),
  type: z.enum(['consultation', 'prp', 'bmac', 'hyaluronic', 'prolotherapy', 'surgery', 'return', 'block']),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  title: z.string().optional(),
  notes: z.string().optional(),
  room: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'agenda:view')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  const conditions = []
  if (start) conditions.push(gte(appointments.startAt, new Date(start)))
  if (end) conditions.push(lte(appointments.startAt, new Date(end)))

  const data = await db.query.appointments.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: (a, { asc }) => [asc(a.startAt)],
    with: {
      patient: { columns: { id: true, name: true, phone: true } },
      lead: { columns: { id: true, name: true, phone: true } },
      doctor: { columns: { id: true, name: true } },
    },
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'agenda:create')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const [apt] = await db.insert(appointments).values({
    ...parsed.data,
    startAt: new Date(parsed.data.startAt),
    endAt: new Date(parsed.data.endAt),
    createdById: session.user.id,
  }).returning()

  return NextResponse.json({ data: apt }, { status: 201 })
}
