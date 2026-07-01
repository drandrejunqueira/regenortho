import { auth } from '@/lib/auth/config'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  const isAuthPage = pathname.startsWith('/login')
  const isApiAuth = pathname.startsWith('/api/auth')
  const isSitePage = pathname.startsWith('/site')
  const isTrackApi = pathname.startsWith('/api/track')
  const isPublicLeadsApi = pathname.startsWith('/api/public/leads')
  const isSitemap = pathname.startsWith('/sitemap.xml') || pathname === '/sitemap'
  const isIndexNowKey = pathname.startsWith('/api/seo/indexnow-key')
  // WhatsApp inbound webhook (called by Evolution) and cron jobs (called by Vercel
  // Cron) have no user session — they carry their own token/secret guard instead.
  const isWhatsAppWebhook = pathname.startsWith('/api/whatsapp/webhook')
  const isCron = pathname.startsWith('/api/cron')

  const isPublic =
    isAuthPage ||
    isApiAuth ||
    isSitePage ||
    isTrackApi ||
    isPublicLeadsApi ||
    isSitemap ||
    isIndexNowKey ||
    isWhatsAppWebhook ||
    isCron

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
