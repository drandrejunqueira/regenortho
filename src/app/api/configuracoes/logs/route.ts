import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { activityLogs } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import type { UserRole } from '@/types'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'settings:view')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const logs = await db.query.activityLogs.findMany({
    orderBy: [desc(activityLogs.createdAt)],
    limit: 200,
  })

  return NextResponse.json({ data: logs })
}
