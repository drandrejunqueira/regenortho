import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { clinicSettings, leads } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import type { UserRole } from '@/types'
import { parseLeadPeriod } from '@/lib/leadPeriod'
import { isLeadChannel, LEAD_CHANNEL_SOURCES } from '@/lib/leadChannels'
import {
  buildLeadReport,
  previousRange,
  rangeBounds,
  resolveReportRange,
  type ReportRange,
} from '@/lib/leadReport'

/**
 * Relatório de captação para mandar ao cliente: quantos leads chegaram no
 * período, por canal, e o que viraram. Mesma permissão do CRM — é o mesmo dado,
 * só que agregado.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'leads:view', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const period = parseLeadPeriod(searchParams.get('period'), '30d')
  const resolved = resolveReportRange(period, searchParams.get('from'), searchParams.get('to'))
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 })

  const rawChannel = searchParams.get('channel')
  const channel = isLeadChannel(rawChannel) ? rawChannel : null
  const channelCond = channel
    ? inArray(leads.source, [...LEAD_CHANNEL_SOURCES[channel]])
    : undefined

  const within = (range: ReportRange) => {
    const { start, end } = rangeBounds(range)
    return and(gte(leads.createdAt, start), lte(leads.createdAt, end), channelCond)
  }

  const range = resolved.range
  const [rows, [prev], [clinic]] = await Promise.all([
    db
      .select({
        source: leads.source,
        status: leads.status,
        createdAt: leads.createdAt,
        specialty: leads.specialty,
      })
      .from(leads)
      .where(within(range)),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(leads)
      .where(within(previousRange(range))),
    db.select({ name: clinicSettings.name }).from(clinicSettings).where(eq(clinicSettings.id, 1)),
  ])

  return NextResponse.json({
    data: buildLeadReport(rows, range, prev?.total ?? 0, channel),
    meta: { period, clinicName: clinic?.name || 'Clínica', generatedAt: new Date().toISOString() },
  })
}
