import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { leadInteractions } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { UserRole } from '@/types'

const schema = z.object({
  type: z.enum(['call', 'whatsapp', 'email', 'note']),
  content: z.string().min(1, 'Conteúdo obrigatório'),
})

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'leads:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const [interaction] = await db.insert(leadInteractions).values({
    leadId: id,
    userId: session.user.id,
    type: parsed.data.type,
    content: parsed.data.content,
  }).returning()

  return NextResponse.json({ data: interaction }, { status: 201 })
}
