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
  index,
  type AnyPgColumn,
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

export const purchaseOrderStatusEnum = pgEnum('purchase_order_status', [
  'draft',
  'ordered',
  'received',
  'cancelled',
])

export const genderEnum = pgEnum('gender', ['male', 'female', 'other'])

export const treatmentStatusEnum = pgEnum('treatment_status', [
  'draft',
  'approved',
  'in_progress',
  'completed',
  'cancelled',
])

export const treatmentItemTypeEnum = pgEnum('treatment_item_type', [
  'procedure',
  'material',
  'fee',
])

export const examUrgencyEnum = pgEnum('exam_urgency', [
  'routine',
  'urgent',
  'emergency',
])

export const examStatusEnum = pgEnum('exam_status', [
  'issued',
  'scheduled',
  'collected',
  'result_available',
  'archived',
])

export const paymentMethodTypeEnum = pgEnum('payment_method_type', [
  'cash',
  'credit_card',
  'debit_card',
  'pix',
  'bank_transfer',
  'insurance',
  'check',
])

export const bankAccountTypeEnum = pgEnum('bank_account_type', [
  'checking',
  'savings',
  'pix_key',
])

export const whatsappMessageTypeEnum = pgEnum('whatsapp_message_type', [
  'lead_notification',
  'appointment_reminder',
  'appointment_confirmation',
  'treatment_summary',
  'exam_ready',
  'payment_reminder',
  'weekly_report',
  'monthly_report',
])

// ── TABELAS ────────────────────────────────────────────────

export const users = pgTable('users', {
  id:           uuid('id').defaultRandom().primaryKey(),
  name:         varchar('name', { length: 255 }).notNull(),
  email:        varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role:         userRoleEnum('role').notNull().default('receptionist'),
  avatar:       text('avatar'),
  phone:        varchar('phone', { length: 20 }),
  isActive:          boolean('is_active').notNull().default(true),
  customPermissions: jsonb('custom_permissions').$type<string[] | null>().default(null),
  googleCalendarId:  text('google_calendar_id'),
  googleCalendarRefreshToken: text('google_calendar_refresh_token'),
  googleCalendarEmail:        text('google_calendar_email'),
  googleCalendarConnectedAt:  timestamp('google_calendar_connected_at'),
  lastLoginAt:       timestamp('last_login_at'),
  createdAt:         timestamp('created_at').defaultNow().notNull(),
  updatedAt:         timestamp('updated_at').defaultNow().notNull(),
})

export const clinicSettings = pgTable('clinic_settings', {
  id:                 integer('id').primaryKey().default(1),
  // Identidade
  name:               varchar('name', { length: 255 }).notNull().default('Regem Orto'),
  cnpj:               varchar('cnpj', { length: 20 }),
  crm:                varchar('crm', { length: 50 }),
  // Contato
  phone:              varchar('phone', { length: 30 }),
  whatsapp:           varchar('whatsapp', { length: 30 }),
  email:              varchar('email', { length: 255 }),
  website:            varchar('website', { length: 255 }),
  // Endereço
  address:            text('address'),
  city:               varchar('city', { length: 100 }),
  state:              varchar('state', { length: 2 }),
  zipCode:            varchar('zip_code', { length: 10 }),
  // Branding
  logoUrl:            text('logo_url'),
  headerImageUrl:     text('header_image_url'),
  primaryColor:       varchar('primary_color', { length: 7 }).default('#61d8dd'),
  // Documentos
  documentHeader:     text('document_header'),
  documentFooter:     text('document_footer'),
  // SEO
  seoTitle:           varchar('seo_title', { length: 70 }),
  seoDescription:     varchar('seo_description', { length: 160 }),
  seoKeywords:        text('seo_keywords'),
  ogImageUrl:         text('og_image_url'),
  gaId:               varchar('ga_id', { length: 30 }),
  gtmId:              varchar('gtm_id', { length: 30 }),
  // Integrações
  whatsappToken:      text('whatsapp_token'),
  whatsappApiUrl:     text('whatsapp_api_url'),
  smtpHost:           varchar('smtp_host', { length: 255 }),
  smtpPort:           integer('smtp_port'),
  smtpUser:           varchar('smtp_user', { length: 255 }),
  smtpPass:           text('smtp_pass'),
  googleCalendarId:   text('google_calendar_id'),
  // Backup
  backupSchedule:     varchar('backup_schedule', { length: 20 }).default('daily'),
  lastBackupAt:       timestamp('last_backup_at'),
  // Evolution API (WhatsApp)
  evolutionApiUrl:    text('evolution_api_url'),
  evolutionApiKey:    text('evolution_api_key'),
  evolutionInstance:  varchar('evolution_instance', { length: 100 }),
  notifyNewLeadNumber:        varchar('notify_new_lead_number', { length: 20 }),
  notifyWeeklyReportNumber:   varchar('notify_weekly_report_number', { length: 20 }),
  notifyMonthlyReportNumber:  varchar('notify_monthly_report_number', { length: 20 }),
  notifyReportDay:            integer('notify_report_day').default(30),
  sendAppointmentReminder:    boolean('send_appointment_reminder').notNull().default(true),
  reminderHoursBefore:        integer('reminder_hours_before').default(24),
  sendTreatmentSummary:       boolean('send_treatment_summary').notNull().default(true),
  // Alertas por e-mail
  notifyEmailNewLead:         boolean('notify_email_new_lead').notNull().default(false),
  notifyEmailNewPatient:      boolean('notify_email_new_patient').notNull().default(false),
  notifyEmailWeeklyReport:    boolean('notify_email_weekly_report').notNull().default(false),
  alertEmailRecipients:       text('alert_email_recipients'),
  // Metadados
  updatedAt:          timestamp('updated_at').defaultNow().notNull(),
})

export const activityLogs = pgTable('activity_logs', {
  id:         uuid('id').defaultRandom().primaryKey(),
  userId:     uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  userName:   varchar('user_name', { length: 255 }),
  action:     varchar('action', { length: 100 }).notNull(),
  module:     varchar('module', { length: 50 }),
  targetId:   uuid('target_id'),
  targetName: varchar('target_name', { length: 255 }),
  ip:         varchar('ip', { length: 45 }),
  details:    jsonb('details'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
})

export const webhooks = pgTable('webhooks', {
  id:          uuid('id').defaultRandom().primaryKey(),
  name:        varchar('name', { length: 100 }).notNull(),
  url:         text('url').notNull(),
  events:      jsonb('events').$type<string[]>().notNull().default([]),
  secret:      text('secret'),
  isActive:    boolean('is_active').notNull().default(true),
  lastTriggeredAt: timestamp('last_triggered_at'),
  lastStatus:  integer('last_status'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
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
  photoUrl:     text('photo_url'),
  internalNotes: text('internal_notes'),
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
  tags:         jsonb('tags').$type<string[]>().default([]),
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

export const rooms = pgTable('rooms', {
  id:           uuid('id').defaultRandom().primaryKey(),
  name:         varchar('name', { length: 100 }).notNull(),
  color:        varchar('color', { length: 7 }).notNull().default('#00BCE4'),
  isActive:     boolean('is_active').notNull().default(true),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
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
  roomId:       uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  googleEventId: text('google_event_id'),
  confirmedAt:  timestamp('confirmed_at'),
  reminderSent: boolean('reminder_sent').notNull().default(false),
  returnDeadline: timestamp('return_deadline'),
  returnEstimatedAt: timestamp('return_estimated_at'),
  isPaidConsultation: boolean('is_paid_consultation').notNull().default(false),
  consultationPrice: numeric('consultation_price', { precision: 10, scale: 2 }),
  paymentMethodId: uuid('payment_method_id').references(() => paymentMethods.id),
  paymentTiming: varchar('payment_timing', { length: 50 }),
  paymentStatus: varchar('payment_status', { length: 50 }),
  paymentReceiptUrl: text('payment_receipt_url'),
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
  treatmentId:   uuid('treatment_id'),
  paymentMethodId: uuid('payment_method_id').references(() => paymentMethods.id),
  bankAccountId:   uuid('bank_account_id').references(() => bankAccounts.id),
  installmentNumber: integer('installment_number'),
  installmentTotal:  integer('installment_total'),
  notes:         text('notes'),
  receipt:       text('receipt'),
  createdById:   uuid('created_by_id').references(() => users.id),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
  updatedAt:     timestamp('updated_at').defaultNow().notNull(),
})

// Categorias de materiais em 2 níveis (auto-referência via parentId).
// parentId nulo = categoria raiz; parentId preenchido = subcategoria.
export const materialCategories = pgTable('material_categories', {
  id:        uuid('id').defaultRandom().primaryKey(),
  name:      varchar('name', { length: 120 }).notNull(),
  parentId:  uuid('parent_id').references((): AnyPgColumn => materialCategories.id, { onDelete: 'cascade' }),
  isActive:  boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const materials = pgTable('materials', {
  id:              uuid('id').defaultRandom().primaryKey(),
  name:            varchar('name', { length: 255 }).notNull(),
  category:        varchar('category', { length: 100 }).notNull(),
  categoryId:      uuid('category_id').references(() => materialCategories.id, { onDelete: 'set null' }),
  subcategoryId:   uuid('subcategory_id').references(() => materialCategories.id, { onDelete: 'set null' }),
  unit:            varchar('unit', { length: 30 }).notNull(),
  currentStock:    integer('current_stock').notNull().default(0),
  minimumStock:    integer('minimum_stock').notNull().default(5),
  unitCost:        numeric('unit_cost', { precision: 10, scale: 2 }),
  laboratory:      varchar('laboratory', { length: 255 }),
  supplier:        varchar('supplier', { length: 255 }),
  supplierContact: varchar('supplier_contact', { length: 100 }),
  batchNumber:     varchar('batch_number', { length: 100 }),
  expiresAt:       date('expires_at'),
  status:          stockStatusEnum('status').notNull().default('ok'),
  isActive:        boolean('is_active').notNull().default(true),
  notes:           text('notes'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
  updatedAt:       timestamp('updated_at').defaultNow().notNull(),
})

// Lotes de um material — cada lote com número, validade e quantidade próprios.
export const materialBatches = pgTable('material_batches', {
  id:          uuid('id').defaultRandom().primaryKey(),
  materialId:  uuid('material_id').notNull().references(() => materials.id, { onDelete: 'cascade' }),
  batchNumber: varchar('batch_number', { length: 100 }),
  expiresAt:   date('expires_at'),
  quantity:    integer('quantity').notNull().default(0),
  notes:       text('notes'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
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

export const purchaseOrders = pgTable('purchase_orders', {
  id:            uuid('id').defaultRandom().primaryKey(),
  supplier:      varchar('supplier', { length: 255 }).notNull(),
  status:        purchaseOrderStatusEnum('status').notNull().default('draft'),
  orderDate:     date('order_date').notNull(),
  expectedDate:  date('expected_date'),
  receivedDate:  date('received_date'),
  totalAmount:   numeric('total_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  notes:         text('notes'),
  transactionId: uuid('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  createdById:   uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
  updatedAt:     timestamp('updated_at').defaultNow().notNull(),
})

export const purchaseOrderItems = pgTable('purchase_order_items', {
  id:              uuid('id').defaultRandom().primaryKey(),
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  materialId:      uuid('material_id').notNull().references(() => materials.id, { onDelete: 'restrict' }),
  quantity:        integer('quantity').notNull(),
  unitCost:        numeric('unit_cost', { precision: 10, scale: 2 }).notNull(),
  total:           numeric('total', { precision: 10, scale: 2 }).notNull(),
  notes:           text('notes'),
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

export const paymentMethods = pgTable('payment_methods', {
  id:              uuid('id').defaultRandom().primaryKey(),
  name:            varchar('name', { length: 100 }).notNull(),
  type:            paymentMethodTypeEnum('type').notNull(),
  feePercent:      numeric('fee_percent', { precision: 5, scale: 2 }).notNull().default('0'),
  maxInstallments: integer('max_installments').notNull().default(1),
  isActive:        boolean('is_active').notNull().default(true),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
})

export const bankAccounts = pgTable('bank_accounts', {
  id:             uuid('id').defaultRandom().primaryKey(),
  name:           varchar('name', { length: 100 }).notNull(),
  bank:           varchar('bank', { length: 100 }),
  agency:         varchar('agency', { length: 20 }),
  account:        varchar('account', { length: 30 }),
  type:           bankAccountTypeEnum('type').notNull().default('checking'),
  pixKey:         text('pix_key'),
  isDefault:      boolean('is_default').notNull().default(false),
  isActive:       boolean('is_active').notNull().default(true),
  currentBalance: numeric('current_balance', { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
})

// Catálogo de tratamentos (modelos reutilizáveis com seus materiais/custos)
export const treatmentTemplates = pgTable('treatment_templates', {
  id:          uuid('id').defaultRandom().primaryKey(),
  name:        varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category:    transactionCategoryEnum('category').notNull().default('consultation_fee'),
  defaultPrice: numeric('default_price', { precision: 10, scale: 2 }).notNull().default('0'),
  estimatedCost: numeric('estimated_cost', { precision: 10, scale: 2 }).notNull().default('0'),
  isActive:    boolean('is_active').notNull().default(true),
  notes:       text('notes'),
  createdById: uuid('created_by_id').references(() => users.id),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
})

export const treatmentTemplateItems = pgTable('treatment_template_items', {
  id:          uuid('id').defaultRandom().primaryKey(),
  templateId:  uuid('template_id').notNull().references(() => treatmentTemplates.id, { onDelete: 'cascade' }),
  type:        treatmentItemTypeEnum('type').notNull(),
  materialId:  uuid('material_id').references(() => materials.id),
  description: varchar('description', { length: 255 }).notNull(),
  quantity:    numeric('quantity', { precision: 8, scale: 3 }).notNull().default('1'),
  unitPrice:   numeric('unit_price', { precision: 10, scale: 2 }).notNull().default('0'),
  sortOrder:   integer('sort_order').notNull().default(0),
})

export const treatments = pgTable('treatments', {
  id:              uuid('id').defaultRandom().primaryKey(),
  patientId:       uuid('patient_id').notNull().references(() => patients.id),
  appointmentId:   uuid('appointment_id').references(() => appointments.id),
  doctorId:        uuid('doctor_id').references(() => users.id),
  paymentMethodId: uuid('payment_method_id').references(() => paymentMethods.id),
  templateId:      uuid('template_id').references(() => treatmentTemplates.id),
  name:            varchar('name', { length: 255 }).notNull(),
  category:        transactionCategoryEnum('category').notNull().default('consultation_fee'),
  status:          treatmentStatusEnum('status').notNull().default('draft'),
  subtotal:        numeric('subtotal', { precision: 10, scale: 2 }).notNull().default('0'),
  discount:        numeric('discount', { precision: 10, scale: 2 }).notNull().default('0'),
  totalSale:       numeric('total_sale', { precision: 10, scale: 2 }).notNull().default('0'),
  totalCost:       numeric('total_cost', { precision: 10, scale: 2 }).notNull().default('0'),
  installments:    integer('installments').notNull().default(1),
  notes:           text('notes'),
  cancelReason:    text('cancel_reason'),
  completedAt:     timestamp('completed_at'),
  createdById:     uuid('created_by_id').references(() => users.id),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
  updatedAt:       timestamp('updated_at').defaultNow().notNull(),
})

export const treatmentItems = pgTable('treatment_items', {
  id:          uuid('id').defaultRandom().primaryKey(),
  treatmentId: uuid('treatment_id').notNull().references(() => treatments.id, { onDelete: 'cascade' }),
  type:        treatmentItemTypeEnum('type').notNull(),
  materialId:  uuid('material_id').references(() => materials.id),
  description: varchar('description', { length: 255 }).notNull(),
  quantity:    numeric('quantity', { precision: 8, scale: 3 }).notNull().default('1'),
  unitCost:    numeric('unit_cost', { precision: 10, scale: 2 }).notNull().default('0'),
  unitPrice:   numeric('unit_price', { precision: 10, scale: 2 }).notNull().default('0'),
  total:       numeric('total', { precision: 10, scale: 2 }).notNull().default('0'),
  sortOrder:   integer('sort_order').notNull().default(0),
})

export const examOrders = pgTable('exam_orders', {
  id:            uuid('id').defaultRandom().primaryKey(),
  patientId:     uuid('patient_id').notNull().references(() => patients.id),
  appointmentId: uuid('appointment_id').references(() => appointments.id),
  doctorId:      uuid('doctor_id').references(() => users.id),
  exams:         jsonb('exams').$type<Array<{ name: string; tuss_code?: string; laterality?: string; prep_instructions?: string }>>().notNull().default([]),
  hypothesis:    text('hypothesis'),
  cid10:         varchar('cid10', { length: 10 }),
  urgency:       examUrgencyEnum('urgency').notNull().default('routine'),
  status:        examStatusEnum('status').notNull().default('issued'),
  resultUrl:     text('result_url'),
  resultDate:    date('result_date'),
  validUntil:    date('valid_until'),
  notes:         text('notes'),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
})

export const patientAccessTokens = pgTable('patient_access_tokens', {
  id:         uuid('id').defaultRandom().primaryKey(),
  patientId:  uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  token:      text('token').notNull().unique(),
  code:       varchar('code', { length: 6 }),
  expiresAt:  timestamp('expires_at').notNull(),
  lastUsedAt: timestamp('last_used_at'),
  isActive:   boolean('is_active').notNull().default(true),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
})

export const whatsappMessages = pgTable('whatsapp_messages', {
  id:                 uuid('id').defaultRandom().primaryKey(),
  type:               whatsappMessageTypeEnum('type').notNull(),
  targetNumber:       varchar('target_number', { length: 20 }).notNull(),
  patientId:          uuid('patient_id').references(() => patients.id),
  appointmentId:      uuid('appointment_id').references(() => appointments.id),
  message:            text('message').notNull(),
  status:             varchar('status', { length: 20 }).notNull().default('pending'),
  evolutionResponse:  jsonb('evolution_response'),
  sentAt:             timestamp('sent_at'),
  createdAt:          timestamp('created_at').defaultNow().notNull(),
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
  treatments:      many(treatments),
}))

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  patient: one(patients, { fields: [appointments.patientId], references: [patients.id] }),
  lead:    one(leads, { fields: [appointments.leadId], references: [leads.id] }),
  doctor:  one(users, { fields: [appointments.doctorId], references: [users.id] }),
  roomObj: one(rooms, { fields: [appointments.roomId], references: [rooms.id] }),
}))

export const roomsRelations = relations(rooms, ({ many }) => ({
  appointments: many(appointments),
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

export const materialCategoriesRelations = relations(materialCategories, ({ one, many }) => ({
  parent:   one(materialCategories, { fields: [materialCategories.parentId], references: [materialCategories.id], relationName: 'category_parent' }),
  children: many(materialCategories, { relationName: 'category_parent' }),
}))

export const materialsRelations = relations(materials, ({ one, many }) => ({
  movements:   many(stockMovements),
  batches:     many(materialBatches),
  categoryRef:    one(materialCategories, { fields: [materials.categoryId], references: [materialCategories.id], relationName: 'material_category' }),
  subcategoryRef: one(materialCategories, { fields: [materials.subcategoryId], references: [materialCategories.id], relationName: 'material_subcategory' }),
}))

export const materialBatchesRelations = relations(materialBatches, ({ one }) => ({
  material: one(materials, { fields: [materialBatches.materialId], references: [materials.id] }),
}))

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  material: one(materials, { fields: [stockMovements.materialId], references: [materials.id] }),
  user:     one(users, { fields: [stockMovements.userId], references: [users.id] }),
}))

export const treatmentsRelations = relations(treatments, ({ one, many }) => ({
  patient:       one(patients, { fields: [treatments.patientId], references: [patients.id] }),
  appointment:   one(appointments, { fields: [treatments.appointmentId], references: [appointments.id] }),
  doctor:        one(users, { fields: [treatments.doctorId], references: [users.id] }),
  paymentMethod: one(paymentMethods, { fields: [treatments.paymentMethodId], references: [paymentMethods.id] }),
  template:      one(treatmentTemplates, { fields: [treatments.templateId], references: [treatmentTemplates.id] }),
  items:         many(treatmentItems),
}))

export const treatmentItemsRelations = relations(treatmentItems, ({ one }) => ({
  treatment: one(treatments, { fields: [treatmentItems.treatmentId], references: [treatments.id] }),
  material:  one(materials, { fields: [treatmentItems.materialId], references: [materials.id] }),
}))

export const treatmentTemplatesRelations = relations(treatmentTemplates, ({ many }) => ({
  items:      many(treatmentTemplateItems),
  treatments: many(treatments),
}))

export const treatmentTemplateItemsRelations = relations(treatmentTemplateItems, ({ one }) => ({
  template: one(treatmentTemplates, { fields: [treatmentTemplateItems.templateId], references: [treatmentTemplates.id] }),
  material: one(materials, { fields: [treatmentTemplateItems.materialId], references: [materials.id] }),
}))

export const examOrdersRelations = relations(examOrders, ({ one }) => ({
  patient:     one(patients, { fields: [examOrders.patientId], references: [patients.id] }),
  appointment: one(appointments, { fields: [examOrders.appointmentId], references: [appointments.id] }),
  doctor:      one(users, { fields: [examOrders.doctorId], references: [users.id] }),
}))

export const patientAccessTokensRelations = relations(patientAccessTokens, ({ one }) => ({
  patient: one(patients, { fields: [patientAccessTokens.patientId], references: [patients.id] }),
}))

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  patient:     one(patients, { fields: [whatsappMessages.patientId], references: [patients.id] }),
  appointment: one(appointments, { fields: [whatsappMessages.appointmentId], references: [appointments.id] }),
}))

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  createdBy:   one(users, { fields: [purchaseOrders.createdById], references: [users.id] }),
  transaction: one(transactions, { fields: [purchaseOrders.transactionId], references: [transactions.id] }),
  items:       many(purchaseOrderItems),
}))

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, { fields: [purchaseOrderItems.purchaseOrderId], references: [purchaseOrders.id] }),
  material:      one(materials, { fields: [purchaseOrderItems.materialId], references: [materials.id] }),
}))

// ── NOVAS TABELAS: GLOSSÁRIO + SEO + ANALYTICS + CONFIGURAÇÕES ──

export const configuracoes = pgTable('configuracoes', {
  chave: text('chave').primaryKey(),
  valor: text('valor'),
  descricao: text('descricao'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tipo: text('tipo').notNull(),
  path: text('path').notNull(),
  referrer: text('referrer'),
  rotulo: text('rotulo'),
  sessionId: text('session_id'),
  device: text('device'),
  pais: text('pais'),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tipoIdx: index('analytics_tipo_idx').on(t.tipo),
  pathIdx: index('analytics_path_idx').on(t.path),
  createdIdx: index('analytics_created_idx').on(t.createdAt),
}))

export const glossarioTermos = pgTable('glossario_termos', {
  id: uuid('id').primaryKey().defaultRandom(),
  termo: text('termo').notNull(),
  slug: text('slug').notNull().unique(),
  letra: text('letra').notNull(),
  nicho: text('nicho').notNull(),
  conteudo: text('conteudo'),
  status: text('status').notNull().default('pendente'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  letraIdx: index('idx_glossario_letra').on(t.letra),
  statusIdx: index('idx_glossario_status').on(t.status),
  slugIdx: index('idx_glossario_slug').on(t.slug),
}))

