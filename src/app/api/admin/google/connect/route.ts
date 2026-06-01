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
  if (!googleConfigurado()) {
    return NextResponse.redirect(
      new URL('/trafego?google=sem_credenciais', request.nextUrl.origin),
    )
  }
  const url = gerarUrlConsentimento(request.nextUrl.origin)
  return NextResponse.redirect(url)
}
