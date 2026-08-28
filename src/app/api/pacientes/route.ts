import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { toDateBR } from '@/lib/utils'
import { patients } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { logActivity } from '@/lib/db/logger'
import { NextRequest, NextResponse } from 'next/server'
import { and, ilike, or, eq, desc, inArray, lt, gte, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

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
  photoUrl: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'patients:view', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const treatment = searchParams.get('treatment')
  const financialStatus = searchParams.get('financialStatus')
  // `page`/`limit` são entrada crua: sem sanitizar, `?limit=999999` carrega a
  // base inteira (com os `with:` junto), `?limit=abc` vira NaN e `?page=0`
  // produz offset negativo. Teto de 100 segue /api/tratamentos.
  const rawPage = Math.trunc(Number(searchParams.get('page')))
  const rawLimit = Math.trunc(Number(searchParams.get('limit')))
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE
  const offset = (page - 1) * limit

  const conditions = []
  if (search) {
    conditions.push(or(
      ilike(patients.name, `%${search}%`),
      ilike(patients.phone, `%${search}%`),
      ilike(patients.cpf, `%${search}%`),
    ))
  }

  if (treatment) {
    const { treatments } = await import('@/lib/db/schema')
    const subquery = db
      .select({ patientId: treatments.patientId })
      .from(treatments)
      .where(ilike(treatments.name, `%${treatment}%`))
    
    conditions.push(inArray(patients.id, subquery))
  }

  if (financialStatus) {
    const { transactions } = await import('@/lib/db/schema')
    const todayStr = toDateBR()
    
    if (financialStatus === 'devendo') {
      const subquery = db
        .select({ patientId: transactions.patientId })
        .from(transactions)
        .where(
          and(
            eq(transactions.type, 'income'),
            eq(transactions.isPaid, false),
            lt(transactions.dueDate, todayStr)
          )
        )
      conditions.push(inArray(patients.id, subquery))
    } else if (financialStatus === 'a_vencer') {
      const subquery = db
        .select({ patientId: transactions.patientId })
        .from(transactions)
        .where(
          and(
            eq(transactions.type, 'income'),
            eq(transactions.isPaid, false),
            gte(transactions.dueDate, todayStr)
          )
        )
      conditions.push(inArray(patients.id, subquery))
    }
  }

  const data = await db.query.patients.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: [desc(patients.createdAt)],
    limit,
    offset,
    with: {
      appointments: {
        columns: { id: true, startAt: true, endAt: true, status: true, type: true },
        orderBy: (a, { desc }) => [desc(a.startAt)],
        limit: 5,
      },
      treatments: {
        columns: { id: true, name: true, totalSale: true, status: true },
        limit: 5,
      },
      transactions: {
        columns: { id: true, amount: true, isPaid: true, dueDate: true, type: true },
      }
    }
  })

  return NextResponse.json({ data, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'patients:create', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  // Deduplicação por telefone: a tabela `patients` não tem nenhuma constraint UNIQUE,
  // então nada no banco impede que a mesma pessoa (landing page hoje, WhatsApp amanhã)
  // ganhe dois prontuários — e prontuário duplicado racha histórico clínico e
  // financeiro em dois. Comparamos só os dígitos, porque '(12) 98176-7896' e
  // '12981767896' são o mesmo número. Mesmo padrão do POST /api/usuarios, que já
  // devolve 409 para e-mail repetido.
  const phoneDigits = parsed.data.phone.replace(/\D/g, '')
  if (phoneDigits.length >= 8) {
    const [duplicate] = await db
      .select()
      .from(patients)
      .where(sql`regexp_replace(${patients.phone}, '[^0-9]', '', 'g') = ${phoneDigits}`)
      .limit(1)

    if (duplicate) {
      // A ficha existente vai junto para a tela poder oferecer "usar esta ficha"
      // em vez de forçar o usuário a procurar o cadastro na mão.
      return NextResponse.json(
        { error: 'Já existe um paciente cadastrado com este telefone', data: duplicate },
        { status: 409 },
      )
    }
  }

  const [patient] = await db.insert(patients).values(parsed.data).returning()

  // Registra no log de auditoria
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
  await logActivity({
    userId: session.user.id,
    userName: session.user.name || session.user.email || null,
    action: 'patient:create',
    module: 'patients',
    targetId: patient.id,
    targetName: patient.name,
    ip,
    details: {
      email: patient.email,
      phone: patient.phone
    }
  })

  return NextResponse.json({ data: patient }, { status: 201 })
}
