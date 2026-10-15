import type { NextRequest } from 'next/server'
import { handlers } from '@/lib/auth/config'
import { limitarTentativaLogin } from '@/lib/auth/loginGuard'

export const { GET } = handlers

export async function POST(req: NextRequest) {
  // Só o envio de credenciais passa pelo freio em memória; o resto do NextAuth
  // (signout, session, csrf) segue direto.
  if (req.nextUrl.pathname.endsWith('/callback/credentials')) {
    const bloqueio = await limitarTentativaLogin(req)
    if (bloqueio) return bloqueio
  }
  return handlers.POST(req)
}
