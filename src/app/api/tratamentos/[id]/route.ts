import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { treatments, treatmentItems, materials, stockMovements, patients, transactions } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { z } from 'zod'
import { eq, and, sql } from 'drizzle-orm'
import { sendAndLog, tplTreatmentSummary } from '@/lib/whatsapp'

const itemSchema = z.object({
  type: z.enum(['procedure', 'material', 'fee']),
  materialId: z.string().uuid().optional().nullable(),
  description: z.string().min(1).max(255),
  quantity: z.number().min(0.001),
  unitCost: z.number().min(0),
  unitPrice: z.number().min(0),
  sortOrder: z.number().int().min(0),
})

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.enum(['consultation_fee','prp_procedure','bmac_procedure','hyaluronic_procedure','surgery_fee','other_income']).optional(),
  paymentMethodId: z.string().uuid().optional().nullable(),
  discount: z.number().min(0).optional(),
  installments: z.number().int().min(1).optional(),
  notes: z.string().optional().nullable(),
  cancelReason: z.string().optional().nullable(),
  status: z.enum(['draft', 'approved', 'in_progress', 'completed', 'cancelled']).optional(),
  paymentStatus: z.enum(['pending', 'first_paid', 'all_paid']).optional(),
  items: z.array(itemSchema).min(1).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'treatments:view')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const [treatment] = await db.select().from(treatments).where(eq(treatments.id, id))
  if (!treatment) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const items = await db.select().from(treatmentItems).where(eq(treatmentItems.treatmentId, id)).orderBy(treatmentItems.sortOrder)

  return NextResponse.json({ data: { ...treatment, items } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'treatments:edit')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const [existing] = await db.select().from(treatments).where(eq(treatments.id, id))
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  const d = parsed.data
  if (d.name !== undefined) updates.name = d.name
  if (d.category !== undefined) updates.category = d.category
  if (d.paymentMethodId !== undefined) updates.paymentMethodId = d.paymentMethodId
  if (d.notes !== undefined) updates.notes = d.notes
  if (d.cancelReason !== undefined) updates.cancelReason = d.cancelReason

  // Recalculate when items are replaced
  let newSubtotal = Number(existing.subtotal)
  let newTotalCost = Number(existing.totalCost)
  if (d.items !== undefined) {
    await db.delete(treatmentItems).where(eq(treatmentItems.treatmentId, id))
    if (d.items.length > 0) {
      await db.insert(treatmentItems).values(
        d.items.map((it, i) => ({
          treatmentId: id,
          type: it.type,
          materialId: it.materialId ?? null,
          description: it.description,
          quantity: String(it.quantity),
          unitCost: String(it.unitCost),
          unitPrice: String(it.unitPrice),
          sortOrder: it.sortOrder ?? i,
        }))
      )
    }
    newSubtotal = d.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
    newTotalCost = d.items.reduce((s, it) => s + it.quantity * it.unitCost, 0)
    updates.subtotal = String(newSubtotal)
    updates.totalCost = String(newTotalCost)
  }

  const effectiveSubtotal = d.items !== undefined ? newSubtotal : Number(existing.subtotal)
  const effectiveDiscount = d.discount !== undefined ? d.discount : Number(existing.discount)
  if (d.discount !== undefined || d.items !== undefined) {
    updates.discount = String(effectiveDiscount)
    updates.totalSale = String(Math.max(0, effectiveSubtotal - effectiveDiscount))
  }

  if (d.installments !== undefined) updates.installments = d.installments
  if (d.status !== undefined) {
    updates.status = d.status
    if (d.status === 'completed' && existing.status !== 'completed') {
      updates.completedAt = new Date()
      // Deduct materials from stock
      const items = await db.select().from(treatmentItems)
        .where(and(eq(treatmentItems.treatmentId, id), eq(treatmentItems.type, 'material')))

      for (const item of items) {
        if (item.materialId) {
          const qty = Math.round(Number(item.quantity))
          // Atomic decrement using sql tag to avoid injection
          await db.update(materials)
            .set({ currentStock: sql`GREATEST(0, current_stock - ${qty})` })
            .where(eq(materials.id, item.materialId))
          await db.insert(stockMovements).values({
            materialId: item.materialId,
            type: 'out',
            quantity: -qty,
            reason: `Tratamento: ${existing.name}`,
            userId: session.user.id,
          })
        }
      }

      // Lança o financeiro: divide o valor de venda em parcelas (recebimentos
      // futuros), com vencimento mensal a partir da conclusão. Cada parcela fica
      // como "a receber" (isPaid=false) para o financeiro baixar conforme entra.
      const n = Math.max(1, d.installments !== undefined ? d.installments : existing.installments)
      const totalSaleVal = d.discount !== undefined ? Math.max(0, Number(existing.subtotal) - d.discount) : Number(existing.totalSale)
      const totalCents = Math.round(totalSaleVal * 100)
      const baseCents = Math.floor(totalCents / n)
      const today = new Date()
      const fmt = (dt: Date) => dt.toISOString().split('T')[0]
      const paymentStatus = d.paymentStatus ?? 'pending'

      const rows = Array.from({ length: n }, (_, i) => {
        // a última parcela absorve o arredondamento
        const cents = i === n - 1 ? totalCents - baseCents * (n - 1) : baseCents
        const due = new Date(today.getFullYear(), today.getMonth() + i, today.getDate())
        const isPaid = paymentStatus === 'all_paid' || (paymentStatus === 'first_paid' && i === 0)
        return {
          type: 'income' as const,
          category: existing.category,
          amount: (cents / 100).toFixed(2),
          description: n > 1
            ? `Tratamento: ${existing.name} (${i + 1}/${n})`
            : `Tratamento: ${existing.name}`,
          date: fmt(today),
          dueDate: fmt(due),
          isPaid,
          paidAt: isPaid ? today : null,
          patientId: existing.patientId,
          appointmentId: existing.appointmentId,
          treatmentId: existing.id,
          installmentNumber: i + 1,
          installmentTotal: n,
          createdById: session.user.id,
        }
      })
      await db.insert(transactions).values(rows)

      // Send WhatsApp summary if patient has phone
      try {
        const [patient] = await db.select({ name: patients.name, phone: patients.phone }).from(patients).where(eq(patients.id, existing.patientId))
        if (patient?.phone) {
          const msg = tplTreatmentSummary(patient.name, existing.name, existing.totalSale, existing.installments)
          await sendAndLog('treatment_summary', patient.phone, msg, { patientId: existing.patientId })
        }
      } catch { /* non-blocking */ }
    }
  }

  const [updated] = await db.update(treatments).set(updates).where(eq(treatments.id, id)).returning()
  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'treatments:delete')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const [existing] = await db.select().from(treatments).where(eq(treatments.id, id))
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  if (!['draft', 'cancelled'].includes(existing.status)) {
    return NextResponse.json({ error: 'Apenas tratamentos em rascunho ou cancelados podem ser excluídos' }, { status: 400 })
  }

  await db.delete(treatments).where(eq(treatments.id, id))
  return NextResponse.json({ ok: true })
}
