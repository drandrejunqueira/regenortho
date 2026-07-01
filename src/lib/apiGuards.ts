// Shared API guard for WhatsApp settings routes. Same auth/permission check used
// by the existing api/whatsapp/test route, factored to avoid repetition.
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'

type GuardResult = { ok: true } | { ok: false; res: NextResponse }

export async function requireSettingsEdit(): Promise<GuardResult> {
  const session = await auth()
  if (!session) return { ok: false, res: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  if (!hasPermission(session.user.role as UserRole, 'settings:edit')) {
    return { ok: false, res: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) }
  }
  return { ok: true }
}
