'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { cn, getInitials } from '@/lib/utils'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ROLE_LABELS } from '@/lib/constants'
import { useState } from 'react'
import { toast } from 'sonner'
import { useClinicSettings } from '@/hooks/useClinicSettings'

interface NavItem {
  href: string
  label: string
  icon: string
  permission: Parameters<typeof hasPermission>[1]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',     label: 'Dashboard',     icon: 'dashboard',      permission: 'dashboard:view' },
  { href: '/leads',         label: 'CRM de Leads',  icon: 'leaderboard',    permission: 'leads:view' },
  { href: '/agenda',        label: 'Agenda',         icon: 'calendar_today', permission: 'agenda:view' },
  { href: '/pacientes',     label: 'Pacientes',      icon: 'group',          permission: 'patients:view' },
  { href: '/tratamentos',   label: 'Tratamentos',    icon: 'vaccines',       permission: 'treatments:view' },
  { href: '/financeiro',    label: 'Financeiro',     icon: 'payments',       permission: 'financial:view' },
  { href: '/materiais',     label: 'Materiais',      icon: 'inventory_2',    permission: 'materials:view' },
  { href: '/relatorios',    label: 'Relatórios',     icon: 'bar_chart',      permission: 'reports:view' },
  { href: '/trafego',       label: 'Tráfego Pago',   icon: 'ads_click',      permission: 'traffic:view' },
  { href: '/glossario',     label: 'Glossário',      icon: 'menu_book',      permission: 'settings:view' },
  { href: '/configuracoes', label: 'Configurações',  icon: 'settings',       permission: 'settings:view' },
]

// ── Profile Sheet ──────────────────────────────────────────────────────────────
function PasswordField({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-[#021541]/40 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#021541]/25">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>lock</span>
        </div>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#f5f6f8] border border-transparent rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#021541] placeholder:text-[#021541]/20 focus:outline-none focus:bg-white focus:border-[#00BCE4] transition-all"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#021541]/25 hover:text-[#021541]/60 transition-colors"
          tabIndex={-1}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
            {show ? 'visibility_off' : 'visibility'}
          </span>
        </button>
      </div>
    </div>
  )
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null
  const score = [/.{6,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(password)).length
  const levels = [
    { label: 'Fraca',    color: 'bg-red-400' },
    { label: 'Regular',  color: 'bg-amber-400' },
    { label: 'Boa',      color: 'bg-yellow-400' },
    { label: 'Forte',    color: 'bg-[#00BCE4]' },
  ]
  const level = levels[score - 1] ?? levels[0]
  return (
    <div className="space-y-1 mt-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={cn('h-1 flex-1 rounded-full transition-all', i < score ? level.color : 'bg-[#021541]/08')}
          />
        ))}
      </div>
      <p className="text-[10px] text-[#021541]/40">{level.label}</p>
    </div>
  )
}

function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: session, update } = useSession()
  const [tab, setTab] = useState<'info' | 'senha'>('info')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name:            session?.user?.name ?? '',
    email:           session?.user?.email ?? '',
    phone:           (session?.user as unknown as Record<string, string>)?.phone ?? '',
    avatar:          (session?.user as unknown as Record<string, string>)?.avatar ?? '',
    currentPassword: '',
    newPassword:     '',
    confirmPassword: '',
  })

  function set(key: string, val: string) { setForm(p => ({ ...p, [key]: val })) }

  const initials = getInitials(session?.user?.name ?? 'U')
  const role = (session?.user?.role ?? 'receptionist') as UserRole
  const roleLabel = ROLE_LABELS[role] ?? role

  const passwordsMatch = form.newPassword === form.confirmPassword && form.newPassword.length >= 6

  async function saveInfo() {
    setSaving(true)
    try {
      const res = await fetch('/api/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone || null, avatar: form.avatar || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro')
      await update({ name: data.data.name, email: data.data.email })
      toast.success('Perfil atualizado!')
      onClose()
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally { setSaving(false) }
  }

  async function savePassword() {
    if (!form.currentPassword) { toast.error('Informe a senha atual'); return }
    if (form.newPassword.length < 6) { toast.error('Nova senha precisa ter ao menos 6 caracteres'); return }
    if (!passwordsMatch) { toast.error('Senhas não coincidem'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro')
      toast.success('Senha alterada!')
      setForm(p => ({ ...p, currentPassword: '', newPassword: '', confirmPassword: '' }))
      onClose()
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally { setSaving(false) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      {/* backdrop */}
      <div className="absolute inset-0 bg-[#021541]/25 backdrop-blur-sm" onClick={onClose} />

      {/* panel */}
      <div className="relative w-[380px] h-full flex flex-col bg-white shadow-2xl border-l border-[rgba(2,21,65,0.08)]">

        {/* ── HEADER com gradiente ── */}
        <div className="relative bg-gradient-to-br from-[#021541] via-[#032170] to-[#021541] overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-[#00BCE4]/10 blur-3xl pointer-events-none" />

          <div className="relative px-6 pt-6 pb-5">
            {/* fechar */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
            </button>

            {/* avatar */}
            <div className="flex flex-col items-center gap-3 mb-1">
              {form.avatar ? (
                <img
                  src={form.avatar}
                  alt={form.name}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-[#00BCE4]/40 shadow-lg"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-[#00BCE4]/20 border border-[#00BCE4]/30 flex items-center justify-center text-2xl font-bold text-[#00BCE4] select-none shadow-lg">
                  {initials}
                </div>
              )}
              <div className="text-center">
                <p className="text-base font-bold text-white leading-tight">{session?.user?.name}</p>
                <p className="text-[10px] text-[#00BCE4]/80 font-semibold uppercase tracking-widest mt-1">
                  {roleLabel}
                </p>
                {session?.user?.email && (
                  <p className="text-[11px] text-white/35 mt-0.5">{session.user.email}</p>
                )}
              </div>
            </div>
          </div>

          {/* tabs dentro do header */}
          <div className="flex gap-px px-4 pb-0">
            {([
              { id: 'info',  label: 'Dados Pessoais', icon: 'person' },
              { id: 'senha', label: 'Alterar Senha',  icon: 'lock' },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold transition-all border-b-2',
                  tab === t.id
                    ? 'text-white border-[#00BCE4]'
                    : 'text-white/30 border-transparent hover:text-white/60 hover:border-white/20'
                )}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">

          {tab === 'info' && (
            <div className="p-5 space-y-4">

              {/* Nome */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#021541]/40 uppercase tracking-wider">Nome completo</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#021541]/25" style={{ fontSize: '16px' }}>badge</span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="Seu nome"
                    className="w-full bg-white border border-[rgba(2,21,65,0.10)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#021541] placeholder:text-[#021541]/20 focus:outline-none focus:border-[#00BCE4] focus:ring-2 focus:ring-[#00BCE4]/15 transition-all"
                  />
                </div>
              </div>

              {/* E-mail */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#021541]/40 uppercase tracking-wider">E-mail</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#021541]/25" style={{ fontSize: '16px' }}>mail</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="email@exemplo.com"
                    className="w-full bg-white border border-[rgba(2,21,65,0.10)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#021541] placeholder:text-[#021541]/20 focus:outline-none focus:border-[#00BCE4] focus:ring-2 focus:ring-[#00BCE4]/15 transition-all"
                  />
                </div>
              </div>

              {/* Telefone */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#021541]/40 uppercase tracking-wider">Telefone</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#021541]/25" style={{ fontSize: '16px' }}>phone</span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    placeholder="(12) 99999-9999"
                    className="w-full bg-white border border-[rgba(2,21,65,0.10)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#021541] placeholder:text-[#021541]/20 focus:outline-none focus:border-[#00BCE4] focus:ring-2 focus:ring-[#00BCE4]/15 transition-all"
                  />
                </div>
              </div>

              {/* Avatar URL */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#021541]/40 uppercase tracking-wider">URL da foto de perfil</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#021541]/25" style={{ fontSize: '16px' }}>image</span>
                  <input
                    type="text"
                    value={form.avatar}
                    onChange={e => set('avatar', e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-white border border-[rgba(2,21,65,0.10)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#021541] placeholder:text-[#021541]/20 focus:outline-none focus:border-[#00BCE4] focus:ring-2 focus:ring-[#00BCE4]/15 transition-all"
                  />
                </div>
                {form.avatar && (
                  <div className="flex items-center gap-2 pl-1">
                    <img
                      src={form.avatar}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover border border-[rgba(0,188,228,0.30)]"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    <span className="text-[10px] text-[#021541]/35">Preview da foto</span>
                  </div>
                )}
              </div>

              <button
                onClick={saveInfo}
                disabled={saving || !form.name.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-br from-[#021541] to-[#032170] shadow-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity mt-2"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  {saving ? 'hourglass_empty' : 'save'}
                </span>
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          )}

          {tab === 'senha' && (
            <div className="p-5 space-y-4">

              <div className="bg-white border border-[rgba(2,21,65,0.06)] rounded-2xl p-4 space-y-4">
                <PasswordField
                  label="Senha atual"
                  value={form.currentPassword}
                  onChange={v => set('currentPassword', v)}
                  placeholder="••••••••"
                />

                <div className="border-t border-[rgba(2,21,65,0.06)]" />

                <div className="space-y-1.5">
                  <PasswordField
                    label="Nova senha"
                    value={form.newPassword}
                    onChange={v => set('newPassword', v)}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <PasswordStrength password={form.newPassword} />
                </div>

                <div className="space-y-1.5">
                  <PasswordField
                    label="Confirmar nova senha"
                    value={form.confirmPassword}
                    onChange={v => set('confirmPassword', v)}
                    placeholder="Repita a nova senha"
                  />
                  {form.confirmPassword && (
                    <p className={cn(
                      'text-[11px] flex items-center gap-1 mt-1',
                      passwordsMatch ? 'text-[#00BCE4]' : 'text-red-500'
                    )}>
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                        {passwordsMatch ? 'check_circle' : 'cancel'}
                      </span>
                      {passwordsMatch ? 'Senhas conferem' : 'Senhas não coincidem'}
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-[rgba(0,188,228,0.06)] border border-[rgba(0,188,228,0.15)] rounded-xl p-3 flex gap-2">
                <span className="material-symbols-outlined text-[#00BCE4] shrink-0 mt-0.5" style={{ fontSize: '14px' }}>info</span>
                <p className="text-[11px] text-[#021541]/50 leading-relaxed">
                  Use ao menos 6 caracteres. Combine letras maiúsculas, números e símbolos para uma senha mais forte.
                </p>
              </div>

              <button
                onClick={savePassword}
                disabled={saving || !form.currentPassword || !passwordsMatch}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-br from-[#021541] to-[#032170] shadow-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  {saving ? 'hourglass_empty' : 'lock_reset'}
                </span>
                {saving ? 'Alterando...' : 'Alterar senha'}
              </button>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="px-5 py-4 bg-white border-t border-[rgba(2,21,65,0.06)] shrink-0">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-red-500 bg-red-50 border border-red-100 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>logout</span>
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sidebar content ────────────────────────────────────────────────────────────
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [profileOpen, setProfileOpen] = useState(false)
  const role = (session?.user?.role ?? 'receptionist') as UserRole
  const clinic = useClinicSettings(true)

  const visibleItems = NAV_ITEMS.filter((item) => hasPermission(role, item.permission))
  const initials = getInitials(session?.user?.name ?? 'U')
  const userName = session?.user?.name ?? ''
  const userEmail = session?.user?.email ?? ''
  const roleLabel = ROLE_LABELS[role] ?? role
  const avatar = (session?.user as unknown as Record<string, string>)?.avatar

  return (
    <>
      <div
        className="flex flex-col h-full w-[220px]"
        style={{
          background: '#ffffff',
          borderRight: '1px solid rgba(2,21,65,0.07)',
        }}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(2,21,65,0.06)' }}>
          <Link href="/site" className="flex items-center gap-3 group w-fit" target="_blank">
            {clinic.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={clinic.logoUrl}
                alt={clinic.name ?? 'REGENORTHO'}
                className="h-8 max-w-[160px] object-contain"
              />
            ) : (
              <>
                <div className="relative w-2 h-2 shrink-0">
                  <div className="absolute inset-0 rounded-full bg-[#00BCE4] animate-pulse-ring" />
                  <div className="w-2 h-2 rounded-full bg-[#00BCE4]" />
                </div>
                <div className="flex flex-col">
                  <span
                    className="font-black text-sm text-[#021541] leading-tight tracking-[0.10em] uppercase"
                    style={{ fontFamily: 'Outfit, sans-serif' }}
                  >
                    {clinic.name ?? 'REGENORTHO'}
                  </span>
                  <span
                    className="text-[9px] text-[#00BCE4]/70 leading-tight tracking-widest uppercase font-semibold"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    Sistema de Gestão
                  </span>
                </div>
              </>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group',
                  isActive
                    ? 'text-[#021541] bg-[#00BCE4]/08'
                    : 'text-[#021541]/45 hover:text-[#021541] hover:bg-[#f5f6f8]'
                )}
                style={isActive ? { borderLeft: '2px solid #00BCE4', paddingLeft: '10px' } : {}}
              >
                <span
                  className="material-symbols-outlined shrink-0"
                  style={{
                    fontSize: '20px',
                    color: isActive ? '#00BCE4' : undefined,
                  }}
                >
                  {item.icon}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00BCE4] shrink-0" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* User footer */}
        <div
          className="px-3 py-4"
          style={{ borderTop: '1px solid rgba(2,21,65,0.06)' }}
        >
          <button
            onClick={() => setProfileOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f5f6f8] transition-colors group text-left"
            title="Editar perfil"
          >
            {avatar ? (
              <img
                src={avatar}
                alt={userName}
                className="w-8 h-8 rounded-full object-cover shrink-0"
                style={{ border: '1.5px solid rgba(0,188,228,0.30)' }}
              />
            ) : (
              <div
                className="flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-xs shrink-0 select-none"
                style={{ background: 'linear-gradient(135deg, #021541, #0a2050)' }}
              >
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-bold text-[#021541] truncate group-hover:text-[#00BCE4] transition-colors"
                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
              >
                {userName}
              </p>
              <p className="text-[10px] text-[#021541]/35 truncate">
                {userEmail || roleLabel}
              </p>
            </div>
            <span
              className="material-symbols-outlined text-[#021541]/20 group-hover:text-[#00BCE4] transition-colors shrink-0"
              style={{ fontSize: '15px' }}
            >
              edit
            </span>
          </button>
        </div>
      </div>

      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex h-screen sticky top-0 shrink-0 w-[220px]">
      <SidebarContent />
    </aside>
  )
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="md:hidden p-2 text-[#021541]/40 hover:text-[#021541] hover:bg-[#f5f6f8] rounded-lg transition-colors"
        aria-label="Abrir menu"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>menu</span>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="p-0 w-[220px] border-r"
        style={{ background: '#ffffff', borderColor: 'rgba(2,21,65,0.07)' }}
      >
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
