import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { getTermosAdmin, deleteTermo, createTermos, updateTermo } from '@/lib/db/queries/glossario'
import { slugify } from '@/lib/utils'
import { revalidatePath } from 'next/cache'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'settings:view', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const searchParams = req.nextUrl.searchParams
  const search = searchParams.get('search') ?? undefined
  const status = searchParams.get('status') ?? undefined
  const letra = searchParams.get('letra') ?? undefined

  try {
    const list = await getTermosAdmin({ search, status, letra })
    return NextResponse.json(list)
  } catch (error) {
    console.error('[glossario-admin-list] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch glossary terms' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'settings:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  try {
    const { termo, letra, nicho } = await req.json()
    if (!termo || !letra || !nicho) {
      return NextResponse.json({ error: 'termo, letra e nicho são obrigatórios' }, { status: 400 })
    }

    const slug = slugify(termo)
    const result = await createTermos([{
      termo,
      slug,
      letra: letra.toUpperCase(),
      nicho,
      status: 'pendente'
    }])

    if (result.length === 0) {
      return NextResponse.json({ error: 'Termo duplicado ou inválido' }, { status: 400 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[glossario-admin-create] Error:', error)
    return NextResponse.json({ error: 'Failed to create glossary term' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'settings:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  try {
    const { id, termo, nicho } = await req.json()
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
    }

    const updateData: any = {}
    if (termo !== undefined) {
      updateData.termo = termo.trim()
      updateData.slug = slugify(termo)
      updateData.letra = termo.trim().charAt(0).toUpperCase()
    }
    if (nicho !== undefined) {
      updateData.nicho = nicho.trim()
    }

    const updated = await updateTermo(id, updateData)
    revalidatePath('/sitemap.xml')
    return NextResponse.json(updated)
  } catch (error) {
    console.error('[glossario-admin-update] Error:', error)
    return NextResponse.json({ error: 'Failed to update glossary term' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'settings:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

    await deleteTermo(id)
    revalidatePath('/sitemap.xml')
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[glossario-admin-delete] Error:', error)
    return NextResponse.json({ error: 'Failed to delete glossary term' }, { status: 500 })
  }
}
