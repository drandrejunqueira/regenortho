import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { rooms } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'

const createSchema = z.object({
  name: z.string().min(1, 'Nome da sala é obrigatório'),
  color: z.string().min(4, 'Cor inválida').max(7, 'Cor inválida').default('#00BCE4'),
  isActive: z.boolean().optional().default(true),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  
  const role = session.user.role as UserRole
  if (!hasPermission(role, 'agenda:view') && !hasPermission(role, 'settings:view')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  let data = await db.query.rooms.findMany({
    orderBy: [asc(rooms.name)],
  })

  if (data.length === 0) {
    try {
      await db.insert(rooms).values([
        { name: 'Sala 1', color: '#00BCE4', isActive: true },
        { name: 'Sala 2', color: '#e6c364', isActive: true },
        { name: 'Sala 3', color: '#10b981', isActive: true },
      ])
      data = await db.query.rooms.findMany({
        orderBy: [asc(rooms.name)],
      })
    } catch (e) {
      console.error('[GET /api/rooms] seeding error:', e)
    }
  }

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'settings:edit')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const [newRoom] = await db.insert(rooms).values({
      name: parsed.data.name,
      color: parsed.data.color,
      isActive: parsed.data.isActive,
    }).returning()

    return NextResponse.json({ data: newRoom }, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/rooms] error:', err)
    return NextResponse.json({ error: 'Erro no banco de dados', details: err.message }, { status: 500 })
  }
}
