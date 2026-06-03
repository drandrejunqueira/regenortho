import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import SiteNav from '@/components/site/SiteNav'
import SiteFooter from '@/components/site/SiteFooter'
import { GSAPAnimations } from '@/components/site/GSAPAnimations'
import { AnimatedCell } from '@/components/site/AnimatedCell'
import FlowArt, { FlowSection } from '@/components/ui/story-scroll'
import { HeroSection } from '@/components/ui/glass-video-hero'
import InteractiveWhatsAppFab from '@/components/site/InteractiveWhatsAppFab'

export const metadata: Metadata = {
  title: 'REGENORTHO — Ortopedia Regenerativa e Tratamento da Dor',
  description:
    'Tecnologia de ponta em medicina regenerativa para restaurar sua biologia e eliminar a dor sem cirurgias invasivas. Dr. André Elias Junqueira — São José dos Campos.',
}

const TREATMENTS_CARDS = [
  {
    icon: 'water_drop',
    tag: 'Regeneração Plasmática',
    title: 'PRP — Plasma Rico em Plaquetas',
    desc: 'Concentração de fatores de crescimento autólogos para reparação tecidual acelerada, indicado em artrose, tendinites e bursites.',
  },
  {
    icon: 'biotech',
    tag: 'Células-Tronco',
    title: 'BMAC — Células Mesenquimais',
    desc: 'Terapia avançada com células progenitoras da medula óssea do próprio paciente para artrose moderada a grave.',
  },
  {
    icon: 'hub',
    tag: 'Viscossuplementação',
    title: 'Ácido Hialurônico',
    desc: 'Infiltração intra-articular de ácido hialurônico de alto peso molecular para lubrificação e proteção da cartilagem.',
  },
]

const SPECIALTIES = [
  { emoji: '🦵', label: 'Joelho', image: '/image/knee.png' },
  { emoji: '💪', label: 'Ombro & Cotovelo', image: '/image/shoulder.png' },
  { emoji: '🦴', label: 'Coluna', image: '/image/spine.png' },
  { emoji: '🚶', label: 'Quadril', image: '/image/hip.png' },
  { emoji: '🦶', label: 'Pé & Tornozelo', image: '/image/foot.png' },
  { emoji: '✋', label: 'Dor Crônica', image: '/image/pain.png' },
]

const TESTIMONIALS = [
  {
    quote: '"O tratamento regenerativo foi a única coisa que resolveu meu problema crônico de joelho sem me levar à mesa de cirurgia."',
    name: 'Carlos M.',
    role: 'Atleta Amador',
    featured: false,
  },
  {
    quote: '"Instalações modernas e um atendimento que realmente se importa com o paciente. Resultados impressionantes com o PRP."',
    name: 'Helena S.',
    role: 'Empresária',
    featured: true,
  },
  {
    quote: '"Voltei a ter qualidade de vida. Dr. André explicou cada passo da viscossuplementação com total transparência."',
    name: 'Ricardo F.',
    role: 'Aposentado',
    featured: false,
  },
]

const CREDENTIALS = [
  'Residência em Ortopedia e Traumatologia — EPM-UNIFESP',
  'Especialização em Cirurgia do Ombro e Cotovelo — EPM-UNIFESP',
  'Pós-graduação em Procedimentos Minimamente Invasivos (USG) — IOT-FMUSP',
  'Membro da SBOT, AAOS (EUA), SBRET, SBED e SOBRAMID',
]

const STATS = [
  { value: '500+', label: 'Pacientes Atendidos' },
  { value: '5.0★', label: 'Avaliação Google' },
  { value: 'SJC', label: 'Jardim Aquarius' },
  { value: '10+', label: 'Anos em Ortopedia' },
]

export default function HomePage() {
  return (
    <div className="site-skin min-h-screen" style={{ background: '#f5f6f8' }}>
      <GSAPAnimations />
      <SiteNav />

      <main className="relative z-10 bg-[#f5f6f8]">

      <HeroSection />

      {/* ══════════════════════════════════════════════════════
          STATS BAR — Navy sólido com números de impacto
      ══════════════════════════════════════════════════════ */}
      <section className="py-14 relative overflow-hidden" style={{ background: '#021541' }}>
        {/* Aurora sutil no fundo */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 50% 100%, rgba(0,188,228,0.12) 0%, transparent 60%)',
        }} />
        <div className="max-w-screen-2xl mx-auto px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 perspective-wrap gsap-stagger-parent">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col items-center text-center stat-card-3d gsap-stagger-child">
                <span
                  className="stat-value text-4xl md:text-5xl text-white"
                  style={{ fontFamily: 'Noto Serif, serif' }}
                >
                  {s.value}
                </span>
                <div className="w-8 h-px bg-[#00BCE4] my-2.5 gsap-line-draw" />
                <span
                  className="text-[10px] uppercase tracking-widest font-semibold text-white/40"
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          TRATAMENTOS — Cards brancos com efeito 3D hover
      ══════════════════════════════════════════════════════ */}
      <section
        id="tratamentos"
        className="py-32 relative overflow-hidden"
        style={{ background: '#ffffff' }}
      >
        <div className="absolute inset-0 dot-pattern-light opacity-40 pointer-events-none" />

        <div className="max-w-screen-2xl mx-auto px-8 md:px-12 relative">
          {/* Título da seção */}
          <div className="mb-20 max-w-2xl gsap-reveal-3d">
            <span
              className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase block mb-4 font-bold"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              — Inovações Terapêuticas
            </span>
            <h2
              className="text-5xl md:text-6xl text-[#021541] leading-tight font-bold"
              style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
            >
              Medicina de precisão{' '}
              <span className="italic text-[#00BCE4] font-medium block">para sua biologia</span>
            </h2>
            <div className="h-0.5 w-20 bg-[#00BCE4] mt-6 gsap-line-draw" />
          </div>

          {/* Cards de tratamento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 perspective-wrap gsap-stagger-parent">
            {TREATMENTS_CARDS.map((card) => (
              <div
                key={card.title}
                className="treatment-card card-kinetic card-3d-hover rounded-2xl p-10 group gsap-stagger-child"
              >
                {/* Ícone */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-7"
                  style={{ background: 'rgba(0,188,228,0.08)', border: '1px solid rgba(0,188,228,0.15)' }}
                >
                  <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '24px' }}>
                    {card.icon}
                  </span>
                </div>

                <span
                  className="text-[#00BCE4] text-[10px] uppercase tracking-widest mb-4 block font-bold"
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  {card.tag}
                </span>
                <h3
                  className="text-[#021541] text-2xl mb-4 font-bold leading-snug"
                  style={{ fontFamily: 'Noto Serif, serif' }}
                >
                  {card.title}
                </h3>
                <p className="text-[#718096] text-sm font-light mb-8 leading-relaxed">
                  {card.desc}
                </p>
                <Link
                  href="/site/tratamentos"
                  className="text-[#021541] font-bold text-[11px] uppercase tracking-widest flex items-center gap-2 hover:gap-4 site-transition group-hover:text-[#00BCE4]"
                >
                  Detalhes do Protocolo
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                    arrow_forward
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Spacer / Watermark para a próxima seção */}
      <div className="relative h-32 flex items-center justify-center overflow-hidden bg-white">
          <span className="site-watermark opacity-[0.015]" style={{ fontSize: '15vw' }}>JORNADA</span>
      </div>


      {/* ══════════════════════════════════════════════════════
          JORNADA DO PACIENTE — Passo a Passo (FlowArt)
      ══════════════════════════════════════════════════════ */}
      <FlowArt aria-label="Sua Jornada na REGENORTHO">
        <FlowSection aria-label="Passo 1 — Agendamento" style={{ backgroundColor: '#021541', color: '#fff' }}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00BCE4]">01 — Agendamento & Triagem</p>
          <hr className="my-[2vw] border-none border-t border-white/10" />
          <div>
            <h2 className="text-[clamp(3.5rem,8vw,10rem)] font-bold leading-[0.85] uppercase tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Primeiro
              <br />
              <span className="text-[#00BCE4]">Passo.</span>
            </h2>
          </div>
          <hr className="my-[2vw] border-none border-t border-white/10" />
          <p className="mt-auto max-w-[50ch] text-[clamp(1rem,2.5vw,1.75rem)] font-light leading-relaxed">
            O alívio começa no contato. Nossa equipe técnica realiza uma triagem personalizada para encaminhar seu caso com a prioridade e atenção que ele merece.
          </p>
        </FlowSection>

        <FlowSection aria-label="Passo 2 — Avaliação" style={{ backgroundColor: '#00BCE4', color: '#021541' }}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#021541]/60">02 — Avaliação de Precisão</p>
          <hr className="my-[2vw] border-none border-t border-black/10" />
          <div>
            <h2 className="text-[clamp(3.5rem,8vw,10rem)] font-bold leading-[0.85] uppercase tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Diagnóstico
              <br />
              <span className="text-white">Expert.</span>
            </h2>
          </div>
          <hr className="my-[2vw] border-none border-t border-black/10" />
          <p className="max-w-[50ch] text-[clamp(1rem,2.5vw,1.75rem)] font-light leading-relaxed">
            Consulta detalhada com o Dr. André Elias Junqueira. Utilizamos tecnologia de ponta para entender a causa raiz da sua dor através de análise biomecânica e estrutural.
          </p>
          <hr className="my-[2vw] border-none border-t border-black/10" />
          <div className="flex flex-wrap gap-[3vw]">
            <div className="min-w-[180px] flex-1">
              <p className="mb-2 text-sm font-bold uppercase tracking-wider">Mapeamento</p>
              <p className="text-[clamp(0.85rem,1.1vw,1rem)] leading-relaxed opacity-75">Identificação precisa do foco da lesão guiada por imagem.</p>
            </div>
            <div className="min-w-[180px] flex-1">
              <p className="mb-2 text-sm font-bold uppercase tracking-wider">Histórico</p>
              <p className="text-[clamp(0.85rem,1.1vw,1rem)] leading-relaxed opacity-75">Análise profunda do seu histórico de saúde e estilo de vida.</p>
            </div>
          </div>
        </FlowSection>

        <FlowSection aria-label="Passo 3 — Planejamento" style={{ backgroundColor: '#f5f6f8', color: '#021541' }}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00BCE4]">03 — Plano Regenerativo</p>
          <hr className="my-[2vw] border-none border-t border-black/10" />
          <div>
            <h2 className="text-[clamp(3.5rem,8vw,10rem)] font-bold leading-[0.85] uppercase tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Bio
              <br />
              Custom.
            </h2>
          </div>
          <hr className="my-[2vw] border-none border-t border-black/10" />
          <p className="max-w-[50ch] text-[clamp(1rem,2.5vw,1.75rem)] font-light leading-relaxed">
            Ninguém é igual. Criamos um protocolo sob medida unindo o que há de mais moderno em Ortobiologia (PRP, BMAC) para regenerar seu tecido.
          </p>
          <hr className="my-[2vw] border-none border-t border-black/10" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[3vw]">
            <div className="p-6 rounded-xl bg-white border border-black/5 shadow-sm">
              <p className="mb-2 text-sm font-bold uppercase tracking-wider text-[#00BCE4]">Protocolo</p>
              <p className="text-xs leading-relaxed opacity-75">Definição das técnicas celulares e frequência das aplicações.</p>
            </div>
            <div className="p-6 rounded-xl bg-white border border-black/5 shadow-sm">
              <p className="mb-2 text-sm font-bold uppercase tracking-wider text-[#00BCE4]">Previsão</p>
              <p className="text-xs leading-relaxed opacity-75">Alinhamento de expectativas e cronograma de recuperação.</p>
            </div>
            <div className="p-6 rounded-xl bg-white border border-black/5 shadow-sm">
              <p className="mb-2 text-sm font-bold uppercase tracking-wider text-[#00BCE4]">Tecnologia</p>
              <p className="text-xs leading-relaxed opacity-75">Uso de guias ultrassonográficos para precisão milimétrica.</p>
            </div>
          </div>
        </FlowSection>

        <FlowSection aria-label="Passo 4 — Tratamento" style={{ backgroundColor: '#021541', color: '#fff' }}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00BCE4]">04 — O Procedimento</p>
          <hr className="my-[2vw] border-none border-t border-white/10" />
          <div>
            <h2 className="text-[clamp(3.5rem,8vw,10rem)] font-bold leading-[0.85] uppercase tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Atelier
              <br />
              Clínico.
            </h2>
          </div>
          <hr className="my-[2vw] border-none border-t border-white/10" />
          <p className="mt-auto max-w-[50ch] text-[clamp(1rem,2.5vw,1.75rem)] font-light leading-relaxed">
            Realizado com o máximo rigor técnico em nosso atelier clínico. Procedimentos rápidos, minimamente invasivos e focados na biologia do reparo.
          </p>
          <hr className="my-[2vw] border-none border-t border-white/10" />
          <div className="flex justify-between items-end">
            <div className="max-w-md">
              <p className="text-sm opacity-60">Foco total no conforto do paciente e na eficácia biológica do tratamento escolhido.</p>
            </div>
            <Link href="/site/agendar" className="btn-cyan-site">
              Iniciar minha jornada
            </Link>
          </div>
        </FlowSection>
      </FlowArt>


      {/* ══════════════════════════════════════════════════════
          ESPECIALIDADES — Grid leve com hover navy
      ══════════════════════════════════════════════════════ */}
      <section
        id="especialidades"
        className="py-32"
        style={{ background: '#f5f6f8' }}
      >
        <div className="max-w-screen-2xl mx-auto px-8 md:px-12">
          {/* Cabeçalho */}
          <div className="text-center mb-20 gsap-reveal-3d">
            <span
              className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase block mb-4 font-bold"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              — Áreas de Atuação
            </span>
            <h2
              className="text-5xl text-[#021541] font-bold"
              style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
            >
              Foco Anatômico
            </h2>
            <div className="h-0.5 w-16 bg-[#00BCE4] mx-auto mt-5 gsap-line-draw" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 perspective-wrap gsap-stagger-parent">
            {SPECIALTIES.map((s) => (
              <Link
                key={s.label}
                href="/site/especialidades"
                className="group relative overflow-hidden flex flex-col items-center justify-end text-center p-6 rounded-2xl cursor-pointer gsap-stagger-child min-h-[190px] card-3d-hover"
                style={{ border: '1px solid rgba(2, 21, 65, 0.08)' }}
              >
                {/* Background Image with elegant overlay */}
                <div className="absolute inset-0 z-0 overflow-hidden">
                  <Image
                    src={s.image}
                    alt={s.label}
                    fill
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-110 group-hover:rotate-1"
                    sizes="(max-width: 768px) 50vw, 200px"
                  />
                  {/* Premium double gradient overlay: darker on hover */}
                  <div
                    className="absolute inset-0 transition-opacity duration-500 opacity-80 group-hover:opacity-90"
                    style={{
                      background: 'linear-gradient(to top, rgba(2, 21, 65, 0.95) 0%, rgba(2, 21, 65, 0.65) 50%, rgba(2, 21, 65, 0.3) 100%)'
                    }}
                  />
                  {/* Subtle top light overlay */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: 'radial-gradient(circle at top, rgba(0, 188, 228, 0.25) 0%, transparent 60%)'
                    }}
                  />
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center w-full">
                  {/* Small neon cyan bar indicating precision */}
                  <div className="w-6 h-[2px] bg-[#00BCE4] mb-3 transform origin-left transition-all duration-500 group-hover:w-10" />
                  <h4 className="text-white font-bold text-sm tracking-wide transition-colors group-hover:text-[#00BCE4]" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.6)' }}>
                    {s.label}
                  </h4>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          DR. ANDRÉ — Split layout com credenciais
      ══════════════════════════════════════════════════════ */}
      <section
        id="doutor"
        className="py-32 relative overflow-hidden"
        style={{ background: '#ffffff' }}
      >
        <div className="absolute inset-0 grid-pattern-light opacity-60 pointer-events-none" />
        <div className="max-w-screen-2xl mx-auto px-8 md:px-12 relative grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">

          {/* Lado da imagem */}
          <div className="relative flex justify-center lg:justify-start gsap-reveal-left">
            <div className="relative w-full max-w-sm">
              {/* Frame da foto */}
              <div
                className="aspect-[4/5] w-full rounded-2xl overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #f0f5ff 0%, #e8f7fb 100%)', border: '1px solid rgba(2,21,65,0.08)', boxShadow: '0 24px 64px rgba(2,21,65,0.10)' }}
              >
                <div className="w-full h-full relative overflow-hidden">
                  <div className="absolute inset-0 scale-110 opacity-30 gsap-parallax" data-depth="10">
                    <AnimatedCell />
                  </div>
                  <Image
                    src="/image/drandre.webp"
                    alt="Dr. André Elias Junqueira"
                    fill
                    className="object-cover relative z-10 gsap-float"
                    sizes="(max-width: 768px) 100vw, 384px"
                    priority
                  />
                </div>
              </div>

              {/* Badge 3D flutuante */}
              <div
                className="badge-3d-float absolute -bottom-5 -left-5 z-20 px-6 py-4 rounded-xl"
                style={{ background: '#00BCE4' }}
              >
                <span
                  className="text-4xl font-bold text-[#021541] block"
                  style={{ fontFamily: 'Noto Serif, serif' }}
                >
                  10+
                </span>
                <p className="text-[9px] uppercase font-bold tracking-widest mt-0.5 text-[#021541]">
                  Anos em Ortopedia
                </p>
              </div>
            </div>
          </div>

          {/* Lado das credenciais */}
          <div className="flex flex-col space-y-7 gsap-reveal-right">
            <div>
              <span
                className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase block mb-4 font-bold"
                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
              >
                — Corpo Clínico
              </span>
              <h2
                className="text-5xl md:text-6xl leading-tight text-[#021541] font-bold"
                style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
              >
                Dr. André<br />
                <span className="text-[#00BCE4] italic font-medium">Elias Junqueira</span>
              </h2>
            </div>

            <div className="h-px w-16 bg-[rgba(2,21,65,0.12)]" />

            <p className="text-[#718096] text-lg font-light leading-relaxed">
              Ortopedista e traumatologista especializado em ombro, cotovelo e tratamento
              intervencionista da dor. Cirurgia minimamente invasiva e ortopedia regenerativa
              com rigor acadêmico de UNIFESP e USP.
            </p>

            <ul className="space-y-0 perspective-wrap gsap-stagger-parent">
              {CREDENTIALS.map((c) => (
                <li key={c} className="credential-item gsap-stagger-child">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'rgba(0,188,228,0.10)' }}
                  >
                    <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '14px' }}>
                      check
                    </span>
                  </div>
                  <span className="text-[#2d3748] text-sm font-light">{c}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-3 pt-2 gsap-scale-in">
              {['Revista Caras', 'Carmo Web TV', 'Destaque Nacional'].map((badge) => (
                <span key={badge} className="badge-navy text-[10px]">{badge}</span>
              ))}
            </div>

            <div className="flex gap-3 pt-2 gsap-scale-in">
              <Link href="/site/a-clinica" className="btn-primary-site">
                Currículo Completo
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
              </Link>
              <a
                href="https://wa.me/5512981767896"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost-site"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>message</span>
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          DEPOIMENTOS — Cards brancos com entrada 3D
      ══════════════════════════════════════════════════════ */}
      <section className="py-32" style={{ background: '#f5f6f8' }}>
        <div className="max-w-screen-2xl mx-auto px-8 md:px-12">
          {/* Cabeçalho */}
          <div className="text-center mb-20 gsap-reveal-3d">
            <span
              className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase block mb-4 font-bold"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              — Relatos de Pacientes
            </span>
            <h2
              className="text-5xl text-[#021541] font-bold"
              style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
            >
              Relatos de Superação
            </h2>
            <div className="h-0.5 w-16 bg-[#00BCE4] mx-auto mt-5 gsap-line-draw" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 perspective-wrap gsap-stagger-parent">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className={`testimonial-card card-3d-hover rounded-2xl p-10 gsap-stagger-child ${t.featured ? 'featured' : ''}`}
              >
                {/* Estrelas */}
                <div className="flex gap-1 mb-7">
                  {[...Array(5)].map((_, i) => (
                    <span
                      key={i}
                      className="material-symbols-outlined text-[#00BCE4]"
                      style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}
                    >
                      star
                    </span>
                  ))}
                </div>
                <p
                  className="italic text-lg text-[#2d3748] leading-relaxed mb-8 font-light"
                  style={{ fontFamily: 'Noto Serif, serif' }}
                >
                  {t.quote}
                </p>
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,188,228,0.10)' }}
                  >
                    <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '20px' }}>
                      person
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-[#021541] text-sm block">{t.name}</span>
                    <span
                      className="text-[9px] text-[#00BCE4] uppercase tracking-widest font-bold"
                      style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                    >
                      {t.role}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          CTA FINAL — Navy com glow cyan
      ══════════════════════════════════════════════════════ */}
      <section className="py-28 cta-block" style={{ background: '#021541' }}>
        <div className="max-w-4xl mx-auto px-8 relative text-center gsap-reveal-3d">
          <span
            className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase block mb-6 font-bold"
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            — Agende sua Consulta
          </span>
          <h2
            className="text-5xl md:text-6xl text-white mb-6 font-bold"
            style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
          >
            Retome seu{' '}
            <span className="text-[#00BCE4] italic font-medium">ritmo.</span>
          </h2>
          <div className="h-0.5 w-16 bg-[#00BCE4] mx-auto mb-8 gsap-line-draw" />
          <p
            className="text-white/50 text-lg font-light mb-12 max-w-xl mx-auto"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Agende sua consulta e conheça as possibilidades da ortopedia de nova
            geração em São José dos Campos.
          </p>
          <div className="flex flex-wrap gap-4 justify-center perspective-wrap gsap-stagger-parent">
            <Link
              href="/site/agendar"
              id="cta-sjc"
              className="btn-cyan-site gsap-stagger-child"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>calendar_month</span>
              Agendar Avaliação
            </Link>
          </div>
        </div>
      </section>
      </main>

      <SiteFooter />

      {/* WhatsApp FAB Interativo */}
      <InteractiveWhatsAppFab />
    </div>
  )
}
