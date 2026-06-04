import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { treatmentTemplates, treatmentTemplateItems, materials } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { z } from 'zod'
import { eq, inArray } from 'drizzle-orm'

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

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  category: z.enum(CATEGORIES).optional(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  items: z.array(itemSchema).optional(),
})

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'treatments:view')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params
  const [tpl] = await db.select().from(treatmentTemplates).where(eq(treatmentTemplates.id, id))
  if (!tpl) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  const items = await db.select().from(treatmentTemplateItems)
    .where(eq(treatmentTemplateItems.templateId, id)).orderBy(treatmentTemplateItems.sortOrder)
  return NextResponse.json({ data: { ...tpl, items } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'treatments:edit')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params
  const [existing] = await db.select().from(treatmentTemplates).where(eq(treatmentTemplates.id, id))
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const parsed = updateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const d = parsed.data

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (d.name !== undefined) updates.name = d.name
  if (d.description !== undefined) updates.description = d.description
  if (d.category !== undefined) updates.category = d.category
  if (d.notes !== undefined) updates.notes = d.notes
  if (d.isActive !== undefined) updates.isActive = d.isActive

  // Substitui itens quando enviados, recalculando os totais
  if (d.items !== undefined) {
    const { defaultPrice, estimatedCost } = await computeTotals(d.items)
    updates.defaultPrice = String(defaultPrice)
    updates.estimatedCost = String(estimatedCost)
    await db.delete(treatmentTemplateItems).where(eq(treatmentTemplateItems.templateId, id))
    if (d.items.length) {
      await db.insert(treatmentTemplateItems).values(
        d.items.map((it, i) => ({
          templateId: id,
          type: it.type,
          materialId: it.materialId ?? null,
          description: it.description,
          quantity: String(it.quantity),
          unitPrice: String(it.unitPrice),
          sortOrder: it.sortOrder ?? i,
        }))
      )
    }
  }

  const [updated] = await db.update(treatmentTemplates).set(updates).where(eq(treatmentTemplates.id, id)).returning()
  const items = await db.select().from(treatmentTemplateItems)
    .where(eq(treatmentTemplateItems.templateId, id)).orderBy(treatmentTemplateItems.sortOrder)
  return NextResponse.json({ data: { ...updated, items } })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'treatments:delete')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params
  const [existing] = await db.select().from(treatmentTemplates).where(eq(treatmentTemplates.id, id))
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  // Soft delete: inativa em vez de apagar (preserva histórico de tratamentos que usaram o modelo)
  await db.update(treatmentTemplates).set({ isActive: false, updatedAt: new Date() }).where(eq(treatmentTemplates.id, id))
  return NextResponse.json({ ok: true })
}
