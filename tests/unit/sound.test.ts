import { beforeEach, describe, expect, it } from 'vitest'
import { isSoundEnabled, setSoundEnabled } from '@/lib/sound'

describe('preferência de som dos avisos', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('vem ligado por padrão, sem nada gravado', () => {
    expect(isSoundEnabled()).toBe(true)
  })

  it('desliga e volta a ligar persistindo a escolha', () => {
    setSoundEnabled(false)
    expect(isSoundEnabled()).toBe(false)

    setSoundEnabled(true)
    expect(isSoundEnabled()).toBe(true)
  })

  it('trata qualquer valor diferente de "0" como ligado', () => {
    window.localStorage.setItem('regenortho:som-avisos', 'lixo')
    expect(isSoundEnabled()).toBe(true)
  })
})
