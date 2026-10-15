// Contratos de dados do dashboard. Cada loader devolve exatamente um destes
// tipos; os componentes consomem `Settled<T>` para renderizar erro por bloco
// sem derrubar a página inteira.

export type AgendaState =
  | 'done'          // atendido
  | 'now'           // dentro do horário, ainda não marcado como atendido
  | 'late'          // horário passou sem registro de atendimento
  | 'confirmed'     // futuro, confirmado
  | 'unconfirmed'   // futuro, sem confirmação
  | 'no_show'
  | 'rescheduled'

export interface AgendaItem {
  id: string
  day: string
  time: string
  endTime: string
  startMs: number
  endMs: number
  personName: string
  personPhone: string | null
  patientId: string | null
  leadId: string | null
  doctorName: string | null
  type: string
  typeLabel: string
  status: string
  state: AgendaState
  room: string | null
}

export interface ChegadasHoje {
  day: string
  items: AgendaItem[]
  total: number
  porChegar: number
  confirmados: number
  atendidos: number
  semRegistro: number
}

export interface NaoConfirmados {
  hoje: AgendaItem[]
  amanha: AgendaItem[]
}

export interface LeadNovo {
  id: string
  name: string
  phone: string
  sourceLabel: string
  specialty: string | null
  createdAt: string
  ageMs: number
}

export interface LeadsNovos {
  total: number
  items: LeadNovo[]
}

export interface EstoqueItem {
  id: string
  name: string
  status: string
  currentStock: number
  minimumStock: number
  unit: string
}

export interface Estoque {
  critical: number
  low: number
  items: EstoqueItem[]
}

export interface MinhaAgenda {
  day: string
  items: AgendaItem[]
  proximo: AgendaItem | null
  total: number
  atendidos: number
}

export interface ExamePendente {
  id: string
  patientId: string
  patientName: string
  examNames: string[]
  urgency: string
  status: string
  ageDays: number
}

export interface Exames {
  aguardando: number
  comResultado: number
  items: ExamePendente[]
}

export interface CaixaHoje {
  day: string
  entrou: number
  saiu: number
  saldo: number
  qtdEntradas: number
  qtdSaidas: number
}

export interface ParcelaVencida {
  id: string
  description: string
  amount: number
  due: string
  daysLate: number
  patientId: string | null
  patientName: string | null
  installmentNumber: number | null
  installmentTotal: number | null
}

export interface Vencidas {
  total: number
  soma: number
  items: ParcelaVencida[]
}

export interface PrevistoMes {
  month: number
  year: number
  recebido: number
  aVencer: number
  vencido: number
  meta: number
  metaDefinida: boolean
  daysLeft: number
  daysInMonth: number
  /** Quanto precisa entrar por dia (corrido) para bater a meta. */
  ritmoDia: number
}

export interface DiaValor {
  day: string
  label: string
  value: number
  count: number
  isToday: boolean
}

export interface Vencimentos7d {
  days: DiaValor[]
  soma: number
}

export interface FunilEtapa {
  status: string
  label: string
  count: number
}

export interface FunilMes {
  month: number
  total: number
  etapas: FunilEtapa[]
  perdidos: number
  /** % dos leads do mês que chegaram pelo menos a "agendado". */
  taxaAgendamento: number
}

export interface OcupacaoDia {
  day: string
  label: string
  minutes: number
  count: number
  pct: number
  isToday: boolean
}

export interface Ocupacao7d {
  days: OcupacaoDia[]
  capacityMinutes: number
  doctors: number
  mediaPct: number
}

export interface LoaderResults {
  chegadas: ChegadasHoje
  naoConfirmados: NaoConfirmados
  leadsNovos: LeadsNovos
  estoque: Estoque
  minhaAgenda: MinhaAgenda
  exames: Exames
  caixaHoje: CaixaHoje
  vencidas: Vencidas
  previstoMes: PrevistoMes
  vencimentos7d: Vencimentos7d
  funilMes: FunilMes
  ocupacao7d: Ocupacao7d
}

export type LoaderId = keyof LoaderResults

export type Settled<T> = { ok: true; data: T } | { ok: false; error: string }

export type ResultMap = { [K in LoaderId]?: Settled<LoaderResults[K]> }

export interface LoaderCtx {
  userId: string
  now: Date
  today: string
}
