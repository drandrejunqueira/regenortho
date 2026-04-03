export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: 'Novo',
  contacted: 'Em Contato',
  scheduled: 'Agendado',
  attended: 'Compareceu',
  active_patient: 'Paciente Ativo',
  lost: 'Perdido',
}

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  instagram_organic: 'Instagram',
  facebook_organic: 'Facebook',
  google_organic: 'Google Orgânico',
  referral: 'Indicação',
  whatsapp: 'WhatsApp',
  other: 'Outro',
}

export const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  consultation: 'Consulta',
  prp: 'PRP',
  bmac: 'BMAC',
  hyaluronic: 'Ác. Hialurônico',
  prolotherapy: 'Proloterapia',
  surgery: 'Cirurgia',
  return: 'Retorno',
  block: 'Bloqueio',
}

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  attended: 'Compareceu',
  no_show: 'Faltou',
  rescheduled: 'Remarcado',
  cancelled: 'Cancelado',
}

export const TRANSACTION_CATEGORY_LABELS: Record<string, string> = {
  consultation_fee: 'Consulta',
  prp_procedure: 'Procedimento PRP',
  bmac_procedure: 'Procedimento BMAC',
  hyaluronic_procedure: 'Proc. Hialurônico',
  surgery_fee: 'Cirurgia',
  other_income: 'Outra Receita',
  rent: 'Aluguel',
  staff: 'Funcionários',
  marketing: 'Marketing',
  materials: 'Materiais',
  equipment: 'Equipamentos',
  utilities: 'Utilidades',
  insurance: 'Seguros',
  accounting: 'Contabilidade',
  other_expense: 'Outra Despesa',
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  receptionist: 'Recepcionista',
  financial: 'Financeiro',
  doctor: 'Médico',
}

export const STOCK_STATUS_LABELS: Record<string, string> = {
  ok: 'Normal',
  low: 'Baixo',
  critical: 'Crítico',
  out_of_stock: 'Sem Estoque',
}

export const APPOINTMENT_COLORS: Record<string, string> = {
  consultation: 'bg-primary/90 text-white',
  prp: 'bg-[var(--gold)] text-white',
  bmac: 'bg-[var(--gold-dark)] text-white',
  hyaluronic: 'bg-[var(--gold-light)] text-white',
  prolotherapy: 'bg-[var(--gold)] text-white',
  surgery: 'bg-purple-600 text-white',
  return: 'bg-blue-500 text-white',
  block: 'bg-red-300/70 text-red-900',
}
