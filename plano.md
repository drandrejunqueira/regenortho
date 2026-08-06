# ============================================================
#  PROMPT MASTER — SISTEMA DE GESTÃO REGEM ORTO
#  Para usar no Claude Code (claude.ai/code)
#  Autor: Daniel Marques · 2TimeWeb
# ============================================================

## CONTEXTO GERAL

Você é um engenheiro sênior fullstack. Sua missão é construir do zero o
**Sistema de Gestão da Regem Orto** — uma clínica de ortopedia regenerativa
em São José dos Campos, SP, Brasil, liderada pelo Dr. André Elias Junqueira.

Este é um sistema web interno, acessado pelo navegador, com múltiplos
perfis de usuário e controle de acesso granular. O sistema precisa ser
robusto, bonito, rápido e pronto para produção.

---

## STACK TECNOLÓGICA OBRIGATÓRIA

- **Framework:** Next.js 14 (App Router)
- **Linguagem:** TypeScript (strict mode)
- **Banco de dados:** PostgreSQL via Neon DB (serverless)
- **ORM:** Drizzle ORM (type-safe, perfeito para Neon + serverless)
- **Autenticação:** NextAuth.js v5 (Auth.js) com credentials provider
- **Estilização:** Tailwind CSS + shadcn/ui
- **Validação:** Zod (schemas compartilhados entre frontend e backend)
- **Estado global:** Zustand (leve, sem boilerplate)
- **Formulários:** React Hook Form + Zod resolver
- **Tabelas:** TanStack Table v8
- **Gráficos:** Recharts
- **Datas:** date-fns com locale pt-BR
- **Drag & drop:** @dnd-kit (para Kanban do CRM)
- **Notificações:** Sonner (toasts)
- **Ícones:** Lucide React
- **HTTP client:** ky ou fetch nativo com wrappers
- **Testes:** Vitest + Testing Library (pelo menos os críticos)

---

## BANCO DE DADOS — NEON DB (POSTGRESQL)

**Connection string:**
```
<sua-connection-string-do-neon>
```

Salve em `.env.local`:
```env
DATABASE_URL="<sua-connection-string-do-neon>"
NEXTAUTH_SECRET="gere-um-secret-aleatorio-forte-aqui"
NEXTAUTH_URL="http://localhost:3000"
```

---

## PASSO 1 — INICIALIZAÇÃO DO PROJETO

Execute em ordem:

```bash
# 1. Criar o projeto Next.js
npx create-next-app@latest regem-orto-sistema \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd regem-orto-sistema

# 2. Instalar dependências principais
npm install drizzle-orm @neondatabase/serverless dotenv
npm install next-auth@beta
npm install zod react-hook-form @hookform/resolvers
npm install zustand
npm install @tanstack/react-table
npm install recharts
npm install date-fns
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install sonner
npm install lucide-react
npm install clsx tailwind-merge class-variance-authority

# 3. Instalar devDependencies
npm install -D drizzle-kit
npm install -D @types/node

# 4. Instalar shadcn/ui
npx shadcn@latest init
# Escolha: Default style, Zinc base color, CSS variables: yes

# 5. Adicionar componentes shadcn necessários
npx shadcn@latest add button card dialog dropdown-menu form input label
npx shadcn@latest add select separator sheet skeleton table tabs textarea
npx shadcn@latest add badge avatar popover calendar command
npx shadcn@latest add alert scroll-area tooltip progress checkbox
```

---

## PASSO 2 — ESTRUTURA DE PASTAS

Crie EXATAMENTE esta estrutura:

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              ← layout com sidebar
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── leads/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── agenda/
│   │   │   └── page.tsx
│   │   ├── pacientes/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── financeiro/
│   │   │   └── page.tsx
│   │   ├── materiais/
│   │   │   └── page.tsx
│   │   ├── trafego/
│   │   │   └── page.tsx
│   │   └── relatorios/
│   │       └── page.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts
│   │   ├── leads/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       └── route.ts
│   │   ├── agenda/
│   │   │   └── route.ts
│   │   ├── pacientes/
│   │   │   └── route.ts
│   │   ├── financeiro/
│   │   │   └── route.ts
│   │   ├── materiais/
│   │   │   └── route.ts
│   │   └── dashboard/
│   │       └── route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                         ← shadcn components (auto-gerados)
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   └── UserMenu.tsx
│   ├── leads/
│   │   ├── KanbanBoard.tsx
│   │   ├── KanbanColumn.tsx
│   │   ├── LeadCard.tsx
│   │   ├── LeadDrawer.tsx
│   │   └── NewLeadDialog.tsx
│   ├── agenda/
│   │   ├── CalendarView.tsx
│   │   ├── WeekView.tsx
│   │   ├── EventBlock.tsx
│   │   └── NewEventDialog.tsx
│   ├── dashboard/
│   │   ├── KpiCard.tsx
│   │   ├── FunnelChart.tsx
│   │   ├── RecentLeads.tsx
│   │   ├── AgendaHoje.tsx
│   │   ├── FinanceiroCard.tsx
│   │   └── EstoqueCard.tsx
│   ├── financeiro/
│   │   ├── LancamentosTable.tsx
│   │   └── DreCard.tsx
│   ├── materiais/
│   │   └── EstoqueTable.tsx
│   └── shared/
│       ├── PageHeader.tsx
│       ├── DataTable.tsx
│       ├── StatusBadge.tsx
│       ├── ConfirmDialog.tsx
│       └── EmptyState.tsx
├── lib/
│   ├── db/
│   │   ├── index.ts                ← conexão Neon
│   │   ├── schema.ts               ← schema Drizzle completo
│   │   └── migrations/
│   ├── auth/
│   │   ├── config.ts               ← NextAuth config
│   │   └── middleware.ts
│   ├── validations/
│   │   ├── lead.ts
│   │   ├── agenda.ts
│   │   ├── paciente.ts
│   │   ├── financeiro.ts
│   │   └── material.ts
│   ├── permissions.ts              ← RBAC
│   ├── utils.ts
│   └── constants.ts
├── hooks/
│   ├── useLeads.ts
│   ├── useAgenda.ts
│   ├── usePacientes.ts
│   ├── useFinanceiro.ts
│   └── useMateriais.ts
├── stores/
│   ├── useUIStore.ts
│   └── useFiltersStore.ts
└── types/
    ├── index.ts
    ├── lead.ts
    ├── agenda.ts
    ├── paciente.ts
    ├── financeiro.ts
    └── material.ts
```

---

## PASSO 3 — SCHEMA DO BANCO DE DADOS (DRIZZLE)

Crie `src/lib/db/schema.ts` com EXATAMENTE estas tabelas:

```typescript
import {
  pgTable, serial, text, varchar, timestamp, boolean,
  integer, decimal, date, pgEnum, jsonb, uuid
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ── ENUMS ──────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', [
  'admin',          // Dr. André — acesso total
  'receptionist',   // Agenda + Leads + Pacientes (sem financeiro)
  'financial',      // Financeiro + Relatórios (sem prontuário)
  'doctor'          // Visualização de pacientes (médico convidado)
])

export const leadStatusEnum = pgEnum('lead_status', [
  'new',            // Novo lead
  'contacted',      // Em contato
  'scheduled',      // Agendado
  'attended',       // Compareceu à consulta
  'active_patient', // Paciente ativo
  'lost'            // Perdido / desistiu
])

export const leadSourceEnum = pgEnum('lead_source', [
  'google_ads',
  'meta_ads',
  'instagram_organic',
  'facebook_organic',
  'google_organic',
  'referral',       // Indicação
  'whatsapp',
  'other'
])

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'scheduled',
  'confirmed',
  'attended',
  'no_show',       // Não compareceu
  'rescheduled',
  'cancelled'
])

export const appointmentTypeEnum = pgEnum('appointment_type', [
  'consultation',   // Consulta
  'prp',            // PRP
  'bmac',           // BMAC / Células-tronco
  'hyaluronic',     // Ácido hialurônico
  'prolotherapy',   // Proloterapia
  'surgery',        // Cirurgia
  'return',         // Retorno
  'block'           // Bloqueio de agenda
])

export const transactionTypeEnum = pgEnum('transaction_type', [
  'income',   // Receita
  'expense'   // Despesa
])

export const transactionCategoryEnum = pgEnum('transaction_category', [
  // Receitas
  'consultation_fee',
  'prp_procedure',
  'bmac_procedure',
  'hyaluronic_procedure',
  'surgery_fee',
  'other_income',
  // Despesas
  'rent',
  'staff',
  'marketing',
  'materials',
  'equipment',
  'utilities',
  'insurance',
  'accounting',
  'other_expense'
])

export const stockStatusEnum = pgEnum('stock_status', [
  'ok',
  'low',
  'critical',
  'out_of_stock'
])

export const genderEnum = pgEnum('gender', ['male', 'female', 'other'])

// ── TABELAS ────────────────────────────────────────────────

// USUÁRIOS DO SISTEMA
export const users = pgTable('users', {
  id:           uuid('id').defaultRandom().primaryKey(),
  name:         varchar('name', { length: 255 }).notNull(),
  email:        varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role:         userRoleEnum('role').notNull().default('receptionist'),
  avatar:       text('avatar'),
  phone:        varchar('phone', { length: 20 }),
  isActive:     boolean('is_active').notNull().default(true),
  lastLoginAt:  timestamp('last_login_at'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
})

// LEADS / PACIENTES EM POTENCIAL
export const leads = pgTable('leads', {
  id:           uuid('id').defaultRandom().primaryKey(),
  name:         varchar('name', { length: 255 }).notNull(),
  phone:        varchar('phone', { length: 30 }).notNull(),
  email:        varchar('email', { length: 255 }),
  status:       leadStatusEnum('status').notNull().default('new'),
  source:       leadSourceEnum('source').notNull().default('other'),
  specialty:    varchar('specialty', { length: 100 }), // joelho, coluna, ombro, etc
  complaint:    text('complaint'),  // queixa principal
  notes:        text('notes'),
  assignedToId: uuid('assigned_to_id').references(() => users.id),
  convertedAt:  timestamp('converted_at'), // quando virou paciente
  patientId:    uuid('patient_id').references(() => patients.id),
  lostReason:   text('lost_reason'),
  utmSource:    varchar('utm_source', { length: 100 }),
  utmCampaign:  varchar('utm_campaign', { length: 100 }),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
})

// INTERAÇÕES COM LEADS (timeline)
export const leadInteractions = pgTable('lead_interactions', {
  id:          uuid('id').defaultRandom().primaryKey(),
  leadId:      uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  userId:      uuid('user_id').references(() => users.id),
  type:        varchar('type', { length: 50 }).notNull(), // call, whatsapp, email, note
  content:     text('content').notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
})

// PACIENTES (leads convertidos)
export const patients = pgTable('patients', {
  id:           uuid('id').defaultRandom().primaryKey(),
  name:         varchar('name', { length: 255 }).notNull(),
  email:        varchar('email', { length: 255 }),
  phone:        varchar('phone', { length: 30 }).notNull(),
  cpf:          varchar('cpf', { length: 14 }),
  birthDate:    date('birth_date'),
  gender:       genderEnum('gender'),
  address:      text('address'),
  city:         varchar('city', { length: 100 }),
  insurance:    varchar('insurance', { length: 100 }), // convênio
  insuranceNum: varchar('insurance_number', { length: 50 }),
  notes:        text('notes'),
  isActive:     boolean('is_active').notNull().default(true),
  nps:          integer('nps'), // 0-10
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
})

// AGENDAMENTOS
export const appointments = pgTable('appointments', {
  id:           uuid('id').defaultRandom().primaryKey(),
  patientId:    uuid('patient_id').references(() => patients.id),
  leadId:       uuid('lead_id').references(() => leads.id),
  doctorId:     uuid('doctor_id').references(() => users.id),
  type:         appointmentTypeEnum('type').notNull().default('consultation'),
  status:       appointmentStatusEnum('status').notNull().default('scheduled'),
  startAt:      timestamp('start_at').notNull(),
  endAt:        timestamp('end_at').notNull(),
  title:        varchar('title', { length: 255 }),
  notes:        text('notes'),
  room:         varchar('room', { length: 50 }),
  confirmedAt:  timestamp('confirmed_at'),
  reminderSent: boolean('reminder_sent').notNull().default(false),
  createdByid:  uuid('created_by_id').references(() => users.id),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
})

// REGISTROS CLÍNICOS (prontuário simplificado)
export const clinicalRecords = pgTable('clinical_records', {
  id:           uuid('id').defaultRandom().primaryKey(),
  patientId:    uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  appointmentId:uuid('appointment_id').references(() => appointments.id),
  doctorId:     uuid('doctor_id').references(() => users.id),
  type:         varchar('type', { length: 50 }).notNull(), // consultation, exam, evolution
  content:      text('content').notNull(),
  attachments:  jsonb('attachments'), // URLs de arquivos
  createdAt:    timestamp('created_at').defaultNow().notNull(),
})

// TRANSAÇÕES FINANCEIRAS
export const transactions = pgTable('transactions', {
  id:           uuid('id').defaultRandom().primaryKey(),
  type:         transactionTypeEnum('type').notNull(),
  category:     transactionCategoryEnum('category').notNull(),
  description:  varchar('description', { length: 255 }).notNull(),
  amount:       decimal('amount', { precision: 10, scale: 2 }).notNull(),
  date:         date('date').notNull(),
  dueDate:      date('due_date'),
  paidAt:       timestamp('paid_at'),
  isPaid:       boolean('is_paid').notNull().default(false),
  patientId:    uuid('patient_id').references(() => patients.id),
  appointmentId:uuid('appointment_id').references(() => appointments.id),
  notes:        text('notes'),
  receipt:      text('receipt'), // URL comprovante
  createdById:  uuid('created_by_id').references(() => users.id),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
})

// MATERIAIS / ESTOQUE
export const materials = pgTable('materials', {
  id:              uuid('id').defaultRandom().primaryKey(),
  name:            varchar('name', { length: 255 }).notNull(),
  category:        varchar('category', { length: 100 }).notNull(), // procedure, consumable, epi, cleaning
  unit:            varchar('unit', { length: 30 }).notNull(), // unid, caixa, frasco
  currentStock:    integer('current_stock').notNull().default(0),
  minimumStock:    integer('minimum_stock').notNull().default(5),
  unitCost:        decimal('unit_cost', { precision: 10, scale: 2 }),
  supplier:        varchar('supplier', { length: 255 }),
  supplierContact: varchar('supplier_contact', { length: 100 }),
  batchNumber:     varchar('batch_number', { length: 100 }),
  expiresAt:       date('expires_at'),
  status:          stockStatusEnum('status').notNull().default('ok'),
  notes:           text('notes'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
  updatedAt:       timestamp('updated_at').defaultNow().notNull(),
})

// MOVIMENTAÇÕES DE ESTOQUE
export const stockMovements = pgTable('stock_movements', {
  id:          uuid('id').defaultRandom().primaryKey(),
  materialId:  uuid('material_id').notNull().references(() => materials.id, { onDelete: 'cascade' }),
  type:        varchar('type', { length: 20 }).notNull(), // in, out
  quantity:    integer('quantity').notNull(),
  reason:      varchar('reason', { length: 255 }),
  userId:      uuid('user_id').references(() => users.id),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
})

// METAS / KPIs MENSAIS
export const monthlyGoals = pgTable('monthly_goals', {
  id:              uuid('id').defaultRandom().primaryKey(),
  month:           integer('month').notNull(),         // 1-12
  year:            integer('year').notNull(),
  revenueGoal:     decimal('revenue_goal', { precision: 10, scale: 2 }),
  leadsGoal:       integer('leads_goal'),
  consultationsGoal: integer('consultations_goal'),
  proceduresGoal:  integer('procedures_goal'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
})

// ── RELATIONS ─────────────────────────────────────────────

export const leadsRelations = relations(leads, ({ one, many }) => ({
  assignedTo:    one(users, { fields: [leads.assignedToId], references: [users.id] }),
  patient:       one(patients, { fields: [leads.patientId], references: [patients.id] }),
  interactions:  many(leadInteractions),
  appointments:  many(appointments),
}))

export const patientsRelations = relations(patients, ({ many }) => ({
  appointments:    many(appointments),
  clinicalRecords: many(clinicalRecords),
  transactions:    many(transactions),
}))

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  patient: one(patients, { fields: [appointments.patientId], references: [patients.id] }),
  lead:    one(leads, { fields: [appointments.leadId], references: [leads.id] }),
  doctor:  one(users, { fields: [appointments.doctorId], references: [users.id] }),
}))
```

---

## PASSO 4 — CONEXÃO COM NEON DB

Crie `src/lib/db/index.ts`:

```typescript
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
export type DB = typeof db
```

Crie `drizzle.config.ts` na raiz:

```typescript
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config
```

Execute as migrations:

```bash
npx drizzle-kit generate:pg
npx drizzle-kit push:pg
```

---

## PASSO 5 — AUTENTICAÇÃO COM NEXTAUTH v5

Crie `src/lib/auth/config.ts`:

```typescript
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data

        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        })

        if (!user || !user.isActive) return null

        const passwordMatch = await bcrypt.compare(password, user.passwordHash)
        if (!passwordMatch) return null

        // Atualiza lastLoginAt
        await db.update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id))

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
})
```

---

## PASSO 6 — RBAC (CONTROLE DE ACESSO)

Crie `src/lib/permissions.ts`:

```typescript
export type UserRole = 'admin' | 'receptionist' | 'financial' | 'doctor'

export type Permission =
  // Dashboard
  | 'dashboard:view'
  // Leads
  | 'leads:view' | 'leads:create' | 'leads:edit' | 'leads:delete'
  // Agenda
  | 'agenda:view' | 'agenda:create' | 'agenda:edit' | 'agenda:delete'
  // Pacientes
  | 'patients:view' | 'patients:create' | 'patients:edit'
  | 'patients:view_clinical' | 'patients:create_clinical'
  // Financeiro
  | 'financial:view' | 'financial:create' | 'financial:edit' | 'financial:delete'
  // Materiais
  | 'materials:view' | 'materials:create' | 'materials:edit'
  // Relatórios
  | 'reports:view' | 'reports:export'
  // Tráfego
  | 'traffic:view'
  // Admin
  | 'users:view' | 'users:create' | 'users:edit' | 'users:delete'
  | 'settings:view' | 'settings:edit'

const rolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    'dashboard:view',
    'leads:view', 'leads:create', 'leads:edit', 'leads:delete',
    'agenda:view', 'agenda:create', 'agenda:edit', 'agenda:delete',
    'patients:view', 'patients:create', 'patients:edit',
    'patients:view_clinical', 'patients:create_clinical',
    'financial:view', 'financial:create', 'financial:edit', 'financial:delete',
    'materials:view', 'materials:create', 'materials:edit',
    'reports:view', 'reports:export',
    'traffic:view',
    'users:view', 'users:create', 'users:edit', 'users:delete',
    'settings:view', 'settings:edit',
  ],
  receptionist: [
    'dashboard:view',
    'leads:view', 'leads:create', 'leads:edit',
    'agenda:view', 'agenda:create', 'agenda:edit',
    'patients:view', 'patients:create', 'patients:edit',
    'materials:view',
    'reports:view',
  ],
  financial: [
    'dashboard:view',
    'financial:view', 'financial:create', 'financial:edit',
    'reports:view', 'reports:export',
    'patients:view',
    'traffic:view',
  ],
  doctor: [
    'dashboard:view',
    'agenda:view',
    'patients:view', 'patients:view_clinical', 'patients:create_clinical',
  ],
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false
}

export function checkPermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Acesso negado: permissão '${permission}' requerida.`)
  }
}
```

---

## PASSO 7 — MIDDLEWARE DE AUTENTICAÇÃO

Crie `middleware.ts` na raiz:

```typescript
import { auth } from '@/lib/auth/config'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  const isAuthPage = pathname.startsWith('/login')
  const isApiAuth = pathname.startsWith('/api/auth')
  const isPublic = isAuthPage || isApiAuth

  if (!isLoggedIn && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

---

## PASSO 8 — DESIGN SYSTEM (PALETA E TEMA)

Edite `src/app/globals.css` para aplicar as cores da Regem Orto:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 220 20% 97%;
    --foreground: 220 15% 10%;
    --card: 0 0% 100%;
    --card-foreground: 220 15% 10%;
    --primary: 183 83% 24%;       /* Teal #0B6E72 */
    --primary-foreground: 0 0% 100%;
    --secondary: 40 54% 54%;      /* Gold #C9A84C */
    --secondary-foreground: 220 15% 10%;
    --muted: 220 15% 94%;
    --muted-foreground: 220 10% 50%;
    --accent: 183 83% 24%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 72% 58%;
    --border: 220 15% 88%;
    --input: 220 15% 92%;
    --ring: 183 83% 24%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 220 25% 7%;
    --foreground: 210 20% 90%;
    --card: 220 22% 11%;
    --card-foreground: 210 20% 90%;
    --primary: 183 50% 45%;
    --primary-foreground: 0 0% 100%;
    --muted: 220 20% 16%;
    --muted-foreground: 220 10% 55%;
    --border: 220 18% 18%;
    --input: 220 18% 18%;
  }
}
```

Configure `tailwind.config.ts` para adicionar cores customizadas:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#0B6E72',
          light: '#14A3A8',
          dark: '#084F52',
        },
        gold: {
          DEFAULT: '#C9A84C',
          light: '#E8C96A',
          dark: '#8A6E2A',
        },
        clinic: {
          bg: '#F4F0E8',
          dark: '#0A0E14',
        }
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
```

---

## PASSO 9 — LAYOUT PRINCIPAL (SIDEBAR)

Crie `src/components/layout/Sidebar.tsx` com:

- Logo Regem Orto (ícone RO + texto)
- Grupos de navegação com ícones Lucide:
  - **PRINCIPAL:** Dashboard, CRM de Leads, Agenda
  - **CLÍNICA:** Pacientes, Materiais, Financeiro
  - **MARKETING:** Tráfego Pago, Relatórios
  - **CONFIG:** Usuários (admin only), Configurações
- Badges de alerta nos itens (ex: "8" leads novos, "2" materiais críticos)
- Item ativo com fundo teal sutil + borda esquerda teal
- Footer com avatar do usuário + nome + role + botão logout
- Responsivo: em mobile colapsa para drawer (Sheet do shadcn)
- Mostrar/ocultar itens baseado na role do usuário (RBAC no frontend)

```typescript
// Lógica de visibilidade por role:
// admin → vê tudo
// receptionist → oculta Financeiro, Tráfego Pago, Usuários
// financial → oculta Leads, Materiais, Usuários
// doctor → vê só Dashboard, Agenda, Pacientes
```

---

## PASSO 10 — PÁGINA DE LOGIN

Crie `src/app/(auth)/login/page.tsx`:

- Design dark com teal gradient no header
- Monograma "RO" + "Regem Orto" + "Sistema de Gestão"
- Formulário: Email + Senha + botão "Entrar"
- Validação com Zod + React Hook Form
- Loading state no botão durante autenticação
- Mensagem de erro clara se login falhar
- Link "Esqueci a senha" (pode ser placeholder por ora)

---

## PASSO 11 — MÓDULO 1: DASHBOARD

`src/app/(dashboard)/dashboard/page.tsx`

Buscar dados na rota API `/api/dashboard` que retorna:

```typescript
interface DashboardData {
  kpis: {
    leadsThisMonth: number
    leadsGrowth: number       // % vs mês anterior
    revenue: number
    revenueGoal: number
    revenueGrowth: number
    consultations: number
    occupancyRate: number     // % da agenda ocupada
    avgCpl: number
    cplChange: number
  }
  recentLeads: Lead[]         // últimos 6
  todayAppointments: Appointment[]
  trafficSummary: {
    google: { leads: number; spend: number; cpl: number }
    meta: { leads: number; spend: number; cpl: number }
    organic: { leads: number }
  }
  financialSummary: {
    income: number
    expenses: number
    netResult: number
    entries: Transaction[]  // últimos 5
  }
  stockAlerts: Material[]     // apenas críticos e baixos
  conversionFunnel: {
    new: number
    contacted: number
    scheduled: number
    attended: number
    active: number
  }
}
```

**Componentes do Dashboard:**

1. `KpiCard` — card com número grande, label, delta (↑↓), cor de borda top
2. `FunnelChart` — 5 colunas com número + label + % de conversão
3. `RecentLeads` — lista com avatar, nome, origem badge, status badge, tempo
4. `AgendaHoje` — lista temporal de agendamentos do dia
5. `FinanceiroCard` — DRE simplificado com barra de progresso vs meta
6. `EstoqueCard` — itens críticos com mini progress bars coloridas
7. `AlertBanner` — alertas de ação necessária no topo

---

## PASSO 12 — MÓDULO 2: CRM DE LEADS

`src/app/(dashboard)/leads/page.tsx`

**Kanban Board com 5 colunas:**

```
Novo (azul) | Em Contato (âmbar) | Agendado (roxo) | Compareceu (teal) | Paciente Ativo (verde) | Perdido (cinza)
```

Implementar com `@dnd-kit`:
- Cards arrastáveis entre colunas
- Ao mover, chama `PATCH /api/leads/[id]` com o novo status
- Otimistic update (atualiza UI antes da resposta)

**Card do Lead contém:**
- Avatar com iniciais coloridas (cor baseada no status)
- Nome completo
- Especialidade/queixa (texto pequeno)
- Badge de origem (Google Ads, Meta, etc.)
- Tempo desde entrada (ex: "há 2h", "ontem")
- Ícones de ação: WhatsApp, Agendar, Editar

**Drawer de Detalhes do Lead (ao clicar no card):**
- Header: nome + status selector dropdown
- Infos: telefone (clicável → WhatsApp), email, origem, especialidade
- Aba "Timeline": lista cronológica de interações
- Aba "Agendamentos": agendamentos vinculados
- Input de nova nota + botão "Adicionar nota"
- Botão "Converter em Paciente" (muda status para active_patient)
- Botão "Agendar Consulta" (abre dialog da agenda)

**Filtros no topo:**
- Search por nome/telefone
- Filtro por status, origem, período
- Contador total por coluna

**Botão "+ Novo Lead" (Dialog):**
- Campos: Nome, Telefone, Email, Origem, Especialidade, Queixa
- Validação Zod
- Após criar, aparece na coluna "Novo"

---

## PASSO 13 — MÓDULO 3: AGENDA

`src/app/(dashboard)/agenda/page.tsx`

**Toggle de visualização:** Dia | Semana | Mês

**Visualização Semanal (padrão):**
- Coluna de horários (07:00–20:00) à esquerda
- 5 colunas de dias (Seg–Sex)
- Eventos como blocos coloridos:
  - Teal sólido: consulta
  - Gold: procedimento (PRP, BMAC, etc.)
  - Vermelho translúcido: bloqueio
  - Roxo: cirurgia
- Clique no evento abre modal de detalhes
- Clique em célula vazia abre dialog de novo agendamento

**Modal de Detalhes do Evento:**
- Nome do paciente/lead
- Tipo + horário
- Status buttons: Confirmar | Faltou | Remarcar | Cancelar
- Botão "Enviar lembrete WhatsApp"
- Link "Ver ficha do paciente"

**Dialog de Novo Agendamento:**
- Busca de paciente ou lead (autocomplete)
- Tipo de procedimento
- Data + hora início + hora fim
- Médico responsável
- Sala/local
- Notas

**Mini-painel lateral (desktop):**
- Resumo do dia: total consultas, procedimentos, confirmados, pendentes
- Próxima consulta em destaque

---

## PASSO 14 — MÓDULO 4: PACIENTES

`src/app/(dashboard)/pacientes/page.tsx`

**Tabela com TanStack Table:**
Colunas: Nome | Idade | Último atendimento | Próximo retorno | Especialidade | Status | Ações

Funcionalidades:
- Busca global (nome, CPF, telefone)
- Filtros: status (ativo/inativo), especialidade
- Paginação server-side
- Ordenação por coluna
- Exportar CSV (role: admin/financial)

**Página de Detalhe do Paciente** `/pacientes/[id]`:

```
Header: foto/avatar + nome + idade + telefone + email + badges (convênio, especialidade)

Tabs:
  Resumo     → dados cadastrais + próximo retorno + NPS
  Histórico  → timeline de consultas e procedimentos
  Prontuário → registros clínicos (só admin e doctor)
  Financeiro → transações vinculadas (só admin e financial)
  Documentos → exames, laudos (upload de arquivos)
```

---

## PASSO 15 — MÓDULO 5: FINANCEIRO

`src/app/(dashboard)/financeiro/page.tsx`

**KPIs no topo:**
- Receita bruta do mês
- Despesas totais
- Resultado líquido (destaque verde/vermelho)
- Inadimplência

**Layout 2 colunas:**

Esquerda — Lançamentos:
- Tabela de transações com: data, descrição, categoria, tipo (entrada/saída), valor, status pago
- Cores: verde para receita, vermelho para despesa
- Filtros: tipo, categoria, período, status
- Botão "+ Lançamento"

Direita — DRE Simplificado:
- Accordion por categoria
  - RECEITAS: Consultas + Procedimentos = Total Receita
  - DESPESAS FIXAS: Aluguel + Funcionários + ... = Total Fixo
  - DESPESAS VARIÁVEIS: Marketing + Materiais + ... = Total Variável
  - **RESULTADO LÍQUIDO** (grande, colorido)

**Gráfico inferior:** Linha de fluxo de caixa 30 dias

**Dialog de Novo Lançamento:**
- Tipo (Receita/Despesa)
- Categoria (dropdown contextual)
- Descrição, Valor, Data
- Vincular paciente (opcional)
- Marcar como pago / a pagar

---

## PASSO 16 — MÓDULO 6: MATERIAIS

`src/app/(dashboard)/materiais/page.tsx`

**Banner de alerta** se houver itens críticos.

**KPIs:** Total itens | Críticos | Estoque baixo | Próx. vencimento

**Tabela de Estoque:**
Colunas: Item | Categoria | Estoque atual | Mínimo | Status (badge) | Validade | Fornecedor | Ações

Status visual:
- `ok` → badge verde
- `low` → badge âmbar ⚡
- `critical` → badge vermelho ⚠ pulsante
- `out_of_stock` → badge cinza

**Ações por item:**
- Registrar entrada (dialog com quantidade + motivo)
- Registrar saída
- Editar cadastro
- Solicitar compra (pré-preenche email/WhatsApp para fornecedor)

**Dialog "Solicitar Compra":**
- Item pré-preenchido
- Quantidade sugerida (para chegar ao mínimo × 2)
- Urgência (Normal / Urgente)
- Observações
- Gerar mensagem WhatsApp para fornecedor

**Auto-atualização do status:**
Trigger automático: quando `currentStock <= minimumStock`, status vira `critical`.
Quando `currentStock <= minimumStock * 1.5`, status vira `low`.

---

## PASSO 17 — MÓDULO 7: TRÁFEGO PAGO

`src/app/(dashboard)/trafego/page.tsx`

Painel de monitoramento (dados inseridos manualmente, sem integração de API por ora):

**KPIs:** Total leads | Budget utilizado | CPL médio | ROI estimado

**Painel Google Ads:**
- Status da conta (badge)
- Budget mensal + valor gasto (barra progresso)
- Tabela de campanhas: nome, status, budget, impressões, cliques, leads, CPL

**Painel Meta Ads:**
- Mesma estrutura do Google

**Gráfico:** Barras de leads por canal nos últimos 30 dias

**Formulário de atualização semanal:**
- Inserir métricas da semana por campanha
- Salva histórico no banco

---

## PASSO 18 — MÓDULO 8: RELATÓRIOS

`src/app/(dashboard)/relatorios/page.tsx`

**Tabs:** Geral | Leads | Financeiro | Agenda | Satisfação

**Aba Geral:**
- Seletor de período (mês/trimestre/ano)
- Grid 2×2 de gráficos Recharts:
  - Leads por mês (barras, 6 meses)
  - Faturamento por mês (linha, 6 meses)
  - Origem dos leads (pizza/donut)
  - Taxa de ocupação da agenda (gauge)
- Cards de insights gerados automaticamente
- Botão "Exportar PDF" (usa `window.print()` com CSS de impressão)

---

## PASSO 19 — GESTÃO DE USUÁRIOS (admin only)

`src/app/(dashboard)/configuracoes/usuarios/page.tsx`

- Tabela de usuários: nome, email, role badge, status, último acesso
- Criar usuário (dialog): nome, email, role, senha temporária
- Editar role e status
- Desativar usuário (soft delete — `isActive = false`)
- Hash de senha com `bcryptjs` (salt rounds: 12)

---

## PASSO 20 — APIs (ROUTE HANDLERS)

Para cada módulo, implemente seguindo este padrão:

```typescript
// src/app/api/leads/route.ts
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  // 1. Verificar sessão
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // 2. Verificar permissão
  if (!hasPermission(session.user.role as any, 'leads:view')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  // 3. Buscar dados com filtros da query string
  const { searchParams } = new URL(req.url)
  // ... lógica de filtro e paginação

  // 4. Retornar
  return NextResponse.json({ data, total, page })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as any, 'leads:create')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  // Validar com Zod
  // Inserir no banco
  // Retornar
}
```

**Implemente estas rotas:**
- `GET/POST /api/leads`
- `GET/PATCH/DELETE /api/leads/[id]`
- `POST /api/leads/[id]/interactions`
- `GET/POST /api/agenda`
- `GET/PATCH/DELETE /api/agenda/[id]`
- `GET/POST /api/pacientes`
- `GET/PATCH /api/pacientes/[id]`
- `POST /api/pacientes/[id]/records`
- `GET/POST /api/financeiro`
- `GET/PATCH/DELETE /api/financeiro/[id]`
- `GET/POST /api/materiais`
- `PATCH /api/materiais/[id]`
- `POST /api/materiais/[id]/movement`
- `GET /api/dashboard`
- `GET /api/relatorios`
- `GET/POST/PATCH /api/usuarios` (admin only)

---

## PASSO 21 — SEED DO BANCO (DADOS INICIAIS)

Crie `src/lib/db/seed.ts`:

```typescript
// Criar usuário admin inicial
// Email: admin@regemorto.com.br
// Senha: Regem@2025 (hashear com bcrypt)
// Role: admin

// Criar usuário recepcionista de teste
// Email: recepcao@regemorto.com.br
// Senha: Recepcao@2025
// Role: receptionist

// Criar 5-10 leads de exemplo com dados brasileiros
// Criar 3-5 pacientes de exemplo
// Criar agendamentos da semana atual
// Criar alguns lançamentos financeiros do mês
// Criar materiais do estoque (Kit PRP, BMAC, etc.)
```

Execute: `npx tsx src/lib/db/seed.ts`

---

## PASSO 22 — QUALIDADE E SEGURANÇA

**Obrigatório implementar:**

1. **Rate limiting** nas rotas de login (max 5 tentativas em 15 min)
2. **Validação dupla** — Zod no frontend E no backend (nunca confiar só no frontend)
3. **SQL injection** — impossível com Drizzle (queries parametrizadas), mas nunca usar `sql` template com input do usuário sem sanitização
4. **CORS** — configurar em `next.config.js` para aceitar só origens permitidas
5. **Headers de segurança** — usar `next-safe-action` ou middleware customizado
6. **Logs de auditoria** — toda ação importante (criar paciente, lançamento financeiro, deletar) deve logar userId + timestamp
7. **Variáveis de ambiente** — NUNCA commitar `.env.local`, usar `.env.example` com valores vazios

---

## PASSO 23 — DEPLOY E CONFIGURAÇÃO FINAL

**Vercel (recomendado para Next.js):**

```bash
npm install -g vercel
vercel login
vercel --prod
```

Configurar variáveis de ambiente na Vercel:
- `DATABASE_URL` → connection string do Neon
- `NEXTAUTH_SECRET` → secret aleatório (use `openssl rand -base64 32`)
- `NEXTAUTH_URL` → URL de produção

**`next.config.js`:**
```javascript
const nextConfig = {
  experimental: { serverActions: { allowedOrigins: ['regemorto.com.br'] } },
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
}
module.exports = nextConfig
```

---

## PASSO 24 — ORDEM DE EXECUÇÃO RECOMENDADA

Execute nesta ordem exata. Não pule etapas.

```
1.  Inicializar projeto e instalar dependências (Passo 1)
2.  Criar estrutura de pastas (Passo 2)
3.  Schema do banco + conexão Neon (Passos 3 e 4)
4.  Rodar migrations: npx drizzle-kit push:pg
5.  Autenticação NextAuth (Passo 5)
6.  RBAC/Permissions (Passo 6)
7.  Middleware (Passo 7)
8.  Design system + globals.css (Passo 8)
9.  Sidebar + Topbar + Layout (Passo 9)
10. Página de Login (Passo 10)
11. Seed do banco (Passo 21) ← antes de testar
12. Testar login com admin@regemorto.com.br
13. Dashboard (Passo 11) + API /dashboard (Passo 20)
14. Módulo Leads/CRM (Passo 12) + API /leads
15. Módulo Agenda (Passo 13) + API /agenda
16. Módulo Pacientes (Passo 14) + API /pacientes
17. Módulo Financeiro (Passo 15) + API /financeiro
18. Módulo Materiais (Passo 16) + API /materiais
19. Módulo Tráfego (Passo 17)
20. Módulo Relatórios (Passo 18)
21. Gestão de usuários admin (Passo 19)
22. Segurança e validações (Passo 22)
23. Deploy Vercel (Passo 23)
```

---

## RESTRIÇÕES E REGRAS ABSOLUTAS

1. **TypeScript strict** — zero `any` implícito. Se precisar de any, tipifique corretamente.
2. **Server Components por padrão** — use `'use client'` só quando necessário (eventos, estado local, hooks).
3. **Nunca expor passwordHash** na API — excluir SEMPRE do retorno.
4. **Verificar permissão em TODA rota de API** — nenhuma exceção.
5. **Zod em todo input externo** — formulários, params, query strings, body da API.
6. **Loading e error states** em todo fetch — usar Suspense + Error Boundary.
7. **Responsivo** — funcionar em tablet (mínimo 768px). Mobile é secundário mas não quebrar.
8. **Acessibilidade** — labels nos inputs, aria-labels nos botões de ícone.
9. **Português** — toda interface, mensagens de erro e notificações em pt-BR.
10. **Formato de moeda** — sempre `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
11. **Formato de data** — sempre `dd/MM/yyyy` com `date-fns` e locale `ptBR`.

---

## CREDENCIAIS DE TESTE (após seed)

| Perfil         | Email                      | Senha        | Acesso                    |
|----------------|----------------------------|--------------|---------------------------|
| Admin          | admin@regemorto.com.br     | Regem@2025   | Tudo                      |
| Recepcionista  | recepcao@regemorto.com.br  | Recepcao@2025| Leads + Agenda + Pacientes|

---

## COMECE AGORA

Inicie pelo **Passo 1** e execute cada passo em sequência.
Após cada passo, verifique se está funcionando antes de avançar.
Se encontrar um erro, resolva-o completamente antes de prosseguir.

O objetivo final: um sistema de gestão clínica completo,
bonito, seguro e pronto para produção da Regem Orto.
