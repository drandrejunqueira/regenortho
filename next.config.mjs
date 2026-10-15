const isDev = process.env.NODE_ENV !== 'production'

// Content-Security-Policy aplicada de verdade (não Report-Only).
//
// O que ela já corta: script de qualquer domínio externo, eval, <object>/<embed>,
// <base> sequestrado, formulário postando para fora, fetch/XHR para outro
// domínio (exfiltração) e a página dentro de iframe alheio. Site público e
// dashboard dividem a origem — e o cookie de sessão do NextAuth —, então esta é a
// segunda linha atrás de qualquer falha de sanitização.
//
// O que ainda falta (passo seguinte, ver PR): `script-src` sem 'unsafe-inline',
// com nonce por requisição. O Next só injeta nonce em página renderizada por
// requisição, então isso exige tirar o site público do estático/ISR — decisão de
// performance e custo que não cabe numa correção de segurança.
//
// Inventário que sustenta as origens abaixo: fontes do Google Fonts (CSS e
// arquivos), imagens em data:/blob: (upload em base64, preview) e https: (avatar,
// resultado de exame, imagem de URL externa nas configurações), vídeo do hero em
// CDN https. Nenhum iframe, nenhum fetch do navegador para outro domínio.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https:",
  // Em dev o HMR do Next usa websocket.
  `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['googleapis'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: csp },
          // Sem HSTS o primeiro acesso continua rebaixável para HTTP. O navegador
          // ignora o header em http://localhost, então dev não é afetado.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          // A aplicação não usa câmera, microfone nem localização: fecha por
          // padrão em vez de deixar liberado por omissão.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
