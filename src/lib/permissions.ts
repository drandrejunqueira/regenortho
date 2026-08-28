export type UserRole = 'admin' | 'receptionist' | 'financial' | 'doctor'

export type Permission =
  | 'dashboard:view'
  | 'leads:view' | 'leads:create' | 'leads:edit' | 'leads:delete'
  | 'agenda:view' | 'agenda:create' | 'agenda:edit' | 'agenda:delete'
  | 'patients:view' | 'patients:create' | 'patients:edit' | 'patients:delete'
  | 'patients:view_clinical' | 'patients:create_clinical'
  | 'treatments:view' | 'treatments:create' | 'treatments:edit' | 'treatments:delete'
  | 'exams:view' | 'exams:create' | 'exams:edit'
  | 'financial:view' | 'financial:create' | 'financial:edit' | 'financial:delete'
  | 'payments:view' | 'payments:edit'
  | 'materials:view' | 'materials:create' | 'materials:edit' | 'materials:delete'
  | 'reports:view' | 'reports:export' | 'reports:balancete'
  | 'traffic:view'
  | 'portal:manage'
  | 'users:view' | 'users:create' | 'users:edit' | 'users:delete'
  | 'settings:view' | 'settings:edit'

// ── Module definitions (used in UI) ─────────────────────────

export interface PermissionDef {
  id: Permission
  label: string
  description: string
  sensitive?: boolean
}

export interface ModuleDef {
  id: string
  label: string
  icon: string
  permissions: PermissionDef[]
}

export const MODULES: ModuleDef[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'grid_view',
    permissions: [
      { id: 'dashboard:view', label: 'Visualizar dashboard', description: 'Acesso à tela inicial com KPIs e resumo' },
    ],
  },
  {
    id: 'leads',
    label: 'CRM de Leads',
    icon: 'person_add',
    permissions: [
      { id: 'leads:view',   label: 'Visualizar leads',   description: 'Ver lista e detalhes dos leads' },
      { id: 'leads:create', label: 'Cadastrar leads',    description: 'Criar novos leads no sistema' },
      { id: 'leads:edit',   label: 'Editar leads',       description: 'Alterar dados e status dos leads' },
      { id: 'leads:delete', label: 'Excluir leads',      description: 'Remover leads permanentemente', sensitive: true },
    ],
  },
  {
    id: 'agenda',
    label: 'Agenda',
    icon: 'calendar_month',
    permissions: [
      { id: 'agenda:view',   label: 'Visualizar agenda',        description: 'Ver consultas e procedimentos agendados' },
      { id: 'agenda:create', label: 'Criar agendamentos',       description: 'Marcar novas consultas e procedimentos' },
      { id: 'agenda:edit',   label: 'Alterar agendamentos',     description: 'Reagendar, confirmar e editar eventos', sensitive: true },
      { id: 'agenda:delete', label: 'Cancelar/excluir eventos', description: 'Cancelar ou remover agendamentos', sensitive: true },
    ],
  },
  {
    id: 'patients',
    label: 'Pacientes',
    icon: 'people',
    permissions: [
      { id: 'patients:view',            label: 'Visualizar pacientes',      description: 'Ver lista e dados cadastrais dos pacientes' },
      { id: 'patients:create',          label: 'Cadastrar pacientes',       description: 'Criar novos registros de pacientes' },
      { id: 'patients:edit',            label: 'Editar dados cadastrais',   description: 'Alterar informações pessoais e de contato' },
      { id: 'patients:delete',          label: 'Excluir pacientes',         description: 'Remover pacientes do sistema', sensitive: true },
      { id: 'patients:view_clinical',   label: 'Ver prontuário clínico',    description: 'Acessar histórico de tratamentos e evolução clínica', sensitive: true },
      { id: 'patients:create_clinical', label: 'Editar prontuário clínico', description: 'Registrar evoluções, diagnósticos e prescrições', sensitive: true },
    ],
  },
  {
    id: 'financial',
    label: 'Financeiro',
    icon: 'payments',
    permissions: [
      { id: 'financial:view',   label: 'Visualizar financeiro',  description: 'Ver receitas, despesas e relatórios financeiros' },
      { id: 'financial:create', label: 'Lançar transações',      description: 'Registrar novas receitas e despesas' },
      { id: 'financial:edit',   label: 'Alterar valores',        description: 'Editar lançamentos e valores existentes', sensitive: true },
      { id: 'financial:delete', label: 'Excluir lançamentos',    description: 'Remover registros financeiros', sensitive: true },
    ],
  },
  {
    id: 'materials',
    label: 'Materiais / Estoque',
    icon: 'inventory_2',
    permissions: [
      { id: 'materials:view',   label: 'Visualizar estoque',   description: 'Ver materiais e níveis de estoque' },
      { id: 'materials:create', label: 'Cadastrar materiais',  description: 'Adicionar novos materiais ao sistema' },
      { id: 'materials:edit',   label: 'Movimentar estoque',   description: 'Registrar entradas, saídas e ajustes' },
      { id: 'materials:delete', label: 'Excluir materiais',    description: 'Remover itens do sistema', sensitive: true },
    ],
  },
  {
    id: 'treatments',
    label: 'Tratamentos',
    icon: 'vaccines',
    permissions: [
      { id: 'treatments:view',   label: 'Visualizar tratamentos', description: 'Ver planos de tratamento e histórico' },
      { id: 'treatments:create', label: 'Criar tratamentos',      description: 'Abrir novos planos de tratamento' },
      { id: 'treatments:edit',   label: 'Editar tratamentos',     description: 'Alterar itens, valores e status', sensitive: true },
      { id: 'treatments:delete', label: 'Excluir tratamentos',    description: 'Remover tratamentos em rascunho', sensitive: true },
    ],
  },
  {
    id: 'exams',
    label: 'Pedidos de Exame',
    icon: 'biotech',
    permissions: [
      { id: 'exams:view',   label: 'Visualizar pedidos',  description: 'Ver pedidos de exame e resultados' },
      { id: 'exams:create', label: 'Emitir pedidos',      description: 'Criar novos pedidos de exame' },
      { id: 'exams:edit',   label: 'Atualizar resultados', description: 'Vincular resultados e alterar status', sensitive: true },
    ],
  },
  {
    id: 'traffic',
    label: 'Tráfego Pago',
    icon: 'show_chart',
    permissions: [
      { id: 'traffic:view', label: 'Visualizar tráfego', description: 'Ver métricas de campanhas e anúncios' },
    ],
  },
  {
    id: 'reports',
    label: 'Relatórios',
    icon: 'bar_chart',
    permissions: [
      { id: 'reports:view',      label: 'Visualizar relatórios', description: 'Acessar todos os relatórios do sistema' },
      { id: 'reports:export',    label: 'Exportar relatórios',   description: 'Baixar relatórios em PDF/Excel', sensitive: true },
      { id: 'reports:balancete', label: 'Acessar DRE/Balancete', description: 'Ver demonstrativo de resultado por procedimento', sensitive: true },
    ],
  },
  {
    id: 'portal',
    label: 'Portal do Paciente',
    icon: 'person_pin',
    permissions: [
      { id: 'portal:manage', label: 'Gerenciar portal', description: 'Gerar links de acesso e tokens do portal do paciente' },
    ],
  },
  {
    id: 'payments',
    label: 'Formas de Pagamento',
    icon: 'credit_card',
    permissions: [
      { id: 'payments:view', label: 'Visualizar pagamentos', description: 'Ver formas de pagamento e contas bancárias' },
      { id: 'payments:edit', label: 'Gerenciar pagamentos',  description: 'Criar e editar formas de pagamento e contas', sensitive: true },
    ],
  },
  {
    id: 'settings',
    label: 'Configurações',
    icon: 'settings',
    permissions: [
      { id: 'settings:view', label: 'Visualizar configurações', description: 'Acessar o painel de configurações' },
      { id: 'settings:edit', label: 'Editar configurações',     description: 'Alterar configurações do sistema', sensitive: true },
      { id: 'users:view',    label: 'Visualizar usuários',      description: 'Ver lista de usuários e seus perfis' },
      { id: 'users:create',  label: 'Criar usuários',           description: 'Adicionar novos usuários ao sistema', sensitive: true },
      { id: 'users:edit',    label: 'Editar usuários',          description: 'Alterar dados e permissões de usuários', sensitive: true },
      { id: 'users:delete',  label: 'Excluir usuários',         description: 'Remover usuários do sistema', sensitive: true },
    ],
  },
]

// ── Role presets ─────────────────────────────────────────────

export const ROLE_PRESETS: Record<UserRole, Permission[]> = {
  admin: [
    'dashboard:view',
    'leads:view', 'leads:create', 'leads:edit', 'leads:delete',
    'agenda:view', 'agenda:create', 'agenda:edit', 'agenda:delete',
    'patients:view', 'patients:create', 'patients:edit', 'patients:delete',
    'patients:view_clinical', 'patients:create_clinical',
    'treatments:view', 'treatments:create', 'treatments:edit', 'treatments:delete',
    'exams:view', 'exams:create', 'exams:edit',
    'financial:view', 'financial:create', 'financial:edit', 'financial:delete',
    'payments:view', 'payments:edit',
    'materials:view', 'materials:create', 'materials:edit', 'materials:delete',
    'reports:view', 'reports:export', 'reports:balancete',
    'traffic:view',
    'portal:manage',
    'users:view', 'users:create', 'users:edit', 'users:delete',
    'settings:view', 'settings:edit',
  ],
  doctor: [
    'dashboard:view',
    // 'agenda:edit' sem 'agenda:create'/'agenda:delete': finalizar a consulta começa por um
    // PATCH na agenda, e sem essa permissão o médico levava 403 antes de gravar evolução e
    // tratamento. Marcar e cancelar consulta continua sendo da recepção.
    'agenda:view', 'agenda:edit',
    'patients:view', 'patients:view_clinical', 'patients:create_clinical',
    'treatments:view', 'treatments:create', 'treatments:edit',
    'exams:view', 'exams:create', 'exams:edit',
    'portal:manage',
  ],
  receptionist: [
    'dashboard:view',
    'leads:view', 'leads:create', 'leads:edit',
    'agenda:view', 'agenda:create', 'agenda:edit',
    'patients:view', 'patients:create', 'patients:edit',
    'treatments:view',
    'exams:view',
    'materials:view',
    'reports:view',
    'portal:manage',
  ],
  financial: [
    'dashboard:view',
    'financial:view', 'financial:create', 'financial:edit',
    'payments:view', 'payments:edit',
    'reports:view', 'reports:export', 'reports:balancete',
    'patients:view',
    'treatments:view',
    'traffic:view',
  ],
}

export const ROLE_META: Record<UserRole, { label: string; description: string; icon: string; color: string }> = {
  admin: {
    label: 'Administrador',
    description: 'Acesso total ao sistema. Gerencia usuários, configurações e todos os módulos.',
    icon: 'shield_person',
    color: '#ffb4ab',
  },
  doctor: {
    label: 'Médico',
    description: 'Acesso à agenda e prontuários clínicos. Sem acesso financeiro.',
    icon: 'stethoscope',
    color: '#61d8dd',
  },
  receptionist: {
    label: 'Recepcionista',
    description: 'Gestão de leads, agenda e pacientes. Sem acesso financeiro ou clínico.',
    icon: 'support_agent',
    color: '#e6c364',
  },
  financial: {
    label: 'Financeiro',
    description: 'Acesso completo ao módulo financeiro e relatórios. Sem dados clínicos.',
    icon: 'account_balance',
    color: '#a8d5a2',
  },
}

// ── Core helpers ─────────────────────────────────────────────

export function getEffectivePermissions(
  role: UserRole,
  customPermissions: string[] | null | undefined,
): Permission[] {
  if (customPermissions && customPermissions.length > 0) {
    return customPermissions as Permission[]
  }
  return ROLE_PRESETS[role] ?? []
}

export function hasPermission(
  role: UserRole,
  permission: Permission,
  customPermissions?: string[] | null,
): boolean {
  return getEffectivePermissions(role, customPermissions).includes(permission)
}

export function checkPermission(
  role: UserRole,
  permission: Permission,
  customPermissions?: string[] | null,
): void {
  if (!hasPermission(role, permission, customPermissions)) {
    throw new Error(`Acesso negado: permissão '${permission}' requerida.`)
  }
}
