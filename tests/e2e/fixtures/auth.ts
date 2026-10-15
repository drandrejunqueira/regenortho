import type { Page } from '@playwright/test'

/**
 * Credenciais de um usuário de teste dedicado (nunca de produção).
 * Geradas por `npm run seed:e2e`, que grava `.env.e2e` (git-ignored).
 * Carregue antes de rodar:  set -a && source .env.e2e && set +a
 */
export const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? ''
export const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? ''

export const hasE2ECredentials = Boolean(E2E_USER_EMAIL && E2E_USER_PASSWORD)

/**
 * Garante uma página autenticada em /dashboard.
 *
 * Nos projetos que carregam `storageState` (ver playwright.config.ts) a sessão
 * já vem pronta e esta função só navega — não repete o login pela UI. Isso
 * importa: com sessão ativa o middleware redireciona /login para /dashboard, e
 * o formulário nem existe para ser preenchido.
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  if (!hasE2ECredentials) {
    throw new Error('E2E_USER_EMAIL / E2E_USER_PASSWORD não configuradas — rode: npm run seed:e2e')
  }

  await page.goto('/dashboard')
  if (/\/dashboard/.test(page.url())) return // sessão reaproveitada

  await page.goto('/login')
  await page.getByLabel('E-mail').fill(E2E_USER_EMAIL)
  await page.getByLabel('Senha', { exact: true }).fill(E2E_USER_PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 })
}
