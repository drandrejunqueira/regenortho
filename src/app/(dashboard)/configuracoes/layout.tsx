'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/configuracoes/sistema',       label: 'Sistema',        icon: 'tune' },
  { href: '/configuracoes/site',          label: 'Site & SEO',     icon: 'globe' },
  { href: '/configuracoes/usuarios',      label: 'Usuários',       icon: 'manage_accounts' },
  { href: '/configuracoes/salas',         label: 'Salas',          icon: 'meeting_room' },
  { href: '/configuracoes/pagamentos',    label: 'Pagamentos',     icon: 'credit_card' },
  { href: '/configuracoes/contas',        label: 'Contas',         icon: 'account_balance' },
  { href: '/configuracoes/notificacoes',  label: 'Notificações',   icon: 'notifications_active' },
  { href: '/configuracoes/seo',           label: 'SEO',            icon: 'travel_explore' },
  { href: '/configuracoes/geo',           label: 'GEO (IA)',       icon: 'psychology' },
  { href: '/configuracoes/integracoes',   label: 'Integrações',    icon: 'hub' },
  { href: '/configuracoes/backup',        label: 'Backup',         icon: 'cloud_done' },
  { href: '/configuracoes/logs',          label: 'Logs',           icon: 'receipt_long' },
  { href: '/configuracoes/webhooks',      label: 'Webhooks',       icon: 'webhook' },
]

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div>
      {/* Page title */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#021541]">Configurações</h1>
        <p className="text-sm text-[#718096] mt-0.5">Gerencie as configurações do sistema e da clínica</p>
      </div>

      {/* Tab bar — scrollable on mobile */}
      <div className="flex gap-1 mb-6 bg-white border border-[rgba(2,21,65,0.06)] shadow-[0_2px_8px_rgba(2,21,65,0.04)] rounded-xl p-1 overflow-x-auto">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                active
                  ? 'bg-[#021541] text-white shadow-sm'
                  : 'text-[#718096] hover:text-[#021541] hover:bg-[rgba(2,21,65,0.04)]'
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                {tab.icon}
              </span>
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* Tab content */}
      {children}
    </div>
  )
}
