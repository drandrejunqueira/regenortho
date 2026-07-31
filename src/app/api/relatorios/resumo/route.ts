import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { leads, transactions } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextResponse } from 'next/server'
import { and, eq, gte, sql } from 'drizzle-orm'
import type { UserRole } from '@/types'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const JANELA_MESES = 6

/** Rótulos dos últimos N meses, do mais antigo para o mais recente. */
function ultimosMeses(n: number): { chave: string; rotulo: string }[] {
  const hoje = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - (n - 1 - i), 1)
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { chave, rotulo: MESES_ABREV[d.getMonth()] }
  })
}

/**
 * Séries reais para as abas Geral / Leads / Financeiro dos Relatórios, que
 * antes renderizavam constantes inventadas no código.
 */
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const role = session.user.role as UserRole
  const custom = session.user.customPermissions
  if (!hasPermission(role, 'reports:view', custom)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const meses = ultimosMeses(JANELA_MESES)
  const desde = new Date()
  desde.setMonth(desde.getMonth() - (JANELA_MESES - 1))
  desde.setDate(1)
  desde.setHours(0, 0, 0, 0)
  const desdeISO = desde.toISOString().slice(0, 10)

  // Faturamento só é devolvido para quem pode ver financeiro.
  const podeVerFinanceiro = hasPermission(role, 'financial:view', custom)

  const [porMesLeads, porOrigem, porMesReceita] = await Promise.all([
    db
      .select({
        chave: sql<string>`to_char(${leads.createdAt}, 'YYYY-MM')`,
        total: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(gte(leads.createdAt, desde))
      .groupBy(sql`to_char(${leads.createdAt}, 'YYYY-MM')`),

    db
      .select({ origem: leads.source, total: sql<number>`count(*)::int` })
      .from(leads)
      .groupBy(leads.source),

    podeVerFinanceiro
      ? db
          .select({
            chave: sql<string>`to_char(${transactions.date}::date, 'YYYY-MM')`,
            total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
          })
          .from(transactions)
          .where(and(
            eq(transactions.type, 'income'),
            // Só o que entrou: mesmo critério do dashboard e do DRE.
            eq(transactions.isPaid, true),
            gte(sql`${transactions.date}::date`, sql`${desdeISO}::date`),
          ))
          .groupBy(sql`to_char(${transactions.date}::date, 'YYYY-MM')`)
      : Promise.resolve([] as { chave: string; total: string }[]),
  ])

  const mapaLeads = new Map(porMesLeads.map((r) => [r.chave, r.total]))
  const mapaReceita = new Map(porMesReceita.map((r) => [r.chave, Number(r.total)]))

  return NextResponse.json({
    leadsMensal: meses.map((m) => ({ mes: m.rotulo, leads: mapaLeads.get(m.chave) ?? 0 })),
    faturamentoMensal: podeVerFinanceiro
      ? meses.map((m) => ({ mes: m.rotulo, valor: mapaReceita.get(m.chave) ?? 0 }))
      : null,
    origemLeads: porOrigem
      .filter((o) => o.total > 0)
      .sort((a, b) => b.total - a.total)
      .map((o) => ({ origem: o.origem, value: o.total })),
  })
}
