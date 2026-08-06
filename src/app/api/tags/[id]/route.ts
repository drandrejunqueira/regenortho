// Edição e remoção de tag do registro.
// Renomear cascateia nos leads: `leads.tags` guarda nomes, então sem a cascata a
// marcação dos leads apontaria para um nome que não existe mais no vocabulário.
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { leads, tags } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'
import { TAG_NAME_RE } from '@/lib/promptSafety'

const updateSchema = z.object({
  name: z.string().trim().min(2).max(40).regex(TAG_NAME_RE, 'Nome inválido').optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida').optional(),
  isActive: z.boolean().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'settings:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  const parsed = updateSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const [current] = await db.select().from(tags).where(eq(tags.id, id))
  if (!current) return NextResponse.json({ error: 'Tag não encontrada' }, { status: 404 })

  const { name, color, isActive } = parsed.data

  if (name && name !== current.name) {
    const [clash] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.name, name), ne(tags.id, id)))
    if (clash) return NextResponse.json({ error: 'Já existe uma tag com esse nome.' }, { status: 409 })

    // Cascata: troca o nome antigo pelo novo dentro do array jsonb de cada lead.
    await db.execute(sql`
      UPDATE leads
      SET tags = (
        SELECT jsonb_agg(CASE WHEN t = ${current.name} THEN ${name}::text ELSE t END)
        FROM jsonb_array_elements_text(tags) AS t
      )
      WHERE tags @> ${JSON.stringify([current.name])}::jsonb
    `)
  }

  const [updated] = await db
    .update(tags)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(color !== undefined ? { color } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      updatedAt: new Date(),
    })
    .where(eq(tags.id, id))
    .returning({ id: tags.id, name: tags.name, color: tags.color, isActive: tags.isActive })

  return NextResponse.json({ data: updated })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'settings:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const { id } = await params

  const [current] = await db.select().from(tags).where(eq(tags.id, id))
  if (!current) return NextResponse.json({ error: 'Tag não encontrada' }, { status: 404 })

  // Excluir do registro não pode apagar a marcação já feita nos leads sem aviso.
  // Se estiver em uso, exige desativar (some do seletor, some do filtro, mas o
  // histórico dos leads permanece).
  const [{ usos }] = await db
    .select({ usos: sql<number>`count(*)::int` })
    .from(leads)
    .where(sql`${leads.tags} @> ${JSON.stringify([current.name])}::jsonb`)

  if (usos > 0) {
    return NextResponse.json(
      {
        error: `Esta tag está em ${usos} lead${usos === 1 ? '' : 's'}. Desative-a em vez de excluir para preservar o histórico.`,
        usos,
      },
      { status: 409 },
    )
  }

  await db.delete(tags).where(eq(tags.id, id))
  return NextResponse.json({ ok: true })
}
