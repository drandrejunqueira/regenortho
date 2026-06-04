import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth/config'
import { googleConfigurado } from '@/lib/google/oauth'
import { gerarUrlConsentimentoCalendar } from '@/lib/google/calendar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.redirect(new URL('/login', request.nextUrl.origin))
  }
  if (!(await googleConfigurado())) {
    return NextResponse.redirect(new URL('/agenda?gcal=sem_credenciais', request.nextUrl.origin))
  }
  const url = await gerarUrlConsentimentoCalendar(request.nextUrl.origin, sessao.user.id)
  return NextResponse.redirect(url)
}
