import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { logActivity } from '@/lib/db/logger'
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
  photoUrl: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
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
      leads: {
        orderBy: (l, { desc }) => [desc(l.createdAt)],
        limit: 5,
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
    leads: patient.leads || [],
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

  // Registra no log de auditoria
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
  await logActivity({
    userId: session.user.id,
    userName: session.user.name || session.user.email || null,
    action: 'patient:edit',
    module: 'patients',
    targetId: updated.id,
    targetName: updated.name,
    ip,
    details: {
      name: updated.name,
      phone: updated.phone
    }
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'patients:delete')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  // Agendamentos, tratamentos, prontuários e lançamentos referenciam o paciente
  // sem cascata: se houver histórico, a FK bloqueia a exclusão. Nesse caso o
  // caminho correto é inativar, preservando o histórico clínico e financeiro.
  let deleted
  try {
    ;[deleted] = await db.delete(patients).where(eq(patients.id, id)).returning()
  } catch (error) {
    console.error('Erro ao excluir paciente:', error)
    return NextResponse.json(
      {
        error:
          'Este paciente possui histórico (agendamentos, tratamentos, prontuários ou lançamentos) e não pode ser excluído. Inative-o para ocultá-lo da lista.',
      },
      { status: 409 }
    )
  }

  if (!deleted) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
  await logActivity({
    userId: session.user.id,
    userName: session.user.name || session.user.email || null,
    action: 'patient:delete',
    module: 'patients',
    targetId: deleted.id,
    targetName: deleted.name,
    ip,
    details: { name: deleted.name, phone: deleted.phone },
  })

  return NextResponse.json({ success: true })
}
