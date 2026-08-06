import DOMPurify from 'isomorphic-dompurify'

// O conteúdo dos verbetes do glossário é HTML gerado por IA e renderizado com
// `dangerouslySetInnerHTML` numa página pública e indexada. Site e dashboard
// compartilham origem, então um `<script>` ou `onerror` que escape — por
// alucinação do modelo ou por influência no prompt de geração — executa no
// contexto onde vive o cookie de sessão do NextAuth.

/** Tags que um verbete legitimamente usa. Tudo fora disso é removido.
 *  `#text` é obrigatório: com `ALLOWED_TAGS` explícito, o DOMPurify trata nós de
 *  texto como não permitidos e devolve `<h2></h2><p></p>` — o verbete inteiro
 *  vira casca vazia. */
const ALLOWED_TAGS = ['#text', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'br', 'a']

/** `on*` não entra: a allowlist de atributos é fechada, não uma denylist. */
const ALLOWED_ATTR = ['href', 'title', 'target', 'rel']

/**
 * Sanitiza HTML de verbete para renderização.
 *
 * Chamado na gravação E na renderização de propósito: sanitizar só na gravação
 * deixaria o conteúdo já persistido sujo, e sanitizar só na renderização faria
 * a defesa depender de todo consumidor futuro lembrar de chamar.
 */
export function sanitizeGlossaryHtml(html: string | null | undefined): string {
  if (!html) return ''
  return DOMPurify.sanitize(String(html), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Sem isto, `<script>` some mas o texto dentro dele permanece no output.
    KEEP_CONTENT: false,
    FORBID_TAGS: ['script', 'iframe', 'style', 'object', 'embed', 'form', 'input'],
  })
}
