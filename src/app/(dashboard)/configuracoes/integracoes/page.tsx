'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'

const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/40 focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)]'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'
const sectionCls = 'bg-white border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] rounded-xl p-5'

interface IntSettings {
  whatsapp: string
  whatsappToken: string
  whatsappApiUrl: string
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPass: string
}

interface Doctor {
  id: string
  name: string
  email: string
  googleCalendarId: string | null
}

const DEFAULT: IntSettings = { whatsapp: '', whatsappToken: '', whatsappApiUrl: '', smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '' }

function IntegrationCard({ icon, title, color, description, connected, children }: {
  icon: string; title: string; color: string; description: string; connected?: boolean; children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={sectionCls}>
      <button type="button" onClick={() => setExpanded((p) => !p)} className="w-full flex items-center gap-3 text-left">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20` }}>
          <span className="material-symbols-outlined" style={{ fontSize: '20px', color }}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-[#021541]">{title}</p>
            {connected ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00BCE4]/10 text-[#00BCE4] uppercase tracking-wider">Conectado</span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f5f6f8] text-[#718096] uppercase tracking-wider">Não configurado</span>
            )}
          </div>
          <p className="text-xs text-[#718096] mt-0.5">{description}</p>
        </div>
        <span className="material-symbols-outlined text-[#718096] shrink-0 transition-transform duration-200" style={{ fontSize: '18px', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          expand_more
        </span>
      </button>
      {expanded && <div className="mt-4 pt-4 border-t border-[rgba(2,21,65,0.08)] space-y-3">{children}</div>}
    </div>
  )
}

export default function IntegracoesPage() {
  const [form, setForm] = useState<IntSettings>(DEFAULT)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [calendarIds, setCalendarIds] = useState<Record<string, string>>({})
  const [savingCalendar, setSavingCalendar] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/configuracoes/sistema').then((r) => r.json()),
      fetch('/api/usuarios').then((r) => r.json()),
    ]).then(([{ data: cfg }, { data: users }]) => {
      if (cfg) setForm({
        whatsapp: cfg.whatsapp ?? '',
        whatsappToken: cfg.whatsappToken ?? '',
        whatsappApiUrl: cfg.whatsappApiUrl ?? '',
        smtpHost: cfg.smtpHost ?? '',
        smtpPort: String(cfg.smtpPort ?? 587),
        smtpUser: cfg.smtpUser ?? '',
        smtpPass: cfg.smtpPass ?? '',
      })
      if (users) {
        const docs: Doctor[] = users.filter((u: { role: string }) => u.role === 'doctor')
        setDoctors(docs)
        const ids: Record<string, string> = {}
        docs.forEach((d: Doctor) => { ids[d.id] = d.googleCalendarId ?? '' })
        setCalendarIds(ids)
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  function set(key: keyof IntSettings, value: string) { setForm((p) => ({ ...p, [key]: value })) }

  async function save() {
    setSaving(true)
    try {
      const payload = { ...form, smtpPort: Number(form.smtpPort) || null }
      const res = await fetch('/api/configuracoes/sistema', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error()
      toast.success('Integrações salvas!')
    } catch { toast.error('Erro ao salvar') } finally { setSaving(false) }
  }

  async function saveCalendar(doctorId: string) {
    setSavingCalendar((p) => ({ ...p, [doctorId]: true }))
    try {
      const res = await fetch(`/api/usuarios/${doctorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleCalendarId: calendarIds[doctorId] || null }),
      })
      if (!res.ok) throw new Error()
      toast.success('Calendar salvo!')
    } catch { toast.error('Erro ao salvar calendar') } finally {
      setSavingCalendar((p) => ({ ...p, [doctorId]: false }))
    }
  }

  const anyCalendarConnected = doctors.some((d) => !!calendarIds[d.id])

  if (loading) return <p className="text-sm text-[#718096] py-8 text-center">Carregando...</p>

  return (
    <div className="space-y-4">

      <IntegrationCard
        icon="chat"
        title="WhatsApp Business API"
        color="#25d366"
        description="Envie mensagens automáticas para leads e pacientes via WhatsApp."
        connected={!!form.whatsappToken}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className={labelCls}>Número WhatsApp</label>
            <input value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="5512999999999" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>API URL</label>
            <input value={form.whatsappApiUrl} onChange={(e) => set('whatsappApiUrl', e.target.value)} placeholder="https://api.whatsapp.com/..." className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Token de acesso</label>
            <input type="password" value={form.whatsappToken} onChange={(e) => set('whatsappToken', e.target.value)} placeholder="••••••••" className={inputCls} />
          </div>
        </div>
      </IntegrationCard>

      <IntegrationCard
        icon="mail"
        title="E-mail SMTP"
        color="#00BCD4"
        description="Configure o servidor de e-mail para envio de comprovantes e notificações."
        connected={!!form.smtpHost}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3 space-y-1.5">
              <label className={labelCls}>Host SMTP</label>
              <input value={form.smtpHost} onChange={(e) => set('smtpHost', e.target.value)} placeholder="smtp.gmail.com" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Porta</label>
              <input value={form.smtpPort} onChange={(e) => set('smtpPort', e.target.value)} placeholder="587" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Usuário</label>
              <input value={form.smtpUser} onChange={(e) => set('smtpUser', e.target.value)} placeholder="usuario@gmail.com" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Senha / App Password</label>
              <input type="password" value={form.smtpPass} onChange={(e) => set('smtpPass', e.target.value)} placeholder="••••••••" className={inputCls} />
            </div>
          </div>
        </div>
      </IntegrationCard>

      {/* Google Calendar por médico */}
      <IntegrationCard
        icon="calendar_month"
        title="Google Calendar"
        color="#e6c364"
        description="Sincronize a agenda individual de cada médico com o Google Calendar."
        connected={anyCalendarConnected}
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-[#e6c364]/5 border border-[#e6c364]/20 text-[11px] text-[#718096]/80 leading-relaxed space-y-1">
            <p>Cada médico tem sua própria agenda sincronizada. No Google Calendar, acesse:</p>
            <p className="text-[#e6c364] font-medium">Configurações → [nome da agenda] → Integrar agenda → <span className="underline">Endereço secreto no formato iCal</span></p>
            <p className="text-[#ffb4ab]/80">⚠ Não use a "URL pública" nem o "Incorporar código" — use apenas o endereço <strong>secreto</strong> (começa com .../private-...).</p>
          </div>

          {doctors.length === 0 && (
            <div className="p-3 rounded-xl bg-[#f5f6f8] text-[11px] text-[#718096] flex items-start gap-2">
              <span className="material-symbols-outlined text-[#e6c364] shrink-0" style={{ fontSize: '16px' }}>info</span>
              Nenhum médico cadastrado. Cadastre médicos em Configurações → Usuários.
            </div>
          )}

          {doctors.map((doctor) => (
            <div key={doctor.id} className="space-y-2 p-3 rounded-xl bg-[#f5f6f8]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#00BCE4]/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '14px' }}>stethoscope</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-[#021541]">{doctor.name}</p>
                  <p className="text-[10px] text-[#718096]/60">{doctor.email}</p>
                </div>
                {calendarIds[doctor.id] && (
                  <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00BCE4]/10 text-[#00BCE4] uppercase tracking-wider">Conectado</span>
                )}
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Endereço secreto no formato iCal</label>
                <div className="flex gap-2">
                  <input
                    value={calendarIds[doctor.id] ?? ''}
                    onChange={(e) => setCalendarIds((p) => ({ ...p, [doctor.id]: e.target.value }))}
                    placeholder="https://calendar.google.com/calendar/ical/.../private-xxx/basic.ics"
                    className={inputCls}
                  />
                  <button
                    onClick={() => saveCalendar(doctor.id)}
                    disabled={savingCalendar[doctor.id]}
                    className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold bg-[#0097a7]/20 text-[#00BCE4] hover:bg-[#0097a7]/40 transition-colors disabled:opacity-50"
                  >
                    {savingCalendar[doctor.id] ? '...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </IntegrationCard>

      <IntegrationCard
        icon="credit_card"
        title="Stripe (Pagamentos)"
        color="#6772e5"
        description="Cobrança online de consultas e procedimentos via link de pagamento."
        connected={false}
      >
        <div className="p-3 rounded-xl bg-[#f5f6f8] text-[11px] text-[#718096] flex items-start gap-2">
          <span className="material-symbols-outlined text-[#e6c364] shrink-0" style={{ fontSize: '16px' }}>construction</span>
          Integração com Stripe em desenvolvimento. Em breve disponível.
        </div>
      </IntegrationCard>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#021541] to-[#032170] text-white hover:opacity-90 transition-opacity disabled:opacity-50">
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
          {saving ? 'Salvando...' : 'Salvar integrações'}
        </button>
      </div>
    </div>
  )
}
