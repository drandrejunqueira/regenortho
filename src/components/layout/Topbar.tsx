'use client'

import { usePathname } from 'next/navigation'
import { MobileSidebar } from './Sidebar'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard':            'Dashboard',
  '/leads':                'CRM de Leads',
  '/agenda':               'Agenda',
  '/pacientes':            'Pacientes',
  '/financeiro':           'Financeiro',
  '/materiais':            'Materiais',
  '/tratamentos':          'Tratamentos',
  '/trafego':              'Tráfego Pago',
  '/relatorios':           'Relatórios',
  '/configuracoes':        'Configurações',
  '/configuracoes/usuarios': 'Configurações',
}

export function Topbar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const label = Object.entries(ROUTE_LABELS).find(([path]) =>
    pathname === path || pathname.startsWith(path + '/')
  )?.[1] ?? 'REGENORTHO'

  return (
    <header
      className="sticky top-0 z-40 flex items-center h-[60px] px-6 md:px-8"
      style={{
        background: 'rgba(245,246,248,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(2,21,65,0.07)',
      }}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Mobile hamburger */}
        <div className="md:hidden">
          <MobileSidebar />
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full bg-[#00BCE4]"
            aria-hidden="true"
          />
          <h1
            className="font-bold text-base text-[#021541] tracking-tight truncate"
            style={{ fontFamily: 'Plus Jakarta Sans, Manrope, sans-serif' }}
          >
            {label}
          </h1>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">

        {/* Site link */}
        <Link
          href="/site"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-[#021541]/40 hover:text-[#021541] hover:bg-[#021541]/5 transition-colors"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          target="_blank"
          title="Ver o site público"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
          Site
        </Link>

        {/* Divider */}
        <div className="h-4 w-px bg-[#021541]/10 mx-1" />

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg text-[#021541]/40 hover:text-[#021541] hover:bg-[#021541]/5 transition-colors"
          aria-label="Notificações"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>notifications</span>
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#00BCE4] rounded-full" />
        </button>

        {/* User chip */}
        <div
          className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl ml-1"
          style={{ background: 'rgba(2,21,65,0.04)', border: '1px solid rgba(2,21,65,0.07)' }}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
            style={{ background: '#021541' }}
          >
            {session?.user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <span
            className="text-[12px] font-semibold text-[#021541] hidden sm:block"
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            {session?.user?.name?.split(' ')[0]}
          </span>
        </div>
      </div>
    </header>
  )
}
