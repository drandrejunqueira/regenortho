/**
 * Resets the staff account passwords to strong, random values and prints them
 * ONCE. Run before go-live to remove the publicly-known seed passwords.
 *
 *   npx tsx scripts/reset-passwords.ts
 *
 * Hand the printed credentials to each staff member; they can change their own
 * password later in the app. Re-running generates new passwords every time.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import crypto from 'crypto'

const ACCOUNTS = [
  'admin@regemorto.com.br',
  'medico@regemorto.com.br',
  'recepcao@regemorto.com.br',
  'financeiro@regemorto.com.br',
]

/** 16-char password from a URL-safe alphabet (no ambiguous chars). */
function strongPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#%&*'
  const bytes = crypto.randomBytes(16)
  let out = ''
  for (let i = 0; i < 16; i++) out += alphabet[bytes[i]! % alphabet.length]
  return out
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL ausente em .env.local')
    process.exit(1)
  }

  const { db } = await import('../src/lib/db')
  const { users } = await import('../src/lib/db/schema')
  const { eq } = await import('drizzle-orm')
  const bcrypt = (await import('bcryptjs')).default

  console.log('🔐 Redefinindo senhas...\n')
  const results: { email: string; password: string; status: string }[] = []

  for (const email of ACCOUNTS) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
    if (!existing) {
      results.push({ email, password: '—', status: 'NÃO ENCONTRADO' })
      continue
    }
    const password = strongPassword()
    const passwordHash = await bcrypt.hash(password, 12)
    await db.update(users).set({ passwordHash }).where(eq(users.id, existing.id))
    results.push({ email, password, status: 'OK' })
  }

  console.log('NOVAS CREDENCIAIS (guarde agora — não serão exibidas de novo):')
  console.log('─'.repeat(64))
  for (const r of results) {
    console.log(`${r.status.padEnd(14)} ${r.email.padEnd(32)} ${r.password}`)
  }
  console.log('─'.repeat(64))
  console.log('\n✅ Concluído. Entregue cada senha ao respectivo usuário.')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Erro:', err)
  process.exit(1)
})
