/** Rotas capturadas na galeria, agrupadas por área. */
export interface Route {
  path: string
  label: string
  area: 'site' | 'auth' | 'portal' | 'dashboard' | 'configuracoes'
  /** Exige sessão autenticada */
  auth: boolean
  /** Rota com [param] — precisa de um id real; resolvido em runtime */
  dynamic?: boolean
}

export const ROUTES: Route[] = [
  // ── Site público ────────────────────────────────────────
  { path: '/site',                    label: 'Home do site',      area: 'site', auth: false },
  { path: '/site/a-clinica',          label: 'A clínica',         area: 'site', auth: false },
  { path: '/site/especialidades',     label: 'Especialidades',    area: 'site', auth: false },
  { path: '/site/tratamentos',        label: 'Tratamentos',       area: 'site', auth: false },
  { path: '/site/agendar',            label: 'Agendar (captação)',area: 'site', auth: false },
  { path: '/site/blog',               label: 'Blog',              area: 'site', auth: false },
  { path: '/site/glossario',          label: 'Glossário',         area: 'site', auth: false },
  { path: '/site/lp/articulacoes',    label: 'LP Articulações',   area: 'site', auth: false },

  // ── Autenticação ────────────────────────────────────────
  { path: '/login',                   label: 'Login',             area: 'auth', auth: false },

  // ── Portal do paciente ──────────────────────────────────
  { path: '/portal',                  label: 'Portal do paciente',area: 'portal', auth: false },

  // ── Dashboard ───────────────────────────────────────────
  { path: '/dashboard',               label: 'Dashboard',         area: 'dashboard', auth: true },
  { path: '/leads',                   label: 'CRM — Kanban',      area: 'dashboard', auth: true },
  { path: '/agenda',                  label: 'Agenda',            area: 'dashboard', auth: true },
  { path: '/pacientes',               label: 'Pacientes',         area: 'dashboard', auth: true },
  { path: '/tratamentos',             label: 'Tratamentos',       area: 'dashboard', auth: true },
  { path: '/financeiro',              label: 'Financeiro',        area: 'dashboard', auth: true },
  { path: '/materiais',               label: 'Materiais',         area: 'dashboard', auth: true },
  { path: '/relatorios',              label: 'Relatórios',        area: 'dashboard', auth: true },
  { path: '/trafego',                 label: 'Tráfego pago',      area: 'dashboard', auth: true },
  { path: '/glossario',               label: 'Glossário (admin)', area: 'dashboard', auth: true },

  // ── Configurações ───────────────────────────────────────
  { path: '/configuracoes',           label: 'Configurações',     area: 'configuracoes', auth: true },
  { path: '/configuracoes/usuarios',  label: 'Usuários',          area: 'configuracoes', auth: true },
  { path: '/configuracoes/salas',     label: 'Salas',             area: 'configuracoes', auth: true },
  { path: '/configuracoes/tags',      label: 'Tags',              area: 'configuracoes', auth: true },
  { path: '/configuracoes/categorias',label: 'Categorias',        area: 'configuracoes', auth: true },
  { path: '/configuracoes/contas',    label: 'Contas bancárias',  area: 'configuracoes', auth: true },
  { path: '/configuracoes/pagamentos',label: 'Formas de pagamento',area:'configuracoes', auth: true },
  { path: '/configuracoes/integracoes',label:'Integrações',       area: 'configuracoes', auth: true },
  { path: '/configuracoes/notificacoes',label:'Notificações',     area: 'configuracoes', auth: true },
  { path: '/configuracoes/site',      label: 'Site',              area: 'configuracoes', auth: true },
  { path: '/configuracoes/seo',       label: 'SEO',               area: 'configuracoes', auth: true },
  { path: '/configuracoes/geo',       label: 'GEO',               area: 'configuracoes', auth: true },
  { path: '/configuracoes/webhooks',  label: 'Webhooks',          area: 'configuracoes', auth: true },
  { path: '/configuracoes/logs',      label: 'Logs de auditoria', area: 'configuracoes', auth: true },
  { path: '/configuracoes/backup',    label: 'Backup',            area: 'configuracoes', auth: true },
  { path: '/configuracoes/sistema',   label: 'Sistema',           area: 'configuracoes', auth: true },
  { path: '/configuracoes/atualizacoes',label:'Atualizações',     area: 'configuracoes', auth: true },
]

export const PUBLIC_ROUTES = ROUTES.filter((r) => !r.auth)
export const AUTH_ROUTES = ROUTES.filter((r) => r.auth)

/** `/configuracoes/usuarios` → `configuracoes-usuarios` */
export function slug(path: string): string {
  return path.replace(/^\//, '').replace(/\//g, '-') || 'raiz'
}
