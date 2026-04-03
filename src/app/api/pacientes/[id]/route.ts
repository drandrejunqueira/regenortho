import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(8).optional(),
  email: z.string().email().nullable().optional(),
  cpf: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  insurance: z.string().nullable().optional(),
  insuranceNum: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  nps: z.number().min(0).max(10).nullable().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'patients:view')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, id),
    with: {
      appointments: {
        orderBy: (a, { desc }) => [desc(a.startAt)],
        with: { doctor: { columns: { id: true, name: true } } },
        limit: 20,
      },
      transactions: {
        orderBy: (t, { desc }) => [desc(t.date)],
        limit: 20,
      },
      clinicalRecords: {
        orderBy: (r, { desc }) => [desc(r.createdAt)],
        limit: 20,
      },
    },
  })

  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  // Filtrar dados sensíveis por permissão
  const role = session.user.role as UserRole
  const result = {
    ...patient,
    clinicalRecords: hasPermission(role, 'patients:view_clinical') ? patient.clinicalRecords : [],
    transactions: hasPermission(role, 'financial:view') ? patient.transactions : [],
  }

  return NextResponse.json({ data: result })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'patients:edit')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const [updated] = await db.update(patients)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(patients.id, id))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })
  return NextResponse.json({ data: updated })
}
