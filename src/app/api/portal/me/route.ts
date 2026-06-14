import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patientAccessTokens, patients, appointments, treatments, examOrders, transactions } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  // Brute-force guard: the 6-digit code has only 1M combinations, so cap
  // attempts per IP. 12 / 5min makes full enumeration take ~1 year.
  const ip = getClientIp(req)
  const rl = rateLimit(`portal:${ip}`, 12, 5 * 60 * 1000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const token = req.nextUrl.searchParams.get('token')
  const code = req.nextUrl.searchParams.get('code')
  if (!token && !code) return NextResponse.json({ error: 'Token ou código requerido' }, { status: 401 })

  const conditions = [
    eq(patientAccessTokens.isActive, true),
    gt(patientAccessTokens.expiresAt, new Date()),
  ]
  if (token) {
    conditions.push(eq(patientAccessTokens.token, token))
  } else if (code) {
    conditions.push(eq(patientAccessTokens.code, code))
  }

  // Validate token/code
  const [tokenRow] = await db.select().from(patientAccessTokens)
    .where(and(...conditions))

  if (!tokenRow) return NextResponse.json({ error: 'Acesso inválido ou expirado' }, { status: 401 })

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
      dueDate: transactions.dueDate,
      isPaid: transactions.isPaid,
    }).from(transactions).where(eq(transactions.patientId, patientId)).orderBy(transactions.date).limit(50),
  ])

  return NextResponse.json({ data: { patient, appointments: appts, treatments: treats, exams, transactions: txs, token: tokenRow.token } })
}
