import { getOuCriarIndexNowKey } from '@/lib/seo/notificar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Arquivo de verificação do IndexNow. Os buscadores acessam esta URL
 * (keyLocation) e o conteúdo deve ser exatamente a chave em texto puro.
 */
export async function GET() {
  const key = await getOuCriarIndexNowKey()
  return new Response(key, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
