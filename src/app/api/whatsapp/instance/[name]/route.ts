import { NextRequest, NextResponse } from 'next/server'
import { requireSettingsEdit } from '@/lib/apiGuards'
import { evoFetch } from '@/lib/evolution'

export const runtime = 'nodejs'

// Remove the instance (logout first, ignoring the error if already disconnected).
export async function DELETE(_req: NextRequest, { params }: { params: { name: string } }) {
  const guard = await requireSettingsEdit()
  if (!guard.ok) return guard.res

  const name = encodeURIComponent(params.name)
  try {
    await evoFetch(`/instance/logout/${name}`, { method: 'DELETE' }).catch(() => undefined)
    const resp = await evoFetch(`/instance/delete/${name}`, { method: 'DELETE' })
    return NextResponse.json(resp)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 502 })
  }
}
