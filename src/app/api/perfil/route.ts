import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { waNumber } from '@/lib/evolution'

// `waNumber` normaliza para 55 + DDD + número. Um WhatsApp BR válido tem 10
// (fixo) ou 11 (celular) dígitos depois do 55. Sem isto o campo aceitava
// qualquer string de até 30 chars — e ele é o destino de uma mensagem que sai
// do número da clínica.
function isPlausibleBrWhatsapp(raw: string): boolean {
  return /^55\d{10,11}$/.test(waNumber(raw))
}

const updateSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).nullable().optional(),
  // Aceita URL http(s) OU data URL base64 (foto enviada e gravada inline no banco)
  avatar: z.string().refine(
    (v) => v.startsWith('data:image/') || /^https?:\/\//.test(v),
    'Imagem inválida',
  ).nullable().optional(),
  currentPassword: z.string().optional(),
  // Mesma política de /api/usuarios/[id]: aceitar menos aqui deixaria o dono
  // rebaixar a própria senha abaixo do mínimo que o admin precisa respeitar.
  newPassword: z.string().min(8).optional(),
  // Resumo diário da agenda no WhatsApp.
  dailyAgendaEnabled: z.boolean().optional(),
  dailyAgendaWhatsapp: z
    .string()
    .max(30)
    .refine(isPlausibleBrWhatsapp, 'Número de WhatsApp inválido')
    .nullable()
    .optional(),
  // HH:mm em passos de hora — o cron roda de hora em hora, minuto não é honrado.
  dailyAgendaHour: z.string().regex(/^([01]\d|2[0-3]):00$/, 'Horário inválido').optional(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      avatar: users.avatar,
      role: users.role,
      dailyAgendaEnabled: users.dailyAgendaEnabled,
      dailyAgendaWhatsapp: users.dailyAgendaWhatsapp,
      dailyAgendaHour: users.dailyAgendaHour,
    })
    .from(users)
    .where(eq(users.id, session.user.id))

  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  return NextResponse.json({ data: user })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  // Change password
  if (d.newPassword) {
    if (!d.currentPassword) return NextResponse.json({ error: 'Senha atual obrigatória' }, { status: 400 })
    const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, session.user.id))
    // Sessão órfã: o JWT sobrevive à remoção do usuário no banco. Sem isto,
    // `user.passwordHash` lança TypeError e a rota devolve 500.
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const valid = await bcrypt.compare(d.currentPassword, user.passwordHash)
    if (!valid) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })
    updates.passwordHash = await bcrypt.hash(d.newPassword, 12)
  }

  if (d.name  !== undefined) updates.name  = d.name
  if (d.email !== undefined) {
    // Check uniqueness
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email))
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json({ error: 'E-mail já em uso' }, { status: 409 })
    }
    updates.email = d.email
  }
  if (d.phone  !== undefined) updates.phone  = d.phone
  if (d.avatar !== undefined) updates.avatar = d.avatar
  if (d.dailyAgendaEnabled  !== undefined) updates.dailyAgendaEnabled  = d.dailyAgendaEnabled
  if (d.dailyAgendaWhatsapp !== undefined) updates.dailyAgendaWhatsapp = d.dailyAgendaWhatsapp
  if (d.dailyAgendaHour     !== undefined) updates.dailyAgendaHour     = d.dailyAgendaHour

  const [updated] = await db.update(users).set(updates).where(eq(users.id, session.user.id)).returning({
    id: users.id, name: users.name, email: users.email, phone: users.phone, avatar: users.avatar, role: users.role,
    dailyAgendaEnabled: users.dailyAgendaEnabled,
    dailyAgendaWhatsapp: users.dailyAgendaWhatsapp,
    dailyAgendaHour: users.dailyAgendaHour,
  })

  return NextResponse.json({ data: updated })
}
