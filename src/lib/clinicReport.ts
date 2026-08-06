// Clinic daily report — server side.
// Reads real data (agenda, finance, treatments, leads, stock) and builds a
// deterministic markdown briefing, optionally refined by the AI engine. This is
// the RegenOrtho analog of MotoFix's server/aiTeam.ts + toWhatsappText: a free,
// reliable base that the LLM only polishes (never invents numbers).
import { and, gte, lte, inArray, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  appointments,
  transactions,
  treatments,
  leads,
  materials,
  patients,
  clinicSettings,
  whatsappMessages,
} from '@/lib/db/schema'
import { callAi } from '@/lib/ai'
import { sendEvolutionText } from '@/lib/evolution'

export type ReportSection = 'agenda' | 'financeiro' | 'tratamentos' | 'leads' | 'estoque'
export const ALL_SECTIONS: ReportSection[] = ['agenda', 'financeiro', 'tratamentos', 'leads', 'estoque']

const TZ = 'America/Sao_Paulo'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Calendar day (YYYY-MM-DD) of a date in the clinic timezone. Avoids UTC/local
// drift on Vercel (server runs in UTC; the clinic reports in BRT).
function brDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d) // en-CA => YYYY-MM-DD
}
function brTime(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(d)
}
function brLongDate(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long' }).format(d)
}

// ── Section builders (deterministic) ─────────────────────────

async function agendaMd(now: Date): Promise<string> {
  const today = brDay(now)
  const from = new Date(now.getTime() - 36 * 3600_000)
  const to = new Date(now.getTime() + 48 * 3600_000)
  const rows = await db
    .select()
    .from(appointments)
    .where(and(gte(appointments.startAt, from), lte(appointments.startAt, to)))

  const notCancelled = rows.filter((a) => a.status !== 'cancelled' && a.status !== 'no_show')
  const todays = notCancelled
    .filter((a) => brDay(new Date(a.startAt)) === today)
    .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt))

  if (todays.length === 0) return '**📅 Agenda de hoje**\n- Nenhuma consulta agendada para hoje.'

  const confirmed = todays.filter((a) => a.status === 'confirmed').length
  const attended = todays.filter((a) => a.status === 'attended').length

  // Resolve patient names for the next few appointments only.
  const nextUp = todays.filter((a) => new Date(a.startAt) >= now).slice(0, 4)
  const ids = nextUp.map((a) => a.patientId).filter((v): v is string => !!v)
  const nameById = new Map<string, string>()
  if (ids.length) {
    const ps = await db.select({ id: patients.id, name: patients.name }).from(patients).where(inArray(patients.id, ids))
    ps.forEach((p) => nameById.set(p.id, p.name))
  }

  const lines = [
    `**📅 Agenda de hoje**`,
    `- ${todays.length} consulta(s) — ${confirmed} confirmada(s), ${attended} atendida(s)`,
  ]
  for (const a of nextUp) {
    const who = a.title || (a.patientId ? nameById.get(a.patientId) : '') || 'Paciente'
    lines.push(`- ${brTime(new Date(a.startAt))} — ${who}`)
  }
  return lines.join('\n')
}

async function financeiroMd(now: Date): Promise<string> {
  const ym = brDay(now).slice(0, 7) // YYYY-MM
  const todayStr = brDay(now)
  const rows = await db.select().from(transactions)

  const inMonth = (d: string | null) => !!d && d.slice(0, 7) === ym
  const income = rows.filter((t) => t.type === 'income')
  const expense = rows.filter((t) => t.type === 'expense')

  const receita = income.filter((t) => t.isPaid && inMonth(t.date)).reduce((s, t) => s + Number(t.amount), 0)
  const despesa = expense.filter((t) => t.isPaid && inMonth(t.date)).reduce((s, t) => s + Number(t.amount), 0)
  const payables = expense.filter((t) => !t.isPaid)
  const aPagarVencido = payables
    .filter((t) => t.dueDate && t.dueDate < todayStr)
    .reduce((s, t) => s + Number(t.amount), 0)
  const aReceber = income.filter((t) => !t.isPaid).reduce((s, t) => s + Number(t.amount), 0)

  return [
    `**💰 Financeiro (mês)**`,
    `- Receita recebida: ${brl(receita)}`,
    `- Despesas pagas: ${brl(despesa)}`,
    `- Saldo do mês: ${brl(receita - despesa)}`,
    `- A pagar vencido: ${brl(aPagarVencido)}`,
    `- A receber em aberto: ${brl(aReceber)}`,
  ].join('\n')
}

async function tratamentosMd(now: Date): Promise<string> {
  const ym = brDay(now).slice(0, 7)
  const today = brDay(now)
  const rows = await db.select().from(treatments)

  const novosHoje = rows.filter((t) => brDay(new Date(t.createdAt)) === today && t.status !== 'cancelled')
  const emAndamento = rows.filter((t) => t.status === 'in_progress' || t.status === 'approved')
  const concluidosMes = rows.filter((t) => t.status === 'completed' && t.completedAt && brDay(new Date(t.completedAt)).slice(0, 7) === ym)
  const vendasMes = concluidosMes.reduce((s, t) => s + Number(t.totalSale), 0)
  const valorNovos = novosHoje.reduce((s, t) => s + Number(t.totalSale), 0)

  return [
    `**🩺 Tratamentos**`,
    `- Novos hoje: ${novosHoje.length}${novosHoje.length ? ` (${brl(valorNovos)})` : ''}`,
    `- Em andamento: ${emAndamento.length}`,
    `- Concluídos no mês: ${concluidosMes.length} (${brl(vendasMes)})`,
  ].join('\n')
}

async function leadsMd(now: Date): Promise<string> {
  const today = brDay(now)
  const rows = await db.select().from(leads)
  const novosHoje = rows.filter((l) => brDay(new Date(l.createdAt)) === today)
  const emAberto = rows.filter((l) => l.status === 'new' || l.status === 'contacted')
  return [`**🧲 Leads**`, `- Novos hoje: ${novosHoje.length}`, `- Em aberto (novo/contatado): ${emAberto.length}`].join('\n')
}

async function estoqueMd(): Promise<string> {
  const rows = await db.select().from(materials).where(eq(materials.isActive, true))
  const low = rows.filter((m) => m.currentStock <= m.minimumStock)
  if (low.length === 0) return '**📦 Estoque**\n- Todos os itens acima do mínimo. ✅'
  const names = low.slice(0, 6).map((m) => `${m.name} (${m.currentStock}/${m.minimumStock})`)
  const extra = low.length > 6 ? ` +${low.length - 6}` : ''
  return `**📦 Estoque**\n- ${low.length} item(ns) abaixo do mínimo: ${names.join(', ')}${extra}`
}

// ── Public API ───────────────────────────────────────────────

export interface ClinicReport {
  markdown: string
  whatsappText: string
  context: string // compact plain-text of the numbers, for the QA path
}

// Convert briefing markdown to WhatsApp style (*bold*, • bullets). Mirrors
// MotoFix/server/aiTeam.ts toWhatsappText.
export function toWhatsappText(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^-\s+/gm, '• ')
}

export interface BuildReportOptions {
  sections?: ReportSection[]
  refine?: boolean // let the AI polish the wording (numbers stay from the base)
}

// Build the clinic report. Deterministic base is always produced; the AI only
// rewords it when `refine` is true and an engine is configured.
export async function buildClinicReport(opts: BuildReportOptions = {}): Promise<ClinicReport> {
  const sections = opts.sections?.length ? opts.sections : ALL_SECTIONS
  const now = new Date()

  const [clinic] = await db.select({ name: clinicSettings.name }).from(clinicSettings).where(eq(clinicSettings.id, 1))
  const clinicName = clinic?.name || 'Clínica'

  const parts: string[] = []
  if (sections.includes('agenda')) parts.push(await agendaMd(now))
  if (sections.includes('financeiro')) parts.push(await financeiroMd(now))
  if (sections.includes('tratamentos')) parts.push(await tratamentosMd(now))
  if (sections.includes('leads')) parts.push(await leadsMd(now))
  if (sections.includes('estoque')) parts.push(await estoqueMd())

  const header = `### 📋 Resumo da ${clinicName}\n${brLongDate(now)}`
  const context = parts.join('\n')
  let markdown = `${header}\n\n${context}`

  if (opts.refine) {
    const polished = await callAi(
      [
        {
          role: 'system',
          content:
            'Você é a secretária de uma clínica de ortopedia regenerativa. Reescreva o resumo abaixo em português, curto e direto para WhatsApp, mantendo TODOS os números e seções exatamente como estão (não invente nada). Preserve emojis e a estrutura em tópicos. Responda só com o texto final.',
        },
        { role: 'user', content: markdown },
      ],
      { timeoutMs: 15000 },
    )
    if (polished && polished.length > 20) markdown = polished
  }

  return { markdown, whatsappText: toWhatsappText(markdown), context }
}

// Parse the `wa_report_sections` config (csv) into a validated section list.
export function parseSections(csv: string | null | undefined): ReportSection[] {
  const set = new Set(ALL_SECTIONS as string[])
  const list = (csv || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => set.has(s)) as ReportSection[]
  return list.length ? list : ALL_SECTIONS
}

export interface DeliverOptions {
  target: string // group JID (...@g.us) or phone number
  sections?: ReportSection[]
  refine?: boolean
}

// Build and send the clinic report to a number/group, logging to whatsappMessages.
// Shared by the "send now" route and the daily cron.
export async function deliverClinicReport(
  opts: DeliverOptions,
): Promise<{ ok: boolean; error?: string }> {
  const report = await buildClinicReport({ sections: opts.sections, refine: opts.refine })
  // targetNumber is varchar(20); a group JID is longer, so store the id part.
  const logTarget = opts.target.split('@')[0].slice(0, 20)
  try {
    const resp = await sendEvolutionText(opts.target, report.whatsappText)

    // O webhook não ignora `fromMe`, então este relatório volta como mensagem
    // recebida. A única guarda era `looksLikeBotReply`, que testa o prefixo 📋 —
    // mas com `refine: true` a IA reescreve o texto e pode perder o emoji, e aí
    // o bot gera OUTRO relatório. Marcar o id enviado é a guarda que não depende
    // de o texto sobreviver à IA.
    // Import dinâmico: whatsappBot já importa este módulo e o estático criaria
    // ciclo.
    const sentId = (resp as { key?: { id?: string } })?.key?.id
    if (sentId) {
      const { markSeen } = await import('@/lib/whatsappBot')
      markSeen(String(sentId))
    }

    await db.insert(whatsappMessages).values({
      type: 'weekly_report',
      targetNumber: logTarget,
      message: report.whatsappText,
      status: 'sent',
      evolutionResponse: (resp as unknown) ?? null,
      sentAt: new Date(),
    })
    return { ok: true }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await db
      .insert(whatsappMessages)
      .values({ type: 'weekly_report', targetNumber: logTarget, message: report.whatsappText, status: 'failed' })
      .catch(() => {})
    return { ok: false, error }
  }
}
