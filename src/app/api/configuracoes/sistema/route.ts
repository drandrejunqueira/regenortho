import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { clinicSettings } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'

const settingsSchema = z.object({
  name: z.string().min(1).optional(),
  cnpj: z.string().nullable().optional(),
  crm: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  website: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().max(2).nullable().optional(),
  zipCode: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  headerImageUrl: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  documentHeader: z.string().nullable().optional(),
  documentFooter: z.string().nullable().optional(),
  seoTitle: z.string().max(70).nullable().optional(),
  seoDescription: z.string().max(160).nullable().optional(),
  seoKeywords: z.string().nullable().optional(),
  ogImageUrl: z.string().nullable().optional(),
  gaId: z.string().nullable().optional(),
  gtmId: z.string().nullable().optional(),
  whatsappToken: z.string().nullable().optional(),
  whatsappApiUrl: z.string().nullable().optional(),
  smtpHost: z.string().nullable().optional(),
  smtpPort: z.number().nullable().optional(),
  smtpUser: z.string().nullable().optional(),
  smtpPass: z.string().nullable().optional(),
  googleCalendarId: z.string().nullable().optional(),
  backupSchedule: z.string().nullable().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'settings:view')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  let settings = await db.query.clinicSettings.findFirst({ where: eq(clinicSettings.id, 1) })
  if (!settings) {
    // Create default row
    const [created] = await db.insert(clinicSettings).values({ id: 1 }).returning()
    settings = created
  }

  return NextResponse.json({ data: settings })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'settings:edit')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  // Upsert
  const existing = await db.query.clinicSettings.findFirst({ where: eq(clinicSettings.id, 1) })
  if (!existing) {
    await db.insert(clinicSettings).values({ id: 1, ...parsed.data, updatedAt: new Date() })
  } else {
    await db.update(clinicSettings).set({ ...parsed.data, updatedAt: new Date() }).where(eq(clinicSettings.id, 1))
  }

  const updated = await db.query.clinicSettings.findFirst({ where: eq(clinicSettings.id, 1) })
  return NextResponse.json({ data: updated })
}
