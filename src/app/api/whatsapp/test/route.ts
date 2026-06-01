import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { sendWhatsApp } from '@/lib/whatsapp'
import { z } from 'zod'

const schema = z.object({
  number: z.string().min(10),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'settings:edit')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Número inválido' }, { status: 400 })

  const result = await sendWhatsApp(
    parsed.data.number,
    '✅ *Teste de conexão Regem Orto*\n\nSua integração com WhatsApp via Evolution API está funcionando corretamente! 🎉',
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Falha ao enviar' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, response: result.response })
}
