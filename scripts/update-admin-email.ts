/**
 * Updates the admin account email.
 *
 *   npx tsx scripts/update-admin-email.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

const OLD_EMAIL = 'admin@regemorto.com.br'
const NEW_EMAIL = 'admin@regenortho.com.br'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL ausente em .env.local')
    process.exit(1)
  }

  const { db } = await import('../src/lib/db')
  const { users } = await import('../src/lib/db/schema')
  const { eq } = await import('drizzle-orm')

  const existing = await db.query.users.findFirst({ where: eq(users.email, OLD_EMAIL) })
  if (!existing) {
    console.error(`❌ Conta não encontrada: ${OLD_EMAIL}`)
    process.exit(1)
  }

  const conflict = await db.query.users.findFirst({ where: eq(users.email, NEW_EMAIL) })
  if (conflict) {
    console.error(`❌ Já existe uma conta com o e-mail: ${NEW_EMAIL}`)
    process.exit(1)
  }

  await db.update(users).set({ email: NEW_EMAIL }).where(eq(users.id, existing.id))
  console.log(`✅ E-mail atualizado: ${OLD_EMAIL} → ${NEW_EMAIL}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Erro:', err)
  process.exit(1)
})
