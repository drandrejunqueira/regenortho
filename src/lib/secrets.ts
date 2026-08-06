import { timingSafeEqual } from 'node:crypto'

/**
 * Compara dois segredos em tempo constante.
 *
 * `timingSafeEqual` lança quando os buffers têm tamanhos diferentes — que é
 * justamente o caso comum de um token errado. Por isso a checagem de
 * comprimento vem antes: sem ela, a comparação viraria uma exceção 500 em vez
 * de uma rejeição.
 *
 * O ganho prático é pequeno: a diferença de tempo fica submersa em jitter de
 * rede, TLS e cold start. É higiene, não mitigação de um vetor demonstrável.
 */
export function secretEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a || '', 'utf8')
  const bufB = Buffer.from(b || '', 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
