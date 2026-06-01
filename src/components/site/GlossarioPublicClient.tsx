'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, BookOpen, ArrowRight, CornerDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Termo {
  id: string
  termo: string
  slug: string
  letra: string
  nicho: string
  conteudo: string | null
  status: string
  seoTitle: string | null
  seoDescription: string | null
  createdAt: Date
  updatedAt: Date
}

interface Props {
  termos: Termo[]
}

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export function GlossarioPublicClient({ termos }: Props) {
  const [busca, setBusca] = useState('')
  const [letraAtiva, setLetraAtiva] = useState<string | null>(null)

  // Rastreia palavras-chave buscadas no site (debounce, via tracker global)
  useEffect(() => {
    const termo = busca.trim()
    if (termo.length < 3) return
    const id = setTimeout(() => {
      if (typeof (window as any).twixTrack === 'function') {
        (window as any).twixTrack('search', termo.toLowerCase())
      }
    }, 1200)
    return () => clearTimeout(id)
  }, [busca])

  // Filtrar termos publicados
  const termosPublicados = termos.filter(t => t.status === 'publicado')

  // Aplicar filtros de busca e letra
  const termosFiltrados = termosPublicados.filter(t => {
    const matchesBusca =
      busca.trim() === '' ||
      t.termo.toLowerCase().includes(busca.toLowerCase()) ||
      t.nicho.toLowerCase().includes(busca.toLowerCase()) ||
      (t.conteudo && t.conteudo.toLowerCase().includes(busca.toLowerCase()))

    const matchesLetra = letraAtiva === null || t.letra === letraAtiva

    return matchesBusca && matchesLetra
  })

  // Agrupar termos filtrados por letra inicial para exibição organizada
  const termosAgrupados = termosFiltrados.reduce((acc, t) => {
    if (!acc[t.letra]) acc[t.letra] = []
    acc[t.letra].push(t)
    return acc
  }, {} as Record<string, Termo[]>)

  const letrasDisponiveis = Array.from(new Set(termosPublicados.map(t => t.letra)))

  return (
    <div className="space-y-12">
      {/* Barra de Busca e Letras */}
      <div className="bg-white border border-[#021541]/06 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-[#718096]" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.06)] rounded-xl pl-11 pr-4 py-3 text-[#021541] placeholder:text-[#718096]/60 text-base focus:outline-none focus:border-[#00BCE4] transition-colors"
              placeholder="Pesquisar termo, significado ou palavra-chave em ortopedia..."
            />
          </div>
          {letraAtiva !== null && (
            <button
              onClick={() => setLetraAtiva(null)}
              className="text-xs font-semibold px-4 py-2.5 rounded-xl border border-[#021541]/10 hover:border-[#00BCE4] text-[#021541] hover:text-[#00BCE4] transition-colors shrink-0"
            >
              Mostrar todas as letras
            </button>
          )}
        </div>

        {/* Linha do Alfabeto */}
        <div className="border-t border-[#021541]/06 pt-5">
          <p className="text-xs font-bold text-[#718096] uppercase tracking-wider mb-3">Navegue por letra</p>
          <div className="flex flex-wrap gap-1.5">
            {ALFABETO.map(l => {
              const temTermos = letrasDisponiveis.includes(l)
              return (
                <button
                  key={l}
                  type="button"
                  disabled={!temTermos}
                  onClick={() => setLetraAtiva(letraAtiva === l ? null : l)}
                  className={cn(
                    'size-9 rounded-lg text-sm font-bold flex items-center justify-center transition-all duration-150',
                    letraAtiva === l
                      ? 'bg-[#00BCE4] text-[#021541] font-black scale-105 shadow-md shadow-[#00BCE4]/25'
                      : temTermos
                      ? 'bg-[#f5f6f8] border border-[rgba(2,21,65,0.06)] text-[#021541] hover:border-[#00BCE4] hover:text-[#00BCE4] cursor-pointer'
                      : 'border-transparent text-[#718096]/40 cursor-not-allowed opacity-40'
                  )}
                >
                  {l}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Grid de Verbetes */}
      {termosFiltrados.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-[#021541]/10 text-[#718096]">
          <BookOpen className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-base font-semibold">Nenhum termo publicado encontrado.</p>
          <p className="text-sm text-[#718096]/80 mt-1">Tente ajustar seus filtros ou termos de pesquisa.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {Object.keys(termosAgrupados)
            .sort()
            .map(letra => (
              <div key={letra} className="space-y-5">
                {/* Cabeçalho da Letra */}
                <div className="flex items-center gap-4 border-b border-[#021541]/06 pb-2">
                  <span className="flex items-center justify-center size-10 rounded-xl bg-[#00BCE4]/08 border border-[#00BCE4]/15 text-[#00BCE4] font-black font-mono text-xl shadow-sm">
                    {letra}
                  </span>
                  <span className="h-[1px] flex-1 bg-gradient-to-r from-[#021541]/06 to-transparent" />
                </div>

                {/* Grid de termos desta letra */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {termosAgrupados[letra].map(t => {
                    const textoLimpo = (t.conteudo ?? '')
                      .replace(/<[^>]*>/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim()
                    const resumo = textoLimpo.length > 130 
                      ? textoLimpo.substring(0, 130).trim() + '...' 
                      : textoLimpo

                    return (
                      <Link
                        key={t.id}
                        href={`/site/glossario/${t.slug}`}
                        className="group bg-white border border-[#021541]/06 rounded-xl p-5 hover:border-[#00BCE4] hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-baseline gap-2">
                            <CornerDownRight className="size-3 text-[#00BCE4]/60 group-hover:translate-x-0.5 transition-transform" />
                            <h3 className="text-[#021541] font-extrabold text-base group-hover:text-[#00BCE4] transition-colors leading-tight">
                              {t.termo}
                            </h3>
                          </div>
                          <p className="text-[#718096] text-[10px] font-bold uppercase tracking-wider mt-1 opacity-80">
                            {t.nicho}
                          </p>
                          {resumo && (
                            <p className="text-[#718096] text-xs leading-relaxed mt-3 group-hover:text-[#021541] transition-colors">
                              {resumo}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#00BCE4] mt-4 group-hover:translate-x-1 transition-transform self-end">
                          Significado completo
                          <ArrowRight className="size-3" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
