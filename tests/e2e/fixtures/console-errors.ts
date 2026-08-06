import type { Page } from '@playwright/test'

/**
 * Anexa um coletor de erros de console/página a partir de agora.
 * Chame `.errors` depois da navegação para conferir o que apareceu.
 */
export function collectConsoleErrors(page: Page) {
  const errors: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => {
    errors.push(err.message)
  })

  return { errors }
}
