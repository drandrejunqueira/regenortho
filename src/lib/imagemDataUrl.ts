import { NextResponse } from 'next/server'

// Imagens gravadas como data URL em `clinicSettings` e servidas pela própria
// origem da aplicação em rota pública (/api/og-image, /api/favicon).
//
// O MIME servido vinha do cabeçalho do próprio data URL, sem allowlist: um
// `data:text/html;base64,...` (ou um SVG com <script>) virava documento
// executado em https://<dominio>/api/og-image, sem sessão. Agora só sai o que
// é imagem rasterizada ou ícone — SVG fica de fora de propósito, porque servido
// como documento ele executa script.

export const MIMES_IMAGEM_SERVIVEIS = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
] as const

// Teto do arquivo decodificado. O maior upload aceito pela tela é 4 MB.
export const TETO_IMAGEM_BYTES = 5 * 1024 * 1024

const DATA_URL_RE = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i

export interface ImagemDecodificada {
  mime: string
  buffer: Buffer
}

function partesValidas(url: string): { mime: string; base64: string } | null {
  const m = DATA_URL_RE.exec(url)
  if (!m) return null
  const mime = m[1].toLowerCase()
  if (!(MIMES_IMAGEM_SERVIVEIS as readonly string[]).includes(mime)) return null
  // Confere o tamanho pelo base64 antes de alocar o buffer.
  if (Math.floor((m[2].length * 3) / 4) > TETO_IMAGEM_BYTES) return null
  return { mime, base64: m[2] }
}

/** Decodifica o data URL se for imagem servível; qualquer outra coisa → null. */
export function decodificarImagemDataUrl(url: string): ImagemDecodificada | null {
  const partes = partesValidas(url)
  if (!partes) return null
  return { mime: partes.mime, buffer: Buffer.from(partes.base64, 'base64') }
}

/**
 * Valor aceito na gravação de og-image/favicon: vazio, URL http(s), caminho
 * relativo ou data URL de imagem servível. Validar só na leitura deixaria o
 * arquivo malicioso parado no banco esperando outro consumidor.
 */
export function valorImagemServivelValido(valor: string | null | undefined): boolean {
  if (valor == null || valor === '') return true
  if (/^https?:\/\//i.test(valor)) return true
  if (valor.startsWith('/') && !valor.startsWith('//')) return true
  return partesValidas(valor) !== null
}

export function respostaImagem(imagem: ImagemDecodificada): NextResponse {
  return new NextResponse(new Uint8Array(imagem.buffer), {
    headers: {
      'Content-Type': imagem.mime,
      'Content-Disposition': 'inline',
      'Content-Length': String(imagem.buffer.length),
      'X-Content-Type-Options': 'nosniff',
      // Segunda linha: mesmo que algo escape da allowlist, a resposta não roda
      // script nem carrega nada.
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
