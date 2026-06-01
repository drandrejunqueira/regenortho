import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patientAccessTokens, patients, appointments, treatments, examOrders, transactions } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 401 })

  // Validate token
  const [tokenRow] = await db.select().from(patientAccessTokens)
    .where(and(
      eq(patientAccessTokens.token, token),
      eq(patientAccessTokens.isActive, true),
      gt(patientAccessTokens.expiresAt, new Date()),
    ))

  if (!tokenRow) return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 401 })

  // Update last used
  await db.update(patientAccessTokens).set({ lastUsedAt: new Date() }).where(eq(patientAccessTokens.id, tokenRow.id))

  const patientId = tokenRow.patientId

  // Fetch patient data
  const [patient] = await db.select({
    id: patients.id,
    name: patients.name,
    email: patients.email,
    phone: patients.phone,
    birthDate: patients.birthDate,
    insurance: patients.insurance,
  }).from(patients).where(eq(patients.id, patientId))

  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const [appts, treats, exams, txs] = await Promise.all([
    db.select({
      id: appointments.id,
      type: appointments.type,
      status: appointments.status,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      title: appointments.title,
      notes: appointments.notes,
    }).from(appointments).where(eq(appointments.patientId, patientId)).orderBy(appointments.startAt).limit(50),

    db.select({
      id: treatments.id,
      name: treatments.name,
      status: treatments.status,
      totalSale: treatments.totalSale,
      installments: treatments.installments,
      completedAt: treatments.completedAt,
      createdAt: treatments.createdAt,
    }).from(treatments).where(eq(treatments.patientId, patientId)).orderBy(treatments.createdAt).limit(50),

    db.select({
      id: examOrders.id,
      exams: examOrders.exams,
      urgency: examOrders.urgency,
      status: examOrders.status,
      resultUrl: examOrders.resultUrl,
      resultDate: examOrders.resultDate,
      validUntil: examOrders.validUntil,
      createdAt: examOrders.createdAt,
    }).from(examOrders).where(eq(examOrders.patientId, patientId)).orderBy(examOrders.createdAt).limit(50),

    db.select({
      id: transactions.id,
      description: transactions.description,
      amount: transactions.amount,
      type: transactions.type,
      date: transactions.date,
      isPaid: transactions.isPaid,
    }).from(transactions).where(eq(transactions.patientId, patientId)).orderBy(transactions.date).limit(50),
  ])

  return NextResponse.json({ data: { patient, appointments: appts, treatments: treats, exams, transactions: txs } })
}
