import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { examOrders, patients, users } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'

const examItemSchema = z.object({
  name: z.string().min(1),
  tuss_code: z.string().optional(),
  laterality: z.string().optional(),
  prep_instructions: z.string().optional(),
})

const createSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional().nullable(),
  doctorId: z.string().uuid().optional().nullable(),
  exams: z.array(examItemSchema).min(1),
  hypothesis: z.string().optional().nullable(),
  cid10: z.string().max(10).optional().nullable(),
  urgency: z.enum(['routine', 'urgent', 'emergency']).default('routine'),
  validUntil: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'exams:view')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const url = new URL(req.url)
  const patientId = url.searchParams.get('patientId')

  const query = db
    .select({
      id: examOrders.id,
      exams: examOrders.exams,
      hypothesis: examOrders.hypothesis,
      cid10: examOrders.cid10,
      urgency: examOrders.urgency,
      status: examOrders.status,
      resultUrl: examOrders.resultUrl,
      resultDate: examOrders.resultDate,
      validUntil: examOrders.validUntil,
      notes: examOrders.notes,
      createdAt: examOrders.createdAt,
      patient: { id: patients.id, name: patients.name },
      doctor: { id: users.id, name: users.name },
    })
    .from(examOrders)
    .leftJoin(patients, eq(examOrders.patientId, patients.id))
    .leftJoin(users, eq(examOrders.doctorId, users.id))
    .orderBy(desc(examOrders.createdAt))
    .limit(100)

  const data = patientId
    ? await query.where(eq(examOrders.patientId, patientId))
    : await query

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'exams:create')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data
  const [order] = await db.insert(examOrders).values({
    patientId: d.patientId,
    appointmentId: d.appointmentId ?? null,
    doctorId: d.doctorId ?? (session.user.role === 'doctor' ? session.user.id : null),
    exams: d.exams,
    hypothesis: d.hypothesis ?? null,
    cid10: d.cid10 ?? null,
    urgency: d.urgency,
    validUntil: d.validUntil ?? null,
    notes: d.notes ?? null,
  }).returning()

  return NextResponse.json({ data: order }, { status: 201 })
}
