import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { desconectarCalendarUsuario } from '@/lib/google/calendar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const sessao = await auth()
  if (!sessao?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  await desconectarCalendarUsuario(sessao.user.id)
  return NextResponse.json({ ok: true })
}
