import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'
import { db } from '@/lib/db'
import { users, clinicSettings } from '@/lib/db/schema'
import { eq, and, ne, isNotNull } from 'drizzle-orm'
import { googleConfigurado } from './oauth'

/**
 * Sincronização da Agenda com o Google Calendar — por médico.
 *
 * Cada médico conecta a própria conta Google (OAuth). Guardamos o refresh_token
 * na linha do usuário (users.google_calendar_refresh_token). Quando a atendente
 * marca um agendamento, o evento é criado na agenda pessoal do médico vinculado
 * (appointments.doctor_id). O id do evento fica em appointments.google_event_id.
 *
 * Reusa GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (mesmas credenciais do Search
 * Console/Analytics), mas com escopo de Calendar e callback próprio.
 */

export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'openid',
  'email',
]

const CALLBACK_PATH = '/api/perfil/google-agenda/callback'

async function criarOAuthClient(origin: string): Promise<OAuth2Client> {
  const { obterGoogleCredentials } = await import('./oauth')
  const creds = await obterGoogleCredentials()
  return new google.auth.OAuth2(
    creds.clientId || undefined,
    creds.clientSecret || undefined,
    `${origin}${CALLBACK_PATH}`,
  )
}

/** URL de consentimento. O `state` carrega o id do usuário que está conectando. */
export async function gerarUrlConsentimentoCalendar(origin: string, userId: string): Promise<string> {
  const client = await criarOAuthClient(origin)
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: CALENDAR_SCOPES,
    state: userId,
    include_granted_scopes: true,
  })
}

/** Troca o code pelo token e salva o refresh_token na linha do usuário. */
export async function conectarCalendarUsuario(origin: string, code: string, userId: string): Promise<void> {
  const client = await criarOAuthClient(origin)
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error('Google não retornou refresh_token. Reconecte autorizando o acesso.')
  }
  client.setCredentials(tokens)

  let email = ''
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const info = await oauth2.userinfo.get()
    email = info.data.email ?? ''
  } catch { /* informativo */ }

  await db.update(users).set({
    googleCalendarRefreshToken: tokens.refresh_token,
    googleCalendarEmail: email,
    googleCalendarConnectedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(users.id, userId))
}

export async function desconectarCalendarUsuario(userId: string): Promise<void> {
  await db.update(users).set({
    googleCalendarRefreshToken: null,
    googleCalendarEmail: null,
    googleCalendarConnectedAt: null,
    updatedAt: new Date(),
  }).where(eq(users.id, userId))
}

export interface CalendarStatus {
  configurado: boolean
  conectado: boolean
  email: string | null
  conectadoEm: string | null
}

export async function getCalendarStatusUsuario(userId: string): Promise<CalendarStatus> {
  const [u] = await db.select({
    refresh: users.googleCalendarRefreshToken,
    email: users.googleCalendarEmail,
    connectedAt: users.googleCalendarConnectedAt,
  }).from(users).where(eq(users.id, userId))
  return {
    configurado: await googleConfigurado(),
    conectado: Boolean(u?.refresh),
    email: u?.email ?? null,
    conectadoEm: u?.connectedAt ? u.connectedAt.toISOString() : null,
  }
}

async function getClientForUser(userId: string): Promise<{ client: OAuth2Client; calendarId: string } | null> {
  if (!(await googleConfigurado())) return null
  
  // Buscar os dados do usuário (médico)
  const [u] = await db.select({
    refresh: users.googleCalendarRefreshToken,
    calendarId: users.googleCalendarId,
  }).from(users).where(eq(users.id, userId))

  // Buscar os dados globais da clínica (agenda central)
  const [settings] = await db.select({
    googleCalendarId: clinicSettings.googleCalendarId
  }).from(clinicSettings).where(eq(clinicSettings.id, 1)).limit(1)
  
  const centralCalendarId = settings?.googleCalendarId ?? null
  const calendarId = u?.calendarId || centralCalendarId

  if (!calendarId) return null

  const { obterGoogleCredentials } = await import('./oauth')
  const creds = await obterGoogleCredentials()

  // 1. Se o próprio médico conectou a conta do Google Agenda, usamos suas credenciais
  if (u?.refresh) {
    const client = new google.auth.OAuth2(creds.clientId || undefined, creds.clientSecret || undefined)
    client.setCredentials({ refresh_token: u.refresh })
    return { client, calendarId }
  }

  // 2. Fallback Central: Buscar o token do Google conectado globalmente na clínica (configuracoes)
  const { getConfig } = await import('@/lib/db/queries/configuracoes')
  const { GKEYS } = await import('./oauth')
  const globalRefresh = await getConfig(GKEYS.refreshToken)
  if (globalRefresh) {
    const client = new google.auth.OAuth2(creds.clientId || undefined, creds.clientSecret || undefined)
    client.setCredentials({ refresh_token: globalRefresh })
    return { client, calendarId }
  }

  // 3. Fallback Secundário: Buscar no banco qualquer outro usuário (ex: admin) com conta conectada
  const [fallbackUser] = await db
    .select({ refresh: users.googleCalendarRefreshToken })
    .from(users)
    .where(
      and(
        isNotNull(users.googleCalendarRefreshToken),
        ne(users.googleCalendarRefreshToken, '')
      )
    )
    .limit(1)

  if (fallbackUser?.refresh) {
    const client = new google.auth.OAuth2(creds.clientId || undefined, creds.clientSecret || undefined)
    client.setCredentials({ refresh_token: fallbackUser.refresh })
    return { client, calendarId }
  }

  return null
}

const TYPE_LABELS: Record<string, string> = {
  consultation: 'Consulta', prp: 'PRP', bmac: 'BMAC', hyaluronic: 'Ácido Hialurônico',
  prolotherapy: 'Proloterapia', surgery: 'Cirurgia', return: 'Retorno', block: 'Bloqueio',
}

export interface SyncableAppointment {
  id: string
  doctorId: string | null
  googleEventId: string | null
  type: string
  status: string
  startAt: Date
  endAt: Date
  title: string | null
  notes: string | null
  room: string | null
}

function buildEventBody(appt: SyncableAppointment, displayName?: string | null) {
  const label = TYPE_LABELS[appt.type] ?? appt.type
  const summary = appt.title || (displayName ? `${label} — ${displayName}` : label)
  const descLines = [
    displayName ? `Paciente: ${displayName}` : null,
    `Tipo: ${label}`,
    appt.notes ? `Obs: ${appt.notes}` : null,
    'Agendado pelo sistema Regen Orto.',
  ].filter(Boolean)
  return {
    summary,
    description: descLines.join('\n'),
    location: appt.room ? `Sala ${appt.room}` : undefined,
    start: { dateTime: appt.startAt.toISOString() },
    end: { dateTime: appt.endAt.toISOString() },
  }
}

/**
 * Cria/atualiza o evento na agenda do médico. Retorna o googleEventId (novo ou
 * existente) para o chamador persistir, ou null se nada foi sincronizado.
 * Nunca lança — falhas de sync não devem quebrar o agendamento.
 */
export async function syncAppointment(appt: SyncableAppointment, displayName?: string | null): Promise<string | null> {
  try {
    if (!appt.doctorId) return null
    const ctx = await getClientForUser(appt.doctorId)
    if (!ctx) return null
    const calendar = google.calendar({ version: 'v3', auth: ctx.client })
    const requestBody = buildEventBody(appt, displayName)

    if (appt.googleEventId) {
      try {
        await calendar.events.update({ calendarId: ctx.calendarId, eventId: appt.googleEventId, requestBody })
        return appt.googleEventId
      } catch (e) {
        // Evento apagado direto no Google devolve 404/410. Antes o erro era
        // engolido e o agendamento ficava preso a um id inexistente: nenhuma
        // edição posterior voltava a aparecer na agenda do médico.
        const status = (e as { code?: number; status?: number })?.code ?? (e as { status?: number })?.status
        if (status !== 404 && status !== 410) throw e
        console.warn('[google/calendar] evento sumiu do Google, recriando', appt.googleEventId)
        const recriado = await calendar.events.insert({ calendarId: ctx.calendarId, requestBody })
        return recriado.data.id ?? null
      }
    }
    const res = await calendar.events.insert({ calendarId: ctx.calendarId, requestBody })
    return res.data.id ?? null
  } catch (e) {
    console.error('[google/calendar] syncAppointment', e)
    return null
  }
}

/** Remove o evento da agenda do médico. Nunca lança. */
export async function removeAppointment(doctorId: string | null, googleEventId: string | null): Promise<void> {
  try {
    if (!doctorId || !googleEventId) return
    const ctx = await getClientForUser(doctorId)
    if (!ctx) return
    const calendar = google.calendar({ version: 'v3', auth: ctx.client })
    await calendar.events.delete({ calendarId: ctx.calendarId, eventId: googleEventId })
  } catch (e) {
    console.error('[google/calendar] removeAppointment', e)
  }
}

/** Lista eventos diretamente do Google Calendar para o médico e período selecionado. */
export async function listGoogleCalendarEvents(doctorId: string, start: Date, end: Date): Promise<SyncableAppointment[]> {
  try {
    const ctx = await getClientForUser(doctorId)
    if (!ctx) return []
    const calendar = google.calendar({ version: 'v3', auth: ctx.client })
    const res = await calendar.events.list({
      calendarId: ctx.calendarId,
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })

    const events = res.data.items ?? []
    return events.map((evt) => {
      const startAt = evt.start?.dateTime || evt.start?.date
      const endAt = evt.end?.dateTime || evt.end?.date
      return {
        id: `gcal-${evt.id}`,
        doctorId,
        googleEventId: evt.id ?? null,
        type: 'google_event',
        status: 'confirmed',
        startAt: new Date(startAt!),
        endAt: new Date(endAt!),
        title: evt.summary ?? 'Compromisso Google',
        notes: evt.description ?? null,
        room: evt.location ?? null,
      }
    })
  } catch (e) {
    console.error('[google/calendar] listGoogleCalendarEvents', e)
    return []
  }
}
