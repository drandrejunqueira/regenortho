'use client'

import { usePathname } from 'next/navigation'
import { MobileSidebar } from './Sidebar'
import { useSession } from 'next-auth/react'

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/leads': 'CRM de Leads',
  '/agenda': 'Agenda',
  '/pacientes': 'Pacientes',
  '/financeiro': 'Financeiro',
  '/materiais': 'Materiais',
  '/trafego': 'Tráfego Pago',
  '/relatorios': 'Relatórios',
  '/configuracoes/usuarios': 'Configurações',
}

export function Topbar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const label = Object.entries(ROUTE_LABELS).find(([path]) =>
    pathname === path || pathname.startsWith(path + '/')
  )?.[1] ?? 'Regem Orto'

  return (
    <header className="sticky top-0 z-40 flex items-center h-[60px] px-8 bg-[#0A0E14]/60 backdrop-blur-xl border-b border-[#3e4949]/10">
      <div className="flex items-center gap-4 flex-1">
        <div className="md:hidden">
          <MobileSidebar />
        </div>
        <h1 className="font-bold text-lg text-[#dfe2eb] tracking-tight">{label}</h1>
      </div>
      <div className="flex items-center gap-3">
        <button className="p-2 text-[#dfe2eb]/60 hover:text-[#61d8dd] transition-colors relative" aria-label="Notificações">
          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>notifications</span>
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#ffb4ab] rounded-full"></span>
        </button>
        <div className="h-5 w-[1px] bg-[#3e4949]/30"></div>
        <span className="text-sm font-medium text-[#dfe2eb]/60">{session?.user?.name?.split(' ')[0]}</span>
      </div>
    </header>
  )
}
