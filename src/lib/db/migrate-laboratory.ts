import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function migrate() {
  console.log('▶ Adicionando coluna laboratory em materials...')
  await sql`ALTER TABLE materials ADD COLUMN IF NOT EXISTS laboratory VARCHAR(255)`
  console.log('✅ Migração concluída!')
  process.exit(0)
}

migrate().catch((err) => { console.error(err); process.exit(1) })
