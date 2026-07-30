import { auth } from '@/lib/auth/config'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  const isAuthPage = pathname.startsWith('/login')
  const isApiAuth = pathname.startsWith('/api/auth')
  const isSitePage = pathname.startsWith('/site')
  // Public site data endpoints: /api/site/config (branding) and /api/site/agendar
  // (lead capture) are called by anonymous visitors — must not redirect to /login,
  // or the public scheduling form silently drops every lead and the site loses branding.
  const isApiSite = pathname.startsWith('/api/site')
  const isTrackApi = pathname.startsWith('/api/track')
  const isPublicLeadsApi = pathname.startsWith('/api/public/leads')
  const isSitemap = pathname.startsWith('/sitemap.xml') || pathname === '/sitemap'
  const isIndexNowKey = pathname.startsWith('/api/seo/indexnow-key')
  // WhatsApp inbound webhook (called by Evolution) and cron jobs (called by Vercel
  // Cron) have no user session — they carry their own token/secret guard instead.
  const isWhatsAppWebhook = pathname.startsWith('/api/whatsapp/webhook')
  const isCron = pathname.startsWith('/api/cron')
  // Portal do paciente: o paciente não tem sessão do CRM — entra por token ou
  // código de 6 dígitos, validados com rate limit dentro de /api/portal/me.
  // /api/portal/token continua protegido (exige sessão + permissão da clínica).
  const isPortalPage = pathname.startsWith('/portal')
  const isPortalApi = pathname.startsWith('/api/portal/me')

  const isPublic =
    isAuthPage ||
    isApiAuth ||
    isSitePage ||
    isApiSite ||
    isTrackApi ||
    isPublicLeadsApi ||
    isSitemap ||
    isIndexNowKey ||
    isWhatsAppWebhook ||
    isCron ||
    isPortalPage ||
    isPortalApi

  if (!isLoggedIn && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
