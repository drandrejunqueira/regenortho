import type { Page } from '@playwright/test'

/**
 * Credenciais de um usuário de teste dedicado (nunca de produção). Preencha
 * via env quando o banco de teste (Neon branch) existir:
 *   E2E_USER_EMAIL / E2E_USER_PASSWORD
 */
export const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? ''
export const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? ''

export const hasE2ECredentials = Boolean(E2E_USER_EMAIL && E2E_USER_PASSWORD)

/** Faz login pela UI (form real) e deixa a página autenticada em /dashboard. */
export async function loginAsTestUser(page: Page): Promise<void> {
  if (!hasE2ECredentials) {
    throw new Error('E2E_USER_EMAIL / E2E_USER_PASSWORD não configuradas — ver tests/e2e/fixtures/auth.ts')
  }

  await page.goto('/login')
  await page.getByLabel('E-mail').fill(E2E_USER_EMAIL)
  await page.getByLabel('Senha', { exact: true }).fill(E2E_USER_PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(/\/dashboard/)
}
