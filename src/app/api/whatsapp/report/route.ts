import { NextResponse } from 'next/server'
import { requireSettingsEdit } from '@/lib/apiGuards'
import { getConfig } from '@/lib/db/queries/configuracoes'
import { deliverClinicReport, parseSections } from '@/lib/clinicReport'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// "Send now": build and deliver the clinic report to the configured target.
export async function POST() {
  const guard = await requireSettingsEdit()
  if (!guard.ok) return guard.res

  const target = (await getConfig('wa_report_target')) || (await getConfig('wa_bot_group_jid')) || ''
  if (!target) {
    return NextResponse.json({ error: 'Defina o destino do relatório (grupo ou número).' }, { status: 400 })
  }
  const sections = parseSections(await getConfig('wa_report_sections'))

  const result = await deliverClinicReport({ target, sections, refine: true })
  if (!result.ok) return NextResponse.json({ error: result.error ?? 'Falha ao enviar' }, { status: 502 })
  return NextResponse.json({ ok: true })
}
