// Quem mandou a mensagem no grupo do WhatsApp, em termos do RBAC do sistema.
//
// Estar no grupo não é credencial: quem entra e sai do grupo não é o RBAC da
// aplicação, e um aparelho perdido carrega o acesso junto. O bot só entrega
// dado individual de paciente a quem é mapeado para um usuário ativo — pelo
// telefone do perfil — e com a permissão que o próprio sistema exigiria.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { hasPermission, type Permission, type UserRole } from '@/lib/permissions'

export interface RemetenteBot {
  userId: string
  nome: string
  /** JID de telefone do remetente — destino da resposta no privado. */
  jid: string
  podeVerPaciente: boolean
  podeVerProntuario: boolean
  podeVerTratamentos: boolean
}

const JID_TELEFONE_RE = /@(s\.whatsapp\.net|c\.us)$/

/**
 * JID de telefone do autor de uma mensagem de grupo, ou null.
 *
 * Mensagem `fromMe` é do número conectado da clínica — aparelho compartilhado,
 * não uma pessoa — e por isso nunca identifica um usuário. JID `@lid` (id
 * anônimo do WhatsApp) sem o telefone alternativo também não: na dúvida, o
 * remetente fica não identificado.
 */
export function jidDoRemetente(data: any): string | null {
  const key = data?.key || {}
  if (key.fromMe) return null
  const candidatos = [key.participantAlt, key.participantPn, key.senderPn, data?.participant, key.participant]
  for (const c of candidatos) {
    const jid = typeof c === 'string' ? c.trim() : ''
    if (JID_TELEFONE_RE.test(jid)) return jid
  }
  return null
}

/**
 * Formas equivalentes de um telefone brasileiro, para casar o JID do WhatsApp
 * (55 + DDD + número, às vezes sem o 9) com o telefone digitado no perfil
 * ("(12) 98176-7896", "012...", "+55 ...").
 */
export function variantesTelefone(bruto: string | null | undefined): string[] {
  let d = (bruto || '').replace(/\D/g, '')
  if (!d) return []
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2)
  else if (d.startsWith('0') && d.length >= 11) d = d.slice(1)
  if (d.length < 10) return []
  const variantes = new Set([d])
  // Celular com e sem o nono dígito (contas antigas aparecem sem ele no JID).
  if (d.length === 11 && d[2] === '9') variantes.add(d.slice(0, 2) + d.slice(3))
  if (d.length === 10) variantes.add(`${d.slice(0, 2)}9${d.slice(2)}`)
  return [...variantes]
}

function mesmoTelefone(a: string[], b: string[]): boolean {
  return a.some(v => b.includes(v))
}

/** Usuário ativo dono do número que mandou a mensagem, com as permissões dele. */
export async function identificarRemetente(jid: string | null): Promise<RemetenteBot | null> {
  if (!jid) return null
  const doJid = variantesTelefone(jid.split('@')[0].split(':')[0])
  if (doJid.length === 0) return null

  const ativos = await db.query.users.findMany({
    where: eq(users.isActive, true),
    columns: { id: true, name: true, role: true, customPermissions: true, phone: true, dailyAgendaWhatsapp: true },
  })
  const donos = ativos.filter(u =>
    mesmoTelefone(doJid, variantesTelefone(u.phone)) || mesmoTelefone(doJid, variantesTelefone(u.dailyAgendaWhatsapp)),
  )
  // Número cadastrado em mais de um usuário: não dá para saber de quem é a
  // permissão, então ninguém é identificado.
  if (donos.length !== 1) return null

  const u = donos[0]
  const pode = (p: Permission) => hasPermission(u.role as UserRole, p, u.customPermissions)
  return {
    userId: u.id,
    nome: u.name,
    jid,
    podeVerPaciente: pode('patients:view'),
    podeVerProntuario: pode('patients:view_clinical'),
    podeVerTratamentos: pode('treatments:view'),
  }
}
