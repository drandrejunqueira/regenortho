import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { and, desc, inArray, sql } from 'drizzle-orm'
import { hasPermission, type Permission } from '@/lib/permissions'
import type { UserRole } from '@/types'

const FEED_LIMIT = 30

// Cada tipo de aviso carrega dado do seu módulo (nome e telefone de paciente,
// valor de tratamento). Só entrega para quem já pode ver aquele módulo.
const TIPO_EXIGE: Record<string, Permission> = {
  lead_new: 'leads:view',
  appointment_new: 'agenda:view',
  appointment_cancelled: 'agenda:view',
  treatment_new: 'treatments:view',
  treatment_status: 'treatments:view',
  stock_low: 'materials:view',
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const userId = session.user.id
  const role = session.user.role as UserRole
  const custom = session.user.customPermissions

  // 'system' não tem módulo e vale para todo mundo.
  const tiposPermitidos = ['system', ...Object.keys(TIPO_EXIGE).filter((tipo) =>
    hasPermission(role, TIPO_EXIGE[tipo], custom)
  )]

  const visiveis = inArray(notifications.type, tiposPermitidos)
  const readByMe = sql`${notifications.readBy} @> ${JSON.stringify([userId])}::jsonb`

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        link: notifications.link,
        priority: notifications.priority,
        createdAt: notifications.createdAt,
        isRead: readByMe,
      })
      .from(notifications)
      .where(visiveis)
      .orderBy(desc(notifications.createdAt))
      .limit(FEED_LIMIT),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(visiveis, sql`NOT ${readByMe}`)),
  ])

  return NextResponse.json({ data: rows, unreadCount: count })
}
