import { db } from '@/lib/db'
import { clinicSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { decodificarImagemDataUrl, respostaImagem } from '@/lib/imagemDataUrl'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const clinic = await db.query.clinicSettings.findFirst({
      where: eq(clinicSettings.id, 1),
    })
    const url = clinic?.ogImageUrl

    if (url?.startsWith('data:')) {
      // Só imagem da allowlist sai com o tipo declarado; o resto cai no fallback.
      const imagem = decodificarImagemDataUrl(url)
      if (imagem) return respostaImagem(imagem)
    } else if (url?.startsWith('http')) {
      return NextResponse.redirect(url)
    }

    // fallback — logo estático
    const base = new URL(request.url).origin
    return NextResponse.redirect(`${base}/image/logo.png`)
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
