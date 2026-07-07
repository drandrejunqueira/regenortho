import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { clinicSettings } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { UserRole } from '@/types'
import { getConfig } from '@/lib/db/queries/configuracoes'
import { GKEYS } from '@/lib/google/oauth'

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
  googleClientId: z.string().nullable().optional(),
  googleClientSecret: z.string().nullable().optional(),
  backupSchedule: z.string().nullable().optional(),
  // Notificações / WhatsApp (Evolution) — antes eram descartados pelo schema,
  // fazendo a página de Notificações "salvar" sem persistir nada.
  evolutionApiUrl: z.string().nullable().optional(),
  evolutionApiKey: z.string().nullable().optional(),
  evolutionInstance: z.string().nullable().optional(),
  notifyNewLeadNumber: z.string().nullable().optional(),
  notifyWeeklyReportNumber: z.string().nullable().optional(),
  notifyMonthlyReportNumber: z.string().nullable().optional(),
  notifyReportDay: z.number().int().nullable().optional(),
  sendAppointmentReminder: z.boolean().optional(),
  reminderHoursBefore: z.number().int().nullable().optional(),
  sendTreatmentSummary: z.boolean().optional(),
  notifyEmailNewLead: z.boolean().optional(),
  notifyEmailNewPatient: z.boolean().optional(),
  notifyEmailWeeklyReport: z.boolean().optional(),
  alertEmailRecipients: z.string().nullable().optional(),
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

  const googleConnected = Boolean(await getConfig(GKEYS.refreshToken))
  const googleEmail = await getConfig(GKEYS.email)
  const googleConnectedAt = await getConfig(GKEYS.connectedAt)
  const googleClientId = await getConfig(GKEYS.clientId)
  const googleClientSecret = await getConfig(GKEYS.clientSecret)

  return NextResponse.json({
    data: {
      ...settings,
      googleConnected,
      googleEmail,
      googleConnectedAt,
      googleClientId,
      googleClientSecret,
    }
  })
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

  const { googleClientId, googleClientSecret, ...clinicData } = parsed.data

  // Save to configuracoes table if provided
  if (googleClientId !== undefined) {
    const { setConfig } = await import('@/lib/db/queries/configuracoes')
    await setConfig(GKEYS.clientId, googleClientId || '')
  }
  if (googleClientSecret !== undefined) {
    const { setConfig } = await import('@/lib/db/queries/configuracoes')
    await setConfig(GKEYS.clientSecret, googleClientSecret || '')
  }

  // Upsert
  const existing = await db.query.clinicSettings.findFirst({ where: eq(clinicSettings.id, 1) })
  if (!existing) {
    await db.insert(clinicSettings).values({ id: 1, ...clinicData, updatedAt: new Date() })
  } else {
    await db.update(clinicSettings).set({ ...clinicData, updatedAt: new Date() }).where(eq(clinicSettings.id, 1))
  }

  const updated = await db.query.clinicSettings.findFirst({ where: eq(clinicSettings.id, 1) })
  const updatedClientId = await getConfig(GKEYS.clientId)
  const updatedClientSecret = await getConfig(GKEYS.clientSecret)

  return NextResponse.json({
    data: {
      ...updated,
      googleClientId: updatedClientId,
      googleClientSecret: updatedClientSecret,
    }
  })
}
