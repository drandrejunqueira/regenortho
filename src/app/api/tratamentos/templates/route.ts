import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { treatmentTemplates, treatmentTemplateItems, materials } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { z } from 'zod'
import { desc, eq, inArray } from 'drizzle-orm'

const CATEGORIES = [
  'consultation_fee', 'prp_procedure', 'bmac_procedure', 'hyaluronic_procedure',
  'surgery_fee', 'other_income', 'rent', 'staff', 'marketing', 'materials',
  'equipment', 'utilities', 'insurance', 'accounting', 'other_expense',
] as const

const itemSchema = z.object({
  type: z.enum(['procedure', 'material', 'fee']),
  materialId: z.string().uuid().optional().nullable(),
  description: z.string().min(1),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().min(0).default(0),
  sortOrder: z.number().int().default(0),
})

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  category: z.enum(CATEGORIES).default('consultation_fee'),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  items: z.array(itemSchema).default([]),
})

/** Calcula preço padrão (soma dos itens) e custo estimado (materiais × custo atual). */
async function computeTotals(items: z.infer<typeof itemSchema>[]) {
  const materialIds = items.map(i => i.materialId).filter((x): x is string => Boolean(x))
  const costMap: Record<string, number> = {}
  if (materialIds.length) {
    const rows = await db.select({ id: materials.id, unitCost: materials.unitCost })
      .from(materials).where(inArray(materials.id, materialIds))
    for (const r of rows) costMap[r.id] = Number(r.unitCost ?? 0)
  }
  const defaultPrice = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const estimatedCost = items.reduce((s, i) =>
    s + (i.materialId ? i.quantity * (costMap[i.materialId] ?? 0) : 0), 0)
  return { defaultPrice, estimatedCost }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'treatments:view')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const includeInactive = new URL(req.url).searchParams.get('all') === 'true'

  const rows = await db.select().from(treatmentTemplates).orderBy(desc(treatmentTemplates.createdAt))
  const list = includeInactive ? rows : rows.filter(t => t.isActive)

  const ids = list.map(t => t.id)
  const items = ids.length
    ? await db.select().from(treatmentTemplateItems)
        .where(inArray(treatmentTemplateItems.templateId, ids))
        .orderBy(treatmentTemplateItems.sortOrder)
    : []

  const itemsMap = items.reduce((m, it) => {
    ;(m[it.templateId] ??= []).push(it)
    return m
  }, {} as Record<string, typeof items>)

  return NextResponse.json({ data: list.map(t => ({ ...t, items: itemsMap[t.id] ?? [] })) })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'treatments:create')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const d = parsed.data

  const { defaultPrice, estimatedCost } = await computeTotals(d.items)

  const [tpl] = await db.insert(treatmentTemplates).values({
    name: d.name,
    description: d.description ?? null,
    category: d.category,
    defaultPrice: String(defaultPrice),
    estimatedCost: String(estimatedCost),
    isActive: d.isActive,
    notes: d.notes ?? null,
    createdById: session.user.id,
  }).returning()

  const insertedItems = d.items.length
    ? await db.insert(treatmentTemplateItems).values(
        d.items.map((it, i) => ({
          templateId: tpl.id,
          type: it.type,
          materialId: it.materialId ?? null,
          description: it.description,
          quantity: String(it.quantity),
          unitPrice: String(it.unitPrice),
          sortOrder: it.sortOrder ?? i,
        }))
      ).returning()
    : []

  return NextResponse.json({ data: { ...tpl, items: insertedItems } }, { status: 201 })
}
