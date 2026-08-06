import { describe, expect, it } from 'vitest'
import { sanitizeGlossaryHtml } from '@/lib/sanitizeHtml'

describe('sanitizeGlossaryHtml — remove o que executa', () => {
  it('remove <script> e o conteúdo dele, preservando o HTML legítimo em volta', () => {
    const sujo = '<p>ok</p><script>alert(1)</script><img src=x onerror=alert(1)>'
    const limpo = sanitizeGlossaryHtml(sujo)

    expect(limpo).toContain('<p>ok</p>')
    expect(limpo).not.toContain('script')
    expect(limpo).not.toContain('alert(1)')
    expect(limpo).not.toContain('onerror')
    expect(limpo).not.toContain('<img')
  })

  it('remove handlers on* de tags permitidas', () => {
    const limpo = sanitizeGlossaryHtml('<p onclick="roubaSessao()">texto</p>')
    expect(limpo).not.toContain('onclick')
    expect(limpo).toContain('texto')
  })

  it('remove iframe, object, embed e style', () => {
    for (const tag of ['iframe', 'object', 'embed', 'style']) {
      const limpo = sanitizeGlossaryHtml(`<p>antes</p><${tag}>x</${tag}><p>depois</p>`)
      expect(limpo, tag).not.toContain(`<${tag}`)
      expect(limpo, tag).toContain('antes')
      expect(limpo, tag).toContain('depois')
    }
  })

  it('neutraliza href javascript:', () => {
    const limpo = sanitizeGlossaryHtml('<a href="javascript:alert(1)">clique</a>')
    expect(limpo).not.toContain('javascript:')
    expect(limpo).toContain('clique')
  })

  it('trata null, undefined e vazio', () => {
    expect(sanitizeGlossaryHtml(null)).toBe('')
    expect(sanitizeGlossaryHtml(undefined)).toBe('')
    expect(sanitizeGlossaryHtml('')).toBe('')
  })
})

describe('sanitizeGlossaryHtml — o conteúdo bom precisa sobreviver intacto', () => {
  // Sanitizador que come o verbete é tão ruim quanto não ter sanitizador.
  it('preserva a estrutura típica de um verbete', () => {
    const verbete = [
      '<h2>O que é PRP?</h2>',
      '<p>O <strong>plasma rico em plaquetas</strong> é um concentrado <em>autólogo</em>.</p>',
      '<h3>Indicações</h3>',
      '<ul><li>Artrose de joelho</li><li>Tendinopatias</li></ul>',
      '<h4>Referências</h4>',
      '<ol><li>Estudo A</li></ol>',
      '<p>Veja <a href="https://exemplo.com.br/artigo" title="Artigo" target="_blank" rel="noopener">este artigo</a>.</p>',
      '<p>Linha um<br>Linha dois</p>',
    ].join('')

    const limpo = sanitizeGlossaryHtml(verbete)

    expect(limpo).toContain('<h2>O que é PRP?</h2>')
    expect(limpo).toContain('<strong>plasma rico em plaquetas</strong>')
    expect(limpo).toContain('<em>autólogo</em>')
    expect(limpo).toContain('<h3>Indicações</h3>')
    expect(limpo).toContain('<li>Artrose de joelho</li>')
    expect(limpo).toContain('<h4>Referências</h4>')
    expect(limpo).toContain('<ol>')
    expect(limpo).toContain('href="https://exemplo.com.br/artigo"')
    expect(limpo).toContain('target="_blank"')
    expect(limpo).toContain('<br>')
  })

  it('preserva acentuação e caracteres portugueses', () => {
    const limpo = sanitizeGlossaryHtml('<p>Ácido hialurônico, proloterapia e infiltração.</p>')
    expect(limpo).toContain('Ácido hialurônico, proloterapia e infiltração.')
  })
})
