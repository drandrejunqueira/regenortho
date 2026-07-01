import { db } from '@/lib/db'
import { whatsappMessages } from '@/lib/db/schema'
import { getEvolutionConfig } from '@/lib/evolution'

interface EvolutionConfig {
  apiUrl: string
  apiKey: string
  instance: string
}

// Kept for backward compatibility with sendWhatsApp's config shape. Delegates to
// the shared getEvolutionConfig (single source of truth for Evolution creds).
async function getConfig(): Promise<EvolutionConfig | null> {
  const { serverUrl, apiKey, instance } = await getEvolutionConfig()
  if (!serverUrl || !apiKey || !instance) return null
  return { apiUrl: serverUrl, apiKey, instance }
}

export async function sendWhatsApp(
  number: string,
  text: string,
  config?: EvolutionConfig,
): Promise<{ success: boolean; response?: unknown; error?: string }> {
  const cfg = config ?? (await getConfig())
  if (!cfg) return { success: false, error: 'Evolution API não configurada' }

  const cleanNumber = number.replace(/\D/g, '')
  if (!cleanNumber) return { success: false, error: 'Número inválido' }

  try {
    const res = await fetch(`${cfg.apiUrl}/message/sendText/${cfg.instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.apiKey,
      },
      body: JSON.stringify({
        number: cleanNumber,
        text,
      }),
    })

    const data = await res.json()
    return { success: res.ok, response: data }
  } catch (e) {
    const err = e as Error
    return { success: false, error: err.message }
  }
}

type MessageType =
  | 'lead_notification'
  | 'appointment_reminder'
  | 'appointment_confirmation'
  | 'treatment_summary'
  | 'exam_ready'
  | 'payment_reminder'
  | 'weekly_report'
  | 'monthly_report'

export async function sendAndLog(
  type: MessageType,
  number: string,
  message: string,
  opts?: { patientId?: string; appointmentId?: string },
): Promise<void> {
  const result = await sendWhatsApp(number, message)

  await db.insert(whatsappMessages).values({
    type,
    targetNumber: number,
    patientId: opts?.patientId,
    appointmentId: opts?.appointmentId,
    message,
    status: result.success ? 'sent' : 'failed',
    evolutionResponse: result.response ?? null,
    sentAt: result.success ? new Date() : null,
  })
}

// ── Message templates ─────────────────────────────────────

export function tplNewLead(name: string, phone: string, source: string): string {
  return `🔔 *Novo Lead no CRM*\n\n👤 *${name}*\n📱 ${phone}\n📌 Origem: ${source}\n\nAcesse o sistema para acompanhar.`
}

export function tplAppointmentReminder(
  patientName: string,
  doctorName: string,
  date: string,
  time: string,
): string {
  return `📅 *Lembrete de Consulta*\n\nOlá, *${patientName}*!\n\nSua consulta com *Dr(a). ${doctorName}* está marcada para:\n📆 ${date} às ⏰ ${time}\n\nQualquer dúvida, entre em contato conosco. Até logo! 😊`
}

export function tplTreatmentSummary(
  patientName: string,
  treatmentName: string,
  totalSale: string,
  installments: number,
): string {
  const paymentInfo = installments > 1
    ? `em ${installments}x de R$ ${(Number(totalSale) / installments).toFixed(2).replace('.', ',')}`
    : `à vista R$ ${Number(totalSale).toFixed(2).replace('.', ',')}`
  return `✅ *Comprovante de Tratamento*\n\nOlá, *${patientName}*!\n\nSeu tratamento *${treatmentName}* foi registrado com sucesso.\n\n💰 Valor total: *R$ ${Number(totalSale).toFixed(2).replace('.', ',')}*\n💳 Pagamento: ${paymentInfo}\n\nObrigado pela confiança! 🙏`
}

export function tplWeeklyReport(
  revenue: string,
  consultations: number,
  newPatients: number,
  weekStart: string,
  weekEnd: string,
): string {
  return `📊 *Fechamento Semanal*\n${weekStart} — ${weekEnd}\n\n💰 Receita: *R$ ${revenue}*\n🩺 Consultas realizadas: *${consultations}*\n👤 Novos pacientes: *${newPatients}*\n\nBom trabalho! 💪`
}
