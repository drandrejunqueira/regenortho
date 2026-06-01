'use client'

import { useEffect, useRef, useState } from 'react'
import { Volume2, Pause, Play, Square, Loader2 } from 'lucide-react'

interface Props {
  /** Título do verbete (lido primeiro) */
  titulo: string
  /** HTML do conteúdo — será limpo para texto puro */
  conteudoHtml: string
}

function htmlParaTexto(html: string): string {
  return html
    .replace(/<\/(h2|p|li|div)>/gi, '. ')   // pausa entre blocos
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .replace(/\.\s*\./g, '.')
    .trim()
}

export function GlossarioReader({ titulo, conteudoHtml }: Props) {
  const [suportado, setSuportado] = useState(true)
  const [estado, setEstado] = useState<'parado' | 'lendo' | 'pausado'>('parado')
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSuportado(false)
    }
    // Garante que a fala pare ao sair da página
    return () => {
      try { window.speechSynthesis?.cancel() } catch { /* noop */ }
    }
  }, [])

  const escolherVozPtBr = (): SpeechSynthesisVoice | null => {
    const vozes = window.speechSynthesis.getVoices()
    return (
      vozes.find(v => /pt[-_]?BR/i.test(v.lang)) ??
      vozes.find(v => /^pt/i.test(v.lang)) ??
      null
    )
  }

  const iniciar = () => {
    const synth = window.speechSynthesis
    synth.cancel()

    const texto = `${titulo}. ${htmlParaTexto(conteudoHtml)}`
    const u = new SpeechSynthesisUtterance(texto)
    u.lang = 'pt-BR'
    u.rate = 1
    u.pitch = 1
    const voz = escolherVozPtBr()
    if (voz) u.voice = voz

    u.onend = () => setEstado('parado')
    u.onerror = () => setEstado('parado')
    utterRef.current = u

    synth.speak(u)
    setEstado('lendo')

    // Em alguns navegadores as vozes carregam de forma assíncrona
    if (synth.getVoices().length === 0) {
      synth.onvoiceschanged = () => {
        const v = escolherVozPtBr()
        if (v && utterRef.current) utterRef.current.voice = v
      }
    }

    if (typeof (window as any).twixTrack === 'function') {
      (window as any).twixTrack('click', `glossario:ouvir:${titulo}`.slice(0, 120))
    }
  }

  const pausar = () => { window.speechSynthesis.pause(); setEstado('pausado') }
  const retomar = () => { window.speechSynthesis.resume(); setEstado('lendo') }
  const parar = () => { window.speechSynthesis.cancel(); setEstado('parado') }

  if (!suportado) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {estado === 'parado' && (
        <button
          onClick={iniciar}
          className="inline-flex items-center gap-2 bg-[#00BCE4] hover:bg-[#009ebd] text-[#021541] font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-all shadow-md"
        >
          <Volume2 className="size-4" />
          Ouvir este verbete
        </button>
      )}

      {estado === 'lendo' && (
        <>
          <button
            onClick={pausar}
            className="inline-flex items-center gap-2 bg-white border border-[#021541]/10 hover:border-[#00BCE4] text-[#021541] font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-colors"
          >
            <Pause className="size-4" /> Pausar
          </button>
          <button
            onClick={parar}
            className="inline-flex items-center gap-2 text-[#718096] hover:text-red-500 font-bold text-xs uppercase tracking-wider px-3 py-3 rounded-xl transition-colors"
          >
            <Square className="size-4" /> Parar
          </button>
          <span className="inline-flex items-center gap-1.5 text-xs text-[#00BCE4] font-semibold">
            <Loader2 className="size-3.5 animate-spin" /> Lendo...
          </span>
        </>
      )}

      {estado === 'pausado' && (
        <>
          <button
            onClick={retomar}
            className="inline-flex items-center gap-2 bg-[#00BCE4] hover:bg-[#009ebd] text-[#021541] font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-colors"
          >
            <Play className="size-4" /> Continuar
          </button>
          <button
            onClick={parar}
            className="inline-flex items-center gap-2 text-[#718096] hover:text-red-500 font-bold text-xs uppercase tracking-wider px-3 py-3 rounded-xl transition-colors"
          >
            <Square className="size-4" /> Parar
          </button>
        </>
      )}
    </div>
  )
}
