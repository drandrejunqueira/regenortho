'use client'

// Aba "Agenda do dia" do perfil: configura o resumo diário no WhatsApp e mostra
// a prévia real de hoje. A prévia vem do mesmo builder que o cron usa, então o
// que o médico vê aqui é exatamente o que ele recebe às 8h.
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AgendaSlot {
  id: string
  time: string
  patientName: string
  typeLabel: string
  statusLabel: string
  room: string | null
}

interface AgendaToday {
  dateLabel: string
  total: number
  confirmed: number
  slots: AgendaSlot[]
}

// O cron roda de hora em hora; oferecer minutos criaria uma expectativa que o
// agendador não cumpre.
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)

const inputCls =
  'w-full bg-white border border-[rgba(2,21,65,0.10)] rounded-xl px-3.5 py-2.5 text-sm text-[#021541] placeholder:text-[#021541]/20 focus:outline-none focus:border-[#00BCE4] focus:ring-2 focus:ring-[#00BCE4]/15 transition-all'
const labelCls = 'text-[10px] font-bold text-[#021541]/40 uppercase tracking-wider'

interface DailyAgendaCardProps {
  enabled: boolean
  whatsapp: string
  hour: string
  onChange: (patch: { enabled?: boolean; whatsapp?: string; hour?: string }) => void
  onSaved: () => void
}

export function DailyAgendaCard({ enabled, whatsapp, hour, onChange, onSaved }: DailyAgendaCardProps) {
  const [agenda, setAgenda] = useState<AgendaToday | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  const loadAgenda = useCallback(async () => {
    try {
      const res = await fetch('/api/perfil/agenda-hoje')
      if (!res.ok) return
      const { data } = await res.json()
      setAgenda(data)
    } catch {
      /* prévia é complementar — a configuração continua utilizável sem ela */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAgenda()
  }, [loadAgenda])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyAgendaEnabled: enabled,
          dailyAgendaWhatsapp: whatsapp.trim() || null,
          dailyAgendaHour: hour,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Erro ao salvar')
      toast.success('Resumo diário atualizado!')
      onSaved()
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function sendNow() {
    setSending(true)
    try {
      // Salva antes: o envio lê o número do banco, não do formulário.
      await save()
      const res = await fetch('/api/perfil/agenda-hoje', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao enviar')
      toast.success('Resumo enviado no seu WhatsApp!')
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-5 space-y-4">
      {/* ── Configuração ── */}
      <div className="bg-white border border-[rgba(2,21,65,0.06)] rounded-2xl p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#021541]">Resumo diário no WhatsApp</p>
            <p className="text-[11px] text-[#021541]/45 mt-0.5">
              Receba todo dia a lista dos seus atendimentos. Dias sem consulta não geram mensagem.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Ativar resumo diário no WhatsApp"
            onClick={() => onChange({ enabled: !enabled })}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 mt-0.5',
              enabled ? 'bg-[#00BCE4]' : 'bg-[#021541]/20',
            )}
          >
            <span
              className={cn(
                'pointer-events-none mt-0.5 inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                enabled ? 'translate-x-[18px]' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div className="space-y-1.5 min-w-0">
            <label className={labelCls} htmlFor="daily-agenda-whatsapp">
              WhatsApp
            </label>
            <input
              id="daily-agenda-whatsapp"
              type="tel"
              value={whatsapp}
              onChange={(e) => onChange({ whatsapp: e.target.value })}
              placeholder="(12) 99999-9999"
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls} htmlFor="daily-agenda-hour">
              Horário
            </label>
            <select
              id="daily-agenda-hour"
              value={hour}
              onChange={(e) => onChange({ hour: e.target.value })}
              className={cn(inputCls, 'w-[92px]')}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving || sending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-br from-[#021541] to-[#032170] shadow-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
              {saving ? 'hourglass_empty' : 'save'}
            </span>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            onClick={sendNow}
            disabled={sending || saving || !whatsapp.trim()}
            title={!whatsapp.trim() ? 'Informe o número de WhatsApp' : 'Enviar o resumo de hoje agora'}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-[#021541] bg-white border border-[rgba(2,21,65,0.10)] hover:border-[#00BCE4] hover:text-[#00BCE4] disabled:opacity-40 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
              {sending ? 'hourglass_empty' : 'send'}
            </span>
            Enviar agora
          </button>
        </div>
      </div>

      {/* ── Prévia de hoje ── */}
      <div className="bg-white border border-[rgba(2,21,65,0.06)] rounded-2xl p-4 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-bold text-[#021541]">Sua agenda de hoje</p>
          {agenda && (
            <span className="font-technical text-[10px] text-[#021541]/40 capitalize">
              {agenda.dateLabel}
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-[#021541]/35 py-4 text-center">Carregando...</p>
        ) : !agenda || agenda.total === 0 ? (
          <p className="text-xs text-[#021541]/45 py-4 text-center">
            Nenhuma consulta agendada para hoje.
          </p>
        ) : (
          <>
            <p className="text-[11px] text-[#021541]/50">
              <strong className="text-[#021541]">{agenda.total}</strong>{' '}
              {agenda.total === 1 ? 'atendimento' : 'atendimentos'}
              {agenda.confirmed > 0 && ` · ${agenda.confirmed} confirmado${agenda.confirmed === 1 ? '' : 's'}`}
            </p>
            <ul className="space-y-1.5">
              {agenda.slots.map((s) => (
                <li
                  key={s.id}
                  className="flex items-baseline gap-3 py-1.5 border-b border-[rgba(2,21,65,0.05)] last:border-0"
                >
                  <span className="font-technical text-xs font-bold text-[#00BCE4] shrink-0 tabular-nums">
                    {s.time}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-[#021541] truncate">
                      {s.patientName}
                    </span>
                    <span className="block text-[10px] text-[#021541]/40">
                      {[s.typeLabel, s.statusLabel, s.room && `Sala ${s.room}`].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
