import { test, expect } from '@playwright/test'
import { loginAsTestUser, hasE2ECredentials } from './fixtures/auth'
import { buildMockAgendaHoje } from './fixtures/mock-data'

// habilitar quando E2E_DATABASE_URL / E2E_USER_EMAIL / E2E_USER_PASSWORD existirem
// (banco de teste dedicado — Neon branch a ser provisionado pelo Daniel).
test.skip(!hasE2ECredentials, 'Requer usuário de teste — ver tests/e2e/fixtures/auth.ts')

test.describe('Perfil → aba "Agenda do dia"', () => {
  test.beforeEach(async ({ page }) => {
    const agenda = buildMockAgendaHoje()

    // GET é a prévia (leitura). POST dispararia envio real de WhatsApp — nunca
    // deixar chegar à rede, mesmo que o teste não clique em "Enviar agora".
    await page.route('**/api/perfil/agenda-hoje', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: agenda }) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    })
    await page.route('**/api/perfil', (route) => {
      if (route.request().method() === 'GET') return route.continue()
      // PATCH de dados de perfil / agenda diária — nunca grava de verdade.
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) })
    })

    await loginAsTestUser(page)
    await page.goto('/dashboard')
  })

  test('abre pelo Sidebar e mostra os 3 tabs', async ({ page }) => {
    // O botão de perfil no rodapé do Sidebar (nome/avatar do usuário logado).
    await page.getByRole('button', { name: /Editar perfil/ }).click()

    await expect(page.getByRole('button', { name: 'Dados' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Agenda do dia' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Senha' })).toBeVisible()
  })

  test('aba Agenda do dia mostra config e prévia', async ({ page }) => {
    await page.getByRole('button', { name: /Editar perfil/ }).click()
    await page.getByRole('button', { name: 'Agenda do dia' }).click()

    // Card de configuração
    await expect(page.getByRole('switch', { name: 'Ativar resumo diário no WhatsApp' })).toBeVisible()
    await expect(page.getByLabel('WhatsApp')).toBeVisible()

    const hourSelect = page.getByLabel('Horário')
    await expect(hourSelect).toBeVisible()
    await expect(hourSelect.locator('option')).toHaveCount(24)
    await expect(hourSelect.locator('option').first()).toHaveText('00:00')
    await expect(hourSelect.locator('option').last()).toHaveText('23:00')

    // Prévia da agenda de hoje (mockada)
    await expect(page.getByText('Paciente Mock 1')).toBeVisible()
    await expect(page.getByText('Paciente Mock 2')).toBeVisible()
    await expect(page.getByText('2', { exact: true })).toBeVisible()
  })
})
