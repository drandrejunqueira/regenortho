/**
 * Registro de tags do sistema (Configurações → Tags).
 * Executa: npx tsx src/lib/db/migrate-tags.ts
 */
import { config } from 'dotenv'
import { sql } from 'drizzle-orm'

config({ path: '.env.local' })

async function run() {
  console.log('▶ migrate-tags: registro de tags do sistema')

  // Import dinâmico: o módulo do banco lê DATABASE_URL no topo e um import
  // estático seria avaliado antes do config() acima.
  const { db } = await import('./index')

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tags (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      name       varchar(40) NOT NULL UNIQUE,
      color      varchar(7) DEFAULT '#00BCE4' NOT NULL,
      is_active  boolean DEFAULT true NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `)
  console.log('  ✔ tabela tags')

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS tags_active_name_idx ON tags (is_active, name)
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS leads_tags_gin_idx ON leads USING GIN (tags)
  `)
  console.log('  ✔ índices (tags_active_name_idx, leads_tags_gin_idx)')

  // Semeia com as tags de texto livre já em uso, para não perder marcação.
  const r = await db.execute(sql`
    INSERT INTO tags (name)
    SELECT DISTINCT LEFT(tag, 40)
    FROM leads, jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) AS tag
    WHERE LENGTH(TRIM(tag)) > 0
    ON CONFLICT (name) DO NOTHING
  `)
  console.log(`  ✔ tags importadas dos leads existentes (${(r as { rowCount?: number }).rowCount ?? 0})`)

  console.log('✅ migrate-tags concluída')
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
