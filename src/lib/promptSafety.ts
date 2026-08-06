// Defesas contra injeção indireta de prompt.
//
// O bot do WhatsApp monta o contexto da IA concatenando valores vindos do banco
// — nome de paciente, nome de médico, notas de consulta. Parte desses valores
// nasce em formulário público, sem autenticação. Sem tratamento, um nome com
// quebras de linha e delimitadores forjados vira instrução para uma IA que tem
// prontuário e financeiro em contexto e publica a resposta no grupo da clínica.

/** Nome de pessoa: letras (com acento), marcas de combinação, espaço, ponto,
 *  apóstrofo e hífen. Precisa da flag `u` para `\p{L}` funcionar. Cobre
 *  `José da Conceição`, `D'Ávila`, `Ana-Maria`.
 *
 *  Espaço literal, NÃO `\s`: `\s` casa `\n` e `\r`, o que deixaria passar
 *  justamente a quebra de linha que permite forjar uma linha de instrução —
 *  anulando a defesa inteira. */
export const PERSON_NAME_RE = /^[\p{L}\p{M} .'-]+$/u

/** Nome de tag: rótulo curto. Aceita número e os separadores usados em rótulos
 *  ("2ª via", "Pré/Pós", "Convênio & Particular"). Mesmo motivo do acima para o
 *  espaço literal: nome de tag acompanha o lead até o contexto da IA. */
export const TAG_NAME_RE = /^[\p{L}\p{N} ./+&-]+$/u

/**
 * Neutraliza um valor vindo do banco antes de entrar no contexto da IA.
 *
 * Não confia na validação de entrada: os dados já gravados continuam sujos, e
 * nem todo campo do contexto passa por formulário público.
 */
export function sanitizeForPrompt(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value)
    // Quebra de linha é o que permite forjar uma linha de "instrução" própria.
    .replace(/[\r\n]+/g, ' ')
    // Caracteres de controle (inclui \t e o resto do bloco C0/C1).
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    // Sequências de `=` forjariam os delimitadores `=== Seção ===` do contexto.
    .replace(/={2,}/g, '=')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
