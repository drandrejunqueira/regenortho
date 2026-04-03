import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  numeric,
  date,
  pgEnum,
  jsonb,
  uuid,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ── ENUMS ──────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'receptionist',
  'financial',
  'doctor',
])

export const leadStatusEnum = pgEnum('lead_status', [
  'new',
  'contacted',
  'scheduled',
  'attended',
  'active_patient',
  'lost',
])

export const leadSourceEnum = pgEnum('lead_source', [
  'google_ads',
  'meta_ads',
  'instagram_organic',
  'facebook_organic',
  'google_organic',
  'referral',
  'whatsapp',
  'other',
])

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'scheduled',
  'confirmed',
  'attended',
  'no_show',
  'rescheduled',
  'cancelled',
])

export const appointmentTypeEnum = pgEnum('appointment_type', [
  'consultation',
  'prp',
  'bmac',
  'hyaluronic',
  'prolotherapy',
  'surgery',
  'return',
  'block',
])

export const transactionTypeEnum = pgEnum('transaction_type', [
  'income',
  'expense',
])

export const transactionCategoryEnum = pgEnum('transaction_category', [
  'consultation_fee',
  'prp_procedure',
  'bmac_procedure',
  'hyaluronic_procedure',
  'surgery_fee',
  'other_income',
  'rent',
  'staff',
  'marketing',
  'materials',
  'equipment',
  'utilities',
  'insurance',
  'accounting',
  'other_expense',
])

export const stockStatusEnum = pgEnum('stock_status', [
  'ok',
  'low',
  'critical',
  'out_of_stock',
])

export const genderEnum = pgEnum('gender', ['male', 'female', 'other'])

// ── TABELAS ────────────────────────────────────────────────

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
  insurance:    varchar('insurance', { length: 100 }),
  insuranceNum: varchar('insurance_number', { length: 50 }),
  notes:        text('notes'),
  isActive:     boolean('is_active').notNull().default(true),
  nps:          integer('nps'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
})

export const leads = pgTable('leads', {
  id:           uuid('id').defaultRandom().primaryKey(),
  name:         varchar('name', { length: 255 }).notNull(),
  phone:        varchar('phone', { length: 30 }).notNull(),
  email:        varchar('email', { length: 255 }),
  status:       leadStatusEnum('status').notNull().default('new'),
  source:       leadSourceEnum('source').notNull().default('other'),
  specialty:    varchar('specialty', { length: 100 }),
  complaint:    text('complaint'),
  notes:        text('notes'),
  assignedToId: uuid('assigned_to_id').references(() => users.id),
  convertedAt:  timestamp('converted_at'),
  patientId:    uuid('patient_id').references(() => patients.id),
  lostReason:   text('lost_reason'),
  utmSource:    varchar('utm_source', { length: 100 }),
  utmCampaign:  varchar('utm_campaign', { length: 100 }),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
})

export const leadInteractions = pgTable('lead_interactions', {
  id:        uuid('id').defaultRandom().primaryKey(),
  leadId:    uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').references(() => users.id),
  type:      varchar('type', { length: 50 }).notNull(),
  content:   text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

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
  createdById:  uuid('created_by_id').references(() => users.id),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
})

export const clinicalRecords = pgTable('clinical_records', {
  id:            uuid('id').defaultRandom().primaryKey(),
  patientId:     uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  appointmentId: uuid('appointment_id').references(() => appointments.id),
  doctorId:      uuid('doctor_id').references(() => users.id),
  type:          varchar('type', { length: 50 }).notNull(),
  content:       text('content').notNull(),
  attachments:   jsonb('attachments'),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
})

export const transactions = pgTable('transactions', {
  id:            uuid('id').defaultRandom().primaryKey(),
  type:          transactionTypeEnum('type').notNull(),
  category:      transactionCategoryEnum('category').notNull(),
  description:   varchar('description', { length: 255 }).notNull(),
  amount:        numeric('amount', { precision: 10, scale: 2 }).notNull(),
  date:          date('date').notNull(),
  dueDate:       date('due_date'),
  paidAt:        timestamp('paid_at'),
  isPaid:        boolean('is_paid').notNull().default(false),
  patientId:     uuid('patient_id').references(() => patients.id),
  appointmentId: uuid('appointment_id').references(() => appointments.id),
  notes:         text('notes'),
  receipt:       text('receipt'),
  createdById:   uuid('created_by_id').references(() => users.id),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
  updatedAt:     timestamp('updated_at').defaultNow().notNull(),
})

export const materials = pgTable('materials', {
  id:              uuid('id').defaultRandom().primaryKey(),
  name:            varchar('name', { length: 255 }).notNull(),
  category:        varchar('category', { length: 100 }).notNull(),
  unit:            varchar('unit', { length: 30 }).notNull(),
  currentStock:    integer('current_stock').notNull().default(0),
  minimumStock:    integer('minimum_stock').notNull().default(5),
  unitCost:        numeric('unit_cost', { precision: 10, scale: 2 }),
  supplier:        varchar('supplier', { length: 255 }),
  supplierContact: varchar('supplier_contact', { length: 100 }),
  batchNumber:     varchar('batch_number', { length: 100 }),
  expiresAt:       date('expires_at'),
  status:          stockStatusEnum('status').notNull().default('ok'),
  notes:           text('notes'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
  updatedAt:       timestamp('updated_at').defaultNow().notNull(),
})

export const stockMovements = pgTable('stock_movements', {
  id:         uuid('id').defaultRandom().primaryKey(),
  materialId: uuid('material_id').notNull().references(() => materials.id, { onDelete: 'cascade' }),
  type:       varchar('type', { length: 20 }).notNull(),
  quantity:   integer('quantity').notNull(),
  reason:     varchar('reason', { length: 255 }),
  userId:     uuid('user_id').references(() => users.id),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
})

export const monthlyGoals = pgTable('monthly_goals', {
  id:                  uuid('id').defaultRandom().primaryKey(),
  month:               integer('month').notNull(),
  year:                integer('year').notNull(),
  revenueGoal:         numeric('revenue_goal', { precision: 10, scale: 2 }),
  leadsGoal:           integer('leads_goal'),
  consultationsGoal:   integer('consultations_goal'),
  proceduresGoal:      integer('procedures_goal'),
  createdAt:           timestamp('created_at').defaultNow().notNull(),
})

// ── RELATIONS ─────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  assignedLeads:   many(leads),
  appointments:    many(appointments),
  interactions:    many(leadInteractions),
}))

export const leadsRelations = relations(leads, ({ one, many }) => ({
  assignedTo:   one(users, { fields: [leads.assignedToId], references: [users.id] }),
  patient:      one(patients, { fields: [leads.patientId], references: [patients.id] }),
  interactions: many(leadInteractions),
  appointments: many(appointments),
}))

export const patientsRelations = relations(patients, ({ many }) => ({
  leads:           many(leads),
  appointments:    many(appointments),
  clinicalRecords: many(clinicalRecords),
  transactions:    many(transactions),
}))

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  patient: one(patients, { fields: [appointments.patientId], references: [patients.id] }),
  lead:    one(leads, { fields: [appointments.leadId], references: [leads.id] }),
  doctor:  one(users, { fields: [appointments.doctorId], references: [users.id] }),
}))

export const leadInteractionsRelations = relations(leadInteractions, ({ one }) => ({
  lead: one(leads, { fields: [leadInteractions.leadId], references: [leads.id] }),
  user: one(users, { fields: [leadInteractions.userId], references: [users.id] }),
}))

export const clinicalRecordsRelations = relations(clinicalRecords, ({ one }) => ({
  patient:     one(patients, { fields: [clinicalRecords.patientId], references: [patients.id] }),
  appointment: one(appointments, { fields: [clinicalRecords.appointmentId], references: [appointments.id] }),
  doctor:      one(users, { fields: [clinicalRecords.doctorId], references: [users.id] }),
}))

export const transactionsRelations = relations(transactions, ({ one }) => ({
  patient:     one(patients, { fields: [transactions.patientId], references: [patients.id] }),
  appointment: one(appointments, { fields: [transactions.appointmentId], references: [appointments.id] }),
  createdBy:   one(users, { fields: [transactions.createdById], references: [users.id] }),
}))

export const materialsRelations = relations(materials, ({ many }) => ({
  movements: many(stockMovements),
}))

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  material: one(materials, { fields: [stockMovements.materialId], references: [materials.id] }),
  user:     one(users, { fields: [stockMovements.userId], references: [users.id] }),
}))
