import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

const AUTH_STATE = path.join(process.cwd(), 'playwright/.auth/user.json')

// Aponta para um ambiente já rodando quando E2E_BASE_URL existe (preview da
// Vercel); senão sobe o dev server local.
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Falha o CI se alguém esquecer um test.only no branch.
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  projects: [
    // Loga uma vez e salva a sessão em playwright/.auth/user.json.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },

    // Specs que exigem sessão: herdam o storageState do setup. Sem isto cada
    // teste refazia o login pela UI e o dev server (compilação sob demanda)
    // estourava o timeout sob paralelismo.
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: [/auth\.spec\.ts/, /public-site\.spec\.ts/, /accessibility\.spec\.ts/, /auth\.setup\.ts/],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_STATE },
    },
    {
      name: 'mobile',
      dependencies: ['setup'],
      testIgnore: [/auth\.spec\.ts/, /public-site\.spec\.ts/, /accessibility\.spec\.ts/, /auth\.setup\.ts/],
      use: { ...devices['Pixel 7'], storageState: AUTH_STATE },
    },

    // Specs públicas e o próprio fluxo de login: precisam começar deslogadas.
    {
      name: 'chromium-publico',
      testMatch: [/auth\.spec\.ts/, /public-site\.spec\.ts/, /accessibility\.spec\.ts/],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-publico',
      testMatch: [/auth\.spec\.ts/, /public-site\.spec\.ts/, /accessibility\.spec\.ts/],
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
