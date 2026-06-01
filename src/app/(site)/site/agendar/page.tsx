'use client'

import { useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/site/SiteNav'
import SiteFooter from '@/components/site/SiteFooter'

const PROCEDURES = [
  { icon: 'water_drop',  label: 'PRP — Plasma Rico em Plaquetas' },
  { icon: 'biotech',     label: 'BMAC — Células-Tronco' },
  { icon: 'vaccines',    label: 'Ácido Hialurônico' },
  { icon: 'healing',     label: 'Proloterapia' },
  { icon: 'arthritis',   label: 'Artroscopia' },
  { icon: 'block',       label: 'Bloqueio Articular & Infiltração' },
  { icon: 'stethoscope', label: 'Consulta Ortopédica' },
  { icon: 'help_outline', label: 'Outro / Não sei ainda' },
]

const UNIDADES = [
  { id: 'sjc', label: 'São José dos Campos', sub: 'Jardim Aquarius · Sala 1106' },
  { id: 'sp',  label: 'São Paulo',           sub: 'Itaim Bibi · Medical Center' },
]

export default function AgendarPage() {
  const [form, setForm] = useState({
    name: '', phone: '', email: '',
    procedure: '', unidade: '', message: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [success, setSuccess] = useState(false)

  function setF(key: string, value: string) { setForm(p => ({ ...p, [key]: value })) }

  async function submit() {
    if (!form.name || !form.phone || !form.procedure) {
      setError('Preencha nome, telefone e procedimento de interesse.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/site/agendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      setSuccess(true)
    } catch {
      setError('Erro ao enviar. Por favor, tente novamente ou entre em contato pelo WhatsApp.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="site-skin min-h-screen" style={{ background: '#f5f6f8' }}>
      <SiteNav />

      {/* ── HERO compact ──────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-32 pb-16 px-6" style={{ background: '#021541' }}>
        <div className="absolute inset-0 dot-pattern-light opacity-20 pointer-events-none" />
        <div
          className="absolute -right-24 -top-24 w-96 h-96 rounded-full blur-[140px] pointer-events-none"
          style={{ background: 'rgba(0,188,228,0.10)' }}
        />
        <div className="max-w-xl mx-auto relative z-10 text-center">
          <span
            className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase mb-4 font-bold block"
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            — Solicitar Consulta
          </span>
          <h1
            className="text-4xl md:text-5xl text-white font-bold leading-tight mb-4"
            style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
          >
            Agende sua{' '}
            <span className="italic text-[#00BCE4] font-medium">avaliação</span>
          </h1>
          <div className="h-0.5 w-12 bg-[#00BCE4] mx-auto mb-4" />
          <p className="text-white/40 font-light text-base">
            Preencha o formulário e nossa equipe entrará em contato em até 1 dia útil.
          </p>
        </div>
      </section>

      {/* ── FORM ──────────────────────────────────────────────── */}
      <section className="py-16 px-6">
        <div className="max-w-xl mx-auto">

          {success ? (
            /* ── SUCCESS STATE ── */
            <div
              className="rounded-2xl p-14 text-center"
              style={{
                background: '#ffffff',
                border: '1px solid rgba(2,21,65,0.06)',
                boxShadow: '0 8px 48px rgba(2,21,65,0.06)',
              }}
            >
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-7"
                style={{ background: 'rgba(0,188,228,0.08)', border: '2px solid rgba(0,188,228,0.20)' }}
              >
                <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '40px', fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
              </div>
              <span
                className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase mb-3 font-bold block"
                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
              >
                — Solicitação recebida
              </span>
              <h2
                className="text-3xl text-[#021541] font-bold mb-4"
                style={{ fontFamily: 'Noto Serif, serif' }}
              >
                Obrigado, {form.name}!
              </h2>
              <div className="h-0.5 w-12 bg-[#00BCE4] mx-auto mb-5" />
              <p className="text-[#718096] leading-relaxed mb-8 font-light">
                Sua solicitação foi recebida com sucesso. Nossa equipe entrará em contato pelo número <strong className="text-[#021541] font-semibold">{form.phone}</strong> em até 1 dia útil.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Link href="/site" className="btn-primary-site">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>home</span>
                  Voltar ao início
                </Link>
                <a
                  href="https://wa.me/5512981767896"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost-site"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>message</span>
                  WhatsApp
                </a>
              </div>
            </div>

          ) : (
            /* ── FORM CARD ── */
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: '#ffffff',
                border: '1px solid rgba(2,21,65,0.06)',
                boxShadow: '0 8px 48px rgba(2,21,65,0.06)',
              }}
            >
              {/* Card header */}
              <div className="px-8 pt-8 pb-6" style={{ borderBottom: '1px solid rgba(2,21,65,0.06)' }}>
                <span
                  className="text-[10px] text-[#00BCE4] tracking-[0.3em] uppercase mb-2 font-bold block"
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  — Dados para contato
                </span>
                <p className="text-[#021541]/40 text-sm font-light">
                  Todos os campos com * são obrigatórios
                </p>
              </div>

              <div className="px-8 py-7 space-y-6">

                {/* Nome */}
                <div className="space-y-1.5">
                  <label
                    className="text-[10px] font-bold text-[#021541]/50 uppercase tracking-wider"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    Nome completo *
                  </label>
                  <div className="relative">
                    <span
                      className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#021541]/20"
                      style={{ fontSize: '18px' }}
                    >
                      person
                    </span>
                    <input
                      value={form.name}
                      onChange={e => setF('name', e.target.value)}
                      placeholder="Seu nome completo"
                      className="w-full rounded-xl pl-10 pr-4 py-3 text-sm text-[#021541] placeholder:text-[#021541]/25 transition-all duration-200"
                      style={{ background: '#f5f6f8', border: '1.5px solid transparent', outline: 'none' }}
                      onFocus={e => { e.currentTarget.style.border = '1.5px solid #00BCE4'; e.currentTarget.style.background = '#fff' }}
                      onBlur={e => { e.currentTarget.style.border = '1.5px solid transparent'; e.currentTarget.style.background = '#f5f6f8' }}
                    />
                  </div>
                </div>

                {/* Telefone + Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      className="text-[10px] font-bold text-[#021541]/50 uppercase tracking-wider"
                      style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                    >
                      Telefone / WhatsApp *
                    </label>
                    <div className="relative">
                      <span
                        className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#021541]/20"
                        style={{ fontSize: '18px' }}
                      >
                        phone
                      </span>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={e => setF('phone', e.target.value)}
                        placeholder="(12) 99999-9999"
                        className="w-full rounded-xl pl-10 pr-4 py-3 text-sm text-[#021541] placeholder:text-[#021541]/25 transition-all duration-200"
                        style={{ background: '#f5f6f8', border: '1.5px solid transparent', outline: 'none' }}
                        onFocus={e => { e.currentTarget.style.border = '1.5px solid #00BCE4'; e.currentTarget.style.background = '#fff' }}
                        onBlur={e => { e.currentTarget.style.border = '1.5px solid transparent'; e.currentTarget.style.background = '#f5f6f8' }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      className="text-[10px] font-bold text-[#021541]/50 uppercase tracking-wider"
                      style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                    >
                      E-mail
                    </label>
                    <div className="relative">
                      <span
                        className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#021541]/20"
                        style={{ fontSize: '18px' }}
                      >
                        mail
                      </span>
                      <input
                        type="email"
                        value={form.email}
                        onChange={e => setF('email', e.target.value)}
                        placeholder="seu@email.com"
                        className="w-full rounded-xl pl-10 pr-4 py-3 text-sm text-[#021541] placeholder:text-[#021541]/25 transition-all duration-200"
                        style={{ background: '#f5f6f8', border: '1.5px solid transparent', outline: 'none' }}
                        onFocus={e => { e.currentTarget.style.border = '1.5px solid #00BCE4'; e.currentTarget.style.background = '#fff' }}
                        onBlur={e => { e.currentTarget.style.border = '1.5px solid transparent'; e.currentTarget.style.background = '#f5f6f8' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Procedimento */}
                <div className="space-y-2">
                  <label
                    className="text-[10px] font-bold text-[#021541]/50 uppercase tracking-wider"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    Procedimento de interesse *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PROCEDURES.map(p => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setF('procedure', p.label)}
                        className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium text-left transition-all duration-200"
                        style={
                          form.procedure === p.label
                            ? { background: 'rgba(0,188,228,0.08)', color: '#021541', border: '1.5px solid #00BCE4' }
                            : { background: '#f5f6f8', color: '#718096', border: '1.5px solid transparent' }
                        }
                      >
                        <span
                          className="material-symbols-outlined shrink-0"
                          style={{ fontSize: '16px', color: form.procedure === p.label ? '#00BCE4' : '#021541', opacity: form.procedure === p.label ? 1 : 0.3 }}
                        >
                          {p.icon}
                        </span>
                        <span className="leading-tight text-xs">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Unidade */}
                <div className="space-y-2">
                  <label
                    className="text-[10px] font-bold text-[#021541]/50 uppercase tracking-wider"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    Unidade de preferência
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {UNIDADES.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setF('unidade', u.id)}
                        className="flex flex-col items-start px-4 py-3 rounded-xl text-sm text-left transition-all duration-200"
                        style={
                          form.unidade === u.id
                            ? { background: 'rgba(0,188,228,0.08)', border: '1.5px solid #00BCE4' }
                            : { background: '#f5f6f8', border: '1.5px solid transparent' }
                        }
                      >
                        <span className="font-semibold text-xs text-[#021541]">{u.label}</span>
                        <span className="text-[10px] text-[#718096] mt-0.5">{u.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mensagem */}
                <div className="space-y-1.5">
                  <label
                    className="text-[10px] font-bold text-[#021541]/50 uppercase tracking-wider"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    Mensagem (opcional)
                  </label>
                  <textarea
                    value={form.message}
                    onChange={e => setF('message', e.target.value)}
                    rows={3}
                    placeholder="Descreva brevemente sua queixa, dor ou dúvida..."
                    className="w-full rounded-xl px-4 py-3 text-sm text-[#021541] placeholder:text-[#021541]/25 transition-all duration-200 resize-none"
                    style={{ background: '#f5f6f8', border: '1.5px solid transparent', outline: 'none' }}
                    onFocus={e => { e.currentTarget.style.border = '1.5px solid #00BCE4'; e.currentTarget.style.background = '#fff' }}
                    onBlur={e => { e.currentTarget.style.border = '1.5px solid transparent'; e.currentTarget.style.background = '#f5f6f8' }}
                  />
                </div>

                {/* Error */}
                {error && (
                  <div
                    className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
                    style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#dc2626' }}
                  >
                    <span className="material-symbols-outlined shrink-0 mt-0.5" style={{ fontSize: '16px' }}>error</span>
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={submit}
                  disabled={saving || !form.name || !form.phone || !form.procedure}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl text-white font-bold text-sm site-transition disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #021541 0%, #0a2050 60%, #021541 100%)',
                    boxShadow: '0 4px 20px rgba(2,21,65,0.20)',
                  }}
                >
                  {saving ? (
                    <>
                      <span className="material-symbols-outlined animate-spin" style={{ fontSize: '18px' }}>refresh</span>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>calendar_month</span>
                      Solicitar Agendamento
                    </>
                  )}
                </button>

                <p className="text-xs text-[#021541]/30 text-center font-light">
                  Ao enviar, você concorda com o contato via WhatsApp ou telefone.
                  Nossa equipe responde em até 1 dia útil.
                </p>
              </div>
            </div>
          )}

          {/* Trust badges */}
          {!success && (
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {['Particular & Convênios', 'CRM SP 150430', 'USG em todos os procedimentos'].map(b => (
                <span key={b} className="badge-navy text-[10px]">{b}</span>
              ))}
            </div>
          )}
        </div>
      </section>

      <SiteFooter />

      {/* WhatsApp FAB */}
      <a
        href="https://wa.me/5512981767896"
        target="_blank"
        rel="noopener noreferrer"
        className="whatsapp-fab"
        aria-label="Fale conosco pelo WhatsApp"
      >
        <svg className="w-7 h-7 fill-white" viewBox="0 0 24 24">
          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.185-.573c.948.517 2.04.794 3.144.794h.002c3.181 0 5.767-2.586 5.767-5.766 0-3.18-2.585-5.766-5.767-5.766zm3.377 8.203c-.145.405-.837.74-1.159.789-.323.05-.63.072-1.84-.407-1.458-.578-2.397-2.055-2.47-2.152-.072-.097-.585-.778-.585-1.496 0-.717.376-1.07.509-1.216.133-.145.29-.182.387-.182h.278c.084 0 .193-.036.302.218l.434 1.054c.036.085.06.182.012.278-.048.096-.072.156-.145.241-.072.085-.157.193-.223.265-.072.073-.145.151-.06.296.084.145.374.616.804 1.002.554.496 1.02.65 1.165.723.145.073.23.06.314-.036.084-.096.362-.423.459-.567.096-.145.193-.121.326-.072.133.048.845.398.99.47.145.073.242.109.278.169.036.06.036.35-.109.754zM12 2C6.48 2 2 6.48 2 12c0 1.76.46 3.42 1.26 4.86L2 22l5.34-1.4c1.4.74 3 1.17 4.66 1.17 5.52 0 10-4.48 10-10S17.52 2 12 2z" />
        </svg>
      </a>
    </div>
  )
}
