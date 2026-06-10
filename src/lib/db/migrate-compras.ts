import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function migrate() {
  console.log('▶ Criando enum purchase_order_status...')
  await sql`
    DO $$ BEGIN
      CREATE TYPE purchase_order_status AS ENUM ('draft','ordered','received','cancelled');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `

  console.log('▶ Criando tabela purchase_orders...')
  await sql`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      supplier         VARCHAR(255) NOT NULL,
      status           purchase_order_status NOT NULL DEFAULT 'draft',
      order_date       DATE NOT NULL,
      expected_date    DATE,
      received_date    DATE,
      total_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
      notes            TEXT,
      transaction_id   UUID REFERENCES transactions(id) ON DELETE SET NULL,
      created_by_id    UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `

  console.log('▶ Criando tabela purchase_order_items...')
  await sql`
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      material_id       UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
      quantity          INTEGER NOT NULL,
      unit_cost         NUMERIC(10,2) NOT NULL,
      total             NUMERIC(10,2) NOT NULL,
      notes             TEXT
    )
  `

  console.log('✅ Migração de compras concluída!')
  process.exit(0)
}

migrate().catch((err) => { console.error(err); process.exit(1) })
