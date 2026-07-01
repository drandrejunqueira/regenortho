import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function migrate() {
  console.log('▶ Criando tabela material_categories...')
  await sql`
    CREATE TABLE IF NOT EXISTS material_categories (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(120) NOT NULL,
      parent_id   UUID REFERENCES material_categories(id) ON DELETE CASCADE,
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `

  console.log('▶ Adicionando colunas em materials...')
  await sql`ALTER TABLE materials ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES material_categories(id) ON DELETE SET NULL`
  await sql`ALTER TABLE materials ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES material_categories(id) ON DELETE SET NULL`
  await sql`ALTER TABLE materials ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`

  console.log('▶ Criando tabela material_batches...')
  await sql`
    CREATE TABLE IF NOT EXISTS material_batches (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      material_id  UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
      batch_number VARCHAR(100),
      expires_at   DATE,
      quantity     INTEGER NOT NULL DEFAULT 0,
      notes        TEXT,
      created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `

  console.log('▶ Semeando categorias padrão...')
  await sql`
    INSERT INTO material_categories (name, sort_order)
    SELECT v.name, v.ord
    FROM (VALUES
      ('Descartáveis', 1),
      ('EPI', 2),
      ('Medicamentos', 3),
      ('Instrumentais', 4),
      ('Equipamentos', 5),
      ('Outros', 99)
    ) AS v(name, ord)
    WHERE NOT EXISTS (
      SELECT 1 FROM material_categories mc WHERE mc.name = v.name AND mc.parent_id IS NULL
    )
  `

  console.log('▶ Migrando categorias de texto já existentes...')
  await sql`
    INSERT INTO material_categories (name)
    SELECT DISTINCT m.category FROM materials m
    WHERE m.category IS NOT NULL AND m.category <> ''
      AND NOT EXISTS (
        SELECT 1 FROM material_categories mc WHERE mc.name = m.category AND mc.parent_id IS NULL
      )
  `

  console.log('▶ Vinculando materiais às categorias...')
  await sql`
    UPDATE materials m
    SET category_id = mc.id
    FROM material_categories mc
    WHERE mc.parent_id IS NULL AND mc.name = m.category AND m.category_id IS NULL
  `

  console.log('▶ Criando subcategorias de exemplo (EPI → Óculos, Luvas)...')
  await sql`
    INSERT INTO material_categories (name, parent_id, sort_order)
    SELECT v.name, epi.id, v.ord
    FROM material_categories epi
    CROSS JOIN (VALUES ('Óculos', 1), ('Luvas', 2), ('Máscaras', 3)) AS v(name, ord)
    WHERE epi.name = 'EPI' AND epi.parent_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM material_categories mc WHERE mc.name = v.name AND mc.parent_id = epi.id
      )
  `

  const cats = await sql`SELECT COUNT(*)::int AS n FROM material_categories`
  const batches = await sql`SELECT COUNT(*)::int AS n FROM material_batches`
  console.log(`✔ Concluído. Categorias: ${cats[0].n} | Lotes: ${batches[0].n}`)
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('✖ Erro na migração:', err)
    process.exit(1)
  })
