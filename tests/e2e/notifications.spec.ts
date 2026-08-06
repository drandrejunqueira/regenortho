import { test, expect } from '@playwright/test'
import { loginAsTestUser, hasE2ECredentials } from './fixtures/auth'
import { buildMockNotifications } from './fixtures/mock-data'

// habilitar quando E2E_DATABASE_URL / E2E_USER_EMAIL / E2E_USER_PASSWORD existirem
// (banco de teste dedicado — Neon branch a ser provisionado pelo Daniel).
test.skip(!hasE2ECredentials, 'Requer usuário de teste — ver tests/e2e/fixtures/auth.ts')

test.describe('Sino de notificações', () => {
  test.beforeEach(async ({ page }) => {
    const items = buildMockNotifications()
    const unreadCount = items.filter((n) => !n.isRead).length

    await page.route('**/api/notifications', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: items, unreadCount }),
      })
    )
    // "Marcar todas como lidas" e leitura individual — nunca grava de verdade.
    await page.route('**/api/notifications/read', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    )

    await loginAsTestUser(page)
    await page.goto('/dashboard')
  })

  test('mostra badge de não lidas', async ({ page }) => {
    const bell = page.getByRole('button', { name: /Notificações/ })
    await expect(bell).toBeVisible()
    await expect(bell.getByText('1')).toBeVisible()
  })

  test('painel abre ao clicar no sino e lista os avisos', async ({ page }) => {
    await page.getByRole('button', { name: /Notificações/ }).click()

    await expect(page.getByText('Novo lead recebido')).toBeVisible()
    await expect(page.getByText('Consulta agendada')).toBeVisible()
  })

  test('botão de som liga/desliga e atualiza aria-checked', async ({ page }) => {
    await page.getByRole('button', { name: /Notificações/ }).click()

    const soundToggle = page.getByRole('switch', { name: /som dos avisos/ })
    const before = await soundToggle.getAttribute('aria-checked')

    await soundToggle.click()

    await expect(soundToggle).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true')
  })

  test('marcar todas como lidas dispara a chamada mockada e zera o badge', async ({ page }) => {
    await page.getByRole('button', { name: /Notificações/ }).click()

    const readRequest = page.waitForRequest(
      (req) => req.url().includes('/api/notifications/read') && req.method() === 'POST'
    )
    await page.getByRole('button', { name: 'Marcar todas como lidas' }).click()
    await readRequest

    await expect(page.getByRole('button', { name: 'Marcar todas como lidas' })).not.toBeVisible()
  })
})
