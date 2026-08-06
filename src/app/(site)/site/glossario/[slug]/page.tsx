import { getTermoBySlugPublicado, getTermosByLetraPublicados } from '@/lib/db/queries/glossario'
import { getConfig, getAllConfigs } from '@/lib/db/queries/configuracoes'
import { GlossarioReader } from '@/components/site/GlossarioReader'
import { GlossarioCta, dividirConteudo } from '@/components/site/GlossarioCta'
import SiteNav from '@/components/site/SiteNav'
import SiteFooter from '@/components/site/SiteFooter'
import InteractiveWhatsAppFab from '@/components/site/InteractiveWhatsAppFab'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ArrowLeft, BookOpen, Star, Sparkles } from 'lucide-react'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { clinicSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getGlossarioTermoJsonLd } from '@/lib/seo/jsonld'
import { sanitizeGlossaryHtml } from '@/lib/sanitizeHtml'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = params
  const termo = await getTermoBySlugPublicado(slug)
  if (!termo) return { title: 'Verbete Não Encontrado — REGENORTHO' }

  return {
    title: termo.seoTitle ?? `${termo.termo} — O que é e Significado | REGENORTHO`,
    description: termo.seoDescription ?? `Saiba o que significa ${termo.termo} no Dicionário Médico REGENORTHO em São José dos Campos.`,
  }
}

export const dynamic = 'force-dynamic'

export default async function VerbetePage({ params }: Props) {
  const { slug } = params
  const termo = await getTermoBySlugPublicado(slug)

  if (!termo) {
    notFound()
  }

  // Buscar verbetes relacionados da mesma letra para linkagem interna (SEO)
  const todosMesmaLetra = await getTermosByLetraPublicados(termo.letra)
  const relacionados = todosMesmaLetra
    .filter(t => t.id !== termo.id)
    .slice(0, 5)

  // Flags de funcionalidade do glossário (liga/desliga no admin)
  const [leituraFlag, adsFlag, configs, clinic] = await Promise.all([
    getConfig('glossario_leitura_ativo'),
    getConfig('glossario_ads_ativo'),
    getAllConfigs(),
    db.query.clinicSettings.findFirst({ where: eq(clinicSettings.id, 1) }),
  ])
  const leituraAtiva = leituraFlag !== 'false'
  const adsAtivo = adsFlag !== 'false'

  const jsonLd = getGlossarioTermoJsonLd(termo, clinic ?? null, configs)

  // Conteúdo: com anúncio injetado no meio (se ativo)
  // Sanitiza aqui além da gravação: o conteúdo já persistido antes desta
  // defesa continua cru no banco.
  const conteudo = sanitizeGlossaryHtml(termo.conteudo)
  const [parteInicial, parteFinal] = adsAtivo ? dividirConteudo(conteudo) : [conteudo, '']

  return (
    <div className="site-skin min-h-screen" style={{ background: '#f5f6f8' }}>
      {/* Schema.org GEO Structured Data para este verbete */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <SiteNav />
      
      <main className="relative z-10 bg-[#f5f6f8] pt-24 pb-20">
        {/* Breadcrumb e Retorno */}
        <section className="px-6 max-w-4xl mx-auto mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#021541]/06 pb-4">
            <nav className="flex items-center gap-1.5 text-xs text-[#718096] font-medium">
              <Link href="/site" className="hover:text-[#00BCE4] transition-colors">Home</Link>
              <ChevronRight className="size-3" />
              <Link href="/site/glossario" className="hover:text-[#00BCE4] transition-colors">Glossário</Link>
              <ChevronRight className="size-3" />
              <span className="text-[#021541] truncate max-w-[200px] font-bold">{termo.termo}</span>
            </nav>
            <Link
              href="/site/glossario"
              className="inline-flex items-center gap-1 text-xs text-[#718096] hover:text-[#00BCE4] transition-colors font-bold self-start"
            >
              <ArrowLeft className="size-3.5" />
              Voltar ao glossário
            </Link>
          </div>
        </section>

        {/* Verbete Corpo Principal */}
        <section className="px-6 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Artigo (Esquerda) */}
            <article className="lg:col-span-8 space-y-6 bg-white border border-[#021541]/06 rounded-2xl p-6 lg:p-8 shadow-sm">
              {/* Header do Verbete */}
              <header className="space-y-3 border-b border-[#021541]/06 pb-5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#00BCE4]/08 border border-[#00BCE4]/15 text-[#00BCE4]">
                  <Sparkles className="size-2.5" />
                  Especialidade: {termo.nicho}
                </span>
                <h1 className="font-sans text-3xl lg:text-4xl font-extrabold text-[#021541] leading-tight uppercase" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {termo.termo}
                </h1>
                <p className="text-xs text-[#718096] font-medium">
                  Publicado no Dicionário de Ortopedia REGENORTHO | Dr. André Elias Junqueira
                </p>

                {/* Modo de leitura ditada (TTS no navegador) */}
                {leituraAtiva && conteudo && (
                  <div className="pt-2">
                    <GlossarioReader titulo={termo.termo} conteudoHtml={conteudo} />
                  </div>
                )}
              </header>

              {/* Conteúdo HTML Gerado (com anúncio injetado no meio, se ativo) */}
              {parteFinal ? (
                <div className="glossario-conteudo text-[#021541] text-sm leading-relaxed space-y-4
                  [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:text-[#021541] [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:border-l-4 [&_h2]:border-[#00BCE4] [&_h2]:pl-3
                  [&_p]:text-[#718096] [&_p]:leading-relaxed [&_p]:mb-4">
                  <div dangerouslySetInnerHTML={{ __html: parteInicial }} />
                  <GlossarioCta termo={termo.termo} />
                  <div dangerouslySetInnerHTML={{ __html: parteFinal }} />
                </div>
              ) : (
                <>
                  <div
                    className="glossario-conteudo text-[#021541] text-sm leading-relaxed space-y-4
                      [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:text-[#021541] [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:border-l-4 [&_h2]:border-[#00BCE4] [&_h2]:pl-3
                      [&_p]:text-[#718096] [&_p]:leading-relaxed [&_p]:mb-4"
                    dangerouslySetInnerHTML={{ __html: parteInicial }}
                  />
                  {adsAtivo && conteudo && <GlossarioCta termo={termo.termo} />}
                </>
              )}
            </article>

            {/* Sidebar Otimização / Internos (Direita) */}
            <aside className="lg:col-span-4 space-y-6">
              {/* Box de Contato/Chamada de Ação */}
              <div className="bg-[#00BCE4]/05 border border-[#00BCE4]/15 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Star className="size-4 text-[#00BCE4] fill-[#00BCE4]" />
                  <h4 className="font-extrabold text-sm text-[#021541]">Agendar Avaliação</h4>
                </div>
                <p className="text-[#718096] text-xs leading-relaxed font-light">
                  Agende sua consulta e faça um mapeamento completo das suas dores nas articulações com exames de imagem e bio-diagnóstico de precisão.
                </p>
                <Link
                  href="/site/lp/articulacoes"
                  className="w-full inline-flex items-center justify-center font-bold text-xs py-3 rounded-xl bg-[#00BCE4] hover:bg-[#009ebd] text-[#021541] transition-all text-center uppercase tracking-wider"
                >
                  Conhecer Tratamentos
                </Link>
              </div>

              {/* Verbetes Relacionados */}
              {relacionados.length > 0 && (
                <div className="bg-white border border-[#021541]/06 rounded-2xl p-5 shadow-sm space-y-4">
                  <h4 className="font-extrabold text-sm text-[#021541] flex items-center gap-1.5">
                    <BookOpen className="size-4 text-[#00BCE4]" />
                    Letra {termo.letra}: Veja também
                  </h4>
                  <ul className="space-y-3">
                    {relacionados.map(r => (
                      <li key={r.id} className="text-xs group border-b border-[#021541]/06 pb-2 last:border-0 last:pb-0">
                        <Link 
                          href={`/site/glossario/${r.slug}`}
                          className="font-semibold text-[#718096] group-hover:text-[#00BCE4] transition-colors flex items-center justify-between"
                        >
                          <span>{r.termo}</span>
                          <span className="text-[10px] bg-[#f5f6f8] border border-[rgba(2,21,65,0.06)] px-1.5 py-0.5 rounded font-mono font-bold group-hover:bg-[#00BCE4]/10 transition-colors uppercase">
                            {r.letra}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </section>
      </main>

      <SiteFooter />
      <InteractiveWhatsAppFab />
    </div>
  )
}
