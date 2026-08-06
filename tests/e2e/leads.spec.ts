import { test, expect } from '@playwright/test'
import { loginAsTestUser, hasE2ECredentials } from './fixtures/auth'
import { buildMockLeadsBoard } from './fixtures/mock-data'
import { horizontalOverflow } from './fixtures/no-horizontal-overflow'

// habilitar quando E2E_DATABASE_URL / E2E_USER_EMAIL / E2E_USER_PASSWORD existirem
// (banco de teste dedicado — Neon branch a ser provisionado pelo Daniel).
test.skip(!hasE2ECredentials, 'Requer usuário de teste — ver tests/e2e/fixtures/auth.ts')

test.describe('CRM de Leads (/leads)', () => {
  test.beforeEach(async ({ page }) => {
    const board = buildMockLeadsBoard()

    // Nunca deixa a mutação de status (drag & drop) ou qualquer escrita
    // chegar ao banco real — todo GET/PATCH de leads é servido por mock.
    await page.route('**/api/leads?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: board }) })
    )
    await page.route('**/api/leads', (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: board }) })
    })
    await page.route('**/api/leads/*', (route) => {
      const id = route.request().url().split('/').pop()
      const lead = board.find((l) => l.id === id)
      if (!lead) return route.fulfill({ status: 404, body: '{}' })
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { ...lead, interactions: [] } }),
      })
    })

    await loginAsTestUser(page)
    await page.goto('/leads')
  })

  test('board Kanban renderiza as colunas do funil', async ({ page }) => {
    for (const label of ['Novo', 'Em Atendimento', 'Agendado', 'Compareceu', 'Perdido']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    }
  })

  for (const vp of [
    { width: 320, height: 720, label: '320' },
    { width: 768, height: 1024, label: '768' },
    { width: 1024, height: 900, label: '1024' },
    { width: 1440, height: 900, label: '1440' },
  ]) {
    test(`board não gera scroll horizontal em ${vp.label}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await expect(page.getByText('Novo', { exact: true })).toBeVisible()

      const overflow = await horizontalOverflow(page)
      expect(overflow, `overflow horizontal de ${overflow}px @ ${vp.label}px`).toBeLessThanOrEqual(1)
    })
  }

  test('drawer do lead abre ao clicar no card', async ({ page }) => {
    await page.getByText('Ana Teste (Novo)').click()

    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText('Ana Teste (Novo)')).toBeVisible()
  })
})
