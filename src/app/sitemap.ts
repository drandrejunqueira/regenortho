import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { glossarioTermos } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getConfig } from '@/lib/db/queries/configuracoes'

export const revalidate = 3600 // regenera a cada 1 hora

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [siteUrl, frequencia, prioridade, includeBlog] = await Promise.all([
    getConfig('site_url'),
    getConfig('sitemap_frequencia'),
    getConfig('sitemap_prioridade'),
    getConfig('sitemap_include_blog'),
  ])

  const base = (siteUrl ?? 'https://regenortho.com.br').replace(/\/$/, '')
  const freq = (frequencia ?? 'weekly') as MetadataRoute.Sitemap[0]['changeFrequency']
  const prio = parseFloat(prioridade ?? '0.8')
  const agora = new Date()

  // ── Páginas estáticas do REGENORTHO ──
  const estaticas: MetadataRoute.Sitemap = [
    { url: `${base}/site`,                 lastModified: agora, changeFrequency: 'daily',   priority: 1.0  },
    { url: `${base}/site/a-clinica`,       lastModified: agora, changeFrequency: 'monthly', priority: 0.8  },
    { url: `${base}/site/especialidades`,  lastModified: agora, changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${base}/site/tratamentos`,     lastModified: agora, changeFrequency: 'weekly',  priority: 0.9  },
    { url: `${base}/site/blog`,            lastModified: agora, changeFrequency: 'daily',   priority: 0.85 },
    { url: `${base}/site/agendar`,         lastModified: agora, changeFrequency: 'monthly', priority: 0.7  },
    { url: `${base}/site/lp/articulacoes`, lastModified: agora, changeFrequency: 'daily',   priority: 0.95 },
    { url: `${base}/site/lp/prp`,               lastModified: agora, changeFrequency: 'daily',   priority: 0.90 },
    { url: `${base}/site/lp/bmac`,              lastModified: agora, changeFrequency: 'daily',   priority: 0.90 },
    { url: `${base}/site/lp/acido-hialuronico`, lastModified: agora, changeFrequency: 'daily',   priority: 0.90 },
    { url: `${base}/site/lp/proloterapia`,      lastModified: agora, changeFrequency: 'daily',   priority: 0.90 },
    { url: `${base}/site/lp/bloqueios`,         lastModified: agora, changeFrequency: 'daily',   priority: 0.90 },
  ]

  // ── Glossário (verbetes publicados) ──
  let glossarioUrls: MetadataRoute.Sitemap = []
  try {
    const lista = await db
      .select({ slug: glossarioTermos.slug, updatedAt: glossarioTermos.updatedAt })
      .from(glossarioTermos)
      .where(eq(glossarioTermos.status, 'publicado'))

    glossarioUrls = [
      { url: `${base}/site/glossario`, lastModified: agora, changeFrequency: 'daily', priority: 0.8 },
      ...lista.map(g => ({
        url: `${base}/site/glossario/${g.slug}`,
        lastModified: g.updatedAt,
        changeFrequency: freq,
        priority: prio,
      }))
    ]
  } catch {
    // silencia erro para não quebrar o sitemap se o DB estiver indisponível
  }

  return [...estaticas, ...glossarioUrls]
}
