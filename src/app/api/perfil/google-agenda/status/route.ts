import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getCalendarStatusUsuario } from '@/lib/google/calendar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const sessao = await auth()
  if (!sessao?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const status = await getCalendarStatusUsuario(sessao.user.id)
  return NextResponse.json({ data: status })
}
