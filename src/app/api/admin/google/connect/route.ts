import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth/config'
import { gerarUrlConsentimento, googleConfigurado } from '@/lib/google/oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sessao = await auth()
  if (!sessao?.user) {
    return NextResponse.redirect(new URL('/login', request.nextUrl.origin))
  }
  const redirectParam = request.nextUrl.searchParams.get('redirect') || undefined
  if (!(await googleConfigurado())) {
    const errorRedirect = redirectParam || '/trafego'
    return NextResponse.redirect(
      new URL(`${errorRedirect}?google=sem_credenciais`, request.nextUrl.origin),
    )
  }
  const url = await gerarUrlConsentimento(request.nextUrl.origin, redirectParam)
  return NextResponse.redirect(url)
}
