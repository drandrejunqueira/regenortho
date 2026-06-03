import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import SiteNav from '@/components/site/SiteNav'
import SiteFooter from '@/components/site/SiteFooter'
import { GSAPAnimations } from '@/components/site/GSAPAnimations'
import { AnimatedCell } from '@/components/site/AnimatedCell'

export const metadata: Metadata = {
  title: 'Sobre o Dr. André Elias Junqueira — Ortopedista em SJC',
  description:
    'Dr. André Elias Junqueira — CRM SP 150430. Ortopedista e traumatologista especialista em ombro, cotovelo e dor. Formado pela UNIFESP, com especialização em medicina regenerativa e procedimentos minimamente invasivos. Atende em São José dos Campos.',
}

const TECHS = [
  {
    icon: 'biotech',
    title: 'Ortopedia Regenerativa',
    desc: 'PRP, BMAC e SVF — terapias autólogas com células do próprio paciente para regeneração articular e tendínea.',
  },
  {
    icon: 'monitor_heart',
    title: 'Ultrassonografia HD',
    desc: 'Guiamento por imagem em tempo real para todos os procedimentos de infiltração, garantindo precisão milimétrica.',
  },
  {
    icon: 'electric_bolt',
    title: 'Neuromodulação & Rizotomia',
    desc: 'Técnicas intervencionistas para tratamento da dor crônica refratária, com mínima invasão e alta eficácia.',
  },
  {
    icon: 'precision_manufacturing',
    title: 'Artroscopia & Cirurgia a Laser',
    desc: 'Cirurgia minimamente invasiva por vídeo (artroscopia) e discectomia a laser para coluna — recuperação acelerada.',
  },
]

const CREDENTIALS = [
  {
    icon: 'school',
    label: 'Graduação em Medicina',
    value: 'Escola Paulista de Medicina — EPM-UNIFESP',
  },
  {
    icon: 'medical_services',
    label: 'Residência em Ortopedia e Traumatologia',
    value: 'EPM-UNIFESP · São Paulo',
  },
  {
    icon: 'fitness_center',
    label: 'Especialização em Cirurgia do Ombro e Cotovelo',
    value: 'EPM-UNIFESP · São Paulo',
  },
  {
    icon: 'psychology',
    label: 'Pós-graduação em Procedimentos Minimamente Invasivos para Dor (Guiados por USG)',
    value: 'IOT-FMUSP · Instituto de Ortopedia e Traumatologia da USP',
  },
]

const EXPERIENCE_ITEMS = [
  { icon: 'concierge', title: 'Concierge Dedicado', desc: 'Acompanhamento personalizado desde o agendamento até o pós-procedimento, garantindo que cada detalhe da sua jornada seja impecável.' },
  { icon: 'coffee', title: 'Lounge de Acolhimento', desc: 'Um refúgio de tranquilidade com menu gourmet e conectividade de alta velocidade.', dark: true },
  { icon: 'privacy_tip', title: 'Privacidade Total', desc: 'Consultórios isolados acusticamente e fluxos desenhados para discrição absoluta.', cyan: true },
  { icon: 'health_and_safety', title: 'Segurança Sanitária', desc: 'Protocolos de esterilização e purificação de ar que excedem as normas internacionais, em um ambiente de nível hospitalar com alma de atelier.' },
]

export default function AClinicaPage() {
  return (
    <div className="site-skin min-h-screen" style={{ background: '#f5f6f8' }}>
      <GSAPAnimations />
      <SiteNav />

      {/* ══════════════════════════════════════════════════════
          HERO — Navy fullscreen
      ══════════════════════════════════════════════════════ */}
      <section
        className="relative flex items-center overflow-hidden"
        style={{ height: '85vh', minHeight: '600px', background: '#021541' }}
      >
        <div className="absolute inset-0 dot-pattern-light opacity-20 pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 70% 50%, rgba(0,188,228,0.08) 0%, transparent 55%)' }}
        />
        <div className="max-w-screen-2xl mx-auto px-8 md:px-12 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center w-full">

          {/* Left text */}
          <div>
            <span
              className="gsap-hero inline-flex items-center gap-2 text-[#00BCE4] tracking-[0.2em] text-[10px] uppercase mb-7 px-4 py-1.5 rounded-full font-bold"
              style={{ background: 'rgba(0,188,228,0.10)', border: '1px solid rgba(0,188,228,0.20)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              The Regenerative Luminary
            </span>
            <h1
              className="gsap-hero text-6xl md:text-7xl text-white leading-tight mb-7 font-bold"
              style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
            >
              O Conceito{' '}
              <br />
              <span className="italic text-[#00BCE4] font-medium">Clinical Atelier</span>
            </h1>
            <div className="gsap-hero h-0.5 w-16 bg-[#00BCE4] mb-7 gsap-line-draw" />
            <p
              className="gsap-hero text-lg text-white/50 font-light leading-relaxed max-w-lg"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Um espaço onde a precisão cirúrgica encontra a hospitalidade de alto padrão. Redefinimos a experiência ortopédica através de um ambiente curado para o seu bem-estar.
            </p>
          </div>

          {/* Right — badge stats */}
          <div className="hidden lg:flex justify-end">
            <div className="grid grid-cols-2 gap-4 perspective-wrap gsap-stagger-parent">
              {[
                { value: 'CRM SP', sub: '150430' },
                { value: 'UNIFESP', sub: 'Formação' },
                { value: 'USP', sub: 'Especialização' },
                { value: 'SJC', sub: 'Unidade' },
              ].map((s) => (
                <div
                  key={s.sub}
                  className="w-36 h-36 flex flex-col items-center justify-center p-4 rounded-2xl stat-card-3d gsap-stagger-child"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <span
                    className="text-white font-bold text-lg text-center"
                    style={{ fontFamily: 'Noto Serif, serif' }}
                  >
                    {s.value}
                  </span>
                  <div className="w-6 h-px bg-[#00BCE4] my-1.5" />
                  <span
                    className="text-[9px] text-white/40 uppercase tracking-widest font-semibold"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    {s.sub}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          MISSÃO — Split com foto
      ══════════════════════════════════════════════════════ */}
      <section className="py-32" style={{ background: '#ffffff' }}>
        <div className="max-w-screen-2xl mx-auto px-8 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-16 items-center">

            {/* Foto */}
            <div className="md:col-span-5 relative gsap-reveal-left">
              <div
                className="aspect-[4/5] rounded-2xl overflow-hidden relative"
                style={{
                  background: 'linear-gradient(135deg, #f0f5ff 0%, #e8f7fb 100%)',
                  border: '1px solid rgba(2,21,65,0.08)',
                  boxShadow: '0 40px 80px rgba(2,21,65,0.08)',
                }}
              >
                <div className="w-full h-full relative overflow-hidden">
                  <div className="absolute inset-0 scale-110 opacity-25 gsap-parallax" data-depth="8">
                    <AnimatedCell />
                  </div>
                  <img
                    src="/image/drandre.webp"
                    alt="Dr. André Elias Junqueira"
                    className="w-full h-full object-cover relative z-10 gsap-float"
                  />
                </div>
              </div>
              {/* Badge flutuante */}
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
                <p
                  className="text-[9px] uppercase font-bold tracking-widest mt-0.5 text-[#021541]"
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  Anos em Ortopedia
                </p>
              </div>
            </div>

            {/* Texto */}
            <div className="md:col-span-7 md:pl-8 gsap-reveal-right">
              <span
                className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase block mb-5 font-bold"
                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
              >
                — Nossa Missão
              </span>
              <h2
                className="text-5xl text-[#021541] mb-8 font-bold"
                style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
              >
                Medicina que <span className="italic text-[#00BCE4]">respeita</span> sua biologia
              </h2>
              <div className="h-0.5 w-16 bg-[#00BCE4] mb-8 gsap-line-draw" />
              <div className="space-y-5 text-[#718096] leading-relaxed text-lg font-light">
                <p>
                  O Dr. André Elias Junqueira atua com foco em prevenção, ortopedia regenerativa e cirurgia minimamente invasiva. Sua abordagem prioriza usar os recursos do próprio organismo do paciente — evitando ou adiando cirurgias sempre que possível.
                </p>
                <blockquote
                  className="italic text-[#021541] font-medium pl-6 py-2"
                  style={{ borderLeft: '3px solid #00BCE4' }}
                >
                  &ldquo;A medicina do futuro será pautada pela prevenção e pelo conhecimento do próprio corpo. Se o problema é identificado cedo, podemos intervir e evitar cirurgias futuras.&rdquo;
                  <span className="block not-italic text-sm text-[#00BCE4] mt-2 font-bold">
                    — Dr. André Elias Junqueira
                  </span>
                </blockquote>
                <p>
                  Acreditamos que o ambiente de cura começa no primeiro contato. Seguimos o princípio hipocrático: se não for plausível curar, ao menos aliviar e consolar — com transparência e respeito a cada paciente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          EXPERIÊNCIA DO PACIENTE — Bento grid
      ══════════════════════════════════════════════════════ */}
      <section className="py-32" style={{ background: '#f5f6f8' }}>
        <div className="max-w-screen-2xl mx-auto px-8 md:px-12">

          {/* Cabeçalho */}
          <div className="text-center mb-20 gsap-reveal-3d">
            <span
              className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase mb-4 block font-bold"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              — Hospitalidade Premium
            </span>
            <h2
              className="text-5xl text-[#021541] font-bold"
              style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
            >
              Experiência do Paciente
            </h2>
            <div className="h-0.5 w-16 bg-[#00BCE4] mx-auto mt-5 gsap-line-draw" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 perspective-wrap gsap-stagger-parent">

            {/* Concierge — destaque largo */}
            <div
              className="md:col-span-2 treatment-card rounded-2xl p-12 gsap-stagger-child"
            >
              <span className="material-symbols-outlined text-[#00BCE4] mb-6 block" style={{ fontSize: '48px' }}>concierge</span>
              <h3
                className="text-2xl text-[#021541] mb-4 font-bold"
                style={{ fontFamily: 'Noto Serif, serif' }}
              >
                Concierge Dedicado
              </h3>
              <p className="text-[#718096] font-light leading-relaxed max-w-md">
                Acompanhamento personalizado desde o agendamento até o pós-procedimento, garantindo que cada detalhe da sua jornada seja impecável.
              </p>
            </div>

            {/* Lounge — dark */}
            <div
              className="flex flex-col justify-end min-h-64 text-white rounded-2xl p-10 gsap-stagger-child"
              style={{ background: '#021541' }}
            >
              <span className="material-symbols-outlined text-[#00BCE4] mb-6 block" style={{ fontSize: '48px' }}>coffee</span>
              <h3
                className="text-2xl mb-3 font-bold"
                style={{ fontFamily: 'Noto Serif, serif' }}
              >
                Lounge de Acolhimento
              </h3>
              <p className="text-white/50 font-light text-sm">Um refúgio de tranquilidade com menu gourmet e conectividade de alta velocidade.</p>
            </div>

            {/* Privacidade — cyan */}
            <div
              className="flex flex-col justify-end min-h-64 text-white rounded-2xl p-10 gsap-stagger-child"
              style={{ background: '#00BCE4' }}
            >
              <span className="material-symbols-outlined text-[#021541] mb-6 block" style={{ fontSize: '48px' }}>privacy_tip</span>
              <h3
                className="text-2xl mb-3 font-bold text-[#021541]"
                style={{ fontFamily: 'Noto Serif, serif' }}
              >
                Privacidade Total
              </h3>
              <p className="text-[#021541]/70 font-light text-sm">Consultórios isolados acusticamente e fluxos desenhados para discrição absoluta.</p>
            </div>

            {/* Segurança — branco largo */}
            <div
              className="md:col-span-2 flex items-center gap-10 treatment-card rounded-2xl p-10 gsap-stagger-child"
            >
              <div className="flex-1">
                <span className="material-symbols-outlined text-[#00BCE4] mb-6 block" style={{ fontSize: '48px' }}>health_and_safety</span>
                <h3
                  className="text-2xl text-[#021541] mb-4 font-bold"
                  style={{ fontFamily: 'Noto Serif, serif' }}
                >
                  Segurança Sanitária
                </h3>
                <p className="text-[#718096] font-light">
                  Protocolos de esterilização e purificação de ar que excedem as normas internacionais, em um ambiente de nível hospitalar com alma de atelier.
                </p>
              </div>
              <div
                className="hidden lg:flex w-48 h-48 rounded-2xl items-center justify-center shrink-0"
                style={{ background: '#f5f6f8' }}
              >
                <span className="material-symbols-outlined text-[#00BCE4] gsap-float" style={{ fontSize: '80px', opacity: 0.6 }}>verified_user</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          CURRÍCULO — Timeline de formação
      ══════════════════════════════════════════════════════ */}
      <section className="py-32" style={{ background: '#ffffff' }}>
        <div className="max-w-screen-2xl mx-auto px-8 md:px-12">

          {/* Cabeçalho */}
          <div className="text-center mb-20 gsap-reveal-3d">
            <span
              className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase mb-4 block font-bold"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              — Formação & Credenciais
            </span>
            <h2
              className="text-5xl text-[#021541] font-bold"
              style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
            >
              Dr. André Elias Junqueira
            </h2>
            <div className="h-0.5 w-16 bg-[#00BCE4] mx-auto mt-5 mb-4 gsap-line-draw" />
            <p className="text-[#718096] max-w-xl mx-auto font-light">
              CRM SP 150430 · Ortopedista e Traumatologista · Especialista em Ombro, Cotovelo e Dor Intervencionista
            </p>
          </div>

          {/* Cards de credenciais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto perspective-wrap gsap-stagger-parent">
            {CREDENTIALS.map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-4 treatment-card rounded-2xl p-6 gsap-stagger-child"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(0,188,228,0.08)', border: '1px solid rgba(0,188,228,0.15)' }}
                >
                  <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '20px' }}>
                    {item.icon}
                  </span>
                </div>
                <div>
                  <p
                    className="text-[10px] font-bold text-[#00BCE4] uppercase tracking-wider mb-1"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    {item.label}
                  </p>
                  <p className="text-[#021541] font-semibold text-sm">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Sociedades */}
          <div className="mt-14 max-w-4xl mx-auto gsap-reveal-3d">
            <p
              className="text-[10px] font-bold text-[#021541]/40 uppercase tracking-wider mb-5 text-center"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              Sociedades & Associações
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                'SBOT — Comitê de Dor',
                'AAOS — American Academy of Orthopaedic Surgeons',
                'SBRET — Sociedade Brasileira de Regeneração Tecidual',
                'SBED — Sociedade Brasileira para Estudo da Dor',
                'SOBRAMID — Sociedade Brasileira de Médicos Intervencionistas em Dor',
              ].map((s) => (
                <span key={s} className="badge-navy text-[10px]">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          TECNOLOGIA — Cards com ícones grandes
      ══════════════════════════════════════════════════════ */}
      <section className="py-32 overflow-hidden relative" style={{ background: '#f5f6f8' }}>
        <div className="max-w-screen-2xl mx-auto px-8 md:px-12">

          {/* Cabeçalho */}
          <div className="flex flex-col md:flex-row items-end justify-between mb-20 gap-8 gsap-reveal-3d">
            <div className="max-w-xl">
              <span
                className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase block mb-4 font-bold"
                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
              >
                — Equipamentos & Técnicas
              </span>
              <h2
                className="text-5xl text-[#021541] font-bold"
                style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
              >
                Tecnologia de{' '}
                <span className="italic text-[#00BCE4] font-medium">Ponta</span>
              </h2>
              <div className="h-0.5 w-16 bg-[#00BCE4] mt-6 gsap-line-draw" />
              <p className="text-[#718096] mt-5 text-lg font-light">
                Investimos continuamente nas fronteiras da medicina regenerativa e diagnóstica para tratamentos menos invasivos e recuperações aceleradas.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap gsap-scale-in">
              {['ISO 9001:2015', 'SBR ONA III'].map((badge) => (
                <span key={badge} className="badge-navy text-[10px]">{badge}</span>
              ))}
            </div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 perspective-wrap gsap-stagger-parent">
            {TECHS.map((t) => (
              <div
                key={t.title}
                className="treatment-card card-3d-hover rounded-2xl overflow-hidden gsap-stagger-child"
              >
                <div
                  className="h-48 flex items-center justify-center"
                  style={{ background: 'rgba(0,188,228,0.05)' }}
                >
                  <span
                    className="material-symbols-outlined text-[#00BCE4] gsap-float"
                    style={{ fontSize: '72px', opacity: 0.6 }}
                  >
                    {t.icon}
                  </span>
                </div>
                <div className="p-6">
                  <h4
                    className="text-lg text-[#021541] font-bold mb-3"
                    style={{ fontFamily: 'Noto Serif, serif' }}
                  >
                    {t.title}
                  </h4>
                  <p className="text-[#718096] text-sm leading-relaxed font-light">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          UNIDADES — Navy com cards
      ══════════════════════════════════════════════════════ */}
      <section className="py-32 text-white" style={{ background: '#021541' }}>
        <div className="max-w-screen-2xl mx-auto px-8 md:px-12">
          <div className="text-center mb-20 gsap-reveal-3d">
            <span
              className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase mb-4 block font-bold"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              — Onde Atendemos
            </span>
            <h2
              className="text-5xl text-white font-bold"
              style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
            >
              Nossa Unidade
            </h2>
            <div className="h-0.5 w-16 bg-[#00BCE4] mx-auto mt-5 gsap-line-draw" />
            <p className="text-white/40 font-light max-w-xl mx-auto mt-4">
              Localizada estrategicamente em São José dos Campos para oferecer conveniência e excelência técnica.
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            {[
              {
                city: 'São José dos Campos',
                area: 'Jardim Aquarius',
                addr: 'Rua Armando D\'Oliveira Cobra, 50\nSala 1106 · CEP 12246-002',
              },
            ].map((u) => (
              <div
                key={u.city}
                className="group cursor-pointer rounded-2xl overflow-hidden"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div
                  className="relative overflow-hidden aspect-video flex items-center justify-center"
                >
                  <Image
                    src="/image/regen.webp"
                    alt="Clínica São José dos Campos"
                    fill
                    className="object-cover group-hover:scale-105 site-transition"
                  />
                  <div className="absolute inset-0 bg-[#021541]/50" />
                  <span
                    className="relative z-10 material-symbols-outlined text-[#00BCE4] group-hover:scale-110 site-transition gsap-float"
                    style={{ fontSize: '80px', opacity: 0.8 }}
                  >
                    location_city
                  </span>
                </div>
                <div className="flex justify-between items-start p-8 bg-[#021541]/40">
                  <div>
                    <h3
                      className="text-3xl font-bold mb-2"
                      style={{ fontFamily: 'Noto Serif, serif' }}
                    >
                      {u.city}
                    </h3>
                    <p
                      className="text-[#00BCE4] text-[10px] uppercase tracking-widest mb-4 font-bold"
                      style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                    >
                      {u.area}
                    </p>
                    <p className="text-white/40 text-sm whitespace-pre-line font-light">{u.addr}</p>
                  </div>
                  <span
                    className="material-symbols-outlined text-white/15 group-hover:text-[#00BCE4] site-transition"
                    style={{ fontSize: '40px' }}
                  >
                    location_on
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          CTA FINAL
      ══════════════════════════════════════════════════════ */}
      <section className="py-28 cta-block" style={{ background: '#021541' }}>
        <div className="max-w-4xl mx-auto px-8 text-center gsap-reveal-3d" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '5rem' }}>
          <span
            className="text-[11px] text-[#00BCE4] tracking-[0.3em] uppercase block mb-6 font-bold"
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            — Nova Experiência em Ortopedia
          </span>
          <h2
            className="text-5xl md:text-6xl text-white mb-6 font-bold"
            style={{ fontFamily: 'Noto Serif, serif', letterSpacing: '-0.02em' }}
          >
            Agende sua{' '}
            <span className="italic text-[#00BCE4] font-medium">avaliação.</span>
          </h2>
          <div className="h-0.5 w-16 bg-[#00BCE4] mx-auto mb-8 gsap-line-draw" />
          <div className="flex flex-wrap gap-4 justify-center perspective-wrap gsap-stagger-parent">
            <Link href="/site/agendar" id="clinica-cta" className="btn-cyan-site gsap-stagger-child">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>calendar_month</span>
              Agendar Consulta
            </Link>
            <a
              href="https://wa.me/5512981767896"
              target="_blank"
              rel="noopener noreferrer"
              className="gsap-stagger-child inline-flex items-center gap-2 px-8 py-3.5 text-white text-[11px] font-bold uppercase tracking-widest site-transition hover:bg-white/8"
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
