import { describe, expect, it } from 'vitest'
import { ALL_SECTIONS, parseSections, toWhatsappText } from '@/lib/clinicReport'

describe('parseSections', () => {
  it('csv válido devolve só as seções reconhecidas, na ordem informada', () => {
    expect(parseSections('agenda,financeiro')).toEqual(['agenda', 'financeiro'])
  })

  it('ignora espaços e é case-insensitive', () => {
    expect(parseSections(' Agenda , FINANCEIRO ')).toEqual(['agenda', 'financeiro'])
  })

  it('descarta entradas inválidas mas mantém as válidas', () => {
    expect(parseSections('agenda,lixo,leads')).toEqual(['agenda', 'leads'])
  })

  it('csv só com lixo cai para todas as seções', () => {
    expect(parseSections('lixo,mais-lixo')).toEqual(ALL_SECTIONS)
  })

  it('vazio, null ou undefined caem para todas as seções', () => {
    expect(parseSections('')).toEqual(ALL_SECTIONS)
    expect(parseSections(null)).toEqual(ALL_SECTIONS)
    expect(parseSections(undefined)).toEqual(ALL_SECTIONS)
  })

  it('entradas duplicadas são preservadas (a função não deduplica)', () => {
    expect(parseSections('agenda,agenda')).toEqual(['agenda', 'agenda'])
  })
})

describe('toWhatsappText', () => {
  it('converte negrito markdown (**x**) para negrito WhatsApp (*x*)', () => {
    expect(toWhatsappText('**Total:** 5')).toBe('*Total:* 5')
  })

  it('remove headings (#, ##, ...) mantendo o texto', () => {
    expect(toWhatsappText('### 📋 Resumo da Clínica')).toBe('📋 Resumo da Clínica')
    expect(toWhatsappText('# Título\n## Subtítulo')).toBe('Título\nSubtítulo')
  })

  it('converte bullets "- " para "• "', () => {
    expect(toWhatsappText('- item um\n- item dois')).toBe('• item um\n• item dois')
  })

  it('combina os três no mesmo texto', () => {
    const md = '### 📅 Agenda de hoje\n**Total:** 3\n- 08:00 — João\n- 09:00 — Maria'
    expect(toWhatsappText(md)).toBe('📅 Agenda de hoje\n*Total:* 3\n• 08:00 — João\n• 09:00 — Maria')
  })

  it('não mexe em texto sem markdown', () => {
    expect(toWhatsappText('texto simples')).toBe('texto simples')
  })
})
