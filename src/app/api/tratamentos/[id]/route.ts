import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { treatments, treatmentItems, materials, stockMovements, patients, transactions } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { z } from 'zod'
import { eq, and, sql } from 'drizzle-orm'
import { sendAndLog, tplTreatmentSummary } from '@/lib/whatsapp'

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  paymentMethodId: z.string().uuid().optional().nullable(),
  discount: z.number().min(0).optional(),
  installments: z.number().int().min(1).optional(),
  notes: z.string().optional().nullable(),
  status: z.enum(['draft', 'approved', 'in_progress', 'completed', 'cancelled']).optional(),
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
  if (d.paymentMethodId !== undefined) updates.paymentMethodId = d.paymentMethodId
  if (d.discount !== undefined) {
    updates.discount = String(d.discount)
    updates.totalSale = String(Math.max(0, Number(existing.subtotal) - d.discount))
  }
  if (d.installments !== undefined) updates.installments = d.installments
  if (d.notes !== undefined) updates.notes = d.notes
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

      // Create income transaction for the treatment
      await db.insert(transactions).values({
        type: 'income',
        category: 'consultation_fee',
        amount: existing.totalSale,
        description: `Tratamento: ${existing.name}`,
        date: new Date().toISOString().split('T')[0],
        isPaid: true,
        patientId: existing.patientId,
      })

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
