import { NextRequest, NextResponse } from 'next/server'
import { requireSettingsEdit } from '@/lib/apiGuards'
import { evoFetch } from '@/lib/evolution'

export const runtime = 'nodejs'

// Connection state (open / connecting / close).
export async function GET(_req: NextRequest, { params }: { params: { name: string } }) {
  const guard = await requireSettingsEdit()
  if (!guard.ok) return guard.res

  try {
    const resp = await evoFetch(`/instance/connectionState/${encodeURIComponent(params.name)}`)
    return NextResponse.json(resp)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 502 })
  }
}
