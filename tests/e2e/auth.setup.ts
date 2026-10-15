import { test as setup, expect } from '@playwright/test'
import { E2E_USER_EMAIL, E2E_USER_PASSWORD, hasE2ECredentials } from './fixtures/auth'
import path from 'node:path'

/**
 * Faz login UMA vez e salva o estado da sessão. Os projetos autenticados
 * reaproveitam esse arquivo em vez de repetir o login pela UI em cada
 * `beforeEach` — o que estourava o timeout de 45s sob paralelismo, porque o
 * dev server do Next compila cada rota sob demanda no primeiro acesso.
 */
export const STORAGE_STATE = path.join(process.cwd(), 'playwright/.auth/user.json')

setup('autentica e salva a sessão', async ({ page }) => {
  setup.skip(!hasE2ECredentials, 'Requer usuário de teste — rode: npm run seed:e2e')

  await page.goto('/login')
  await page.getByLabel('E-mail').fill(E2E_USER_EMAIL)
  await page.getByLabel('Senha', { exact: true }).fill(E2E_USER_PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 })

  // Só salva sessão de fato autenticada — senão os testes herdam um estado
  // vazio e falham com erro de UI em vez de erro de login, que engana.
  await expect(page).toHaveURL(/\/dashboard/)
  await page.context().storageState({ path: STORAGE_STATE })
})
