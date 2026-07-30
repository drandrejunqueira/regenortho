import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { clinicalRecords, users } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { z } from 'zod'
import { eq, desc, and } from 'drizzle-orm'

const createSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional().nullable(),
  doctorId: z.string().uuid().optional().nullable(),
  type: z.string().min(1).default('evolucao'),
  content: z.string().min(1),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'patients:view_clinical', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')
  // Require a patientId. Without it the query returned the 100 most recent clinical
  // records of ANY patient (PHI leak / LGPD violation), so scope every read to one patient.
  if (!patientId) {
    return NextResponse.json({ error: 'patientId é obrigatório' }, { status: 400 })
  }

  const data = await db
    .select({
      id: clinicalRecords.id,
      type: clinicalRecords.type,
      content: clinicalRecords.content,
      createdAt: clinicalRecords.createdAt,
      doctor: { id: users.id, name: users.name },
    })
    .from(clinicalRecords)
    .leftJoin(users, eq(clinicalRecords.doctorId, users.id))
    .where(eq(clinicalRecords.patientId, patientId))
    .orderBy(desc(clinicalRecords.createdAt))
    .limit(100)

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  // Criar registro clínico exige a permissão de criação, não a de leitura.
  if (!hasPermission(session.user.role as UserRole, 'patients:create_clinical', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const [record] = await db.insert(clinicalRecords).values({
    patientId: parsed.data.patientId,
    appointmentId: parsed.data.appointmentId ?? null,
    doctorId: parsed.data.doctorId ?? null,
    type: parsed.data.type,
    content: parsed.data.content,
  }).returning()

  return NextResponse.json({ data: record }, { status: 201 })
}
