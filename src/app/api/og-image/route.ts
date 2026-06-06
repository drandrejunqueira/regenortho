import { db } from '@/lib/db'
import { clinicSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const clinic = await db.query.clinicSettings.findFirst({
      where: eq(clinicSettings.id, 1),
    })
    const url = clinic?.ogImageUrl

    if (url?.startsWith('data:')) {
      const commaIdx = url.indexOf(',')
      const header = url.slice(0, commaIdx)
      const b64 = url.slice(commaIdx + 1)
      const mimeMatch = header.match(/data:([^;]+);base64/)
      const mime = mimeMatch?.[1] ?? 'image/png'
      const buffer = Buffer.from(b64, 'base64')
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      })
    }

    if (url?.startsWith('http')) {
      return NextResponse.redirect(url)
    }

    // fallback — logo estático
    const base = new URL(request.url).origin
    return NextResponse.redirect(`${base}/image/logo.png`)
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
