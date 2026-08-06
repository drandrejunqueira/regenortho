import type { Page } from '@playwright/test'

/**
 * Retorna o quanto o layout ultrapassa a largura da viewport (em px).
 * 0 (ou negativo) significa que não há overflow horizontal.
 */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth
    const viewportWidth = window.innerWidth
    return docWidth - viewportWidth
  })
}
