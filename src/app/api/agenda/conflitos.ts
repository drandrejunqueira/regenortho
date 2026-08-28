import { db } from '@/lib/db'
import { appointments } from '@/lib/db/schema'
import { and, eq, gt, lt, ne, or } from 'drizzle-orm'

/**
 * Checagem de choque de horário da agenda.
 *
 * Mora fora dos `route.ts` porque o App Router só deixa um arquivo de rota
 * exportar handlers — e a regra de sobreposição precisa ser IDÊNTICA no POST e
 * no PATCH. Duas cópias iriam divergir na primeira manutenção e o buraco por
 * onde a clínica marca dois pacientes no mesmo médico voltaria por um dos lados.
 */

export type ConflitoAgenda = {
  id: string
  startAt: Date
  endAt: Date
  doctorId: string | null
  roomId: string | null
}

type BuscaConflito = {
  inicio: Date
  fim: Date
  doctorId?: string | null
  roomId?: string | null
  /** Id do próprio agendamento sendo editado — ele nunca conflita consigo mesmo. */
  ignorarId?: string
}

/**
 * Agendamentos que disputam o mesmo médico OU a mesma sala na faixa pedida.
 *
 * Sobreposição real é `novoInicio < fimExistente AND novoFim > inicioExistente`:
 * encostar não conflita — 14h–15h e 15h–16h convivem no mesmo consultório.
 * Cancelados ficam de fora: o horário deles está livre para ser reocupado.
 */
export async function buscarConflitos(opts: BuscaConflito): Promise<ConflitoAgenda[]> {
  const recursos = []
  if (opts.doctorId) recursos.push(eq(appointments.doctorId, opts.doctorId))
  if (opts.roomId) recursos.push(eq(appointments.roomId, opts.roomId))
  // Sem médico e sem sala não há recurso físico disputado (ex.: bloqueio pessoal).
  if (recursos.length === 0) return []

  const linhas = await db.query.appointments.findMany({
    where: and(
      or(...recursos),
      lt(appointments.startAt, opts.fim),
      gt(appointments.endAt, opts.inicio),
      ne(appointments.status, 'cancelled'),
      opts.ignorarId ? ne(appointments.id, opts.ignorarId) : undefined,
    ),
    columns: { id: true, startAt: true, endAt: true, doctorId: true, roomId: true },
    // A recepção só precisa saber o que remarcar; listar tudo não ajuda ninguém.
    limit: 5,
  })

  return linhas as ConflitoAgenda[]
}

/** Faixa de horário no fuso da clínica — em UTC a recepção leria 3h a menos. */
function faixaBR(inicio: Date, fim: Date): string {
  const dia = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(inicio)
  const hora = (d: Date) =>
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
    }).format(d)
  return `${dia}, das ${hora(inicio)} às ${hora(fim)}`
}

/**
 * Mensagem do 409. Diz O QUE está ocupado e EM QUE horário: a recepção precisa
 * saber o que remarcar, não só que a gravação falhou.
 */
export function mensagemDeConflito(
  conflitos: ConflitoAgenda[],
  doctorId?: string | null,
  roomId?: string | null,
): string {
  const partes = conflitos.map((c) => {
    const quem =
      doctorId && c.doctorId === doctorId
        ? 'o médico já tem um agendamento'
        : roomId && c.roomId === roomId
          ? 'a sala já está ocupada'
          : 'já existe um agendamento'
    return `${quem} em ${faixaBR(c.startAt, c.endAt)}`
  })
  return `Conflito de horário: ${partes.join('; ')}. Escolha outro horário ou remarque o agendamento existente.`
}
