import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { treatments, treatmentItems, patients, users, paymentMethods } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { z } from 'zod'
import { eq, desc, sql, inArray } from 'drizzle-orm'

const itemSchema = z.object({
  type: z.enum(['procedure', 'material', 'fee']),
  materialId: z.string().uuid().optional().nullable(),
  description: z.string().min(1),
  quantity: z.number().positive().default(1),
  unitCost: z.number().min(0).default(0),
  unitPrice: z.number().min(0).default(0),
  sortOrder: z.number().int().default(0),
})

const CATEGORIES = [
  'consultation_fee', 'prp_procedure', 'bmac_procedure', 'hyaluronic_procedure',
  'surgery_fee', 'other_income', 'rent', 'staff', 'marketing', 'materials',
  'equipment', 'utilities', 'insurance', 'accounting', 'other_expense',
] as const

const createSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional().nullable(),
  doctorId: z.string().uuid().optional().nullable(),
  paymentMethodId: z.string().uuid().optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
  category: z.enum(CATEGORIES).default('consultation_fee'),
  name: z.string().min(1).max(255),
  discount: z.number().min(0).default(0),
  installments: z.number().int().min(1).default(1),
  notes: z.string().optional().nullable(),
  items: z.array(itemSchema).default([]),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'treatments:view')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const url = new URL(req.url)
  const patientId = url.searchParams.get('patientId')
  const status = url.searchParams.get('status')
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 100)

  const query = db
    .select({
      id: treatments.id,
      name: treatments.name,
      status: treatments.status,
      subtotal: treatments.subtotal,
      discount: treatments.discount,
      totalSale: treatments.totalSale,
      totalCost: treatments.totalCost,
      installments: treatments.installments,
      notes: treatments.notes,
      completedAt: treatments.completedAt,
      createdAt: treatments.createdAt,
      updatedAt: treatments.updatedAt,
      patient: { id: patients.id, name: patients.name },
      doctor: { id: users.id, name: users.name },
      paymentMethod: { id: paymentMethods.id, name: paymentMethods.name, type: paymentMethods.type },
    })
    .from(treatments)
    .leftJoin(patients, eq(treatments.patientId, patients.id))
    .leftJoin(users, eq(treatments.doctorId, users.id))
    .leftJoin(paymentMethods, eq(treatments.paymentMethodId, paymentMethods.id))
    .orderBy(desc(treatments.createdAt))
    .limit(limit)

  // Apply filters
  const VALID_STATUSES = ['draft', 'approved', 'in_progress', 'completed', 'cancelled'] as const
  type TreatmentStatus = typeof VALID_STATUSES[number]

  const data = await (() => {
    if (patientId && status && VALID_STATUSES.includes(status as TreatmentStatus)) {
      return query.where(sql`${treatments.patientId} = ${patientId} AND ${treatments.status} = ${status}`)
    } else if (patientId) {
      return query.where(eq(treatments.patientId, patientId))
    } else if (status && VALID_STATUSES.includes(status as TreatmentStatus)) {
      return query.where(eq(treatments.status, status as TreatmentStatus))
    }
    return query
  })()

  // Fetch items for returned treatments
  const ids = (data as Array<{ id: string }>).map(t => t.id)
  const items = ids.length > 0
    ? await db.select().from(treatmentItems).where(inArray(treatmentItems.treatmentId, ids)).orderBy(treatmentItems.sortOrder)
    : []

  const itemsMap = items.reduce((map, item) => {
    if (!map[item.treatmentId]) map[item.treatmentId] = []
    map[item.treatmentId].push(item)
    return map
  }, {} as Record<string, typeof items>)

  return NextResponse.json({
    data: (data as Array<{ id: string }>).map(t => ({ ...t, items: itemsMap[t.id] ?? [] })),
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'treatments:create')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data

  // Calculate totals
  const itemsWithTotals = d.items.map(item => ({
    ...item,
    total: item.quantity * item.unitPrice,
  }))
  const subtotal = itemsWithTotals.reduce((sum, i) => sum + i.total, 0)
  const totalSale = Math.max(0, subtotal - d.discount)
  const totalCost = itemsWithTotals.reduce((sum, i) => sum + i.quantity * i.unitCost, 0)

  const [treatment] = await db.insert(treatments).values({
    patientId: d.patientId,
    appointmentId: d.appointmentId ?? null,
    doctorId: d.doctorId ?? null,
    paymentMethodId: d.paymentMethodId ?? null,
    templateId: d.templateId ?? null,
    category: d.category,
    name: d.name,
    status: 'draft',
    subtotal: String(subtotal),
    discount: String(d.discount),
    totalSale: String(totalSale),
    totalCost: String(totalCost),
    installments: d.installments,
    notes: d.notes ?? null,
    createdById: session.user.id,
  }).returning()

  const insertedItems = await db.insert(treatmentItems).values(
    itemsWithTotals.map((item, i) => ({
      treatmentId: treatment.id,
      type: item.type,
      materialId: item.materialId ?? null,
      description: item.description,
      quantity: String(item.quantity),
      unitCost: String(item.unitCost),
      unitPrice: String(item.unitPrice),
      total: String(item.total),
      sortOrder: item.sortOrder ?? i,
    }))
  ).returning()

  return NextResponse.json({ data: { ...treatment, items: insertedItems } }, { status: 201 })
}
