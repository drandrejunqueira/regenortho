'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useClinicSettings } from '@/hooks/useClinicSettings'

const NAV_LINKS = [
  { href: '/site/tratamentos', label: 'Tratamentos' },
  { href: '/site/especialidades', label: 'Especialidades' },
  { href: '/site/a-clinica', label: 'A Clínica' },
  { href: '/site/blog', label: 'Blog' },
]

export default function SiteNav() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const clinic = useClinicSettings()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      {/* ── Accent Bar lateral (Arton Design Guide) ── */}
      <div className="site-accent-bar" aria-hidden="true" />

      <header
        id="site-nav"
        className={`fixed z-50 transition-all duration-500 ease-out ${
          scrolled
            ? 'top-3 left-4 right-4 md:left-8 md:right-8 rounded-2xl glass-hud shadow-lg'
            : 'top-0 left-0 right-0 bg-[#f5f6f8]/95 backdrop-blur-sm border-b border-[rgba(2,21,65,0.06)]'
        }`}
      >
        <div className="site-skin flex justify-between items-center w-full px-5 md:px-8 py-3.5 max-w-screen-2xl mx-auto">

          {/* ── Logo ── */}
          <Link href="/site" className="flex items-center gap-3 group" aria-label="REGENORTHO — Página Inicial">
            {clinic.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={clinic.logoUrl}
                alt={clinic.name ?? 'REGENORTHO'}
                className="h-9 max-w-[180px] object-contain"
              />
            ) : (
              <>
                {/* Kinetic accent dot */}
                <div className="relative w-2 h-2">
                  <div className="absolute inset-0 rounded-full bg-[#00BCE4] animate-pulse-ring" />
                  <div className="w-2 h-2 rounded-full bg-[#00BCE4]" />
                </div>
                <div className="flex flex-col leading-none">
                  <span
                    className="text-base font-black tracking-[0.16em] text-[#021541] uppercase"
                    style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '0.16em' }}
                  >
                    {clinic.name ?? 'REGENORTHO'}
                  </span>
                  <span
                    className="text-[8.5px] font-semibold uppercase tracking-[0.12em] text-[#00BCE4]"
                    style={{ fontFamily: 'Plus Jakarta Sans, Manrope, sans-serif' }}
                  >
                    Ortopedia Regenerativa · SJC
                  </span>
                </div>
              </>
            )}
          </Link>

          {/* ── Desktop Nav ── */}
          <nav className="hidden md:flex items-center gap-7" aria-label="Navegação principal">
            {NAV_LINKS.map((link) => {
              const isActive = pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative text-[11px] uppercase tracking-[0.12em] font-semibold transition-colors duration-300 pb-1 ${
                    isActive
                      ? 'text-[#021541] nav-dot-active'
                      : 'text-[#021541]/50 hover:text-[#021541]'
                  }`}
                  style={{ fontFamily: 'Plus Jakarta Sans, Manrope, sans-serif' }}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          {/* ── Actions ── */}
          <div className="flex items-center gap-2">
            {/* Admin gear */}
            <Link
              href="/dashboard"
              className="hidden md:flex items-center justify-center p-2 text-[#021541]/20 hover:text-[#00BCE4] transition-colors duration-300"
              title="Acesso Administrativo"
              aria-label="Painel administrativo"
            >
              <span className="material-symbols-outlined animate-gear-slow" style={{ fontSize: '18px' }}>
                settings
              </span>
            </Link>

            {/* Portal paciente */}
            <Link
              href="/portal"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-[#021541]/45 hover:text-[#021541] text-[10px] uppercase tracking-widest transition-colors duration-300"
              style={{ fontFamily: 'Plus Jakarta Sans, Manrope, sans-serif' }}
              aria-label="Área do paciente"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                person_pin
              </span>
              Paciente
            </Link>

            {/* CTA */}
            <Link
              href="/site/agendar"
              id="nav-agendar-cta"
              className="btn-primary-site"
              aria-label="Agendar avaliação"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                calendar_month
              </span>
              Agendar
            </Link>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden flex flex-col gap-1.5 p-2 text-[#021541]"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileOpen}
            >
              <span
                className={`block w-5 h-0.5 bg-[#021541] transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`}
              />
              <span
                className={`block w-5 h-0.5 bg-[#021541] transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`}
              />
              <span
                className={`block w-5 h-0.5 bg-[#021541] transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* ── Mobile Nav Dropdown ── */}
        {mobileOpen && (
          <div className="md:hidden site-skin glass-hud border-t border-[rgba(2,21,65,0.06)] px-5 py-6 flex flex-col gap-4">
            {NAV_LINKS.map((link) => {
              const isActive = pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`text-[11px] uppercase tracking-[0.12em] font-semibold py-2 border-b border-[rgba(2,21,65,0.06)] transition-colors ${
                    isActive ? 'text-[#021541]' : 'text-[#021541]/50'
                  }`}
                  style={{ fontFamily: 'Plus Jakarta Sans, Manrope, sans-serif' }}
                >
                  {link.label}
                </Link>
              )
            })}
            <Link
              href="/site/agendar"
              onClick={() => setMobileOpen(false)}
              className="btn-primary-site w-full justify-center mt-2"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                calendar_month
              </span>
              Agendar Avaliação
            </Link>
          </div>
        )}
      </header>
    </>
  )
}
