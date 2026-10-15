'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// Motivos fechados para o relatório de perdas agrupar; "Outro" abre texto livre.
// Sem motivo obrigatório, 100% dos leads perdidos desde a reconstrução do Google
// Ads chegaram sem explicação — e não havia como separar lead ruim de atendimento ruim.
export const LOST_REASONS = [
  'Não respondeu após 3 tentativas',
  'Achou caro / sem condições',
  'Queria convênio',
  'Já agendou com outro médico',
  'Mora longe / fora da região',
  'Só queria informação',
  'Contato inválido',
  'Outro',
] as const

const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/40 focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30'

interface Props {
  open: boolean
  leadName?: string
  onCancel: () => void
  onConfirm: (reason: string) => void
}

export function LostReasonDialog({ open, leadName, onCancel, onConfirm }: Props) {
  const [choice, setChoice] = useState('')
  const [other, setOther] = useState('')

  const reason = choice === 'Outro' ? other.trim() : choice
  const canConfirm = reason.length >= 3

  function reset() {
    setChoice('')
    setOther('')
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onCancel() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Por que o lead foi perdido?</DialogTitle>
        </DialogHeader>
        {leadName && <p className="text-xs text-[#718096] -mt-2">{leadName}</p>}

        <div role="radiogroup" aria-label="Motivo da perda" className="grid gap-1.5">
          {LOST_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={choice === r}
              onClick={() => setChoice(r)}
              className={cn(
                'text-left text-sm px-3 py-2 rounded-xl border transition-colors cursor-pointer',
                choice === r
                  ? 'bg-red-50 border-red-300 text-red-700 font-semibold'
                  : 'bg-[#f5f6f8] border-[rgba(2,21,65,0.08)] text-[#021541] hover:border-[rgba(2,21,65,0.2)]'
              )}
            >
              {r}
            </button>
          ))}
        </div>

        {choice === 'Outro' && (
          <textarea
            aria-label="Descreva o motivo"
            className={inputCls}
            rows={2}
            maxLength={300}
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="Descreva o motivo"
            autoFocus
          />
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={() => { reset(); onCancel() }}
            className="px-4 py-2 text-sm font-semibold text-[#718096] hover:text-[#021541] cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => { onConfirm(reason); reset() }}
            className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Marcar como perdido
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
