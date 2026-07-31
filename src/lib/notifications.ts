import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'

export type NotificationType =
  | 'lead_new'
  | 'appointment_new'
  | 'appointment_cancelled'
  | 'treatment_new'
  | 'treatment_status'
  | 'stock_low'
  | 'system'

export interface NotifyInput {
  type: NotificationType
  title: string
  body?: string | null
  /** Rota do sistema aberta ao clicar no aviso (ex: '/leads'). */
  link?: string | null
  entityId?: string | null
  priority?: 'normal' | 'high'
}

/**
 * Registra um aviso na central de notificações (sino do topo).
 *
 * Nunca lança: um aviso que falha não pode derrubar a captação de um lead nem o
 * salvamento de um agendamento. A falha é logada com contexto no servidor.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await db.insert(notifications).values({
      type: input.type,
      title: input.title.slice(0, 160),
      body: input.body?.slice(0, 1000) || null,
      link: input.link || null,
      entityId: input.entityId || null,
      priority: input.priority ?? 'normal',
      readBy: [],
    })
  } catch (error) {
    console.error('[notifications] falha ao registrar aviso', { type: input.type, error })
  }
}
