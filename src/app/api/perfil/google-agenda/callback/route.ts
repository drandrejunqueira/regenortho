import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth/config'
import { conectarCalendarUsuario } from '@/lib/google/calendar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.redirect(new URL('/login', request.nextUrl.origin))
  }

  const origin = request.nextUrl.origin
  const erro = request.nextUrl.searchParams.get('error')
  if (erro) {
    return NextResponse.redirect(new URL(`/agenda?gcal=erro&motivo=${encodeURIComponent(erro)}`, origin))
  }

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  if (!code) {
    return NextResponse.redirect(new URL('/agenda?gcal=sem_code', origin))
  }
  // O state deve bater com o usuário logado (segurança: evita vincular ao usuário errado)
  if (state && state !== sessao.user.id) {
    return NextResponse.redirect(new URL('/agenda?gcal=erro&motivo=estado_invalido', origin))
  }

  try {
    await conectarCalendarUsuario(origin, code, sessao.user.id)
    return NextResponse.redirect(new URL('/agenda?gcal=ok', origin))
  } catch (e) {
    console.error('[google-agenda/callback]', e)
    const msg = e instanceof Error ? e.message : 'falha'
    return NextResponse.redirect(new URL(`/agenda?gcal=erro&motivo=${encodeURIComponent(msg)}`, origin))
  }
}
