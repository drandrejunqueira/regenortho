import type { MetadataRoute } from 'next'
import { getConfig } from '@/lib/db/queries/configuracoes'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const [siteUrl, allowAi] = await Promise.all([
    getConfig('site_url'),
    getConfig('geo_allow_ai_crawlers'),
  ])

  const base = (siteUrl ?? 'https://regenortho.com.br').replace(/\/$/, '')
  const allowAiCrawling = allowAi !== 'false' // default to true

  const rules: MetadataRoute.Robots['rules'] = []

  if (!allowAiCrawling) {
    // Common AI crawler user-agents to block
    const aiAgents = [
      'GPTBot',
      'ChatGPT-User',
      'Claude-Web',
      'ClaudeBot',
      'PerplexityBot',
      'Google-Extended',
      'Applebot-Extended',
      'Omgilibot',
      'ByteSpider',
      'diffbot',
      'cohere-ai',
    ]

    aiAgents.forEach((agent) => {
      rules.push({
        userAgent: agent,
        disallow: '/',
      })
    })
  }

  // General rule for standard search engines (and AI engines if not disabled)
  rules.push({
    userAgent: '*',
    allow: '/',
    disallow: ['/api/', '/admin/', '/login/'],
  })

  return {
    rules,
    sitemap: `${base}/sitemap.xml`,
  }
}
