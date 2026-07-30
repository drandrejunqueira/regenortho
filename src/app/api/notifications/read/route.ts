import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

const schema = z.object({
  id: z.string().uuid().optional(),
  all: z.boolean().optional(),
})

/** Marca um aviso (id) ou todos (all: true) como lidos para o usuário da sessão. */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success || (!parsed.data.id && !parsed.data.all)) {
    return NextResponse.json({ error: 'Informe id ou all' }, { status: 400 })
  }

  const userId = JSON.stringify([session.user.id])
  // Só acrescenta o usuário a read_by se ele ainda não estiver lá — o filtro
  // evita crescer o array com ids repetidos a cada clique.
  const notReadByMe = sql`NOT (${notifications.readBy} @> ${userId}::jsonb)`

  await db
    .update(notifications)
    .set({ readBy: sql`${notifications.readBy} || ${userId}::jsonb` })
    .where(
      parsed.data.id
        ? and(eq(notifications.id, parsed.data.id), notReadByMe)
        : notReadByMe
    )

  return NextResponse.json({ ok: true })
}
