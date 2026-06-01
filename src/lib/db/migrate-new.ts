// @ts-nocheck — one-time migration script, not production code
import { neon } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function run(sql: ReturnType<typeof neon>, query: string, desc: string) {
  try {
    await sql.unsafe(query)
    console.log(`✓ ${desc}`)
  } catch (e: unknown) {
    const err = e as { message?: string }
    if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
      console.log(`- ${desc} (already exists, skipped)`)
    } else {
      console.error(`✗ ${desc}: ${err.message}`)
    }
  }
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!)
  console.log('Running targeted migration...\n')

  // Enums
  await run(sql, `CREATE TYPE "public"."treatment_status" AS ENUM('draft','approved','in_progress','completed','cancelled')`, 'enum treatment_status')
  await run(sql, `CREATE TYPE "public"."treatment_item_type" AS ENUM('procedure','material','fee')`, 'enum treatment_item_type')
  await run(sql, `CREATE TYPE "public"."exam_urgency" AS ENUM('routine','urgent','emergency')`, 'enum exam_urgency')
  await run(sql, `CREATE TYPE "public"."exam_status" AS ENUM('issued','scheduled','collected','result_available','archived')`, 'enum exam_status')
  await run(sql, `CREATE TYPE "public"."payment_method_type" AS ENUM('cash','credit_card','debit_card','pix','bank_transfer','insurance','check')`, 'enum payment_method_type')
  await run(sql, `CREATE TYPE "public"."bank_account_type" AS ENUM('checking','savings','pix_key')`, 'enum bank_account_type')
  await run(sql, `CREATE TYPE "public"."whatsapp_message_type" AS ENUM('lead_notification','appointment_reminder','appointment_confirmation','treatment_summary','exam_ready','payment_reminder','weekly_report','monthly_report')`, 'enum whatsapp_message_type')

  // New clinic_settings columns (safe - ADD COLUMN IF NOT EXISTS)
  const settingsColumns = [
    [`ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS evolution_api_url text`, 'settings.evolution_api_url'],
    [`ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS evolution_api_key text`, 'settings.evolution_api_key'],
    [`ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS evolution_instance varchar(100)`, 'settings.evolution_instance'],
    [`ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS notify_new_lead_number varchar(20)`, 'settings.notify_new_lead_number'],
    [`ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS notify_weekly_report_number varchar(20)`, 'settings.notify_weekly_report_number'],
    [`ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS notify_monthly_report_number varchar(20)`, 'settings.notify_monthly_report_number'],
    [`ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS notify_report_day integer DEFAULT 30`, 'settings.notify_report_day'],
    [`ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS send_appointment_reminder boolean NOT NULL DEFAULT true`, 'settings.send_appointment_reminder'],
    [`ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS reminder_hours_before integer DEFAULT 24`, 'settings.reminder_hours_before'],
    [`ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS send_treatment_summary boolean NOT NULL DEFAULT true`, 'settings.send_treatment_summary'],
    [`ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS notify_email_new_lead boolean NOT NULL DEFAULT false`, 'settings.notify_email_new_lead'],
    [`ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS notify_email_new_patient boolean NOT NULL DEFAULT false`, 'settings.notify_email_new_patient'],
    [`ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS notify_email_weekly_report boolean NOT NULL DEFAULT false`, 'settings.notify_email_weekly_report'],
    [`ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS alert_email_recipients text`, 'settings.alert_email_recipients'],
  ]
  for (const [q, d] of settingsColumns) await run(sql, q as string, d as string)

  // New tables
  await run(sql, `
    CREATE TABLE IF NOT EXISTS payment_methods (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(100) NOT NULL,
      type payment_method_type NOT NULL,
      fee_percent numeric(5,2) NOT NULL DEFAULT 0,
      max_installments integer NOT NULL DEFAULT 1,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp DEFAULT now() NOT NULL
    )
  `, 'table payment_methods')

  await run(sql, `
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(100) NOT NULL,
      bank varchar(100),
      agency varchar(20),
      account varchar(30),
      type bank_account_type NOT NULL DEFAULT 'checking',
      pix_key text,
      is_default boolean NOT NULL DEFAULT false,
      is_active boolean NOT NULL DEFAULT true,
      current_balance numeric(12,2) NOT NULL DEFAULT 0,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `, 'table bank_accounts')

  await run(sql, `
    CREATE TABLE IF NOT EXISTS treatments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id uuid NOT NULL REFERENCES patients(id),
      appointment_id uuid REFERENCES appointments(id),
      doctor_id uuid REFERENCES users(id),
      payment_method_id uuid REFERENCES payment_methods(id),
      name varchar(255) NOT NULL,
      status treatment_status NOT NULL DEFAULT 'draft',
      subtotal numeric(10,2) NOT NULL DEFAULT 0,
      discount numeric(10,2) NOT NULL DEFAULT 0,
      total_sale numeric(10,2) NOT NULL DEFAULT 0,
      total_cost numeric(10,2) NOT NULL DEFAULT 0,
      installments integer NOT NULL DEFAULT 1,
      notes text,
      completed_at timestamp,
      created_by_id uuid REFERENCES users(id),
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `, 'table treatments')

  await run(sql, `
    CREATE TABLE IF NOT EXISTS treatment_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      treatment_id uuid NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
      type treatment_item_type NOT NULL,
      material_id uuid REFERENCES materials(id),
      description varchar(255) NOT NULL,
      quantity numeric(8,3) NOT NULL DEFAULT 1,
      unit_cost numeric(10,2) NOT NULL DEFAULT 0,
      unit_price numeric(10,2) NOT NULL DEFAULT 0,
      total numeric(10,2) NOT NULL DEFAULT 0,
      sort_order integer NOT NULL DEFAULT 0
    )
  `, 'table treatment_items')

  await run(sql, `
    CREATE TABLE IF NOT EXISTS exam_orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id uuid NOT NULL REFERENCES patients(id),
      appointment_id uuid REFERENCES appointments(id),
      doctor_id uuid REFERENCES users(id),
      exams jsonb NOT NULL DEFAULT '[]',
      hypothesis text,
      cid10 varchar(10),
      urgency exam_urgency NOT NULL DEFAULT 'routine',
      status exam_status NOT NULL DEFAULT 'issued',
      result_url text,
      result_date date,
      valid_until date,
      notes text,
      created_at timestamp DEFAULT now() NOT NULL
    )
  `, 'table exam_orders')

  await run(sql, `
    CREATE TABLE IF NOT EXISTS patient_access_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      token text NOT NULL UNIQUE,
      expires_at timestamp NOT NULL,
      last_used_at timestamp,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp DEFAULT now() NOT NULL
    )
  `, 'table patient_access_tokens')

  await run(sql, `
    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      type whatsapp_message_type NOT NULL,
      target_number varchar(20) NOT NULL,
      patient_id uuid REFERENCES patients(id),
      appointment_id uuid REFERENCES appointments(id),
      message text NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'pending',
      evolution_response jsonb,
      sent_at timestamp,
      created_at timestamp DEFAULT now() NOT NULL
    )
  `, 'table whatsapp_messages')

  // Seed default payment methods
  await run(sql, `
    INSERT INTO payment_methods (name, type, fee_percent, max_installments)
    SELECT name::varchar, type::payment_method_type, fee_percent::numeric, max_installments::integer
    FROM (VALUES
      ('Dinheiro', 'cash', '0', '1'),
      ('PIX', 'pix', '0', '1'),
      ('Cartão de Débito', 'debit_card', '1.5', '1'),
      ('Cartão de Crédito 1x', 'credit_card', '2.5', '1'),
      ('Cartão de Crédito até 6x', 'credit_card', '3.5', '6'),
      ('Cartão de Crédito até 12x', 'credit_card', '4.5', '12'),
      ('Convênio', 'insurance', '0', '1'),
      ('Transferência Bancária', 'bank_transfer', '0', '1')
    ) AS vals(name, type, fee_percent, max_installments)
    WHERE NOT EXISTS (SELECT 1 FROM payment_methods)
  `, 'seed default payment_methods')

  console.log('\nDone!')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
