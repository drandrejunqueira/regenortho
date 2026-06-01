import type { Metadata } from 'next'
import { LenisProvider } from '@/components/site/LenisProvider'

export const metadata: Metadata = {
  title: {
    default: 'REGENORTHO — Ortopedia Regenerativa e Tratamento da Dor',
    template: '%s | REGENORTHO',
  },
  description: 'Referência em medicina regenerativa intervencionista. Tratamentos avançados com PRP, BMAC, Ácido Hialurônico e Proloterapia em São José dos Campos e São Paulo.',
  keywords: ['ortopedia', 'medicina regenerativa', 'PRP', 'BMAC', 'ácido hialurônico', 'proloterapia', 'Dr. André Junqueira', 'São José dos Campos', 'tratamento da dor'],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'REGENORTHO Clinical Atelier',
  },
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
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
      <LenisProvider>{children}</LenisProvider>
    </>
  )
}
