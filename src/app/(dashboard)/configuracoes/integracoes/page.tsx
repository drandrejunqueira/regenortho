'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { desconectarContaGoogle } from '@/app/actions/configuracoes'

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
  googleCalendarId: string
  googleClientId: string
  googleClientSecret: string
}

interface Doctor {
  id: string
  name: string
  email: string
  googleCalendarId: string | null
}

const DEFAULT: IntSettings = {
  whatsapp: '',
  whatsappToken: '',
  whatsappApiUrl: '',
  smtpHost: '',
  smtpPort: '587',
  smtpUser: '',
  smtpPass: '',
  googleCalendarId: '',
  googleClientId: '',
  googleClientSecret: '',
}

function IntegrationCard({ icon, title, color, description, connected, defaultExpanded = false, children }: {
  icon: string; title: string; color: string; description: string; connected?: boolean; defaultExpanded?: boolean; children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  useEffect(() => {
    if (defaultExpanded) {
      setExpanded(true)
    }
  }, [defaultExpanded])

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
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleEmail, setGoogleEmail] = useState<string | null>(null)
  const [googleConnectedAt, setGoogleConnectedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [origin, setOrigin] = useState('')
  const [googleExpanded, setGoogleExpanded] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/configuracoes/sistema').then((r) => r.json()),
      fetch('/api/usuarios').then((r) => r.json()),
    ]).then(([{ data: cfg }, { data: users }]) => {
      if (cfg) {
        setForm({
          whatsapp: cfg.whatsapp ?? '',
          whatsappToken: cfg.whatsappToken ?? '',
          whatsappApiUrl: cfg.whatsappApiUrl ?? '',
          smtpHost: cfg.smtpHost ?? '',
          smtpPort: String(cfg.smtpPort ?? 587),
          smtpUser: cfg.smtpUser ?? '',
          smtpPass: cfg.smtpPass ?? '',
          googleCalendarId: cfg.googleCalendarId ?? '',
          googleClientId: cfg.googleClientId ?? '',
          googleClientSecret: cfg.googleClientSecret ?? '',
        })
        setGoogleConnected(cfg.googleConnected ?? false)
        setGoogleEmail(cfg.googleEmail ?? null)
        setGoogleConnectedAt(cfg.googleConnectedAt ?? null)
        if (!cfg.googleConnected) {
          setShowGuide(true)
        }
      }
      if (users) {
        const docs: Doctor[] = users.filter((u: { role: string }) => u.role === 'doctor')
        setDoctors(docs)
        const ids: Record<string, string> = {}
        docs.forEach((d: Doctor) => { ids[d.id] = d.googleCalendarId ?? '' })
        setCalendarIds(ids)
      }
      setOrigin(window.location.origin)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const googleParam = params.get('google')
    if (googleParam) {
      setGoogleExpanded(true)
      if (googleParam === 'ok') {
        toast.success('Conta Google conectada com sucesso!')
      } else if (googleParam === 'sem_credenciais') {
        toast.error('Por favor, insira e salve as Credenciais do Google antes de conectar.')
      } else if (googleParam === 'erro') {
        const motivo = params.get('motivo')
        toast.error(`Erro ao conectar: ${motivo || 'Erro desconhecido'}`)
      }
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }
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
  const googleCalendarActive = googleConnected || anyCalendarConnected || !!form.googleCalendarId

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

      {/* Google Calendar */}
      <IntegrationCard
        icon="calendar_month"
        title="Google Calendar"
        color="#e6c364"
        description="Sincronize a agenda central da clínica e as agendas internas de cada médico."
        connected={googleCalendarActive}
        defaultExpanded={googleExpanded}
      >
        <div className="space-y-4">

          {/* Guia de Configuração Passo a Passo */}
          <div className="border border-[#e6c364]/20 rounded-xl overflow-hidden bg-[#e6c364]/5 shadow-sm">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#e6c364]/10 hover:bg-[#e6c364]/15 transition-all text-left text-xs font-bold text-[#021541]"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#e6c364]" style={{ fontSize: '18px' }}>help_outline</span>
                <span>Guia Passo a Passo: Como Configurar e Sincronizar</span>
              </div>
              <span className="material-symbols-outlined text-[#718096]" style={{ fontSize: '16px' }}>
                {showGuide ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
              </span>
            </button>
            {showGuide && (
              <div className="p-4 space-y-4 text-xs text-[#718096] leading-relaxed border-t border-[#e6c364]/20 bg-white">
                <div className="space-y-3">
                  <div className="flex gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-[#e6c364]/10 text-[#e6c364] flex items-center justify-center shrink-0 font-bold text-[10px]">1</div>
                    <div>
                      <p className="font-bold text-[#021541]">Criar Projeto no Google Cloud</p>
                      <p className="mt-0.5">Acesse o <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-[#00BCE4] hover:underline font-semibold">Google Cloud Console</a>, faça login com a conta da clínica e crie um novo projeto (ex: "Agenda Regem Orto").</p>
                    </div>
                  </div>

                  <div className="flex gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-[#e6c364]/10 text-[#e6c364] flex items-center justify-center shrink-0 font-bold text-[10px]">2</div>
                    <div>
                      <p className="font-bold text-[#021541]">Ativar a Google Calendar API</p>
                      <p className="mt-0.5">No menu lateral esquerdo, vá em <strong>APIs e Serviços → Biblioteca</strong>. Busque por <strong>Google Calendar API</strong> na barra de pesquisa, selecione a API e clique no botão <strong>Ativar</strong>.</p>
                    </div>
                  </div>

                  <div className="flex gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-[#e6c364]/10 text-[#e6c364] flex items-center justify-center shrink-0 font-bold text-[10px]">3</div>
                    <div>
                      <p className="font-bold text-[#021541]">Configurar a Tela de Consentimento (OAuth Consent Screen)</p>
                      <p className="mt-0.5">Acesse <strong>Tela de consentimento OAuth</strong> no menu lateral:</p>
                      <ul className="list-disc pl-4 mt-1 space-y-1 text-[11px]">
                        <li>Defina o User Type como <strong>Externo</strong> (ou Interno se tiver Google Workspace na clínica) e preencha as informações básicas do aplicativo.</li>
                        <li>Na etapa de <strong>Escopos (Scopes)</strong>, clique em &quot;Adicionar ou remover escopos&quot; e adicione os seguintes escopos da Google Calendar API: <code className="bg-[#f5f6f8] px-1 rounded font-mono text-[10px]">.../auth/calendar</code> e <code className="bg-[#f5f6f8] px-1 rounded font-mono text-[10px]">.../auth/calendar.events</code>.</li>
                        <li>Na etapa de <strong>Usuários de Teste (Test Users)</strong>, adicione os e-mails do Google que você pretende conectar (tanto o da Clínica quanto o dos Médicos).</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-[#e6c364]/10 text-[#e6c364] flex items-center justify-center shrink-0 font-bold text-[10px]">4</div>
                    <div>
                      <p className="font-bold text-[#021541]">Criar Credenciais OAuth 2.0</p>
                      <p className="mt-0.5">Vá em <strong>Credenciais</strong>, clique em <strong>+ Criar Credenciais</strong> e escolha <strong>ID do cliente OAuth</strong>:</p>
                      <ul className="list-disc pl-4 mt-1 space-y-1 text-[11px]">
                        <li>Selecione Tipo de Aplicativo: <strong>Aplicativo da Web</strong>.</li>
                        <li>Adicione em <strong>Origens JavaScript autorizadas</strong>: <code className="bg-[#f5f6f8] px-1 rounded font-mono text-[10px] select-all">{origin || 'http://localhost:3000'}</code></li>
                        <li>Adicione em <strong>URIs de redirecionamento autorizados</strong> exatamente este endereço: <code className="bg-[#f5f6f8] px-1.5 py-0.5 rounded font-mono text-[10px] select-all text-[#021541] font-bold block mt-0.5">{origin || 'http://localhost:3000'}/api/admin/google/callback</code></li>
                        <li>Clique em Salvar, copie o <strong>Client ID</strong> e o <strong>Client Secret</strong> gerados e insira-os no formulário abaixo. Clique em <strong>Salvar Integrações</strong> no rodapé antes de prosseguir.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-[#e6c364]/10 text-[#e6c364] flex items-center justify-center shrink-0 font-bold text-[10px]">5</div>
                    <div>
                      <p className="font-bold text-[#021541]">Conectar a Conta Central e Vincular Agenda Master</p>
                      <p className="mt-0.5">Com as credenciais salvas, clique no botão <strong>Conectar Google</strong> abaixo e conceda a permissão à conta da clínica. Após conectar, insira o <strong>ID da Agenda Central da Clínica</strong> (encontrado em <em>Configurações da Agenda → Integrar agenda → ID da agenda</em> no Google Calendar) e clique em <strong>Salvar integrações</strong>.</p>
                      <p className="mt-1 font-semibold text-[#00BCE4]">A partir deste momento, todos os agendamentos dos médicos serão refletidos e sincronizados bidirecionalmente com a agenda centralizada e a conta Google Master da clínica.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Credenciais da API do Google */}
          <div className="p-4 rounded-xl border border-[rgba(2,21,65,0.06)] shadow-sm bg-white space-y-3">
            <p className="text-xs font-bold text-[#021541] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#e6c364]" style={{ fontSize: '18px' }}>key</span>
              Credenciais da API do Google (Google Cloud Console)
            </p>
            <div className="text-[11px] text-[#718096] leading-relaxed font-light space-y-1">
              <p>Para obter acesso à agenda da clínica, crie credenciais de ID do Cliente OAuth 2.0 no Google Cloud Console.</p>
              <p>Configure a URI de redirecionamento autorizada para:</p>
              <code className="bg-[#f5f6f8] border border-[rgba(2,21,65,0.08)] px-2 py-1 rounded text-[10px] font-mono select-all block text-[#021541] font-semibold break-all">
                {origin || 'http://localhost:3000'}/api/admin/google/callback
              </code>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1.5">
                <label className={labelCls}>Google Client ID</label>
                <input
                  value={form.googleClientId}
                  onChange={(e) => set('googleClientId', e.target.value)}
                  placeholder="xxxxxx-xxxxxxxx.apps.googleusercontent.com"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Google Client Secret</label>
                <input
                  type="password"
                  value={form.googleClientSecret}
                  onChange={(e) => set('googleClientSecret', e.target.value)}
                  placeholder="••••••••••••••••••••"
                  className={inputCls}
                />
              </div>
            </div>
            <p className="text-[10px] text-[#718096]/80 italic">
              💡 Salve as alterações clicando em "Salvar integrações" no rodapé antes de realizar a conexão da conta.
            </p>
          </div>
          
          {/* Conta Google Central da Clínica */}
          <div className="p-4 rounded-xl border border-[rgba(2,21,65,0.06)] shadow-sm bg-white space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#021541] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#e6c364]" style={{ fontSize: '18px' }}>account_circle</span>
                  Conexão Google da Clínica
                </p>
                <p className="text-[11px] text-[#718096] mt-0.5 leading-relaxed font-light">
                  {googleConnected
                    ? `Conectada à conta: ${googleEmail} (${googleConnectedAt ? new Date(googleConnectedAt).toLocaleDateString('pt-BR') : ''})`
                    : 'Conecte a conta do Google após salvar o Client ID e Client Secret acima.'
                  }
                </p>
              </div>
              <div className="shrink-0">
                {googleConnected ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('Deseja realmente desconectar a conta do Google da clínica?')) return
                      try {
                        await desconectarContaGoogle()
                        setGoogleConnected(false)
                        setGoogleEmail(null)
                        setGoogleConnectedAt(null)
                        toast.success('Conta Google central desconectada!')
                      } catch {
                        toast.error('Erro ao desconectar conta Google.')
                      }
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                  >
                    Desconectar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!form.googleClientId || !form.googleClientSecret) {
                        toast.error('Por favor, insira e salve as Credenciais do Google antes de conectar.')
                        return
                      }
                      window.location.href = `/api/admin/google/connect?redirect=/configuracoes/integracoes`
                    }}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-[#e6c364] hover:bg-[#d8b355] text-[#021541] text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    Conectar Google
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5 border-t border-[rgba(2,21,65,0.06)] pt-3">
              <label className={labelCls}>ID da Agenda Central da Clínica (Agenda Master)</label>
              <input
                value={form.googleCalendarId}
                onChange={(e) => set('googleCalendarId', e.target.value)}
                placeholder="ex: e9f58db2a0ada0...aade594ef8e1cc@group.calendar.google.com"
                className={inputCls}
              />
              <p className="text-[10px] text-[#718096]">
                A agenda principal onde os compromissos de todos os médicos serão sincronizados.
              </p>
            </div>
          </div>

          {/* Agendas dos Médicos */}
          <div className="pt-2 border-t border-[rgba(2,21,65,0.06)] space-y-3">
            <div>
              <p className="text-xs font-bold text-[#021541] uppercase tracking-wider">Agendas Internas dos Médicos</p>
              <p className="text-[10px] text-[#718096] leading-relaxed mt-0.5">
                Para vincular a agenda de cada médico, insira o ID da agenda do Google correspondente ou o endereço secreto iCal.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#e6c364]/5 border border-[#e6c364]/20 text-[11px] text-[#718096]/80 leading-relaxed space-y-1">
              <p>No Google Calendar, acesse:</p>
              <p className="text-[#e6c364] font-medium">Configurações → [nome da agenda] → Integrar agenda → <span className="underline">ID da agenda ou Endereço secreto no formato iCal</span></p>
              <p className="text-[#ffb4ab]/80">⚠ Certifique-se de que a conta Google conectada acima tem acesso de edição para esta agenda.</p>
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
                    <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00BCE4]/10 text-[#00BCE4] uppercase tracking-wider">Configurada</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Google Calendar ID ou Endereço Secreto iCal</label>
                  <div className="flex gap-2">
                    <input
                      value={calendarIds[doctor.id] ?? ''}
                      onChange={(e) => setCalendarIds((p) => ({ ...p, [doctor.id]: e.target.value }))}
                      placeholder="ex: medico@gmail.com ou https://calendar.google.com/calendar/ical/.../basic.ics"
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
