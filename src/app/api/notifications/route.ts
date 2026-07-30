import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { desc, sql } from 'drizzle-orm'

const FEED_LIMIT = 30

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const userId = session.user.id
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
      .orderBy(desc(notifications.createdAt))
      .limit(FEED_LIMIT),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(sql`NOT ${readByMe}`),
  ])

  return NextResponse.json({ data: rows, unreadCount: count })
}
