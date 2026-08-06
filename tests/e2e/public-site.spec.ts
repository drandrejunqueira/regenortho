import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from './fixtures/console-errors'
import { horizontalOverflow } from './fixtures/no-horizontal-overflow'

const PUBLIC_PAGES = [
  { path: '/site', name: 'Home' },
  { path: '/site/tratamentos', name: 'Tratamentos' },
  { path: '/site/agendar', name: 'Agendar' },
  { path: '/site/glossario', name: 'Glossário' },
  { path: '/site/especialidades', name: 'Especialidades' },
  { path: '/site/a-clinica', name: 'A Clínica' },
]

const VIEWPORTS = [
  { width: 320, height: 720, label: '320' },
  { width: 768, height: 1024, label: '768' },
  { width: 1024, height: 900, label: '1024' },
  { width: 1440, height: 900, label: '1440' },
]

test.describe('Site público', () => {
  test.beforeEach(async ({ page }) => {
    // O PageTracker dispara sendBeacon/fetch para /api/track em toda navegação,
    // gravando eventos reais de analytics no banco de produção — intercepta e
    // nunca deixa a chamada chegar à rede.
    await page.route('**/api/track', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    )
  })

  for (const { path, name } of PUBLIC_PAGES) {
    test(`${name} (${path}) carrega com h1 e sem erro de console`, async ({ page }) => {
      const { errors } = collectConsoleErrors(page)

      const response = await page.goto(path)
      expect(response?.ok()).toBeTruthy()

      await expect(page.locator('h1').first()).toBeVisible()
      expect(errors, `erros de console em ${path}: ${errors.join('; ')}`).toEqual([])
    })

    for (const vp of VIEWPORTS) {
      test(`${name} (${path}) sem overflow horizontal em ${vp.label}px`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.goto(path)
        await expect(page.locator('h1').first()).toBeVisible()

        const overflow = await horizontalOverflow(page)
        expect(overflow, `overflow horizontal de ${overflow}px em ${path} @ ${vp.label}px`).toBeLessThanOrEqual(1)
      })
    }
  }
})
