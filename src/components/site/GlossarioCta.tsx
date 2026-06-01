import Link from 'next/link'
import { Stethoscope, ArrowRight, MessageSquare } from 'lucide-react'

/**
 * Bloco de anúncio/CTA inserido dentro do conteúdo do glossário.
 * Direciona o paciente para a avaliação clínica de dor ou WhatsApp.
 */
export function GlossarioCta({ termo }: { termo: string }) {
  return (
    <aside
      className="my-10 rounded-2xl border border-[#00BCE4]/20 bg-gradient-to-br from-[#021541]/03 to-[#00BCE4]/03 p-6 sm:p-8 shadow-sm not-prose"
      aria-label="Agendamento REGENORTHO"
    >
      <div className="flex items-start gap-4">
        <span className="flex items-center justify-center size-12 rounded-2xl bg-[#00BCE4]/10 text-[#00BCE4] shrink-0">
          <Stethoscope className="size-6" />
        </span>
        <div className="flex-1 space-y-3">
          <h3 className="font-extrabold text-[#021541] text-lg sm:text-xl leading-tight">
            Sofrendo com dores constantes nas articulações?
          </h3>
          <p className="text-[#718096] text-sm leading-relaxed font-light">
            Não mascare a dor com anti-inflamatórios temporários. O Dr. André Elias Junqueira oferece tratamentos regenerativos personalizados (PRP, BMAC, viscossuplementação) focados na raiz do seu desgaste articular.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/site/lp/articulacoes"
              data-track={`glossario-cta:lp:${termo}`}
              className="inline-flex items-center gap-1.5 bg-[#00BCE4] hover:bg-[#009ebd] text-[#021541] font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-all shadow-sm"
            >
              <Stethoscope className="size-4" />
              Agendar Avaliação
            </Link>
            <a
              href="https://wa.me/5512981767896?text=Olá%2C+estava+lendo+no+glossário+sobre+dor+articular+e+gostaria+de+falar+com+um+especialista."
              target="_blank"
              rel="noopener noreferrer"
              data-track={`glossario-cta:whatsapp:${termo}`}
              className="inline-flex items-center gap-1.5 bg-white border border-[#021541]/10 hover:border-[#00BCE4] text-[#021541] font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-colors"
            >
              Falar no WhatsApp
              <MessageSquare className="size-4 text-[#00BCE4]" />
            </a>
          </div>
        </div>
      </div>
    </aside>
  )
}

/**
 * Divide o HTML do verbete em duas partes para encaixar a CTA no meio,
 * preferindo cortar antes de um <h2> próximo do meio do texto.
 */
export function dividirConteudo(html: string): [string, string] {
  if (!html) return ['', '']
  const indices: number[] = []
  const regex = /<h2[\s>]/gi
  let m: RegExpExecArray | null
  while ((m = regex.exec(html)) !== null) indices.push(m.index)

  // Sem h2 suficientes para dividir → não insere no meio
  if (indices.length < 2) return [html, '']

  const meio = html.length / 2
  // Escolhe o <h2> mais próximo do meio (a partir do 2º)
  let corte = indices[1]
  for (const idx of indices.slice(1)) {
    if (Math.abs(idx - meio) < Math.abs(corte - meio)) corte = idx
  }
  return [html.slice(0, corte), html.slice(corte)]
}
