import type { Metadata } from 'next'
import Link from 'next/link'
import SiteNav from '@/components/site/SiteNav'
import SiteFooter from '@/components/site/SiteFooter'
import { GSAPAnimations } from '@/components/site/GSAPAnimations'

export const metadata: Metadata = {
  title: 'Tratamentos — Ortopedia Regenerativa | Dr. André Elias Junqueira',
  description:
    'PRP, BMAC, SVF, Ácido Hialurônico, Proloterapia, Artroscopia e Bloqueios de Dor. Ortopedia regenerativa e cirurgia minimamente invasiva em São José dos Campos — Dr. André Elias Junqueira CRM SP 150430.',
}

const PROTOCOLS = [
  {
    icon: 'opacity',
    tag: 'Regeneração Plasmática',
    title: 'PRP',
    fullName: 'Plasma Rico em Plaquetas',
    desc: 'Concentração de fatores de crescimento autólogos extraídos do próprio sangue do paciente. Indicado para artrose leve a moderada (joelho, quadril, ombro, tornozelo), tendinites e bursites. Estimula a cicatrização e reduz inflamação sem cirurgia.',
  },
  {
    icon: 'genetics',
    tag: 'Células-Tronco',
    title: 'BMAC',
    fullName: 'Aspirado de Medula Óssea',
    desc: 'Terapia de elite com células progenitoras mesenquimais extraídas da medula óssea do próprio paciente. Indicada para artrose moderada a grave, lesões ósseas complexas e casos em que o PRP não é suficiente. Alto potencial regenerativo articular.',
  },
  {
    icon: 'science',
    tag: 'Tecido Adiposo',
    title: 'SVF',
    fullName: 'Fração do Estroma Vascular',
    desc: 'Derivada do tecido adiposo (gordura), rica em células-tronco e substâncias bioativas que reduzem inflamação e promovem regeneração tecidual. Indicada para quadros articulares avançados com forte componente inflamatório.',
  },
  {
    icon: 'vaccines',
    tag: 'Viscossuplementação',
    title: 'Ácido Hialurônico',
    fullName: 'Viscossuplementação Articular',
    desc: 'Infiltração intra-articular de ácido hialurônico de alto peso molecular. Restaura a lubrificação e o amortecimento articular, reduz a rigidez e a dor. Especialmente eficaz no joelho, quadril e ombro.',
  },
  {
    icon: 'healing',
    tag: 'Terapia Proliferativa',
    title: 'Proloterapia',
    fullName: 'Terapia Proliferativa',
    desc: 'Injeções proliferativas com solução hipertônica que induzem resposta inflamatória controlada, fortalecendo ligamentos e tendões enfraquecidos por trauma crônico. Tratamento natural para dor ligamentar e instabilidades articulares.',
  },
  {
    icon: 'electric_bolt',
    tag: 'Tratamento da Dor',
    title: 'Neuromodulação',
    fullName: 'Modulação Neurológica da Dor',
    desc: 'Procedimento minimamente invasivo para tratamento de dor crônica através da modulação dos sinais nervosos. Inclui bloqueios de nervo periférico, rizotomia e técnicas guiadas por ultrassom para dor refratária.',
  },
  {
    icon: 'arthritis',
    tag: 'Cirurgia por Vídeo',
    title: 'Artroscopia',
    fullName: 'Cirurgia Minimamente Invasiva',
    desc: 'Procedimento cirúrgico por vídeo com mínima invasão. Realizado no ombro e cotovelo para reparo do manguito rotador, tratamento de instabilidade, lesões de SLAP e epicondilite. Recuperação acelerada com menor risco.',
  },
  {
    icon: 'block',
    tag: 'Intervencionista',
    title: 'Bloqueios & Infiltrações',
    fullName: 'Tratamento Intervencionista da Dor',
    desc: 'Infiltrações articulares e bloqueios de nervo periférico e na coluna, todos guiados por ultrassonografia para máxima precisão. Indicados para dor crônica, hérnia de disco, artrose e síndrome do impacto.',
  },
]

const SAFETY = [
  {
    icon: 'verified_user',
    title: 'Guiado por Ultrassonografia',
    desc: '100% dos procedimentos realizados com precisão de imagem milimétrica, garantindo exatidão no alvo anatômico.',
  },
  {
    icon: 'monitoring',
    title: 'Recursos do Próprio Paciente',
    desc: 'Terapias autólogas (PRP, BMAC, SVF) extraídas do próprio organismo, com segurança máxima e sem risco de rejeição.',
  },
  {
    icon: 'assignment_turned_in',
    title: 'Certificação e Normas ANVISA',
    desc: 'Adesão estrita às normas da ANVISA, SBOT e protocolos internacionais da AAOS (American Academy of Orthopaedic Surgeons).',
  },
]

export default function TratamentosPage() {
  return (
    <div className="site-skin min-h-screen" style={{ background: '#f5f6f8' }}>
      <GSAPAnimations />
      <SiteNav />

      {/* ══════════════════════════════════════════════════════
          HERO — Navy fullscreen
      ══════════════════════════════════════════════════════ */}
      <section className="relative pt-36 pb-28 overflow-hidden" style={{ background: '#021541' }}>
        <div className="absolute inset-0 dot-pattern-light opacity-20 pointer-events-none" />
        <div
          className="absolute -left-32 bottom-0 w-[500px] h-[500px] rounded-full blur-[160px] pointer-events-none"
          style={{ background: 'rgba(0,188,228,0.08)' }}
        />
        <div className="max-w-screen-2xl mx-auto px-8 md:px-12 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-end">

          {/* Left */}
          <div className="gsap-hero">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-7"
              style={{ background: 'rgba(0,188,228,0.10)', border: '1px solid rgba(0,188,228,0.20)' }}
            >
              <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '14px' }}>clinical_notes</span>
              <span
                className="text-[#00BCE4] text-[10px] uppercase font-bold tracking-[0.2em]"
                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
              >
                Ortopedia Regenerativa
              </span>
            </div>
            <h1
              className="text-5xl md:text-7xl text-white font-bold leading-tight mb-6"
              style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
            >
              Ciência que{' '}
              <span className="italic text-[#00BCE4] font-medium">Restaura</span>
            </h1>
            <div className="h-0.5 w-16 bg-[#00BCE4] mb-6 gsap-line-draw" />
            <p
              className="text-white/50 text-lg leading-relaxed max-w-lg mb-10 font-light"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Ortopedia regenerativa, cirurgia minimamente invasiva e tratamento intervencionista da dor. Utilizamos os recursos do próprio organismo do paciente para estimular a cura natural.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <Link href="/site/agendar" id="tratamentos-cta" className="btn-cyan-site">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>calendar_month</span>
                Agendar Consulta
              </Link>
              <a
                href="https://wa.me/5512981767896"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-white/60 hover:text-white text-[11px] uppercase tracking-widest font-bold site-transition"
              >
                Falar com especialista
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
              </a>
            </div>
          </div>

          {/* Right — Stats */}
          <div className="hidden lg:grid grid-cols-2 gap-4 perspective-wrap gsap-stagger-parent">
            {[
              { value: '8', label: 'Protocolos Regenerativos' },
              { value: '98%', label: 'Taxa de Sucesso' },
              { value: 'USG', label: 'Precisão por Imagem' },
              { value: '10+', label: 'Anos de Experiência' },
            ].map((s) => (
              <div
                key={s.label}
                className="stat-card-3d gsap-stagger-child flex flex-col items-center text-center p-6 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span
                  className="text-3xl text-white font-bold mb-2"
                  style={{ fontFamily: 'Noto Serif, serif' }}
                >
                  {s.value}
                </span>
                <div className="w-6 h-px bg-[#00BCE4] my-1.5" />
                <span
                  className="text-[9px] uppercase tracking-widest font-semibold text-white/40"
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
          PROTOCOLOS — Grid de 4 colunas
      ══════════════════════════════════════════════════════ */}
      <section className="py-32" style={{ background: '#ffffff' }}>
        <div className="max-w-screen-2xl mx-auto px-8 md:px-12">

          {/* Cabeçalho */}
          <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8 gsap-reveal-3d">
            <div className="max-w-2xl">
              <span
                className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase block mb-4 font-bold"
                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
              >
                — Protocolos Terapêuticos
              </span>
              <h2
                className="text-5xl md:text-6xl text-[#021541] font-bold"
                style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
              >
                Tratamentos e{' '}
                <span className="italic text-[#00BCE4] font-medium">Procedimentos</span>
              </h2>
              <div className="h-0.5 w-16 bg-[#00BCE4] mt-6 gsap-line-draw" />
            </div>
            <div className="text-right shrink-0 hidden md:block gsap-scale-in">
              <span
                className="text-[#00BCE4] font-bold"
                style={{ fontSize: '3.5rem', fontFamily: 'Noto Serif, serif' }}
              >
                98%
              </span>
              <p
                className="text-[#021541]/40 text-[10px] uppercase font-bold tracking-widest mt-1"
                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
              >
                Taxa de Sucesso Clínico
              </p>
            </div>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 perspective-wrap gsap-stagger-parent">
            {PROTOCOLS.map((p) => (
              <div
                key={p.title}
                className="treatment-card card-kinetic card-3d-hover rounded-2xl p-8 flex flex-col h-full gsap-stagger-child"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
                  style={{ background: 'rgba(0,188,228,0.08)', border: '1px solid rgba(0,188,228,0.15)' }}
                >
                  <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '24px' }}>
                    {p.icon}
                  </span>
                </div>
                <span
                  className="text-[#00BCE4] text-[10px] uppercase tracking-widest mb-3 block font-bold"
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  {p.tag}
                </span>
                <h3
                  className="text-2xl text-[#021541] font-bold mb-1"
                  style={{ fontFamily: 'Noto Serif, serif' }}
                >
                  {p.title}
                </h3>
                <p
                  className="text-[#00BCE4] text-[10px] font-bold uppercase tracking-widest mb-4"
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  {p.fullName}
                </p>
                <p className="text-[#718096] text-sm leading-relaxed mb-8 flex-grow font-light">
                  {p.desc}
                </p>
                <Link
                  href="/site/agendar"
                  className="w-full py-3 flex items-center justify-center gap-2 text-[#021541] font-bold text-[11px] uppercase tracking-widest site-transition hover:bg-[#021541] hover:text-white rounded-sm"
                  style={{ border: '1px solid rgba(2,21,65,0.15)' }}
                >
                  Saiba mais
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SEGURANÇA — Navy com destaque de protocolo
      ══════════════════════════════════════════════════════ */}
      <section className="py-32" style={{ background: '#f5f6f8' }}>
        <div className="max-w-screen-2xl mx-auto px-8 md:px-12">
          <div
            className="rounded-2xl p-12 lg:p-20 relative overflow-hidden flex flex-col lg:flex-row items-center gap-16 gsap-reveal-3d"
            style={{ background: '#021541' }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at top right, rgba(0,188,228,0.08) 0%, transparent 60%)' }}
            />
            <div className="absolute top-0 right-0 w-1/3 h-full opacity-5 dot-pattern-light pointer-events-none" />

            {/* Texto */}
            <div className="lg:w-1/2 relative z-10">
              <span
                className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase mb-6 block font-bold"
                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
              >
                — Excellence Benchmark
              </span>
              <h2
                className="text-4xl md:text-5xl text-white font-bold mb-8 leading-tight"
                style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
              >
                Protocolo de Segurança{' '}
                <span className="italic text-[#00BCE4] font-medium">e Eficácia</span>
              </h2>
              <div className="h-0.5 w-16 bg-[#00BCE4] mb-8 gsap-line-draw" />
              <ul className="space-y-7 perspective-wrap gsap-stagger-parent">
                {SAFETY.map((s) => (
                  <li key={s.title} className="flex items-start gap-4 gsap-stagger-child">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: 'rgba(0,188,228,0.12)', border: '1px solid rgba(0,188,228,0.20)' }}
                    >
                      <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '20px' }}>
                        {s.icon}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-white font-bold mb-1">{s.title}</h4>
                      <p className="text-white/40 text-sm font-light">{s.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Badges */}
            <div className="lg:w-1/2 flex justify-center">
              <div className="grid grid-cols-2 gap-4 perspective-wrap gsap-stagger-parent">
                {[
                  { l: 'ISO', s: 'Qualidade', a: false },
                  { l: 'ONA III', s: 'Acreditação', a: true },
                  { l: 'ANVISA', s: 'Conformidade', a: true },
                  { l: 'SBOT', s: 'Membro', a: false },
                ].map((c) => (
                  <div
                    key={c.l}
                    className="w-36 h-36 flex flex-col items-center justify-center p-5 rounded-2xl gsap-stagger-child stat-card-3d"
                    style={{
                      background: c.a ? 'rgba(0,188,228,0.10)' : 'rgba(255,255,255,0.04)',
                      border: c.a ? '1px solid rgba(0,188,228,0.20)' : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <span
                      className="font-bold text-xl text-center text-[#00BCE4]"
                      style={{ fontFamily: 'Noto Serif, serif' }}
                    >
                      {c.l}
                    </span>
                    <span
                      className="text-[9px] text-white/40 uppercase tracking-widest mt-2 font-semibold"
                      style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                    >
                      {c.s}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          CTA FINAL
      ══════════════════════════════════════════════════════ */}
      <section className="py-28 cta-block" style={{ background: '#021541' }}>
        <div className="max-w-4xl mx-auto px-8 text-center gsap-reveal-3d">
          <span
            className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase block mb-6 font-bold"
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            — Comece sua Recuperação
          </span>
          <h2
            className="text-5xl md:text-6xl text-white mb-6 font-bold"
            style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
          >
            Seu protocolo{' '}
            <span className="italic text-[#00BCE4] font-medium">personalizado.</span>
          </h2>
          <div className="h-0.5 w-16 bg-[#00BCE4] mx-auto mb-8 gsap-line-draw" />
          <p
            className="text-white/50 text-lg font-light mb-12 max-w-xl mx-auto"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Agende uma avaliação com o Dr. André Elias Junqueira e descubra qual protocolo regenerativo é ideal para o seu caso.
          </p>
          <div className="flex flex-wrap gap-4 justify-center perspective-wrap gsap-stagger-parent">
            <Link href="/site/agendar" className="btn-cyan-site gsap-stagger-child">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>calendar_month</span>
              Agendar Consulta
            </Link>
            <Link
              href="/site/especialidades"
              className="gsap-stagger-child inline-flex items-center gap-2 px-8 py-3.5 text-white text-[11px] font-bold uppercase tracking-widest site-transition hover:bg-white/8"
              style={{ border: '1px solid rgba(255,255,255,0.18)', borderRadius: '2px' }}
            >
              Ver Especialidades
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />

      {/* WhatsApp FAB */}
      <a
        href="https://wa.me/5512981767896"
        target="_blank"
        rel="noopener noreferrer"
        className="whatsapp-fab"
        aria-label="Fale conosco pelo WhatsApp"
      >
        <svg className="w-7 h-7 fill-white" viewBox="0 0 24 24">
          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.185-.573c.948.517 2.04.794 3.144.794h.002c3.181 0 5.767-2.586 5.767-5.766 0-3.18-2.585-5.766-5.767-5.766zm3.377 8.203c-.145.405-.837.74-1.159.789-.323.05-.63.072-1.84-.407-1.458-.578-2.397-2.055-2.47-2.152-.072-.097-.585-.778-.585-1.496 0-.717.376-1.07.509-1.216.133-.145.29-.182.387-.182h.278c.084 0 .193-.036.302.218l.434 1.054c.036.085.06.182.012.278-.048.096-.072.156-.145.241-.072.085-.157.193-.223.265-.072.073-.145.151-.06.296.084.145.374.616.804 1.002.554.496 1.02.65 1.165.723.145.073.23.06.314-.036.084-.096.362-.423.459-.567.096-.145.193-.121.326-.072.133.048.845.398.99.47.145.073.242.109.278.169.036.06.036.35-.109.754zM12 2C6.48 2 2 6.48 2 12c0 1.76.46 3.42 1.26 4.86L2 22l5.34-1.4c1.4.74 3 1.17 4.66 1.17 5.52 0 10-4.48 10-10S17.52 2 12 2z" />
        </svg>
      </a>
    </div>
  )
}
