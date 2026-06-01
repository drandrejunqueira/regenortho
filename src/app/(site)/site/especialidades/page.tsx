import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import SiteNav from '@/components/site/SiteNav'
import SiteFooter from '@/components/site/SiteFooter'
import { GSAPAnimations } from '@/components/site/GSAPAnimations'

export const metadata: Metadata = {
  title: 'Especialidades — Joelho, Ombro, Coluna, Quadril | Dr. André Elias Junqueira',
  description:
    'Especialidades em ortopedia e traumatologia: Joelho, Ombro e Cotovelo, Coluna, Quadril, Pé e Tornozelo. Tratamentos regenerativos e cirurgia minimamente invasiva em SJC — CRM SP 150430.',
}

const SPECIALTIES = [
  {
    icon: 'skateboarding',
    title: 'Joelho',
    featured: true,
    chips: ['Artrose (Gonartrose)', 'Lesão de LCA/LCP', 'Lesão de Menisco', 'Tendinite Patelar', 'Condropatia', 'Desgaste Articular'],
    desc: 'Tratamentos focados na regeneração cartilaginosa e estabilização ligamentar. Utilizamos PRP, BMAC, SVF e viscosuplementação com ácido hialurônico para evitar ou postergar próteses. Infiltrações guiadas por ultrassom para máxima precisão.',
  },
  {
    icon: 'fitness_center',
    title: 'Ombro & Cotovelo',
    featured: false,
    dark: true,
    chips: ['Manguito Rotador', 'Luxação Recidivante', 'Lesão de SLAP', 'Epicondilite Lateral', 'Artroscopia', 'PRP & Infiltrações USG'],
    desc: 'Especialidade principal do Dr. André. Cirurgia artroscópica do ombro e cotovelo, tratamento regenerativo de tendinites e instabilidade articular.',
  },
  {
    icon: 'accessibility_new',
    title: 'Coluna',
    featured: false,
    desc: 'Tratamento da hérnia de disco (L4-L5, L5-S1), dor lombar crônica e cervicalgia com bloqueios guiados por USG, rizotomia, discectomia a laser e neuromodulação. Foco em evitar cirurgia aberta.',
  },
  {
    icon: 'recent_actors',
    title: 'Quadril',
    featured: false,
    desc: 'Tratamento da artrose do quadril, impacto femoroacetabular e bursites trocantéricas com PRP, ácido hialurônico e infiltrações guiadas por ultrassom. Preservação articular e reabilitação funcional acelerada.',
  },
  {
    icon: 'pan_tool',
    title: 'Mão & Punho',
    featured: false,
    desc: 'Tratamento de tendinites, artroses das pequenas articulações, síndrome do túnel do carpo e lesões tendíneas com infiltrações de precisão guiadas por ultrassonografia.',
  },
]

export default function EspecialidadesPage() {
  return (
    <div className="site-skin min-h-screen" style={{ background: '#f5f6f8' }}>
      <GSAPAnimations />
      <SiteNav />

      {/* ══════════════════════════════════════════════════════
          HERO — Navy com dot pattern
      ══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden pt-36 pb-28 px-6 md:px-12" style={{ background: '#021541' }}>
        <div className="absolute inset-0 dot-pattern-light opacity-20 pointer-events-none" />
        <div
          className="absolute -right-32 -top-32 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none"
          style={{ background: 'rgba(0,188,228,0.12)' }}
        />
        <div className="max-w-screen-2xl mx-auto relative z-10 flex flex-col items-center text-center gsap-hero">
          <span
            className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase mb-5 font-bold block"
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            — Nossa Expertise
          </span>
          <h1
            className="text-5xl md:text-7xl text-white font-bold leading-tight max-w-4xl mb-6"
            style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
          >
            Especialistas focados no{' '}
            <span className="italic text-[#00BCE4]">seu movimento</span>
          </h1>
          <div className="h-0.5 w-16 bg-[#00BCE4] mb-6 gsap-line-draw" />
          <p
            className="text-white/50 text-lg max-w-2xl leading-relaxed font-light"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Aliamos o rigor científico às mais avançadas terapias regenerativas para restaurar
            sua funcionalidade e qualidade de vida.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FEATURED — Joelho (card grande)
      ══════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 md:px-12" style={{ background: '#ffffff' }}>
        <div className="max-w-screen-2xl mx-auto">

          {/* Título seção */}
          <div className="mb-16 gsap-reveal-3d">
            <span
              className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase block mb-4 font-bold"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              — Áreas de Atuação
            </span>
            <h2
              className="text-5xl md:text-6xl text-[#021541] font-bold"
              style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
            >
              Cada articulação,<br />
              <span className="italic text-[#00BCE4] font-medium">um protocolo único</span>
            </h2>
            <div className="h-0.5 w-16 bg-[#00BCE4] mt-6 gsap-line-draw" />
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 perspective-wrap gsap-stagger-parent">

            {/* Joelho — large feature */}
            <div
              className="md:col-span-8 relative overflow-hidden group treatment-card card-3d-hover rounded-2xl gsap-stagger-child flex flex-col md:flex-row justify-between"
              style={{ minHeight: '420px' }}
            >
              {/* Left Side Content */}
              <div className="relative z-10 flex flex-col justify-between p-8 md:p-10 md:w-3/5">
                <div>
                  <div
                    className="w-12 h-12 flex items-center justify-center rounded-xl mb-6"
                    style={{ background: 'rgba(0,188,228,0.08)', border: '1px solid rgba(0,188,228,0.15)' }}
                  >
                    <span className="material-symbols-outlined text-[#00BCE4]">settings_accessibility</span>
                  </div>
                  <span
                    className="text-[#00BCE4] text-[10px] uppercase tracking-widest mb-3 block font-bold"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    Especialidade Principal
                  </span>
                  <h3
                    className="text-3xl text-[#021541] mb-5 font-bold"
                    style={{ fontFamily: 'Noto Serif, serif' }}
                  >
                    Joelho
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {['Artrose (Gonartrose)', 'Lesão de LCA/LCP', 'Lesão de Menisco', 'Tendinite Patelar', 'Condropatia', 'Desgaste Articular'].map((chip) => (
                      <span
                        key={chip}
                        className="px-3 py-1 text-xs font-semibold rounded-full"
                        style={{ background: 'rgba(0,188,228,0.08)', color: '#021541', border: '1px solid rgba(0,188,228,0.15)' }}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                  <p className="text-[#718096] text-sm leading-relaxed font-light">
                    Tratamentos focados na regeneração cartilaginosa e estabilização ligamentar. Utilizamos PRP, BMAC, SVF e viscosuplementação com ácido hialurônico para evitar ou postergar próteses. Infiltrações guiadas por ultrassom para máxima precisão.
                  </p>
                </div>
                <div className="mt-8">
                  <Link
                    href="/site/tratamentos"
                    className="text-[#021541] font-bold text-[11px] uppercase tracking-widest flex items-center gap-2 hover:gap-4 site-transition hover:text-[#00BCE4]"
                  >
                    Ver Tratamentos
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                  </Link>
                </div>
              </div>

              {/* Right Side Image */}
              <div className="relative w-full md:w-2/5 h-64 md:h-auto overflow-hidden shrink-0">
                <Image
                  src="/image/knee.png"
                  alt="Especialidade Joelho"
                  fill
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 350px"
                />
                {/* Gradient blend to match layout */}
                <div
                  className="absolute inset-0 md:bg-gradient-to-r md:from-white md:via-white/70 md:to-transparent bg-gradient-to-t from-white via-white/75 to-transparent"
                  style={{ pointerEvents: 'none' }}
                />
              </div>
            </div>

            {/* Ombro — dark card */}
            <div
              className="md:col-span-4 relative overflow-hidden group rounded-2xl gsap-stagger-child card-3d-hover"
              style={{ background: '#021541', padding: '2.5rem' }}
            >
              {/* Background clinical shoulder photo */}
              <div className="absolute inset-0 z-0 overflow-hidden opacity-30 transition-opacity duration-500 group-hover:opacity-40">
                <Image
                  src="/image/shoulder.png"
                  alt="Especialidade Ombro e Cotovelo"
                  fill
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 380px"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(to top, #021541 30%, rgba(2, 21, 65, 0.6) 100%)'
                  }}
                />
              </div>

              <div
                className="absolute inset-0 pointer-events-none z-0"
                style={{ background: 'radial-gradient(ellipse at top right, rgba(0,188,228,0.15) 0%, transparent 60%)' }}
              />

              <div className="relative z-10 h-full flex flex-col justify-between" style={{ minHeight: '340px' }}>
                <div>
                  <div
                    className="w-12 h-12 flex items-center justify-center rounded-xl mb-6"
                    style={{ background: 'rgba(0,188,228,0.12)', border: '1px solid rgba(0,188,228,0.20)' }}
                  >
                    <span className="material-symbols-outlined text-[#00BCE4]">fitness_center</span>
                  </div>
                  <span
                    className="text-[#00BCE4] text-[10px] uppercase tracking-widest mb-3 block font-bold"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    Especialidade do Dr. André
                  </span>
                  <h3
                    className="text-2xl text-white mb-4 font-bold"
                    style={{ fontFamily: 'Noto Serif, serif' }}
                  >
                    Ombro & Cotovelo
                  </h3>
                  <p className="text-white/60 text-sm leading-relaxed mb-6 font-light">
                    Cirurgia artroscópica do ombro e cotovelo, tratamento regenerativo de tendinites e instabilidade articular.
                  </p>
                </div>
                <div className="space-y-2.5 mt-auto">
                  {['Manguito Rotador', 'Luxação Recidivante', 'Lesão de SLAP', 'Epicondilite Lateral', 'Artroscopia', 'PRP & Infiltrações USG'].map((item) => (
                    <div key={item} className="flex items-center gap-3 text-white/80 text-xs">
                      <span className="w-1.5 h-1.5 bg-[#00BCE4] rounded-full shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Coluna */}
            <div
              className="md:col-span-4 relative overflow-hidden group treatment-card card-3d-hover rounded-2xl gsap-stagger-child"
              style={{ padding: '2.5rem' }}
            >
              {/* Background Spine Photo */}
              <div className="absolute inset-0 z-0 overflow-hidden opacity-10 transition-opacity duration-500 group-hover:opacity-20">
                <Image
                  src="/image/spine.png"
                  alt="Especialidade Coluna"
                  fill
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 380px"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(to top, #ffffff 40%, rgba(255, 255, 255, 0.4) 100%)'
                  }}
                />
              </div>

              <div className="relative z-10 flex flex-col justify-between h-full" style={{ minHeight: '340px' }}>
                <div>
                  <div
                    className="w-12 h-12 flex items-center justify-center rounded-xl mb-6"
                    style={{ background: 'rgba(0,188,228,0.08)', border: '1px solid rgba(0,188,228,0.15)' }}
                  >
                    <span className="material-symbols-outlined text-[#00BCE4]">accessibility_new</span>
                  </div>
                  <span
                    className="text-[#00BCE4] text-[10px] uppercase tracking-widest mb-3 block font-bold"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    Hérnia & Dor Lombar
                  </span>
                  <h3
                    className="text-2xl text-[#021541] mb-4 font-bold"
                    style={{ fontFamily: 'Noto Serif, serif' }}
                  >
                    Coluna
                  </h3>
                  <p className="text-[#718096] text-sm leading-relaxed mb-6 font-light">
                    Tratamento da hérnia de disco (L4-L5, L5-S1), dor lombar crônica e cervicalgia com bloqueios guiados por USG, rizotomia, discectomia a laser e neuromodulação.
                  </p>
                </div>
                <Link
                  href="/site/tratamentos"
                  className="text-[#021541] font-bold text-[11px] uppercase tracking-widest flex items-center gap-2 hover:gap-3 site-transition hover:text-[#00BCE4] mt-auto"
                >
                  Ver Protocolos
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Quadril */}
            <div
              className="md:col-span-4 relative overflow-hidden group treatment-card card-3d-hover rounded-2xl gsap-stagger-child"
              style={{ padding: '2.5rem', background: '#f5f6f8' }}
            >
              {/* Background Hip Photo */}
              <div className="absolute inset-0 z-0 overflow-hidden opacity-10 transition-opacity duration-500 group-hover:opacity-20">
                <Image
                  src="/image/hip.png"
                  alt="Especialidade Quadril"
                  fill
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 380px"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(to top, #f5f6f8 40%, rgba(245, 246, 248, 0.4) 100%)'
                  }}
                />
              </div>

              <div className="relative z-10 flex flex-col h-full justify-between" style={{ minHeight: '340px' }}>
                <div>
                  <div
                    className="w-12 h-12 flex items-center justify-center rounded-xl mb-6"
                    style={{ background: 'rgba(0,188,228,0.08)', border: '1px solid rgba(0,188,228,0.15)' }}
                  >
                    <span className="material-symbols-outlined text-[#00BCE4]">recent_actors</span>
                  </div>
                  <span
                    className="text-[#00BCE4] text-[10px] uppercase tracking-widest mb-3 block font-bold"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    Artrose & Impacto
                  </span>
                  <h3
                    className="text-2xl text-[#021541] mb-4 font-bold"
                    style={{ fontFamily: 'Noto Serif, serif' }}
                  >
                    Quadril
                  </h3>
                  <p className="text-[#718096] text-sm leading-relaxed font-light mb-6">
                    Tratamento da artrose do quadril, impacto femoroacetabular e bursites trocantéricas com PRP, ácido hialurônico e infiltrações guiadas por ultrassom.
                  </p>
                </div>
                <Link
                  href="/site/tratamentos"
                  className="text-[#021541] font-bold text-[11px] uppercase tracking-widest flex items-center gap-2 hover:gap-3 site-transition hover:text-[#00BCE4] mt-auto"
                >
                  Ver Protocolos
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Mão & Punho */}
            <div
              className="md:col-span-4 relative overflow-hidden group treatment-card card-3d-hover rounded-2xl gsap-stagger-child"
              style={{ padding: '2.5rem' }}
            >
              {/* Background Hand Photo */}
              <div className="absolute inset-0 z-0 overflow-hidden opacity-10 transition-opacity duration-500 group-hover:opacity-20">
                <Image
                  src="/image/hand.png"
                  alt="Especialidade Mão e Punho"
                  fill
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 380px"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(to top, #ffffff 40%, rgba(255, 255, 255, 0.4) 100%)'
                  }}
                />
              </div>

              <div className="relative z-10 flex flex-col h-full justify-between" style={{ minHeight: '340px' }}>
                <div>
                  <div
                    className="w-12 h-12 flex items-center justify-center rounded-xl mb-6"
                    style={{ background: 'rgba(0,188,228,0.08)', border: '1px solid rgba(0,188,228,0.15)' }}
                  >
                    <span className="material-symbols-outlined text-[#00BCE4]">pan_tool</span>
                  </div>
                  <span
                    className="text-[#00BCE4] text-[10px] uppercase tracking-widest mb-3 block font-bold"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    Pequenas Articulações
                  </span>
                  <h3
                    className="text-2xl text-[#021541] mb-4 font-bold"
                    style={{ fontFamily: 'Noto Serif, serif' }}
                  >
                    Mão & Punho
                  </h3>
                  <p className="text-[#718096] text-sm leading-relaxed font-light mb-6">
                    Tendinites, artroses das pequenas articulações, síndrome do túnel do carpo e lesões tendíneas com infiltrações de precisão guiadas por ultrassonografia.
                  </p>
                </div>
                <Link
                  href="/site/tratamentos"
                  className="text-[#021541] font-bold text-[11px] uppercase tracking-widest flex items-center gap-2 hover:gap-3 site-transition hover:text-[#00BCE4] mt-auto"
                >
                  Ver Protocolos
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          PÉ & TORNOZELO — Full width destaque
      ══════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 md:px-12" style={{ background: '#f5f6f8' }}>
        <div className="max-w-screen-2xl mx-auto">
          <div
            className="treatment-card rounded-2xl p-10 lg:p-16 flex flex-col lg:flex-row items-center gap-12 gsap-reveal-3d"
          >
            <div
              className="lg:w-1/3 w-full h-56 lg:h-72 rounded-2xl overflow-hidden relative shrink-0 gsap-float"
              style={{ border: '1px solid rgba(2, 21, 65, 0.08)', boxShadow: '0 12px 32px rgba(2, 21, 65, 0.05)' }}
            >
              <Image
                src="/image/foot.png"
                alt="Especialidade Pé & Tornozelo"
                fill
                className="object-cover transition-transform duration-700 ease-out hover:scale-105"
                sizes="(max-width: 768px) 100vw, 400px"
              />
            </div>
            <div className="lg:w-2/3">
              <span
                className="text-[#00BCE4] text-[10px] uppercase tracking-widest mb-4 block font-bold"
                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
              >
                — Lesões Esportivas & Crônicas
              </span>
              <h3
                className="text-4xl text-[#021541] mb-5 font-bold"
                style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.01em' }}
              >
                Pé & Tornozelo
              </h3>
              <div className="h-0.5 w-12 bg-[#00BCE4] mb-6 gsap-line-draw" />
              <p className="text-[#718096] leading-relaxed mb-8 font-light">
                Tratamento de entorses de repetição, tendinopatia do Aquiles, fascite plantar, artrose do tornozelo e lesões esportivas do pé. Uso de PRP, proloterapia e infiltrações guiadas por ultrassom para regeneração tendínea e ligamentar, com retorno acelerado às atividades.
              </p>
              <div className="flex gap-3 flex-wrap">
                <Link href="/site/tratamentos" className="btn-primary-site">
                  Conhecer Técnicas
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                </Link>
                <Link href="/site/a-clinica" className="btn-ghost-site">
                  Corpo Clínico
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          CTA — Navy com cyan
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
            Pronto para retomar sua{' '}
            <span className="text-[#00BCE4] italic font-medium">liberdade?</span>
          </h2>
          <div className="h-0.5 w-16 bg-[#00BCE4] mx-auto mb-8 gsap-line-draw" />
          <p
            className="text-white/50 text-lg font-light mb-12 max-w-xl mx-auto"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Nossa equipe está pronta para uma avaliação detalhada e propor o melhor
            caminho regenerativo para o seu caso.
          </p>
          <div className="flex flex-wrap gap-4 justify-center perspective-wrap gsap-stagger-parent">
            <Link href="/site/agendar" id="especialidades-cta" className="btn-cyan-site gsap-stagger-child">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>calendar_month</span>
              Agendar Avaliação
            </Link>
            <a
              href="https://wa.me/5512981767896"
              target="_blank"
              rel="noopener noreferrer"
              className="gsap-stagger-child inline-flex items-center gap-2 px-8 py-3.5 text-white text-[11px] font-bold uppercase tracking-widest rounded-sm site-transition hover:bg-white/8"
              style={{ border: '1px solid rgba(255,255,255,0.18)', borderRadius: '2px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>message</span>
              WhatsApp
            </a>
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
