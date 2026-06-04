import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth/config'
import { trocarCodePorToken } from '@/lib/google/oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.redirect(new URL('/login', request.nextUrl.origin))
  }

  const state = request.nextUrl.searchParams.get('state')
  const defaultDest = state || '/trafego'

  const erro = request.nextUrl.searchParams.get('error')
  if (erro) {
    return NextResponse.redirect(
      new URL(`${defaultDest}?google=erro&motivo=${encodeURIComponent(erro)}`, request.nextUrl.origin),
    )
  }

  const code = request.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(new URL(`${defaultDest}?google=sem_code`, request.nextUrl.origin))
  }

  try {
    await trocarCodePorToken(request.nextUrl.origin, code)
    return NextResponse.redirect(new URL(`${defaultDest}?google=ok`, request.nextUrl.origin))
  } catch (e) {
    console.error('[google/callback]', e)
    const msg = e instanceof Error ? e.message : 'falha'
    return NextResponse.redirect(
      new URL(`${defaultDest}?google=erro&motivo=${encodeURIComponent(msg)}`, request.nextUrl.origin),
    )
  }
}
