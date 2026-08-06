// Resumo diário da agenda por médico — rota PÚBLICA, protegida por CRON_SECRET.
// Roda de hora em hora (vercel.json) e envia para quem configurou aquele horário
// no perfil. A deduplicação por dia-calendário BR (daily_agenda_last_sent) garante
// um envio por médico por dia mesmo se o cron disparar duas vezes.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { brDay, brHourMinute, deliverDoctorAgenda } from '@/lib/doctorAgenda'
import { rateLimit } from '@/lib/rate-limit'
import { secretEquals } from '@/lib/secrets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CRON_CALLS_PER_MINUTE = 2

export async function GET(req: NextRequest) {
  // Fail-closed: sem CRON_SECRET a rota não pode ser chamada — ela expõe a
  // agenda dos médicos e consome envios da Evolution.
  const secret = process.env.CRON_SECRET
  const authz = req.headers.get('authorization') || ''
  if (!secret || !secretEquals(authz, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  // O CRON_SECRET é env estática, sem rotação. Sozinho ele não impede que quem
  // o obtenha chame a rota em laço — e cada chamada reenvia a agenda para todos
  // os médicos habilitados, o que faz a Meta banir o número da clínica por
  // padrão de spam. Chave fixa por rota: cron não tem IP de cliente útil.
  const rl = rateLimit('cron:agenda-medicos', CRON_CALLS_PER_MINUTE, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Muitas chamadas. Tente novamente em instantes.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const url = new URL(req.url)
  // `force` pula horário e dedupe — é ferramenta de teste e não pode existir em
  // produção, onde seria justamente o laço de reenvio ilimitado.
  const force = url.searchParams.get('force') === '1' && process.env.VERCEL_ENV !== 'production'
  // ?hora=08:00 permite testar um horário específico fora da janela.
  const nowHour = url.searchParams.get('hora') || brHourMinute()
  const today = brDay()

  const candidates = await db
    .select({
      id: users.id,
      name: users.name,
      hour: users.dailyAgendaHour,
      whatsapp: users.dailyAgendaWhatsapp,
      phone: users.phone,
      lastSent: users.dailyAgendaLastSent,
    })
    .from(users)
    .where(and(eq(users.dailyAgendaEnabled, true), eq(users.isActive, true)))

  // `hour <= nowHour` em vez de igualdade exata: se o cron falhar às 8h, o médico
  // ainda recebe na próxima execução do dia em vez de perder o resumo. A trava de
  // duplicidade é o lastSent, não o horário.
  const due = candidates.filter((u) => {
    if (!force && (u.hour || '08:00') > nowHour) return false
    if (!force && u.lastSent === today) return false
    return Boolean(u.whatsapp || u.phone)
  })

  const results: Array<{ doctor: string; ok: boolean; skipped?: string; error?: string }> = []

  // Sequencial de propósito: a Evolution é um gateway único e rajadas paralelas
  // de mensagens aumentam a chance de bloqueio do número.
  for (const u of due) {
    const r = await deliverDoctorAgenda({
      doctorId: u.id,
      number: u.whatsapp || u.phone || '',
      skipEmpty: true,
    })
    // Marca como enviado mesmo quando pulou por agenda vazia: senão o cron
    // tentaria de novo a cada hora até o fim do dia.
    if (r.ok) {
      await db
        .update(users)
        .set({ dailyAgendaLastSent: today })
        .where(eq(users.id, u.id))
        .catch(() => {})
    }
    results.push({ doctor: u.name, ok: r.ok, skipped: r.skipped, error: r.error })
  }

  return NextResponse.json({ ok: true, hour: nowHour, date: today, sent: results.length, results })
}
