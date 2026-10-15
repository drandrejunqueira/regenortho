import { test, expect } from '@playwright/test'

const PUBLIC_PAGES = [
  '/site',
  '/site/tratamentos',
  '/site/agendar',
  '/site/glossario',
  '/site/especialidades',
  '/site/a-clinica',
]

test.describe('Site público — acessibilidade básica', () => {
  test.beforeEach(async ({ page }) => {
    // Evita gravar pageviews reais de analytics durante os testes.
    await page.route('**/api/track', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    )
  })

  for (const path of PUBLIC_PAGES) {
    test(`${path} tem exatamente um <h1>`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('h1')).toHaveCount(1)
    })

    test(`${path} — imagens de conteúdo têm atributo alt`, async ({ page }) => {
      await page.goto(path)
      const images = page.locator('img')
      const count = await images.count()
      for (let i = 0; i < count; i++) {
        const alt = await images.nth(i).getAttribute('alt')
        expect(alt, `imagem #${i} em ${path} sem atributo alt`).not.toBeNull()
      }
    })
  }

  test('menu principal é navegável e ativável por teclado', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/site')

    const tratamentosLink = page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: 'Tratamentos', exact: true })
    await tratamentosLink.focus()
    await expect(tratamentosLink).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/site\/tratamentos/)
  })

  // Regressão — ver docs/equipe/ACESSIBILIDADE.md, achado "FORM-01".
  // /site/agendar é o formulário de conversão do site público (paciente
  // idoso agendando avaliação). Os <label> não têm htmlFor/id casado com o
  // <input> correspondente, então leitor de tela não anuncia o rótulo do
  // campo — e getByLabel (o mesmo seletor usado nos fixtures de E2E do
  // sistema interno) não encontra o campo.
  test('/site/agendar — campos do formulário têm label associado (getByLabel)', async ({ page }) => {
    await page.goto('/site/agendar')

    await expect(page.getByLabel('Nome completo', { exact: false })).toBeVisible()
    await expect(page.getByLabel('Telefone / WhatsApp', { exact: false })).toBeVisible()
    await expect(page.getByLabel('E-mail', { exact: false })).toBeVisible()
  })
})
