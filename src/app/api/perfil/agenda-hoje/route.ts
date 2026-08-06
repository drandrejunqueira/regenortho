// Agenda do dia do próprio usuário logado.
// GET  → prévia (card no perfil). POST → dispara o envio no WhatsApp agora.
// Sempre escopado em session.user.id: ninguém lê nem dispara a agenda de outro.
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { buildDoctorAgenda, deliverDoctorAgenda } from '@/lib/doctorAgenda'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// O envio manual é declaradamente um teste — 3 por hora sobra. Sem teto, este
// endpoint vira relay: o usuário aponta `dailyAgendaWhatsapp` para um número
// qualquer e dispara em laço mensagens saindo do número da clínica.
const MANUAL_SENDS_PER_HOUR = 3

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const agenda = await buildDoctorAgenda(session.user.id)
  // `AgendaSlot` carrega `patientPhone` e `notes` porque o caminho do WhatsApp
  // (deliverDoctorAgenda) monta o texto a partir do mesmo tipo no servidor. O
  // card do perfil não renderiza nenhum dos dois, então projeta aqui em vez de
  // mandar telefone e nota clínica para o navegador sem finalidade.
  const slots = agenda.slots.map((s) => ({
    id: s.id,
    time: s.time,
    endTime: s.endTime,
    patientName: s.patientName,
    type: s.type,
    typeLabel: s.typeLabel,
    status: s.status,
    statusLabel: s.statusLabel,
    room: s.room,
    isPaid: s.isPaid,
  }))

  return NextResponse.json({
    data: {
      date: agenda.date,
      dateLabel: agenda.dateLabel,
      total: agenda.total,
      confirmed: agenda.confirmed,
      slots,
      preview: agenda.whatsappText,
    },
  })
}

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const rl = rateLimit(`agenda-manual:${session.user.id}`, MANUAL_SENDS_PER_HOUR, 60 * 60 * 1000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Muitos envios. Tente novamente em ${Math.ceil(rl.retryAfterSec / 60)} min.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const [me] = await db
    .select({ whatsapp: users.dailyAgendaWhatsapp, phone: users.phone })
    .from(users)
    .where(eq(users.id, session.user.id))

  const number = me?.whatsapp || me?.phone || ''
  if (!number) {
    return NextResponse.json(
      { error: 'Informe o número de WhatsApp no seu perfil antes de enviar.' },
      { status: 400 },
    )
  }

  // skipEmpty: false — o envio manual é um teste, deve chegar mesmo sem consultas.
  const result = await deliverDoctorAgenda({ doctorId: session.user.id, number, skipEmpty: false })
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Falha ao enviar.' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
