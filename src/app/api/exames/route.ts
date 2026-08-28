import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { examOrders, patients, users } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { logActivity } from '@/lib/db/logger'
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
  if (!hasPermission(session.user.role as UserRole, 'exams:view', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const url = new URL(req.url)
  const patientId = url.searchParams.get('patientId')
  // Exige patientId. Sem ele a listagem devolvia os 100 pedidos mais recentes de QUALQUER
  // paciente, com hipótese diagnóstica e CID-10 (vazamento de PHI / violação de LGPD) —
  // ainda mais grave porque 'exams:view' está no preset da recepção. Toda leitura fica
  // restrita a um paciente.
  if (!patientId) {
    return NextResponse.json({ error: 'patientId é obrigatório' }, { status: 400 })
  }

  const data = await db
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
    .where(eq(examOrders.patientId, patientId))
    .orderBy(desc(examOrders.createdAt))
    .limit(100)

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'exams:create', session.user.customPermissions)) {
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

  // Registra no log de auditoria. `details` guarda só o que identifica o pedido — hipótese
  // e CID-10 ficam fora para não replicar dado clínico numa tabela de acesso mais amplo.
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
  await logActivity({
    userId: session.user.id,
    userName: session.user.name || session.user.email || null,
    action: 'exame:create',
    module: 'exames',
    targetId: order.id,
    targetName: d.exams.map(e => e.name).join(', '),
    ip,
    details: {
      patientId: order.patientId,
      urgency: order.urgency,
      examCount: d.exams.length
    }
  })

  return NextResponse.json({ data: order }, { status: 201 })
}
