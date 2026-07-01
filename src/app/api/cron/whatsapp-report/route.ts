// Scheduled daily clinic report — PUBLIC route, guarded by CRON_SECRET.
// Vercel Cron calls this with `Authorization: Bearer <CRON_SECRET>`. Runs once per
// BR calendar day (deduped via wa_report_last_sent) and honors the weekday config.
// Fires at the vercel.json cron time; pass ?force=1 (authorized) to test off-schedule.
import { NextRequest, NextResponse } from 'next/server'
import { getConfig, setConfig } from '@/lib/db/queries/configuracoes'
import { deliverClinicReport, parseSections } from '@/lib/clinicReport'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TZ = 'America/Sao_Paulo'
const brToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function brWeekday(): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(new Date())
  return WEEKDAYS.indexOf(wd) // 0=Sun..6=Sat
}

const DAY_TOKENS: Record<string, number> = {
  dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

function dayMatches(cfg: string, wd: number): boolean {
  const c = (cfg || 'daily').toLowerCase().trim()
  if (c === 'daily' || c === '') return true
  if (c === 'mon-fri' || c === 'weekdays' || c === 'seg-sex' || c === 'uteis') return wd >= 1 && wd <= 5
  return c
    .split(/[,\s]+/)
    .filter(Boolean)
    .some((t) => DAY_TOKENS[t] === wd)
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const authz = req.headers.get('authorization') || ''
    if (authz !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }
  }

  const force = new URL(req.url).searchParams.get('force') === '1'
  const enabled = (await getConfig('wa_report_enabled')) === '1'
  if (!enabled && !force) return NextResponse.json({ ok: true, skipped: 'disabled' })

  const days = (await getConfig('wa_report_days')) || 'daily'
  if (!force && !dayMatches(days, brWeekday())) {
    return NextResponse.json({ ok: true, skipped: 'day-off' })
  }

  const today = brToday()
  const lastSent = await getConfig('wa_report_last_sent')
  if (!force && lastSent === today) return NextResponse.json({ ok: true, skipped: 'already-sent' })

  const target = (await getConfig('wa_report_target')) || (await getConfig('wa_bot_group_jid')) || ''
  if (!target) return NextResponse.json({ ok: false, error: 'sem destino configurado' }, { status: 400 })

  const sections = parseSections(await getConfig('wa_report_sections'))
  const result = await deliverClinicReport({ target, sections, refine: true })
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 })

  await setConfig('wa_report_last_sent', today, 'Última data (BR) em que o relatório diário foi enviado')
  return NextResponse.json({ ok: true, sent: true, date: today })
}
