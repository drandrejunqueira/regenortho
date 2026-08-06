/**
 * Resumo diário da agenda do médico via WhatsApp.
 * Executa: npx tsx src/lib/db/migrate-agenda-diaria.ts
 */
import { config } from 'dotenv'
import { sql } from 'drizzle-orm'

config({ path: '.env.local' })

async function run() {
  console.log('▶ migrate-agenda-diaria: resumo diário do médico')

  // Import dinâmico: o módulo do banco lê DATABASE_URL no topo, e um import
  // estático seria avaliado antes do config() acima.
  const { db } = await import('./index')

  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_agenda_enabled boolean DEFAULT false NOT NULL
  `)
  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_agenda_whatsapp varchar(30)
  `)
  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_agenda_hour varchar(5) DEFAULT '08:00' NOT NULL
  `)
  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_agenda_last_sent varchar(10)
  `)
  console.log('  ✔ colunas em users')

  // ALTER TYPE ... ADD VALUE não roda dentro de transação implícita em algumas
  // versões; isolado num execute próprio e tolerante a "já existe".
  await db.execute(sql`
    ALTER TYPE whatsapp_message_type ADD VALUE IF NOT EXISTS 'daily_agenda'
  `)
  console.log("  ✔ enum whatsapp_message_type += 'daily_agenda'")

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS users_daily_agenda_idx
      ON users (daily_agenda_enabled, daily_agenda_hour)
  `)
  console.log('  ✔ índice users_daily_agenda_idx')

  console.log('✅ migrate-agenda-diaria concluída')
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
