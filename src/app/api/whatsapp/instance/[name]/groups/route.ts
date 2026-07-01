import { NextRequest, NextResponse } from 'next/server'
import { requireSettingsEdit } from '@/lib/apiGuards'
import { fetchGroups } from '@/lib/evolution'

export const runtime = 'nodejs'

// List the groups of the connected number so the operator can pick the clinic
// group for the report/bot. Returns [{ id, subject, size }].
export async function GET(_req: NextRequest, { params }: { params: { name: string } }) {
  const guard = await requireSettingsEdit()
  if (!guard.ok) return guard.res

  try {
    const groups = await fetchGroups(params.name)
    return NextResponse.json({ groups })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 502 })
  }
}
