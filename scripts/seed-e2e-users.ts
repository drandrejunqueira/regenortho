/**
 * Cria (ou atualiza) os quatro usuários de teste — um por papel — com senhas
 * aleatórias fortes, e grava as credenciais em `.env.e2e` (ignorado pelo git).
 *
 *   npx tsx scripts/seed-e2e-users.ts
 *
 * Sem esses usuários, TODA spec de dashboard do Playwright começa com
 * `test.skip(!hasE2ECredentials)` — a suíte passa verde sem testar nada.
 *
 * ⚠️  Aponte para um banco de TESTE (branch do Neon), nunca produção.
 *     Defina E2E_DATABASE_URL, ou confirme com ALLOW_PROD_SEED=1.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import crypto from 'node:crypto'
import fs from 'node:fs'

const ROLES = [
  { role: 'admin',        email: 'qa.admin@regenortho.test',       name: 'QA Admin' },
  { role: 'doctor',       email: 'qa.medico@regenortho.test',      name: 'QA Médico' },
  { role: 'receptionist', email: 'qa.recepcao@regenortho.test',    name: 'QA Recepção' },
  { role: 'financial',    email: 'qa.financeiro@regenortho.test',  name: 'QA Financeiro' },
] as const

/** 20 chars, alfabeto sem caracteres ambíguos. */
function strongPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#%&*'
  const bytes = crypto.randomBytes(20)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

async function main() {
  const url = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL
  if (!url) {
    console.error('❌ Defina E2E_DATABASE_URL (preferido) ou DATABASE_URL em .env.local')
    process.exit(1)
  }
  if (!process.env.E2E_DATABASE_URL && process.env.ALLOW_PROD_SEED !== '1') {
    console.error('❌ E2E_DATABASE_URL ausente — recusando semear no banco de DATABASE_URL.')
    console.error('   Crie um branch do Neon para testes e aponte E2E_DATABASE_URL para ele.')
    console.error('   Se você TEM certeza de que este banco é descartável: ALLOW_PROD_SEED=1 npx tsx scripts/seed-e2e-users.ts')
    process.exit(1)
  }
  process.env.DATABASE_URL = url

  const { db } = await import('../src/lib/db')
  const { users } = await import('../src/lib/db/schema')
  const { eq } = await import('drizzle-orm')
  const bcrypt = (await import('bcryptjs')).default

  console.log('🌱 Provisionando usuários de teste...\n')
  const lines: string[] = [
    '# Credenciais de teste E2E — geradas por scripts/seed-e2e-users.ts',
    `# ${new Date().toISOString()}`,
    '# NUNCA commitar. NUNCA reutilizar em produção.',
    '',
  ]

  for (const spec of ROLES) {
    const password = strongPassword()
    const passwordHash = await bcrypt.hash(password, 12)
    const existing = await db.query.users.findFirst({ where: eq(users.email, spec.email) })

    if (existing) {
      await db.update(users)
        .set({ passwordHash, role: spec.role, isActive: true, name: spec.name, customPermissions: null })
        .where(eq(users.id, existing.id))
      console.log(`  ↻ ${spec.role.padEnd(13)} ${spec.email}`)
    } else {
      await db.insert(users).values({
        name: spec.name, email: spec.email, passwordHash, role: spec.role, isActive: true,
      })
      console.log(`  + ${spec.role.padEnd(13)} ${spec.email}`)
    }

    const KEY = spec.role.toUpperCase()
    lines.push(`E2E_${KEY}_EMAIL="${spec.email}"`)
    lines.push(`E2E_${KEY}_PASSWORD="${password}"`)
  }

  // O fixture padrão (tests/e2e/fixtures/auth.ts) usa E2E_USER_* — aponta para o admin.
  lines.push('')
  lines.push('# Usuário padrão dos fixtures de E2E (= admin)')
  lines.push(`E2E_USER_EMAIL="${ROLES[0].email}"`)
  lines.push(`E2E_USER_PASSWORD="${lines.find((l) => l.startsWith('E2E_ADMIN_PASSWORD'))!.split('"')[1]}"`)
  lines.push('')

  fs.writeFileSync('.env.e2e', lines.join('\n'))
  console.log('\n✅ Credenciais em .env.e2e (git-ignored).')
  console.log('   Carregue antes de rodar os testes:')
  console.log('     set -a && source .env.e2e && set +a && npm run test:e2e')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Erro:', err instanceof Error ? err.message : err)
  process.exit(1)
})
