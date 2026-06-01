import type { Metadata } from 'next'
import { getTermosPublicados } from '@/lib/db/queries/glossario'
import { GlossarioPublicClient } from '@/components/site/GlossarioPublicClient'
import SiteNav from '@/components/site/SiteNav'
import SiteFooter from '@/components/site/SiteFooter'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Glossário de Ortopedia e Tratamento da Dor',
  description: 'Entenda os principais termos técnicos, diagnósticos, procedimentos e siglas em ortopedia e medicina regenerativa.',
}

export default async function GlossarioPage() {
  const termos = await getTermosPublicados()

  return (
    <div className="site-skin min-h-screen" style={{ background: '#f5f6f8' }}>
      <SiteNav />

      <main className="relative z-10 bg-[#f5f6f8] pt-24 pb-20">
        <div className="max-w-4xl mx-auto px-6">
          
          {/* Header */}
          <div className="mb-12 text-center md:text-left">
            <span 
              className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase block mb-3 font-bold"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              — Dicionário Médico Ilustrado
            </span>
            <h1 
              className="text-4xl md:text-5xl text-[#021541] font-bold tracking-tight"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              Glossário de Ortopedia
            </h1>
            <p className="text-[#718096] text-sm font-light mt-3 max-w-xl">
              Esclareça suas dúvidas sobre patologias, exames de imagem e as mais modernas terapias regenerativas articulares de forma rápida e didática.
            </p>
          </div>

          {/* Client Interactive Area */}
          {/* @ts-ignore */}
          <GlossarioPublicClient termos={termos} />

        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
