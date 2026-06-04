// @ts-nocheck — migração idempotente Frente 1 (Catálogo de tratamentos + parcelas)
// Rodar com: npx tsx src/lib/db/migrate-frente1.ts
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
      console.log(`- ${desc} (já existe, ignorado)`)
    } else {
      console.error(`✗ ${desc}: ${err.message}`)
    }
  }
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!)
  console.log('Migração Frente 1 (tratamentos + financeiro)...\n')

  // Catálogo de tratamentos
  await run(sql, `
    CREATE TABLE IF NOT EXISTS treatment_templates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(255) NOT NULL,
      description text,
      category transaction_category NOT NULL DEFAULT 'consultation_fee',
      default_price numeric(10,2) NOT NULL DEFAULT 0,
      estimated_cost numeric(10,2) NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      notes text,
      created_by_id uuid REFERENCES users(id),
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `, 'tabela treatment_templates')

  await run(sql, `
    CREATE TABLE IF NOT EXISTS treatment_template_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id uuid NOT NULL REFERENCES treatment_templates(id) ON DELETE CASCADE,
      type treatment_item_type NOT NULL,
      material_id uuid REFERENCES materials(id),
      description varchar(255) NOT NULL,
      quantity numeric(8,3) NOT NULL DEFAULT 1,
      unit_price numeric(10,2) NOT NULL DEFAULT 0,
      sort_order integer NOT NULL DEFAULT 0
    )
  `, 'tabela treatment_template_items')

  // Colunas novas em treatments
  await run(sql, `ALTER TABLE treatments ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES treatment_templates(id)`, 'treatments.template_id')
  await run(sql, `ALTER TABLE treatments ADD COLUMN IF NOT EXISTS category transaction_category NOT NULL DEFAULT 'consultation_fee'`, 'treatments.category')

  // Colunas novas em transactions (parcelas / recebimentos futuros)
  await run(sql, `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS treatment_id uuid REFERENCES treatments(id)`, 'transactions.treatment_id')
  await run(sql, `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS installment_number integer`, 'transactions.installment_number')
  await run(sql, `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS installment_total integer`, 'transactions.installment_total')

  console.log('\nFeito!')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
