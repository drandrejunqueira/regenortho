// @ts-nocheck — migração idempotente Frente 2 (Google Calendar por médico)
// Rodar com: npx tsx src/lib/db/migrate-frente2.ts
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
  console.log('Migração Frente 2 (Google Calendar por médico)...\n')

  await run(sql, `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_calendar_refresh_token text`, 'users.google_calendar_refresh_token')
  await run(sql, `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_calendar_email text`, 'users.google_calendar_email')
  await run(sql, `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_calendar_connected_at timestamp`, 'users.google_calendar_connected_at')
  await run(sql, `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_event_id text`, 'appointments.google_event_id')

  console.log('\nFeito!')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
