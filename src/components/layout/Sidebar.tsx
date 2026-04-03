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

interface NavItem {
  href: string
  label: string
  icon: string
  permission: Parameters<typeof hasPermission>[1]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', permission: 'dashboard:view' },
  { href: '/leads', label: 'CRM de Leads', icon: 'leaderboard', permission: 'leads:view' },
  { href: '/agenda', label: 'Agenda', icon: 'calendar_today', permission: 'agenda:view' },
  { href: '/trafego', label: 'Tráfego Pago', icon: 'ads_click', permission: 'traffic:view' },
  { href: '/relatorios', label: 'Relatórios', icon: 'bar_chart', permission: 'reports:view' },
  { href: '/materiais', label: 'Materiais', icon: 'inventory_2', permission: 'materials:view' },
  { href: '/pacientes', label: 'Pacientes', icon: 'group', permission: 'patients:view' },
  { href: '/financeiro', label: 'Financeiro', icon: 'payments', permission: 'financial:view' },
  { href: '/configuracoes/usuarios', label: 'Configurações', icon: 'settings', permission: 'users:view' },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = (session?.user?.role ?? 'receptionist') as UserRole

  const visibleItems = NAV_ITEMS.filter((item) => hasPermission(role, item.permission))
  const initials = getInitials(session?.user?.name ?? 'U')
  const userName = session?.user?.name ?? ''
  const roleLabel = ROLE_LABELS[role] ?? role

  return (
    <div className="flex flex-col h-full w-[220px] bg-[#181c22]">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-[#006e72] to-[#61d8dd] text-[#003739] font-bold text-sm select-none shrink-0">
            RO
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm text-[#dfe2eb] leading-tight">Regem Orto</span>
            <span className="text-[10px] text-[#61d8dd]/70 leading-tight tracking-widest uppercase font-medium">
              Sistema de Gestão
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative',
                isActive
                  ? 'text-[#61d8dd] border-l-2 border-[#61d8dd] pl-[10px]'
                  : 'text-[#dfe2eb]/60 hover:text-[#61d8dd] hover:bg-[#1c2026]'
              )}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-[#3e4949]/20">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#006e72] text-[#dfe2eb] font-bold text-xs shrink-0 select-none">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#dfe2eb] truncate">{userName}</p>
            <p className="text-xs text-[#bec9c9] truncate">{roleLabel}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-1.5 text-[#dfe2eb]/60 hover:text-[#ffb4ab] transition-colors rounded-lg hover:bg-[#ffb4ab]/10"
            aria-label="Sair"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
          </button>
        </div>
      </div>
    </div>
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
      <SheetTrigger className="md:hidden p-1 text-[#dfe2eb]/60 hover:text-[#61d8dd] transition-colors" aria-label="Abrir menu">
        <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-[220px] bg-[#181c22] border-r border-[#3e4949]/20">
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
