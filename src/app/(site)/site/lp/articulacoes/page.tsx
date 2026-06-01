'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'

const FAQ_ITEMS = [
  {
    q: 'As infiltrações regenerativas são dolorosas?',
    a: 'Os procedimentos são realizados sob anestesia local e, em muitos casos, guiados por ultrassonografia de alta resolução. Isso garante que a agulha chegue exatamente ao ponto da lesão com o mínimo de desconforto possível para o paciente.',
  },
  {
    q: 'Quanto tempo leva para sentir os resultados?',
    a: 'Varia de acordo com a técnica. A lubrificação com Ácido Hialurônico costuma trazer alívio mecânico imediato ou em poucos dias. Já terapias celulares como PRP ou BMAC estimulam a regeneração biológica gradual, com picos de melhora entre 4 e 12 semanas.',
  },
  {
    q: 'O tratamento substitui a necessidade de cirurgia?',
    a: 'Para muitos pacientes com artrose leve a moderada ou tendinopatias crônicas, as terapias regenerativas adiam ou evitam totalmente a necessidade de próteses ou cirurgias abertas, restaurando a biologia natural da articulação.',
  },
  {
    q: 'É preciso ficar em repouso absoluto após o procedimento?',
    a: 'Não. São procedimentos ambulatoriais rápidos (você vai embora no mesmo dia). Geralmente é recomendado apenas um repouso relativo de atividades de alto impacto por 48 a 72 horas, podendo retornar ao trabalho e rotinas leves imediatamente.',
  },
  {
    q: 'O plano de saúde cobre estes tratamentos?',
    a: 'A consulta médica de avaliação e exames de imagem costumam ser cobertos normalmente pelos planos por meio de reembolso ou rede credenciada. O procedimento ortobiológico em si é particular, mas fornecemos toda a documentação e relatórios detalhados para solicitação de reembolso.',
  },
]

export default function ArticulacoesLP() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', complaint: '', joint: 'joelho' })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [activeFaq, setActiveFaq] = useState<number | null>(null)
  
  // Captura UTMs da URL
  const [utms, setUtms] = useState({ source: 'google_ads', campaign: '' })
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setUtms({
      source: params.get('utm_source') || 'google_ads',
      campaign: params.get('utm_campaign') || 'lp_articulacoes_infiltracoes',
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Por favor, preencha seu nome e telefone.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email,
          complaint: `Articulação afetada: ${form.joint.toUpperCase()}. Queixa: ${form.complaint}`,
          utmSource: utms.source,
          utmCampaign: utms.campaign,
        }),
      })

      if (!res.ok) throw new Error()
      
      setSubmitted(true)
      toast.success('Recebemos seus dados! Nossa equipe entrará em contato em breve.')
      
      // Tracking manual do lead no Analytics First Party
      if (typeof (window as any).twixTrack === 'function') {
        (window as any).twixTrack('click', 'Conversão Lead LP Articulações', { joint: form.joint })
      }
    } catch {
      toast.error('Ocorreu um erro ao enviar seus dados. Tente novamente ou nos chame no WhatsApp.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-[#021541] font-sans selection:bg-[#00BCE4] selection:text-white">
      <Toaster position="top-right" />
      
      {/* ── HEADER DE CONFIANÇA ── */}
      <header className="bg-white/80 backdrop-blur-md border-b border-[#021541]/06 sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00BCE4]" />
            <span className="font-extrabold text-base tracking-[0.12em] uppercase font-mono">
              REGEN<span className="text-[#00BCE4]">ORTHO</span>
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-6">
            <span className="text-xs font-semibold text-[#718096] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#00BCE4] text-base">verified</span>
              CRM-SP: 172.932 | RQE: 89.243
            </span>
            <a 
              href="https://wa.me/5512981767896?text=Ol%C3%A1%2C+vi+a+p%C3%A1gina+sobre+regenera%C3%A7%C3%A3o+articular+e+gostaria+de+saber+mais."
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#00BCE4]/08 text-[#00BCE4] hover:bg-[#00BCE4] hover:text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">message</span>
              Falar pelo WhatsApp
            </a>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative bg-gradient-to-br from-[#021541] via-[#032170] to-[#021541] py-20 lg:py-28 text-white overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-[#00BCE4]/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-[#00BCE4]/05 blur-3xl pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center relative z-10">
          {/* Lado Esquerdo - Chamada Persuasiva */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <span 
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00BCE4]/15 border border-[#00BCE4]/30 text-[#00BCE4] text-[10px] font-bold uppercase tracking-widest"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#00BCE4] animate-ping" />
              Tecnologia em Medicina Regenerativa
            </span>
            <h1 
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              Regenere suas Articulações e <span className="text-[#00BCE4] italic font-normal">Elimine a Dor</span> Sem Cirurgia
            </h1>
            <p className="text-white/60 text-base sm:text-lg font-light leading-relaxed max-w-2xl">
              Tratamento avançado de infiltrações guiadas por imagem com PRP, BMAC e Ácido Hialurônico de alta viscosidade para joelho, ombro, quadril e coluna. Recupere sua mobilidade e qualidade de vida de forma rápida e segura.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 max-w-xl mx-auto lg:mx-0">
              {[
                { val: '94%', desc: 'De satisfação clínica' },
                { val: 'Minimante', desc: 'Invasivo e sem cortes' },
                { val: 'Rápido', desc: 'Retorno às atividades' }
              ].map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-white/04 border border-white/08 text-center sm:text-left">
                  <span className="text-xl font-extrabold text-[#00BCE4] block font-mono">{item.val}</span>
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Lado Direito - Glassmorphism Lead Form */}
          <div className="lg:col-span-5 relative">
            <div className="absolute inset-0 bg-[#00BCE4]/10 rounded-3xl blur-2xl pointer-events-none" />
            <div className="relative bg-white/05 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
              {!submitted ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="text-center sm:text-left mb-6">
                    <h3 className="text-xl font-bold text-white leading-tight">Agendar Avaliação Médica</h3>
                    <p className="text-white/40 text-xs mt-1">Preencha o formulário e receba o contato de nossa equipe técnica para analisar seu caso.</p>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">Nome Completo</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 text-base">person</span>
                      <input 
                        type="text" 
                        required
                        value={form.name}
                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="Ex: Carlos Silva"
                        className="w-full bg-white/06 border border-white/08 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:bg-white/10 focus:border-[#00BCE4] transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">WhatsApp ou Telefone</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 text-base">phone</span>
                      <input 
                        type="tel" 
                        required
                        value={form.phone}
                        onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                        placeholder="Ex: (12) 99999-9999"
                        className="w-full bg-white/06 border border-white/08 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:bg-white/10 focus:border-[#00BCE4] transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">Articulação Afetada</label>
                    <select
                      value={form.joint}
                      onChange={e => setForm(p => ({ ...p, joint: e.target.value }))}
                      className="w-full bg-[#021541] border border-white/08 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00BCE4] transition-all"
                    >
                      <option value="joelho">Joelho (Artrose, Lesão de Cartilagem, Menisco)</option>
                      <option value="ombro">Ombro (Tendinite, Manguito Rotador, Bursite)</option>
                      <option value="coluna">Coluna (Hérnia, Desgaste, Dor Lombar)</option>
                      <option value="quadril">Quadril (Desgaste, Artrose, Impacto)</option>
                      <option value="outra">Outras Dores Articulares</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">Breve queixa ou sintoma (Opcional)</label>
                    <textarea 
                      value={form.complaint}
                      onChange={e => setForm(p => ({ ...p, complaint: e.target.value }))}
                      placeholder="Ex: Sinto muita dor ao caminhar ou descer escadas há 6 meses..."
                      rows={2}
                      className="w-full bg-white/06 border border-white/08 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:bg-white/10 focus:border-[#00BCE4] transition-all resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-[#00BCE4] hover:bg-[#009ebd] disabled:opacity-50 text-[#021541] font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-[#00BCE4]/20 mt-2"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-[#021541] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">event_available</span>
                        Quero Agendar Minha Avaliação
                      </>
                    )}
                  </button>
                  <p className="text-[9px] text-white/30 text-center leading-relaxed mt-2">
                    🔒 Seus dados estão seguros e protegidos pela LGPD. Usaremos seus contatos apenas para alinhar a sua avaliação médica.
                  </p>
                </form>
              ) : (
                <div className="text-center py-10 space-y-6">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto text-green-400">
                    <span className="material-symbols-outlined text-3xl">done_all</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Cadastro Confirmado!</h3>
                    <p className="text-white/60 text-sm mt-2 leading-relaxed">
                      Obrigado pelo contato, <span className="text-white font-bold">{form.name}</span>. Nossa equipe técnica entrará em contato via WhatsApp ou ligação no número <span className="text-white font-bold">{form.phone}</span> em poucas horas para dar andamento ao seu caso.
                    </p>
                  </div>
                  <a
                    href={`https://wa.me/5512981767896?text=Ol%C3%A1%2C+meu+nome+%C3%A9+${encodeURIComponent(form.name)}+e+acabei+de+me+cadastrar+pela+p%C3%A1gina+sobre+dores+nas+articula%C3%A7%C3%B5es.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg"
                  >
                    <span className="material-symbols-outlined">message</span>
                    Acelerar Contato via WhatsApp
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── AS DORES MAIS COMUNS ── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[#00BCE4] text-[10px] uppercase tracking-widest font-extrabold block mb-2">— Sintomas Frequentes</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#021541]" style={{ fontFamily: 'Noto Serif, serif' }}>
              Identifica-se com algum destes cenários?
            </h2>
            <div className="h-0.5 w-12 bg-[#00BCE4] mx-auto mt-4" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { t: 'Dor persistente nas articulações', d: 'Fisgadas ou incômodo chato que não passa mesmo com repouso, piorando com frio ou mudanças de clima.' },
              { t: 'Desgaste e estalos frequentes', d: 'Sensação de "areia" ou estalos constantes ao movimentar joelhos, ombros ou quadril, limitando o movimento.' },
              { t: 'Dependência de analgésicos', d: 'Tomar anti-inflamatórios constantemente para mascarar a dor, correndo o risco de sofrer com efeitos colaterais estomacais ou renais.' },
              { t: 'Medo de cirurgia invasiva (prótese)', d: 'O receio da mesa de cirurgia, de um pós-operatório doloroso e de uma reabilitação lenta que te afasta da rotina.' }
            ].map((item, idx) => (
              <div key={idx} className="flex gap-4 p-5 rounded-2xl bg-[#f5f6f8] border border-[#021541]/03">
                <span className="material-symbols-outlined text-red-500 shrink-0 mt-0.5">report_problem</span>
                <div>
                  <h4 className="font-extrabold text-sm text-[#021541]">{item.t}</h4>
                  <p className="text-xs text-[#718096] mt-1 leading-relaxed font-light">{item.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA A REGENERAÇÃO POR INFILTRAÇÃO ── */}
      <section className="py-20 bg-[#021541] text-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(circle at 80% 20%, rgba(0,188,228,0.10) 0%, transparent 50%)',
        }} />
        
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[#00BCE4] text-[10px] uppercase tracking-widest font-extrabold block mb-2">— Terapias Celulares Inovadoras</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ fontFamily: 'Noto Serif, serif' }}>
              O Poder das Infiltrações Regenerativas
            </h2>
            <p className="text-white/50 text-xs mt-2">A medicina regenerativa utiliza os melhores recursos biológicos e sintéticos para restaurar tecidos.</p>
            <div className="h-0.5 w-12 bg-[#00BCE4] mx-auto mt-4" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Lubrificação Articular',
                tag: 'Ácido Hialurônico',
                icon: 'hub',
                desc: 'Infiltração de alta viscosidade para criar um colchão protetor dentro da articulação, reduzindo o atrito ósseo, aliviando o impacto mecânico e protegendo a cartilagem restante.'
              },
              {
                title: 'Fatores de Crescimento',
                tag: 'PRP — Plasma Rico em Plaquetas',
                icon: 'water_drop',
                desc: 'Concentrado autólogo coletado do próprio paciente e centrifugado para isolar plaquetas ricas em proteínas reparadoras, acelerando a cicatrização de tendões, ligamentos e artrose.'
              },
              {
                title: 'Células Mesenquimais',
                tag: 'BMAC — Terapia de Medula Óssea',
                icon: 'biotech',
                desc: 'Terapia altamente avançada que aspira pequenas frações de células progenitoras da medula óssea para injetar diretamente na articulação desgastada, estimulando a autorregeneração celular.'
              }
            ].map((card, idx) => (
              <div key={idx} className="p-8 rounded-2xl bg-white/04 border border-white/08 relative group hover:border-[#00BCE4]/30 transition-all">
                <div className="w-10 h-10 rounded-xl bg-[#00BCE4]/10 border border-[#00BCE4]/20 flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '20px' }}>{card.icon}</span>
                </div>
                <span className="text-[10px] text-[#00BCE4] uppercase font-bold tracking-widest block mb-1">{card.tag}</span>
                <h3 className="text-lg font-extrabold text-white mb-3">{card.title}</h3>
                <p className="text-white/60 text-xs font-light leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AUTORIDADE MÉDICA ── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-[280px] aspect-[4/5] rounded-2xl overflow-hidden border border-[#021541]/10 shadow-xl bg-[#f5f6f8]">
              <Image 
                src="/image/drandre.webp"
                alt="Dr. André Elias Junqueira"
                fill
                className="object-cover"
                sizes="280px"
              />
              <div className="absolute bottom-4 left-4 right-4 bg-[#021541] px-4 py-2 rounded-xl text-center border border-white/10">
                <span className="text-[#00BCE4] text-[10px] font-black uppercase tracking-widest">DR. ANDRÉ JUNQUEIRA</span>
                <span className="text-[8px] text-white/50 block font-bold uppercase mt-0.5">CRM-SP 172.932 | RQE 89.243</span>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
            <span className="text-[#00BCE4] text-[10px] uppercase tracking-widest font-extrabold block">— Responsável Técnico</span>
            <h2 className="text-3xl font-extrabold text-[#021541]" style={{ fontFamily: 'Noto Serif, serif' }}>
              Tratamento com Rigor Clínico e Acadêmico
            </h2>
            <p className="text-[#718096] text-sm font-light leading-relaxed">
              O **Dr. André Elias Junqueira** é ortopedista e traumatologista com ampla dedicação no tratamento intervencionista da dor e medicina regenerativa. Com formação em grandes centros nacionais, seu compromisso é trazer alívio focado na biologia de cada paciente, de forma ética e sem tratamentos invasivos desnecessários.
            </p>
            <ul className="space-y-2 text-xs font-medium text-[#021541] inline-block text-left">
              {[
                'Graduação e Residência em Ortopedia na EPM-UNIFESP',
                'Especialização em Ombro, Cotovelo e Dor Crônica',
                'Treinamento e Pós em Procedimentos Guiados por Imagem (USG)',
                'Membro da SBOT, AAOS (EUA) e Sociedade Brasileira de Dor (SBED)'
              ].map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#00BCE4]/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[#00BCE4] text-xs">check</span>
                  </span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── FAQ SECTION ── */}
      <section className="py-20 bg-[#f5f6f8] border-t border-[#021541]/05">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[#00BCE4] text-[10px] uppercase tracking-widest font-extrabold block mb-2">— Tire suas Dúvidas</span>
            <h2 className="text-3xl font-extrabold text-[#021541]" style={{ fontFamily: 'Noto Serif, serif' }}>
              Perguntas Frequentes
            </h2>
            <div className="h-0.5 w-12 bg-[#00BCE4] mx-auto mt-4" />
          </div>

          <div className="space-y-4">
            {FAQ_ITEMS.map((item, idx) => (
              <div 
                key={idx} 
                className="bg-white border border-[#021541]/06 rounded-xl overflow-hidden shadow-sm transition-all"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left font-extrabold text-sm text-[#021541] hover:bg-[#021541]/02 transition-colors select-none"
                >
                  <span>{item.q}</span>
                  <span className={`material-symbols-outlined text-[#00BCE4] transition-transform ${activeFaq === idx ? 'rotate-180' : ''}`}>
                    keyboard_arrow_down
                  </span>
                </button>
                {activeFaq === idx && (
                  <div className="px-5 pb-5 pt-1 text-xs text-[#718096] leading-relaxed font-light border-t border-[#021541]/03">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER DE FECHAMENTO ── */}
      <footer className="py-12 bg-[#021541] text-white/50 border-t border-white/06 text-center text-xs">
        <div className="max-w-6xl mx-auto px-6 space-y-6">
          <div className="flex items-center justify-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#00BCE4]" />
            <span className="font-extrabold text-sm tracking-[0.10em] text-white uppercase font-mono">
              REGEN<span className="text-[#00BCE4]">ORTHO</span>
            </span>
          </div>
          <p className="max-w-2xl mx-auto text-[10px] leading-relaxed">
            AVISO LEGAL: Os conteúdos desta página são informativos e baseados na literatura médica de ortopedia e medicina regenerativa. Consultas clínicas individuais são fundamentais para diagnosticar e prescrever qualquer protocolo terapêutico. Dr. André Elias Junqueira | CRM-SP 172.932 | RQE 89.243.
          </p>
          <div className="h-px bg-white/08 max-w-xs mx-auto" />
          <p className="text-[9px]">
            &copy; {new Date().getFullYear()} REGENORTHO. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
