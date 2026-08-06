import { test, expect } from '@playwright/test'
import { loginAsTestUser, hasE2ECredentials } from './fixtures/auth'
import { horizontalOverflow } from './fixtures/no-horizontal-overflow'

// habilitar quando E2E_DATABASE_URL / E2E_USER_EMAIL / E2E_USER_PASSWORD existirem
// (banco de teste dedicado — Neon branch a ser provisionado pelo Daniel).
test.skip(!hasE2ECredentials, 'Requer usuário de teste — ver tests/e2e/fixtures/auth.ts')

const DASHBOARD_PAGES = ['/dashboard', '/leads', '/agenda', '/pacientes', '/financeiro', '/materiais']

const VIEWPORTS = [
  { width: 320, height: 720, label: '320' },
  { width: 768, height: 1024, label: '768' },
  { width: 1024, height: 900, label: '1024' },
  { width: 1440, height: 900, label: '1440' },
]

test.describe('Responsividade do dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  for (const path of DASHBOARD_PAGES) {
    for (const vp of VIEWPORTS) {
      test(`${path} sem overflow horizontal em ${vp.label}px`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.goto(path)
        await page.waitForLoadState('networkidle')

        const overflow = await horizontalOverflow(page)
        expect(overflow, `overflow horizontal de ${overflow}px em ${path} @ ${vp.label}px`).toBeLessThanOrEqual(1)
      })
    }
  }
})
