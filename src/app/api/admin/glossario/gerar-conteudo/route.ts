import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { getConfig } from '@/lib/db/queries/configuracoes'
import { getTermoById, updateTermo } from '@/lib/db/queries/glossario'
import { notificarBuscadores } from '@/lib/seo/notificar'
import { revalidatePath } from 'next/cache'
import { sanitizeGlossaryHtml } from '@/lib/sanitizeHtml'

const PROVIDER_BASES: Record<string, string> = {
  openai:       'https://api.openai.com/v1',
  openrouter:   'https://openrouter.ai/api/v1',
  groq:         'https://api.groq.com/openai/v1',
  deepseek:     'https://api.deepseek.com/v1',
  gemini:       'https://generativelanguage.googleapis.com/v1beta/openai',
  anthropic:    '__anthropic__', // Handled separately
}

async function callOpenAiCompatible(
  baseUrl: string,
  model: string,
  apiKey: string,
  prompt: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://regenortho.com.br',
      'X-Title': 'REGENORTHO Admin',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Provider error: ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

async function callAnthropic(model: string, apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic error: ${res.status}`)
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim()
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return cleaned.substring(start, end + 1)
  }

  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3)
  }
  return cleaned.trim()
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'settings:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id do termo é obrigatório' }, { status: 400 })

    // Buscar o termo no banco
    const termo = await getTermoById(id)
    if (!termo) {
      return NextResponse.json({ error: 'Termo não encontrado' }, { status: 404 })
    }

    // Load AI config from configuracoes table
    const [provedor, modelo] = await Promise.all([
      getConfig('ia_motor_nome'),
      getConfig('ia_modelo'),
    ])

    let apiKey = ''
    const motor = (provedor || 'gemini').toLowerCase().trim()
    if (motor === 'gemini') {
      apiKey = await getConfig('gemini_api_key') || await getConfig('ia_api_key') || ''
    } else if (motor === 'openai') {
      apiKey = await getConfig('openai_api_key') || await getConfig('ia_api_key') || ''
    } else if (motor === 'openrouter') {
      apiKey = await getConfig('openrouter_api_key') || await getConfig('ia_api_key') || ''
    } else {
      apiKey = await getConfig('ia_api_key') || ''
    }

    if (!provedor || !modelo || !apiKey) {
      return NextResponse.json({
        error: 'Chave de IA não configurada. Configure o provedor de IA e a API Key correspondente nas Configurações do Site.'
      }, { status: 400 })
    }

    const prompt = `Você é um redator médico sênior especialista em SEO de saúde, com alto rigor científico e marketing de atração.
Escreva uma definição/verbete de dicionário clínico extremamente detalhado e explicativo (em formato de artigo didático) para o termo técnico ortopédico abaixo.

Termo: "${termo.termo}"
Especialidade/Contexto: "${termo.nicho}"
Localização e Foco Geográfico: Atuação da clínica REGENORTHO em São José dos Campos (SJC), Vale do Paraíba e São Paulo (SP).
Diretor Técnico: Dr. André Elias Junqueira, especialista EPM-UNIFESP/USP.

Instruções Cruciais:
1. Escreva um verbete longo, didático e cientificamente embasado, com excelente profundidade e riqueza de informações anatômicas reais.
2. Cada seção (introduzida por uma tag <h2>) DEVE ser acompanhada de pelo menos um parágrafo longo de 100 a 150 palavras de texto explicativo real.
3. Use obrigatoriamente tags HTML <h2> para introduzir as seções. Adapte os cabeçalhos para o contexto ortopédico (nunca use reticências "..." nos títulos finais). Exemplos de cabeçalhos adequados:
   - "<h2>O que é [Termo]</h2>" (Escreva um parágrafo explicativo completo)
   - "<h2>Principais causas e sintomas de [Termo]</h2>" (Escreva um parágrafo explicativo completo)
   - "<h2>Como funciona o diagnóstico e a avaliação biomecânica</h2>" (Escreva um parágrafo explicativo completo)
   - "<h2>Tratamentos regenerativos e infiltrações para [Termo] em SJC</h2>" (Escreva um parágrafo explicativo completo)
4. ATENÇÃO MÁXIMA: NUNCA adicione marcadores de posição, resumos em tópicos ou reticências ("...") no conteúdo. Todos os parágrafos sob cada tag <h2> devem estar inteiramente escritos e conter definições reais, completas e ricas em SEO.
5. Não use markdown de títulos (como ##) nem tags <h1>. Não use tags globais de estrutura como <html>, <body>, ou <div>.
6. Inclua palavras-chave e citações geográficas locais de forma fluida e natural (como "São José dos Campos", "tratamento da dor em SJC", "ortopedia regenerativa", "Vale do Paraíba", "PRP", "Ácido Hialurônico").
7. Escreva no tom de voz de um médico especialista profissional, acolhedor e altamente científico.
8. NÃO adicione introduções formais (ex: "Aqui está o verbete..."), conclusões redundantes (ex: "Conclusão", "Considerações finais") nem considerações sobre o processo. O conteúdo deve iniciar direto no assunto da primeira tag <h2>.
9. NUNCA faça rascunhos extensos ou contagens manuais de palavras em seus pensamentos internos (isso esgota o seu limite de tokens). Foque em escrever diretamente o texto final e em gerar o JSON completo de uma vez.
10. Retorne o resultado em formato JSON válido para que possamos salvar no banco de dados.

Retorne APENAS um objeto JSON válido (sem formatação markdown, sem comentários, apenas o JSON bruto):
{
  "conteudo": "HTML completo com o texto e as tags <h2> (não use markdown de títulos), e sem tags <html>/<body>/<div> externas",
  "seoTitle": "(título SEO ideal de no máximo 60 caracteres com o termo e menção à REGENORTHO ou São José dos Campos)",
  "seoDescription": "(descrição SEO atraente de no máximo 155 caracteres com chamada para ação de agendamento de consulta)"
}`

    const provKey = provedor.toLowerCase().trim()
    let rawText = ''

    if (provKey === 'anthropic') {
      rawText = await callAnthropic(modelo, apiKey, prompt)
    } else {
      const baseUrl = PROVIDER_BASES[provKey] ?? `https://api.${provKey}.com/v1`
      rawText = await callOpenAiCompatible(baseUrl, modelo, apiKey, prompt)
    }

    const cleanedText = cleanJsonResponse(rawText)
    const parsed = JSON.parse(cleanedText)

    const { conteudo, seoTitle, seoDescription } = parsed

    if (!conteudo) {
      return NextResponse.json({ error: 'Conteúdo gerado pela IA está vazio ou inválido.' }, { status: 500 })
    }

    // Atualizar no banco com status 'publicado'
    const updated = await updateTermo(id, {
      // Sanitiza na gravação também: sem isto a defesa dependeria de todo
      // consumidor futuro do campo lembrar de sanitizar na leitura.
      conteudo: sanitizeGlossaryHtml(conteudo.trim()),
      seoTitle: seoTitle ? seoTitle.trim() : `${termo.termo} – Significado e Tratamento | REGENORTHO`,
      seoDescription: seoDescription ? seoDescription.trim() : `Entenda o significado de ${termo.termo} e conheça as alternativas de infiltrações e reabilitação regenerativa na REGENORTHO em SJC.`,
      status: 'publicado',
    })

    // Notifica buscadores (Google sitemap + IndexNow) — não bloqueia em caso de falha
    const slug = updated?.slug ?? termo.slug
    if (slug) {
      revalidatePath('/sitemap.xml')
      await notificarBuscadores([`/site/glossario/${slug}`])
    }

    return NextResponse.json({
      success: true,
      termo: updated
    })
  } catch (error: any) {
    console.error('[gerar-conteudo] Error:', error)
    return NextResponse.json({ error: error.message ?? 'Erro interno ao gerar definição do termo.' }, { status: 500 })
  }
}
