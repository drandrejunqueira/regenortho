import type { Metadata } from 'next'
import Link from 'next/link'
import SiteNav from '@/components/site/SiteNav'
import SiteFooter from '@/components/site/SiteFooter'

export const metadata: Metadata = {
  title: 'Blog & Hub de Conhecimento — Ortopedia Regenerativa',
  description: 'Artigos científicos, casos clínicos e guias sobre medicina regenerativa, PRP, BMAC e ortopedia. Central de conhecimento do RegenOrtho Clinical Atelier.',
}

const SIDE_ARTICLES = [
  { icon: 'schedule', meta: '10 min de leitura', title: 'Plasma Rico em Plaquetas (PRP) em Atletas de Elite' },
  { icon: 'science', meta: 'Casos Clínicos', title: 'Recuperação acelerada de LCA com Ortopedia Regenerativa' },
  { icon: 'visibility', meta: '2.4k visualizações', title: 'Mitos e Verdades sobre a Artrose no Joelho' },
]

const CATEGORIES = ['Ciência', 'Casos Clínicos', 'Dicas de Saúde', 'Vídeos', 'Guias']

const VIDEOS = [
  { duration: '04:12', title: 'Entenda a Bioestimulação Celular', desc: 'Dr. André explica como o corpo reage aos estímulos regenerativos modernos.' },
  { duration: '08:45', title: 'Procedimentos Guiados por Imagem', desc: 'A precisão milimétrica que garante a eficácia das infiltrações regenerativas.' },
  { duration: '06:30', title: 'A Jornada do Paciente RegenOrtho', desc: 'Conheça cada etapa, da primeira consulta à reabilitação total.' },
]

const GUIDES = [
  { icon: 'description', title: 'Preparação para Consulta', desc: 'Documentos e exames necessários para sua primeira avaliação.' },
  { icon: 'medical_services', title: 'Pós-Procedimento', desc: 'Cuidados imediatos e o que esperar nas primeiras 48 horas.' },
  { icon: 'fitness_center', title: 'Manual de Exercícios', desc: 'Vídeos e tutoriais de mobilidade para realizar em casa.' },
  { icon: 'contact_support', title: 'Perguntas Frequentes', desc: 'Respostas claras para as dúvidas mais comuns dos pacientes.' },
]

export default function BlogPage() {
  return (
    <div className="site-light min-h-screen" style={{ background: '#f7f9fb', fontFamily: 'Manrope, sans-serif', color: '#191c1e' }}>
      <SiteNav />

      {/* Hero */}
      <header className="relative pt-32 pb-20 px-6 md:px-12 overflow-hidden" style={{ background: '#021541' }}>
        <div className="absolute inset-0 opacity-10 dot-pattern-light pointer-events-none" />
        <div className="max-w-screen-xl mx-auto relative z-10 flex flex-col items-center text-center">
          <span className="text-[#58e6ff] text-xs uppercase tracking-[0.3em] mb-4 font-semibold">Central de Conhecimento</span>
          <h1 className="text-white text-5xl md:text-6xl font-bold leading-tight max-w-4xl mb-6" style={{ fontFamily: 'Noto Serif, serif' }}>
            O Futuro da Medicina Regenerativa e Ortopedia
          </h1>
          <p className="text-slate-300 max-w-2xl text-lg font-light leading-relaxed mb-10">
            Exploração científica, atualizações clínicas e guias práticos para a sua recuperação acelerada.
          </p>

          {/* Search */}
          <div className="w-full max-w-2xl mb-8">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: '20px' }}>search</span>
              <input
                type="text"
                placeholder="Buscar artigos, especialidades ou tratamentos..."
                className="w-full bg-white/5 text-white pl-12 pr-4 py-4 placeholder:text-slate-500 focus:outline-none focus:border-[#58e6ff] transition-all"
                style={{ fontFamily: 'Manrope, sans-serif', borderBottom: '1px solid rgba(255,255,255,0.2)' }}
              />
            </div>
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap justify-center gap-3">
            {CATEGORIES.map((cat, i) => (
              <button
                key={cat}
                className="px-6 py-2 rounded-full text-xs font-semibold uppercase tracking-widest site-transition"
                style={i === 0
                  ? { background: '#006876', color: 'white' }
                  : { background: 'rgba(255,255,255,0.08)', color: '#cbd5e1' }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 md:px-12 py-24 space-y-24">

        {/* Artigos Recentes */}
        <section>
          <div className="flex justify-between items-end mb-12">
            <div>
              <span className="text-[#006876] text-xs uppercase tracking-widest font-semibold">Inovação Diária</span>
              <h2 className="text-[#191c1e] text-4xl mt-2 italic font-bold" style={{ fontFamily: 'Noto Serif, serif' }}>Artigos Recentes</h2>
            </div>
            <button className="text-[#006876] text-sm uppercase tracking-widest flex items-center gap-2 hover:gap-4 site-transition font-semibold">
              Ver Todos <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Featured */}
            <article className="md:col-span-8 group relative overflow-hidden cursor-pointer" style={{ background: '#ffffff', borderRadius: '12px', boxShadow: '0px 12px 32px rgba(2,21,65,0.06)' }}>
              <div className="h-80 w-full flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a1929, #1a2b56)' }}>
                <span className="material-symbols-outlined group-hover:scale-110 site-transition" style={{ fontSize: '100px', color: '#006876' }}>biotech</span>
              </div>
              <div className="p-8 space-y-4">
                <div className="flex items-center gap-4 text-xs text-slate-500 uppercase tracking-widest">
                  <span className="px-3 py-1 rounded" style={{ background: 'rgba(88,230,255,0.15)', color: '#006876' }}>Destaque</span>
                  <span>15 de Outubro, 2024</span>
                </div>
                <h3 className="text-3xl text-[#191c1e] group-hover:text-[#006876] site-transition font-bold" style={{ fontFamily: 'Noto Serif, serif' }}>
                  O Futuro das Células-Tronco na Ortopedia: Além da Cirurgia
                </h3>
                <p className="text-[#45464f] line-clamp-2 max-w-2xl font-light">
                  Como as novas terapias biológicas estão redefinindo o tratamento de lesões articulares crônicas sem a necessidade de intervenções invasivas.
                </p>
              </div>
            </article>
            {/* Side articles */}
            <div className="md:col-span-4 flex flex-col gap-6">
              {SIDE_ARTICLES.map((a) => (
                <article key={a.title} className="group cursor-pointer p-6 flex flex-col gap-4 site-transition hover:shadow-md" style={{ background: '#ffffff', borderRadius: '12px', boxShadow: '0px 12px 32px rgba(2,21,65,0.04)' }}>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{a.icon}</span>
                    {a.meta}
                  </div>
                  <h4 className="text-[#191c1e] group-hover:text-[#006876] site-transition font-bold" style={{ fontFamily: 'Noto Serif, serif', fontSize: '18px' }}>
                    {a.title}
                  </h4>
                  <div className="w-full h-0.5 transition-all group-hover:bg-[#006876]/20" style={{ background: '#eceef0' }} />
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Vídeos */}
        <section className="-mx-6 md:-mx-12 px-6 md:px-12 py-24 relative" style={{ background: '#f2f4f6', borderRadius: '24px' }}>
          <div className="absolute top-0 right-0 w-1/3 h-full dot-pattern-light opacity-5 pointer-events-none" />
          <div className="mb-16">
            <span className="text-[#006876] text-xs uppercase tracking-widest font-semibold">Conteúdo em Vídeo</span>
            <h2 className="text-[#191c1e] text-4xl mt-2 italic font-bold" style={{ fontFamily: 'Noto Serif, serif' }}>Vídeos Explicativos</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {VIDEOS.map((v) => (
              <div key={v.title} className="flex flex-col gap-4 group cursor-pointer">
                <div className="aspect-video relative overflow-hidden" style={{ background: '#1a2b56', borderRadius: '12px', boxShadow: '0px 12px 32px rgba(2,21,65,0.06)' }}>
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="material-symbols-outlined" style={{ fontSize: '60px', color: 'rgba(0,104,118,0.6)' }}>play_circle</span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center group-hover:scale-110 site-transition" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)' }}>
                      <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                    </div>
                  </div>
                  <div className="absolute bottom-4 right-4 px-2 py-1 rounded text-white text-[10px] tracking-widest" style={{ background: '#021541' }}>{v.duration}</div>
                </div>
                <div className="px-1">
                  <h5 className="text-[#191c1e] text-lg mb-2 font-bold" style={{ fontFamily: 'Noto Serif, serif' }}>{v.title}</h5>
                  <p className="text-[#45464f] text-sm font-light">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Guia do Paciente */}
        <section>
          <div className="flex flex-col items-center text-center mb-16">
            <span className="text-[#006876] text-xs uppercase tracking-[0.2em] font-semibold">Recursos Úteis</span>
            <h2 className="text-[#191c1e] text-4xl mt-2 italic font-bold" style={{ fontFamily: 'Noto Serif, serif' }}>Guia do Paciente</h2>
            <div className="w-20 h-1 mt-6" style={{ background: 'rgba(0,104,118,0.3)' }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {GUIDES.map((g) => (
              <div key={g.title} className="p-8 flex flex-col justify-between group site-transition hover:border-[#006876]" style={{ background: '#ffffff', borderRadius: '12px', boxShadow: '0px 12px 32px rgba(2,21,65,0.04)', borderBottom: '2px solid transparent' }}>
                <div>
                  <span className="material-symbols-outlined text-[#006876] text-4xl mb-6 block">{g.icon}</span>
                  <h6 className="text-lg mb-2 font-bold" style={{ fontFamily: 'Noto Serif, serif' }}>{g.title}</h6>
                  <p className="text-[#45464f] text-sm font-light">{g.desc}</p>
                </div>
                <a href="#" className="mt-8 text-[10px] uppercase tracking-widest text-[#006876] group-hover:underline font-bold">
                  Acessar Guia
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Newsletter */}
        <section className="relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-12 p-12 md:p-20" style={{ background: '#021541', borderRadius: '24px' }}>
          <div className="absolute inset-0 opacity-10 dot-pattern-light pointer-events-none" />
          <div className="relative z-10 max-w-xl">
            <h2 className="text-white text-4xl leading-tight font-bold" style={{ fontFamily: 'Noto Serif, serif' }}>
              Mantenha-se informado sobre a vanguarda da ortopedia.
            </h2>
            <p className="text-slate-400 mt-4 text-lg">
              Assine nosso informativo e receba atualizações exclusivas do Dr. André e sua equipe.
            </p>
          </div>
          <div className="relative z-10 w-full max-w-md">
            <div className="flex flex-col gap-4">
              <input
                type="email"
                placeholder="Seu melhor e-mail"
                className="w-full bg-white/10 text-white px-0 py-3 focus:outline-none focus:border-[#58e6ff] transition-colors placeholder:text-slate-500"
                style={{ fontFamily: 'Manrope, sans-serif', borderBottom: '1px solid rgba(255,255,255,0.2)' }}
              />
              <button className="w-full py-4 text-white text-sm uppercase tracking-widest font-bold site-transition hover:brightness-110" style={{ background: '#006876', borderRadius: '6px' }}>
                Inscrever-se Agora
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-4 text-center">
              Respeitamos sua privacidade. Cancele a inscrição a qualquer momento.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
