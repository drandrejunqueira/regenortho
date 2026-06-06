'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

const QUICK_LOGINS = [
  { label: 'Admin',      email: 'admin@regemorto.com.br',      password: 'Regem@2025',      icon: 'shield_person' },
  { label: 'Médico',     email: 'medico@regemorto.com.br',     password: 'Medico@2025',     icon: 'stethoscope' },
  { label: 'Recepção',   email: 'recepcao@regemorto.com.br',   password: 'Recepcao@2025',   icon: 'headset_mic' },
  { label: 'Financeiro', email: 'financeiro@regemorto.com.br', password: 'Financeiro@2025', icon: 'payments' },
]

const BRAND_FEATURES = [
  { icon: 'group_add',      value: '500+',  label: 'Pacientes' },
  { icon: 'star',           value: '5.0★',  label: 'Avaliação Google' },
  { icon: 'calendar_month', value: '2',     label: 'Unidades' },
  { icon: 'biotech',        value: '10+',   label: 'Anos em Ortopedia' },
]

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginForm) {
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })
      if (result?.error) {
        toast.error('E-mail ou senha inválidos. Tente novamente.')
      } else {
        toast.success('Bem-vindo!')
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      toast.error('Erro ao conectar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function quickLogin(email: string, password: string, label: string) {
    setLoading(true)
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) { toast.error('Credencial inválida'); setLoading(false) }
    else { toast.success(`Bem-vindo, ${label}!`); router.push('/dashboard'); router.refresh() }
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ background: '#f5f6f8', fontFamily: 'Manrope, sans-serif' }}
    >

      {/* ── LEFT PANEL — Brand (desktop only) ────────────────── */}
      <div
        className="hidden lg:flex lg:w-[45%] relative overflow-hidden flex-col justify-between p-14"
        style={{ background: '#021541' }}
      >
        {/* Dot pattern */}
        <div className="absolute inset-0 dot-pattern-light opacity-20 pointer-events-none" />
        {/* Glow */}
        <div
          className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full blur-[150px] pointer-events-none"
          style={{ background: 'rgba(0,188,228,0.10)' }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/site" className="flex items-center gap-3 group w-fit">
            <div className="relative w-2.5 h-2.5">
              <div className="absolute inset-0 rounded-full bg-[#00BCE4] animate-pulse-ring" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#00BCE4]" />
            </div>
            <div>
              <span
                className="text-base font-black tracking-[0.16em] text-white uppercase block"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                REGENORTHO
              </span>
              <span
                className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#00BCE4]/70 block"
                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
              >
                Sistema Clínico Interno
              </span>
            </div>
          </Link>
        </div>

        {/* Main message */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-12">
          <span
            className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase mb-5 font-bold block"
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            — Acesso Seguro
          </span>
          <h1
            className="text-5xl text-white font-bold leading-tight mb-6"
            style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
          >
            Gestão clínica<br />
            <span className="italic text-[#00BCE4] font-medium">de ponta a ponta</span>
          </h1>
          <div className="h-0.5 w-16 bg-[#00BCE4] mb-6" />
          <p
            className="text-white/40 text-base font-light leading-relaxed max-w-sm"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Centralize leads, agenda, pacientes, financeiro e materiais em uma única plataforma especializada para ortopedia regenerativa.
          </p>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 mt-12">
            {BRAND_FEATURES.map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-3 p-4 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(0,188,228,0.12)', border: '1px solid rgba(0,188,228,0.20)' }}
                >
                  <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '18px' }}>{f.icon}</span>
                </div>
                <div>
                  <span
                    className="text-white font-bold text-lg block leading-none"
                    style={{ fontFamily: 'Noto Serif, serif' }}
                  >
                    {f.value}
                  </span>
                  <span
                    className="text-white/40 text-[10px] uppercase tracking-wider font-semibold"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    {f.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/20 text-xs">
            REGENORTHO © {new Date().getFullYear()} · São José dos Campos, SP
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL — Form ───────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-16 relative overflow-hidden">

        {/* Subtle background pattern */}
        <div className="absolute inset-0 dot-pattern-light opacity-30 pointer-events-none" />

        {/* Mobile logo */}
        <div className="lg:hidden mb-10 flex items-center gap-3">
          <div className="relative w-2 h-2">
            <div className="absolute inset-0 rounded-full bg-[#00BCE4] animate-pulse-ring" />
            <div className="w-2 h-2 rounded-full bg-[#00BCE4]" />
          </div>
          <span
            className="text-base font-black tracking-[0.16em] text-[#021541] uppercase"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            REGENORTHO
          </span>
        </div>

        <div className="w-full max-w-sm relative z-10">

          {/* Form header */}
          <div className="mb-10">
            <span
              className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase mb-3 font-bold block"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              — Acesso ao Sistema
            </span>
            <h2
              className="text-4xl text-[#021541] font-bold"
              style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
            >
              Entrar na<br />
              <span className="italic text-[#00BCE4] font-medium">plataforma</span>
            </h2>
            <div className="h-0.5 w-12 bg-[#00BCE4] mt-4" />
          </div>

          {/* Form card */}
          <div
            className="rounded-2xl p-8"
            style={{
              background: '#ffffff',
              border: '1px solid rgba(2,21,65,0.08)',
              boxShadow: '0 8px 48px rgba(2,21,65,0.06)',
            }}
          >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

              {/* E-mail */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
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
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com.br"
                    className="w-full rounded-xl pl-10 pr-4 py-3 text-sm text-[#021541] placeholder:text-[#021541]/25 transition-all duration-200"
                    style={{
                      background: '#f5f6f8',
                      border: errors.email ? '1.5px solid #ef4444' : '1.5px solid transparent',
                      outline: 'none',
                    }}
                    onFocus={e => { e.currentTarget.style.border = '1.5px solid #00BCE4'; e.currentTarget.style.background = '#fff' }}
                    {...register('email', {
                      onBlur: e => {
                        e.currentTarget.style.border = errors.email ? '1.5px solid #ef4444' : '1.5px solid transparent';
                        e.currentTarget.style.background = '#f5f6f8';
                      }
                    })}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>error</span>
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Senha */}
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-[10px] font-bold text-[#021541]/50 uppercase tracking-wider"
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  Senha
                </label>
                <div className="relative">
                  <span
                    className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#021541]/20"
                    style={{ fontSize: '18px' }}
                  >
                    lock
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full rounded-xl pl-10 pr-12 py-3 text-sm text-[#021541] placeholder:text-[#021541]/25 transition-all duration-200"
                    style={{
                      background: '#f5f6f8',
                      border: errors.password ? '1.5px solid #ef4444' : '1.5px solid transparent',
                      outline: 'none',
                    }}
                    onFocus={e => { e.currentTarget.style.border = '1.5px solid #00BCE4'; e.currentTarget.style.background = '#fff' }}
                    {...register('password', {
                      onBlur: e => {
                        e.currentTarget.style.border = errors.password ? '1.5px solid #ef4444' : '1.5px solid transparent';
                        e.currentTarget.style.background = '#f5f6f8';
                      }
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#021541]/30 hover:text-[#00BCE4] transition-colors"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>error</span>
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 mt-2 site-transition disabled:opacity-50"
                style={{
                  backgroundColor: '#021541',
                  backgroundImage: loading ? 'none' : 'linear-gradient(135deg, #021541 0%, #0a2050 60%, #021541 100%)',
                  backgroundSize: '200% 200%',
                  boxShadow: '0 4px 20px rgba(2,21,65,0.20)',
                }}
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin" style={{ fontSize: '18px' }}>refresh</span>
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-xs text-[#021541]/30 mt-5">
              Problemas para acessar?{' '}
              <span className="text-[#00BCE4] cursor-pointer hover:text-[#021541] transition-colors font-medium">
                Fale com o administrador
              </span>
            </p>
          </div>

          {/* ── Dev quick-login ── */}
          <div className="mt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: 'rgba(2,21,65,0.08)' }} />
              <span
                className="text-[10px] font-bold text-[#021541]/30 uppercase tracking-widest"
                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
              >
                Acesso rápido · dev
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(2,21,65,0.08)' }} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_LOGINS.map(acc => (
                <button
                  key={acc.label}
                  type="button"
                  disabled={loading}
                  onClick={() => quickLogin(acc.email, acc.password, acc.label)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] disabled:opacity-40"
                  style={{
                    background: '#ffffff',
                    color: '#021541',
                    border: '1.5px solid rgba(2,21,65,0.10)',
                    boxShadow: '0 1px 4px rgba(2,21,65,0.04)',
                  }}
                >
                  <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '14px' }}>{acc.icon}</span>
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
