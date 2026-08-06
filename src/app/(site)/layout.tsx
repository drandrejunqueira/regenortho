import type { Metadata } from 'next'
import { LenisProvider } from '@/components/site/LenisProvider'
import { PageTracker } from '@/components/site/PageTracker'
import { Suspense } from 'react'
import { getAllConfigs } from '@/lib/db/queries/configuracoes'
import { db } from '@/lib/db'
import { clinicSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getClinicJsonLd } from '@/lib/seo/jsonld'

export async function generateMetadata(): Promise<Metadata> {
  const configs = await getAllConfigs()
  const clinic = await db.query.clinicSettings.findFirst({ where: eq(clinicSettings.id, 1) })

  const title = clinic?.seoTitle || 'REGENORTHO — Ortopedia Regenerativa e Tratamento da Dor'
  const description = clinic?.seoDescription || 'Referência em medicina regenerativa intervencionista. Tratamentos avançados com PRP, BMAC, Ácido Hialurônico e Proloterapia em São José dos Campos.'
  const keywordsRaw = clinic?.seoKeywords || 'ortopedia, medicina regenerativa, PRP, BMAC, ácido hialurônico, proloterapia, Dr. André Junqueira, São José dos Campos, tratamento da dor'
  const keywords = keywordsRaw ? keywordsRaw.split(',').map((k) => k.trim()) : []
  const base = (configs.site_url || 'https://regenortho.com.br').replace(/\/$/, '')
  const ogImage = clinic?.ogImageUrl || `${base}/image/logo.png`

  let metadataBase: URL | undefined
  try {
    const canonical = base.startsWith('http') ? base : `https://${base}`
    metadataBase = new URL(canonical)
  } catch {
    metadataBase = new URL('https://regenortho.com.br')
  }

  return {
    metadataBase,
    title: {
      default: title,
      template: `%s | ${clinic?.name || 'REGENORTHO'}`,
    },
    description,
    keywords,
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      siteName: clinic?.name || 'REGENORTHO Clinical Atelier',
      images: [{ url: '/api/og-image', width: 1200, height: 630 }],
    },
    icons: { icon: '/api/favicon' },
    verification: {
      google: 'o-YuvObMWgLt9q4nWBsCntEtTkgSaPJfzlIJg77Sp30',
    },
    other: {
      'ai-context': configs.geo_ai_summary || description,
    }
  }
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const configs = await getAllConfigs()
  let clinic = await db.query.clinicSettings.findFirst({ where: eq(clinicSettings.id, 1) })
  if (!clinic) {
    clinic = { id: 1 } as any
  }
  const clinicSchema = getClinicJsonLd(clinic || null, configs)

  return (
    <>
      {/* Schema.org GEO Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(clinicSchema).replace(/</g, '\\u003c') }}
      />
      {/* Google Fonts — Clinical Atelier Design System */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&family=Noto+Serif:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Manrope:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,300,0,0"
        rel="stylesheet"
      />
      <LenisProvider>
        <Suspense fallback={null}>
          <PageTracker />
        </Suspense>
        {children}
      </LenisProvider>
    </>
  )
}
