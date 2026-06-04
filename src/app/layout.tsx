import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'sonner'
import DynamicFavicon from '@/components/shared/DynamicFavicon'

export const metadata: Metadata = {
  metadataBase: new URL('https://regenortho.com.br'),
  title: 'Regem Orto — Sistema de Gestão',
  description: 'Sistema de gestão da clínica Regem Orto',
  verification: {
    google: 'o-YuvObMWgLt9q4nWBsCntEtTkgSaPJfzlIJg77Sp30',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="dark h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,600;0,700;1,400&family=Manrope:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full bg-[#0c1221] text-[#e2e8f0]">
        <SessionProvider>
          <DynamicFavicon />
          {children}
          <Toaster richColors position="top-right" />
        </SessionProvider>
      </body>
    </html>
  )
}
