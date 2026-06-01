/**
 * GET /api/site/config
 * Endpoint público (sem autenticação) que retorna apenas os dados
 * necessários para renderizar o site público: nome, logo, cor, SEO.
 */
import { db } from '@/lib/db'
import { clinicSettings } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

export const revalidate = 60 // cache por 60s

export async function GET() {
  try {
    const settings = await db.query.clinicSettings.findFirst({
      where: eq(clinicSettings.id, 1),
      columns: {
        name:        true,
        logoUrl:     true,
        headerImageUrl: true,
        primaryColor: true,
        seoTitle:    true,
        seoDescription: true,
        ogImageUrl:  true,
        phone:       true,
        whatsapp:    true,
        email:       true,
        address:     true,
        city:        true,
        state:       true,
      },
    })

    return NextResponse.json({ data: settings ?? null })
  } catch {
    return NextResponse.json({ data: null })
  }
}
