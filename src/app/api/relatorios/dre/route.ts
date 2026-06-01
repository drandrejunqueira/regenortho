import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { treatments, treatmentItems, transactions } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { eq, and, gte, lte, sql } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'reports:balancete')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const url = new URL(req.url)
  const year  = Number(url.searchParams.get('year')  ?? new Date().getFullYear())
  const month = url.searchParams.get('month') ? Number(url.searchParams.get('month')) : null

  const startDate = month
    ? new Date(year, month - 1, 1)
    : new Date(year, 0, 1)
  const endDate = month
    ? new Date(year, month, 0, 23, 59, 59)
    : new Date(year, 11, 31, 23, 59, 59)

  // Completed treatments in period
  const completedTreatments = await db.select({
    id: treatments.id,
    name: treatments.name,
    totalSale: treatments.totalSale,
    totalCost: treatments.totalCost,
    completedAt: treatments.completedAt,
  })
    .from(treatments)
    .where(and(
      eq(treatments.status, 'completed'),
      gte(treatments.completedAt, startDate),
      lte(treatments.completedAt, endDate),
    ))

  // Procedure breakdown — group by name
  const procedureMap = completedTreatments.reduce((map, t) => {
    const key = t.name
    if (!map[key]) map[key] = { name: key, count: 0, revenue: 0, cost: 0 }
    map[key].count++
    map[key].revenue += Number(t.totalSale)
    map[key].cost += Number(t.totalCost)
    return map
  }, {} as Record<string, { name: string; count: number; revenue: number; cost: number }>)

  const procedures = Object.values(procedureMap).sort((a, b) => b.revenue - a.revenue)

  // Financial transactions in period (expenses)
  const expenses = await db.select({
    category: transactions.category,
    total: sql<string>`SUM(${transactions.amount})`,
  })
    .from(transactions)
    .where(and(
      eq(transactions.type, 'expense'),
      eq(transactions.isPaid, true),
      gte(sql`${transactions.date}::date`, sql`${startDate.toISOString().substring(0, 10)}::date`),
      lte(sql`${transactions.date}::date`, sql`${endDate.toISOString().substring(0, 10)}::date`),
    ))
    .groupBy(transactions.category)

  // Other income (non-treatment)
  const otherIncome = await db.select({
    total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
  })
    .from(transactions)
    .where(and(
      eq(transactions.type, 'income'),
      eq(transactions.isPaid, true),
      gte(sql`${transactions.date}::date`, sql`${startDate.toISOString().substring(0, 10)}::date`),
      lte(sql`${transactions.date}::date`, sql`${endDate.toISOString().substring(0, 10)}::date`),
    ))

  // DRE calculations
  const receitaTratamentos = completedTreatments.reduce((s, t) => s + Number(t.totalSale), 0)
  const receitaOutras = Number(otherIncome[0]?.total ?? 0)
  const receitaBruta = receitaTratamentos + receitaOutras

  const custoMateriais = completedTreatments.reduce((s, t) => s + Number(t.totalCost), 0)
  const margemBruta = receitaBruta - custoMateriais

  const despesasTotal = expenses.reduce((s, e) => s + Number(e.total ?? 0), 0)
  const resultadoOperacional = margemBruta - despesasTotal

  // Monthly breakdown (last 12 months if no specific month)
  let monthly: Array<{ month: string; revenue: number; cost: number; expenses: number; result: number }> = []
  if (!month) {
    const monthlyTreatments = await db.select({
      month: sql<string>`TO_CHAR(${treatments.completedAt}, 'YYYY-MM')`,
      revenue: sql<string>`SUM(${treatments.totalSale})`,
      cost: sql<string>`SUM(${treatments.totalCost})`,
    })
      .from(treatments)
      .where(and(
        eq(treatments.status, 'completed'),
        gte(treatments.completedAt, startDate),
        lte(treatments.completedAt, endDate),
      ))
      .groupBy(sql`TO_CHAR(${treatments.completedAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${treatments.completedAt}, 'YYYY-MM')`)

    monthly = monthlyTreatments.map(m => ({
      month: m.month,
      revenue: Number(m.revenue ?? 0),
      cost: Number(m.cost ?? 0),
      expenses: 0,
      result: Number(m.revenue ?? 0) - Number(m.cost ?? 0),
    }))
  }

  return NextResponse.json({
    data: {
      period: { year, month, startDate, endDate },
      dre: {
        receitaTratamentos,
        receitaOutras,
        receitaBruta,
        custoMateriais,
        margemBruta,
        margemPercent: receitaBruta > 0 ? (margemBruta / receitaBruta) * 100 : 0,
        despesas: expenses.map(e => ({ category: e.category, total: Number(e.total ?? 0) })),
        despesasTotal,
        resultadoOperacional,
        resultadoPercent: receitaBruta > 0 ? (resultadoOperacional / receitaBruta) * 100 : 0,
      },
      procedures,
      monthly,
      treatmentCount: completedTreatments.length,
    },
  })
}
