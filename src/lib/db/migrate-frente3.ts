/**
 * Frente 3 — cancel_reason no tratamento
 * Executa: npx tsx src/lib/db/migrate-frente3.ts
 */
import { db } from './index'
import { sql } from 'drizzle-orm'

async function run() {
  console.log('▶ migrate-frente3: cancel_reason')

  await db.execute(sql`
    ALTER TABLE treatments ADD COLUMN IF NOT EXISTS cancel_reason TEXT
  `)
  console.log('  ✔ treatments.cancel_reason')

  console.log('✅ migrate-frente3 concluída')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
