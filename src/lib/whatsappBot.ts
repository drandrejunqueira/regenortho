// WhatsApp group bot — inbound side (server).
// Receives group messages from the Evolution webhook (messages.upsert), normalizes
// the payload, guards against duplicates/echoes, transcribes voice notes and
// answers in the group. Ported from MotoFix/server/financeBot.ts, adapted to the
// clinic: read-only assistant (daily report + Q&A over real data), single-tenant.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { evoFetch, sendEvolutionText } from '@/lib/evolution'
import { transcribeAudio } from '@/lib/transcribe'
import { callAi } from '@/lib/ai'
import { buildClinicReport } from '@/lib/clinicReport'
import { db } from '@/lib/db'
import { and, gte, lte, eq, ilike } from 'drizzle-orm'
import { patients, appointments, clinicalRecords, users, treatments } from '@/lib/db/schema'


export interface IncomingMessage {
  instance: string
  groupJid: string // remoteJid ending in @g.us
  fromMe: boolean
  messageId: string
  text: string
  timestamp: number // epoch seconds
  pushName: string
  isAudio: boolean
  audioMime?: string
  audioBase64?: string
  raw?: any
}

// Extract the text from a Baileys message object (several shapes).
function textFromMessage(message: any): string {
  if (!message) return ''
  return String(
    message.conversation ||
      message.extendedTextMessage?.text ||
      message.imageMessage?.caption ||
      message.videoMessage?.caption ||
      '',
  ).trim()
}

function audioFromMessage(message: any): { mime: string } | null {
  const a = message?.audioMessage
  if (!a) return null
  return { mime: String(a.mimetype || 'audio/ogg') }
}

// Download audio media from Evolution and return base64 + mimetype. Defensive:
// tries the known payload/response shapes across Evolution versions.
export async function downloadAudioBase64(
  instance: string,
  raw: any,
): Promise<{ base64: string; mimetype: string }> {
  try {
    const resp = await evoFetch(`/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`, {
      method: 'POST',
      body: JSON.stringify({ message: raw, convertToMp4: false }),
    })
    const base64 = String(resp?.base64 || resp?.media || resp?.buffer || '')
    const mimetype = String(resp?.mimetype || raw?.message?.audioMessage?.mimetype || 'audio/ogg')
    return { base64, mimetype }
  } catch (e) {
    console.error('[whatsappBot] downloadAudioBase64:', e instanceof Error ? e.message : e)
    return { base64: '', mimetype: '' }
  }
}

// Normalize the Evolution `messages.upsert` webhook payload. `data` may be a
// single object or an array; we take the first message. Returns null when it is
// not a usable group text/audio message.
export function parseWebhookMessage(payload: any): IncomingMessage | null {
  if (!payload) return null
  const instance = String(payload.instance || payload.instanceName || '').trim()
  const raw = payload.data
  const data = Array.isArray(raw) ? raw[0] : raw
  if (!data) return null

  const key = data.key || {}
  const groupJid = String(key.remoteJid || '')
  if (!groupJid.endsWith('@g.us')) return null // groups only

  const text = textFromMessage(data.message)
  const audio = audioFromMessage(data.message)
  if (!text && !audio) return null

  // With webhook base64:true, media arrives inline. Locations vary across versions.
  const audioBase64 = audio
    ? String(data.message?.base64 || data.base64 || data.message?.audioMessage?.base64 || '')
    : ''

  const tsRaw = data.messageTimestamp ?? data.message?.messageTimestamp ?? 0
  const timestamp = Number(tsRaw) || Math.floor(Date.now() / 1000)

  return {
    instance,
    groupJid,
    fromMe: Boolean(key.fromMe),
    messageId: String(key.id || ''),
    text,
    timestamp,
    pushName: String(data.pushName || ''),
    isAudio: Boolean(audio),
    audioMime: audio?.mime,
    audioBase64,
    raw: data,
  }
}

// Resolve the effective text: if audio, download (when needed) and transcribe via
// Groq Whisper. Returns the text ('' when unusable) and whether it came from voice.
export async function resolveText(msg: IncomingMessage): Promise<{ text: string; fromAudio: boolean }> {
  if (msg.text) return { text: msg.text, fromAudio: false }
  if (!msg.isAudio) return { text: '', fromAudio: false }

  let base64 = msg.audioBase64 || ''
  let mime = msg.audioMime || 'audio/ogg'
  if (!base64) {
    const media = await downloadAudioBase64(msg.instance, msg.raw)
    base64 = media.base64
    mime = media.mimetype || mime
  }
  if (!base64) return { text: '', fromAudio: true }
  const text = await transcribeAudio(base64, mime)
  return { text, fromAudio: true }
}

// ── Idempotency / anti-replay ────────────────────────────────

const MAX_AGE_SECONDS = 300 // drop messages older than 5 min (webhook re-deliveries)
const DEDUPE_TTL_MS = 10 * 60 * 1000
const seen = new Map<string, number>() // messageId -> epoch ms

function pruneSeen(now = Date.now()) {
  for (const [id, ts] of seen) if (now - ts > DEDUPE_TTL_MS) seen.delete(id)
}

// Decide whether a message should be processed: drops duplicates (same id) and
// old messages (webhook re-deliveries). Marks as seen when accepted.
export function shouldProcess(msg: IncomingMessage, now = Date.now()): boolean {
  const nowSec = Math.floor(now / 1000)
  if (msg.timestamp && nowSec - msg.timestamp > MAX_AGE_SECONDS) return false
  if (msg.messageId) {
    if (seen.has(msg.messageId)) return false
    pruneSeen(now)
    seen.set(msg.messageId, now)
  }
  return true
}

// Mark a message id as already seen (e.g. the reply the bot itself sent).
export function markSeen(id: string, now = Date.now()): void {
  if (id) seen.set(id, now)
}

// Emoji prefixes of the replies the bot sends. Since staff write in the group with
// the same connected number (fromMe), we must ignore the echoes of our own replies
// to avoid a loop. Human commands never start with these icons.
const BOT_REPLY_PREFIX = /^\s*(📋|📊|✅|🤖|🎙️|⚠️|🤷|📅|💰|🩺|🧲|📦)/u

export function looksLikeBotReply(text: string): boolean {
  return BOT_REPLY_PREFIX.test(text || '')
}

// ── Intent detection ─────────────────────────────────────────

const REPORT_RE =
  /\b(relat[óo]rio|resumo|panorama|fechamento|como (est[áa]|vai)\s+(a\s+)?cl[íi]nica|como estamos|resumo do dia|briefing)\b/i

const QUESTION_TRIGGER_RE =
  /\b(quanto|quantos|quantas|qual|quais|quando|como|tem|houve|faturamento|faturei|receita|despesa|saldo|agenda|consultas?|leads?|estoque|tratamentos?|pacientes?|prontu[áa]rios?|hist[óo]ricos?|clientes?|m[ée]dicos?)\b/i

export function isReportRequest(text: string): boolean {
  return REPORT_RE.test(text || '')
}

const TZ = 'America/Sao_Paulo'
const getBrDateString = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
const getBrWeekdayString = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long' }).format(d)

interface DBQueryParams {
  searchPatientName: string | null
  dateRange: { start: string; end: string } | null
  needAllAppointments: boolean
}

async function extractQueryParams(text: string): Promise<DBQueryParams> {
  const now = new Date()
  const todayStr = getBrDateString(now)
  const tomorrowStr = getBrDateString(new Date(now.getTime() + 24 * 3600_000))
  const weekdayStr = getBrWeekdayString(now)

  const systemPrompt = `Você é um coordenador de banco de dados para uma clínica. Analise a pergunta do usuário e extraia quais dados precisamos buscar no banco de dados para respondê-la.
Responda APENAS um JSON válido (sem markdown, sem blocos de código) no formato:
{
  "searchPatientName": "Nome ou parte do nome do paciente a buscar, ou null",
  "dateRange": {
    "start": "YYYY-MM-DD",
    "end": "YYYY-MM-DD"
  } | null,
  "needAllAppointments": boolean
}

Informações de data atual de referência:
- Hoje: ${todayStr} (dia da semana: ${weekdayStr})
- Amanhã: ${tomorrowStr}

Regras:
- Se o usuário perguntar da agenda de "hoje", "amanhã", "esta semana" ou datas específicas, preencha o dateRange.
- Se perguntar "qual cliente tenho amanhã" ou similar, preencha o dateRange para amanhã (ou a data correspondente).
- Se perguntar sobre informações, prontuário, histórico ou consultas de um paciente específico (ex: "João", "Maria Silva", "histórico do paciente José"), coloque o nome/parte do nome em searchPatientName.
- Se pedir para buscar a agenda geral ou consultas gerais sem um paciente específico, marque needAllAppointments = true.`

  try {
    const rawJson = await callAi([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ], { timeoutMs: 10000 })
    
    if (rawJson) {
      // Clean JSON formatting
      const cleaned = rawJson.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      return {
        searchPatientName: parsed.searchPatientName || null,
        dateRange: parsed.dateRange || null,
        needAllAppointments: !!parsed.needAllAppointments
      }
    }
  } catch (err) {
    console.error('[whatsappBot] Error extracting query params:', err)
  }

  // Fallback heuristic extraction
  const lower = text.toLowerCase()
  let searchPatientName: string | null = null
  let dateRange: { start: string; end: string } | null = null
  let needAllAppointments = false

  if (lower.includes('agenda') || lower.includes('consulta') || lower.includes('cliente') || lower.includes('paciente')) {
    needAllAppointments = true
  }

  if (lower.includes('amanhã') || lower.includes('amanha')) {
    dateRange = { start: tomorrowStr, end: tomorrowStr }
  } else if (lower.includes('hoje')) {
    dateRange = { start: todayStr, end: todayStr }
  }

  const match = text.match(/(?:paciente|sobre|histórico de|consulta de)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/)
  if (match) {
    searchPatientName = match[1]
  }

  return { searchPatientName, dateRange, needAllAppointments }
}

async function executeDatabaseQueries(params: DBQueryParams): Promise<string> {
  const contexts: string[] = []

  // 1. Search Patient Information
  if (params.searchPatientName) {
    const queryName = `%${params.searchPatientName.trim()}%`
    const foundPatients = await db
      .select()
      .from(patients)
      .where(ilike(patients.name, queryName))
      .limit(5)

    if (foundPatients.length === 0) {
      contexts.push(`Nenhum paciente encontrado com o nome contendo "${params.searchPatientName}".`)
    } else {
      for (const p of foundPatients) {
        let pContext = `=== Paciente: ${p.name} ===\n`
        pContext += `- Telefone: ${p.phone || 'Não informado'}\n`
        pContext += `- Email: ${p.email || 'Não informado'}\n`
        pContext += `- CPF: ${p.cpf || 'Não informado'}\n`
        pContext += `- Data de Nascimento: ${p.birthDate ? new Date(p.birthDate).toLocaleDateString('pt-BR') : 'Não informada'}\n`
        pContext += `- Gênero: ${p.gender || 'Não informado'}\n`

        // Fetch recent appointments for this patient
        const pAppts = await db
          .select({
            id: appointments.id,
            startAt: appointments.startAt,
            status: appointments.status,
            type: appointments.type,
            notes: appointments.notes,
            title: appointments.title,
            doctorName: users.name
          })
          .from(appointments)
          .leftJoin(users, eq(appointments.doctorId, users.id))
          .where(eq(appointments.patientId, p.id))
          .orderBy(appointments.startAt)
          .limit(10)

        if (pAppts.length > 0) {
          pContext += `\nHistórico de consultas de ${p.name}:\n`
          for (const a of pAppts) {
            const dateStr = new Date(a.startAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
            pContext += `- ${dateStr} | Status: ${a.status} | Tipo: ${a.type} | Médico: ${a.doctorName || 'Não designado'} | Notas: ${a.notes || ''}\n`
          }
        } else {
          pContext += `\nNão há histórico de consultas registrado.\n`
        }

        // Fetch clinical records (prontuário/medical history)
        const pRecords = await db
          .select({
            id: clinicalRecords.id,
            type: clinicalRecords.type,
            content: clinicalRecords.content,
            createdAt: clinicalRecords.createdAt,
            doctorName: users.name
          })
          .from(clinicalRecords)
          .leftJoin(users, eq(clinicalRecords.doctorId, users.id))
          .where(eq(clinicalRecords.patientId, p.id))
          .orderBy(clinicalRecords.createdAt)
          .limit(10)

        if (pRecords.length > 0) {
          pContext += `\nProntuário / Histórico Médico de ${p.name}:\n`
          for (const r of pRecords) {
            const dateStr = new Date(r.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
            pContext += `- [${dateStr}] (${r.type}) por Dr(a). ${r.doctorName || 'Desconhecido'}:\n  ${r.content}\n`
          }
        } else {
          pContext += `\nNão há registros no prontuário/histórico médico.\n`
        }

        // Fetch active treatments
        const pTreatments = await db
          .select()
          .from(treatments)
          .where(eq(treatments.patientId, p.id))
          .limit(5)

        if (pTreatments.length > 0) {
          pContext += `\nTratamentos de ${p.name}:\n`
          for (const t of pTreatments) {
            pContext += `- ${t.name || 'Sem nome'} | Status: ${t.status} | Total: R$ ${Number(t.totalSale || 0).toFixed(2)}\n`
          }
        }

        contexts.push(pContext)
      }
    }
  }

  // 2. Search Appointments in Date Range
  if (params.dateRange) {
    const start = new Date(params.dateRange.start + 'T00:00:00')
    const end = new Date(params.dateRange.end + 'T23:59:59')

    const dateAppts = await db
      .select({
        startAt: appointments.startAt,
        status: appointments.status,
        type: appointments.type,
        notes: appointments.notes,
        title: appointments.title,
        patientName: patients.name,
        doctorName: users.name
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(users, eq(appointments.doctorId, users.id))
      .where(and(
        gte(appointments.startAt, start),
        lte(appointments.startAt, end)
      ))
      .orderBy(appointments.startAt)

    let dateCtx = `=== Consultas de ${params.dateRange.start}`
    if (params.dateRange.start !== params.dateRange.end) {
      dateCtx += ` até ${params.dateRange.end}`
    }
    dateCtx += ` ===\n`

    if (dateAppts.length === 0) {
      dateCtx += `Nenhuma consulta agendada para esse período.\n`
    } else {
      for (const a of dateAppts) {
        const timeStr = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(a.startAt))
        const pName = a.patientName || a.title || 'Paciente não informado'
        dateCtx += `- ${timeStr} | Paciente: ${pName} | Médico: ${a.doctorName || 'Não designado'} | Tipo: ${a.type} | Status: ${a.status} | Notas: ${a.notes || ''}\n`
      }
    }
    contexts.push(dateCtx)
  }

  // 3. Fallback/general appointments check (if needAllAppointments and dateRange wasn't set)
  if (params.needAllAppointments && !params.dateRange) {
    const now = new Date()
    const todayStr = getBrDateString(now)
    const tomorrowStr = getBrDateString(new Date(now.getTime() + 24 * 3600_000))

    const start = new Date(todayStr + 'T00:00:00')
    const end = new Date(tomorrowStr + 'T23:59:59')

    const generalAppts = await db
      .select({
        startAt: appointments.startAt,
        status: appointments.status,
        type: appointments.type,
        notes: appointments.notes,
        title: appointments.title,
        patientName: patients.name,
        doctorName: users.name
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(users, eq(appointments.doctorId, users.id))
      .where(and(
        gte(appointments.startAt, start),
        lte(appointments.startAt, end)
      ))
      .orderBy(appointments.startAt)

    let genCtx = `=== Consultas (Hoje e Amanhã) ===\n`
    if (generalAppts.length === 0) {
      genCtx += `Nenhuma consulta agendada para hoje ou amanhã.\n`
    } else {
      for (const a of generalAppts) {
        const dateFormatted = new Date(a.startAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        const pName = a.patientName || a.title || 'Paciente não informado'
        genCtx += `- ${dateFormatted} | Paciente: ${pName} | Médico: ${a.doctorName || 'Não designado'} | Status: ${a.status}\n`
      }
    }
    contexts.push(genCtx)
  }

  return contexts.join('\n\n')
}

// ── Dispatch ─────────────────────────────────────────────────

// Full flow of a group message. Returns the reply text, or null when the message
// isn't addressed to the bot (normal chatter) — the webhook then stays silent.
export async function dispatchGroupMessage(text: string): Promise<string | null> {
  const t = (text || '').trim()
  if (!t) return null

  // 1) Explicit request for the clinic report.
  if (isReportRequest(t)) {
    const r = await buildClinicReport({ refine: true })
    return r.whatsappText
  }

  // 2) A question directed to the assistant (ends with '?' or uses a trigger word).
  const directed = t.endsWith('?') || QUESTION_TRIGGER_RE.test(t)
  if (!directed) return null

  const report = await buildClinicReport() // deterministic numbers as context
  const params = await extractQueryParams(t)
  const dbContent = await executeDatabaseQueries(params)

  const combinedContext = [
    `=== Resumo Geral da Clínica ===`,
    report.context,
    `=== Informações Específicas do Banco de Dados ===`,
    dbContent || 'Nenhuma informação específica pesquisada ou encontrada no banco.'
  ].join('\n\n')

  const answer = await callAi(
    [
      {
        role: 'system',
        content:
          'Você é o assistente inteligente da clínica de ortopedia regenerativa RegenOrtho. Responda em português de forma natural, curta e direta para o WhatsApp. Utilize as informações reais recuperadas do banco de dados (como histórico de consultas, prontuário/histórico médico dos pacientes ou a agenda de compromissos) para responder com precisão. Seja prestativo, mas profissional.',
      },
      { role: 'user', content: `Dados e Históricos Recuperados:\n${combinedContext}\n\nPergunta do usuário:\n${t}` },
    ],
    { timeoutMs: 15000 },
  )

  if (answer && answer.trim()) return `📊 ${answer.trim()}`

  // No AI engine configured → fall back to the full deterministic report.
  return report.whatsappText
}

// Send a text message to the group and mark our own message id as seen, so the
// webhook echo (fromMe) is dropped by shouldProcess and we don't loop.
export async function sendGroupMessage(jid: string, text: string): Promise<void> {
  try {
    const resp = await sendEvolutionText(jid, text)
    const id = (resp as any)?.key?.id
    if (id) markSeen(String(id))
  } catch (e) {
    console.error('[whatsappBot] sendGroupMessage:', e instanceof Error ? e.message : e)
  }
}
