/**
 * Removes seed/test transactional data so the clinic starts with a clean slate,
 * while PRESERVING staff users, clinic settings, catalogs and site content
 * (rooms, payment methods, bank accounts, treatment templates, glossary, etc.).
 *
 *   npx tsx scripts/clean-test-data.ts          # dry-run: shows counts only
 *   npx tsx scripts/clean-test-data.ts --confirm # actually deletes
 *
 * Deletes (in FK-safe order): WhatsApp logs, portal tokens, clinical records,
 * treatments + items, exam orders, transactions, purchase orders + items,
 * appointments, lead interactions, leads, stock movements, materials,
 * patients, monthly goals, analytics events.
 *
 * Irreversible. Make sure .env.local points to the intended database.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

// Child → parent order. Each runs as its own statement to respect FKs.
const DELETE_ORDER = [
  'whatsapp_messages',
  'patient_access_tokens',
  'clinical_records',
  'treatment_items',
  'treatments',
  'exam_orders',
  'transactions',
  'purchase_order_items',
  'purchase_orders',
  'appointments',
  'lead_interactions',
  'leads',
  'stock_movements',
  'materials',
  'patients',
  'monthly_goals',
  'analytics_events',
] as const

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL ausente em .env.local')
    process.exit(1)
  }
  const confirmed = process.argv.includes('--confirm')

  const { db } = await import('../src/lib/db')
  const { sql } = await import('drizzle-orm')

  const count = async (table: string): Promise<number> => {
    const r = await db.execute(sql.raw(`SELECT count(*)::int AS n FROM ${table}`))
    // neon-http returns rows on the result object
    return (r as unknown as { rows?: { n: number }[] }).rows?.[0]?.n
      ?? (r as unknown as { n: number }[])[0]?.n
      ?? 0
  }

  console.log(confirmed ? '🧹 LIMPEZA (modo real)\n' : '🔎 DRY-RUN (nada será apagado)\n')
  console.log('Tabela'.padEnd(26) + 'Linhas')
  console.log('─'.repeat(36))
  let total = 0
  for (const table of DELETE_ORDER) {
    const n = await count(table)
    total += n
    console.log(table.padEnd(26) + n)
  }
  console.log('─'.repeat(36))
  console.log('TOTAL'.padEnd(26) + total + '\n')

  if (!confirmed) {
    console.log('▶ Rode novamente com --confirm para apagar de fato.')
    console.log('  Preservados: usuários, configurações, salas, formas de pagamento,')
    console.log('  contas bancárias, templates de tratamento, glossário e conteúdo do site.')
    process.exit(0)
  }

  for (const table of DELETE_ORDER) {
    try {
      await db.execute(sql.raw(`DELETE FROM ${table}`))
      console.log(`  ✓ ${table} limpa`)
    } catch (e) {
      console.error(`  ⚠ ${table}: ${(e as Error).message}`)
    }
  }

  console.log('\n✅ Dados de teste removidos. Banco pronto para pacientes reais.')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Erro:', err)
  process.exit(1)
})
