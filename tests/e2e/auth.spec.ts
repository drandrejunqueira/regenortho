import { test, expect } from '@playwright/test'

test.describe('Autenticação e guarda de rotas', () => {
  test('renderiza a tela de login', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByLabel('E-mail')).toBeVisible()
    await expect(page.getByLabel('Senha', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  })

  test('rota protegida sem sessão redireciona para /login', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByLabel('E-mail')).toBeVisible()
  })

  for (const path of ['/leads', '/agenda', '/financeiro', '/configuracoes']) {
    test(`${path} redireciona para /login sem sessão`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
    })
  }

  test('login com credencial errada mostra erro e permanece na tela', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('E-mail').fill('usuario-inexistente@regenortho.com.br')
    await page.getByLabel('Senha', { exact: true }).fill('senha-errada-123')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByText('E-mail ou senha inválidos. Tente novamente.')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('validação client-side bloqueia envio com campos inválidos', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('E-mail').fill('nao-e-email')
    await page.getByLabel('Senha', { exact: true }).fill('123')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByText('E-mail inválido')).toBeVisible()
    await expect(page.getByText('Senha deve ter ao menos 6 caracteres')).toBeVisible()
  })
})
