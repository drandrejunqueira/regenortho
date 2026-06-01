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
  
  const isPublic = isAuthPage || isApiAuth || isSitePage || isTrackApi || isPublicLeadsApi || isSitemap || isIndexNowKey

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
