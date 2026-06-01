import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
  const sql = neon(process.env.DATABASE_URL!)
  const db = drizzle(sql)
  console.log('Running migrations...')
  await migrate(db, { migrationsFolder: './src/lib/db/migrations' })
  console.log('Migrations complete.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
