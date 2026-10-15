import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { VIEWPORTS } from './viewports'
import { ROUTES, slug, type Route } from './routes'

/**
 * Captura a galeria de telas: cada rota em cada viewport.
 * Não é teste de regressão visual — é matéria-prima para os agentes de UI
 * (Codex) auditarem qualidade e responsividade.
 *
 *   npm run screens          # tudo (precisa de E2E_USER_EMAIL/PASSWORD)
 *   npm run screens:public   # só as rotas públicas
 */

const GALLERY = path.join(process.cwd(), 'tests/visual/gallery')
const ONLY_PUBLIC = process.env.SCREENS_SCOPE === 'public'
const EMAIL = process.env.E2E_USER_EMAIL ?? ''
const PASSWORD = process.env.E2E_USER_PASSWORD ?? ''
const HAS_CREDS = Boolean(EMAIL && PASSWORD)

interface Shot {
  route: string
  label: string
  area: string
  viewport: string
  width: number
  height: number
  file: string
  overflowPx: number
  consoleErrors: string[]
}

const shots: Shot[] = []

fs.mkdirSync(GALLERY, { recursive: true })

/** Largura que estoura para fora da viewport, em px. 0 = ok. */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement
    return Math.max(0, doc.scrollWidth - doc.clientWidth)
  })
}

async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(EMAIL)
  await page.getByLabel('Senha', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 })
}

const targets: Route[] = ONLY_PUBLIC ? ROUTES.filter((r) => !r.auth) : ROUTES

test.describe('Galeria de telas', () => {
  for (const vp of VIEWPORTS) {
    test.describe(vp.label, () => {
      const routes = targets.filter((r) => (r.auth ? HAS_CREDS : true))

      test(`captura ${vp.label} (${routes.length} rotas)`, async ({ browser }) => {
        test.slow()
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          isMobile: vp.mobile,
          hasTouch: vp.mobile,
          deviceScaleFactor: vp.mobile ? 2 : 1,
          locale: 'pt-BR',
          timezoneId: 'America/Sao_Paulo',
        })
        const page = await context.newPage()

        const errors: string[] = []
        page.on('console', (msg) => {
          if (msg.type() === 'error') errors.push(msg.text().slice(0, 200))
        })

        let loggedIn = false

        for (const route of routes) {
          if (route.auth && !loggedIn) {
            await login(page)
            loggedIn = true
          }

          errors.length = 0
          const file = `${slug(route.path)}__${vp.label}.png`

          try {
            await page.goto(route.path, { waitUntil: 'networkidle', timeout: 30_000 })
          } catch {
            // networkidle pode não chegar em página com polling — segue com o que carregou
            await page.waitForLoadState('domcontentloaded')
          }
          // deixa animação de entrada (GSAP/anime) assentar antes do clique do obturador
          await page.waitForTimeout(600)

          const overflowPx = await horizontalOverflow(page)
          await page.screenshot({ path: path.join(GALLERY, file), fullPage: true })

          shots.push({
            route: route.path,
            label: route.label,
            area: route.area,
            viewport: vp.label,
            width: vp.width,
            height: vp.height,
            file,
            overflowPx,
            consoleErrors: [...errors],
          })
        }

        await context.close()
        expect(shots.length).toBeGreaterThan(0)
      })
    })
  }

  test.afterAll(() => {
    const manifestPath = path.join(GALLERY, 'manifest.json')
    // Cada projeto/worker do Playwright roda em processo próprio: mescla em vez
    // de sobrescrever, senão a última rodada apaga as capturas das outras.
    let previous: Shot[] = []
    if (fs.existsSync(manifestPath)) {
      try {
        previous = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).shots ?? []
      } catch {
        previous = []
      }
    }
    const byKey = new Map<string, Shot>()
    for (const s of [...previous, ...shots]) byKey.set(s.file, s)

    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          scope: ONLY_PUBLIC ? 'public' : 'full',
          authenticated: HAS_CREDS,
          viewports: VIEWPORTS,
          shots: [...byKey.values()].sort(
            (a, b) => a.route.localeCompare(b.route) || a.width - b.width,
          ),
        },
        null,
        2,
      ),
    )
  })
})
