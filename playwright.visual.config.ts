import { defineConfig } from '@playwright/test'

/**
 * Configuração dedicada à galeria de telas (tests/visual/).
 * Separada da suíte E2E porque aqui o objetivo não é assertar — é capturar
 * material para os agentes de UI auditarem.
 */
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './tests/visual',
  // Um worker: a captura é sequencial por viewport e o dev server local não
  // aguenta 7 contextos disputando compilação sob demanda.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  timeout: 15 * 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    screenshot: 'off',
    video: 'off',
    trace: 'off',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
      },
})
