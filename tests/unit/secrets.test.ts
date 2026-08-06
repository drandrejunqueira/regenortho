import { describe, expect, it } from 'vitest'
import { secretEquals } from '@/lib/secrets'

describe('secretEquals', () => {
  it('aceita segredos idênticos', () => {
    expect(secretEquals('Bearer abc123', 'Bearer abc123')).toBe(true)
  })

  it('rejeita segredos diferentes de mesmo comprimento', () => {
    expect(secretEquals('Bearer abc123', 'Bearer abc124')).toBe(false)
  })

  // timingSafeEqual lança quando os buffers têm tamanhos diferentes — que é o
  // caso comum de token errado. Sem a guarda de comprimento isto viraria 500.
  it('rejeita — sem lançar — quando os comprimentos diferem', () => {
    expect(() => secretEquals('curto', 'muito-mais-longo')).not.toThrow()
    expect(secretEquals('curto', 'muito-mais-longo')).toBe(false)
  })

  it('rejeita string vazia e undefined sem lançar', () => {
    expect(secretEquals('', 'segredo')).toBe(false)
    expect(secretEquals(undefined as unknown as string, 'segredo')).toBe(false)
    expect(secretEquals('', '')).toBe(true)
  })

  it('é sensível a acentos e multibyte sem quebrar', () => {
    expect(secretEquals('senhã', 'senhã')).toBe(true)
    expect(secretEquals('senhã', 'senha')).toBe(false)
  })
})
