import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { chain } from '../helpers/dbChain'

vi.mock('@/lib/evolution', () => ({ sendEvolutionText: vi.fn() }))
vi.mock('@/lib/ai', () => ({ callAi: vi.fn(async () => null) }))
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => chain([])),
    insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
  },
}))
vi.mock('@/lib/whatsappBot', () => ({ markSeen: vi.fn() }))

import { sendEvolutionText } from '@/lib/evolution'
import { markSeen } from '@/lib/whatsappBot'
import { deliverClinicReport } from '@/lib/clinicReport'

describe('deliverClinicReport — eco de volta para o bot', () => {
  afterEach(() => vi.clearAllMocks())

  // O webhook não ignora `fromMe`, então o relatório volta como mensagem
  // recebida. A única guarda era `looksLikeBotReply`, que testa o prefixo 📋 —
  // com `refine: true` a IA reescreve o texto e pode perder o emoji, e o bot
  // gera OUTRO relatório. Marcar o id enviado não depende do texto.
  it('marca o id da mensagem enviada como vista', async () => {
    ;(sendEvolutionText as unknown as Mock).mockResolvedValue({ key: { id: 'MSG-ABC-123' } })

    const res = await deliverClinicReport({ target: '12036@g.us' })

    expect(res.ok).toBe(true)
    expect(markSeen).toHaveBeenCalledWith('MSG-ABC-123')
  })

  it('não quebra quando a Evolution não devolve key.id', async () => {
    ;(sendEvolutionText as unknown as Mock).mockResolvedValue({})

    const res = await deliverClinicReport({ target: '12036@g.us' })

    expect(res.ok).toBe(true)
    expect(markSeen).not.toHaveBeenCalled()
  })

  it('não marca nada quando o envio falha', async () => {
    ;(sendEvolutionText as unknown as Mock).mockRejectedValue(new Error('Número bloqueado'))

    const res = await deliverClinicReport({ target: '12036@g.us' })

    expect(res.ok).toBe(false)
    expect(markSeen).not.toHaveBeenCalled()
  })
})
