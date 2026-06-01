import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getConfig } from '@/lib/db/queries/configuracoes'
import { createTermos } from '@/lib/db/queries/glossario'
import { slugify } from '@/lib/utils'

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
      max_tokens: 1024,
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
      max_tokens: 1024,
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

  try {
    const { nicho, letra, promptExtra = '', prefixo = 'O que é' } = await request.json()
    if (!nicho || !letra) {
      return NextResponse.json({ error: 'nicho e letra são obrigatórios' }, { status: 400 })
    }

    const uppercaseLetra = letra.toUpperCase().trim().slice(0, 1)

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

    const promptFormatting = prefixo !== 'Nenhum'
      ? `Formate cada termo iniciando obrigatoriamente com o prefixo "${prefixo}".
Por exemplo, se o prefixo for "O que é" e o nicho for "artrose e dores articulares", para a letra "C", você DEVE sugerir termos exatamente no formato:
"O que é Condromalácia", "O que é Cartilagem Hialina", "O que é Colágeno Tipo II" (garantindo que a palavra-chave/termo principal do nicho após o prefixo comece estritamente com a letra "${uppercaseLetra}").`
      : `Não utilize nenhum prefixo. Gere apenas os termos simples começando estritamente com a letra "${uppercaseLetra}". Ex: "Condromalácia", "Cartilagem Hialina", "Colágeno Tipo II".`

    const prompt = `Você é um especialista em Marketing Digital, SEO médico (com alto rigor científico) e criação de glossários de ortopedia e dor altamente indexáveis no Google.
Gere uma lista de termos, palavras-chave e expressões médicas/procedimentos relacionados ao nicho/especialidade "${nicho}".

${promptFormatting}

Retorne APENAS um objeto JSON válido (sem formatação markdown, sem comentários, apenas o JSON bruto):
{
  "termos": ["Termo 1", "Termo 2", "Termo 3", ...]
}

Gere entre 15 e 30 termos altamente relevantes.
${promptExtra ? `Instruções adicionais importantes: ${promptExtra}` : ''}`

    const provKey = provedor.toLowerCase().trim()
    let rawText = ''

    if (provKey === 'anthropic') {
      rawText = await callAnthropic(modelo, apiKey, prompt)
    } else {
      const baseUrl = PROVIDER_BASES[provKey] ?? `https://api.${provKey}.com/v1`
      rawText = await callOpenAiCompatible(baseUrl, modelo, apiKey, prompt)
    }

    if (!rawText || rawText.trim().length === 0) {
      throw new Error('A API retornou uma resposta vazia. Por favor, tente novamente.')
    }

    const cleanedText = cleanJsonResponse(rawText)
    const parsed = JSON.parse(cleanedText)
    const termosSugeridos = parsed.termos ?? []

    if (!Array.isArray(termosSugeridos) || termosSugeridos.length === 0) {
      return NextResponse.json({ error: 'Nenhum termo sugerido pela IA ou formato inválido.' }, { status: 500 })
    }

    // Preparar dados para inserção em lote no banco
    const dbPayload = termosSugeridos
      .filter((t: string) => t && t.trim().length > 0)
      .map((t: string) => {
        const termoCleaned = t.trim()
        return {
          termo: termoCleaned,
          slug: slugify(termoCleaned),
          letra: uppercaseLetra,
          nicho: nicho.trim(),
          status: 'pendente' as const,
        }
      })

    // Inserir os termos no banco, evitando duplicatas no slug
    const inserted = await createTermos(dbPayload)

    return NextResponse.json({
      success: true,
      totalSugeridos: termosSugeridos.length,
      totalInseridos: inserted.length,
      inseridos: inserted
    })
  } catch (error: any) {
    console.error('[gerar-termos] Error:', error)
    return NextResponse.json({ error: error.message ?? 'Erro interno ao gerar termos.' }, { status: 500 })
  }
}
