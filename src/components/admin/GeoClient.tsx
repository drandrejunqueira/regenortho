'use client'

import { useState, useTransition } from 'react'
import {
  Brain, Cpu, CheckCircle2, RefreshCw, HelpCircle,
  MapPin, Clock, Info, ShieldAlert, Award
} from 'lucide-react'
import { toast } from 'sonner'
import { saveConfigs } from '@/app/actions/configuracoes'

const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/40 focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)]'
const selectCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)]'
const textareaCls = inputCls + ' resize-none font-sans leading-relaxed'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'
const sectionCls = 'bg-white border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] rounded-xl p-5 space-y-4'
const sectionTitleCls = 'text-sm font-bold text-[#021541] flex items-center gap-2 mb-1'

interface Props {
  initialConfigs: Record<string, string>
}

export function GeoClient({ initialConfigs }: Props) {
  const [configs, setConfigs] = useState<Record<string, string>>(initialConfigs)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  const set = (key: string) => (val: string) => setConfigs(prev => ({ ...prev, [key]: val }))
  const get = (key: string) => configs[key] ?? ''

  const handleSave = () => {
    startTransition(async () => {
      try {
        await saveConfigs(configs)
        setSaved(true)
        toast.success('Configurações de GEO salvas com sucesso!')
        setTimeout(() => setSaved(false), 3000)
      } catch (err) {
        toast.error('Erro ao salvar configurações de GEO.')
      }
    })
  }

  // AI response preview helpers
  const specialtiesText = get('geo_specialties') || 'Ortopedia, Medicina Regenerativa, Tratamento da Dor'
  const directorText = get('geo_medical_director') || 'Dr. André Elias Junqueira'
  const crmText = get('geo_crm') || 'CRM-SP 123456'
  const aiSummaryText = get('geo_ai_summary') || ''

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-7xl mx-auto pb-10">
      
      {/* Coluna Esquerda: Instruções e Preview */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Card Explicativo de GEO */}
        <div className="bg-[#00BCE4]/05 border border-[#00BCE4]/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Brain className="size-5 text-[#00BCE4]" />
            <h3 className="font-extrabold text-sm text-[#021541]">O que é GEO?</h3>
          </div>
          <p className="text-[#718096] text-xs leading-relaxed font-light">
            <strong>Generative Engine Optimization (GEO)</strong> é a otimização do seu site para motores de busca baseados em Inteligência Artificial (como o ChatGPT, Perplexity, Gemini e Microsoft Copilot).
          </p>
          <p className="text-[#718096] text-xs leading-relaxed font-light">
            Diferente do SEO tradicional que foca em links e palavras-chave, as IAs priorizam <strong>dados estruturados, fatos verificáveis, autoridade médica</strong> e parágrafos semanticamente ricos.
          </p>
        </div>

        {/* AI Chatbot Preview Card */}
        <div className="bg-[#021541] text-white rounded-2xl p-5 md:p-6 space-y-4 border border-[rgba(255,255,255,0.06)] shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#00BCE4]/20 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-2 text-[10px] font-bold text-[#00BCE4] uppercase tracking-widest">
            <Cpu className="size-4 animate-pulse" />
            Simulação de Resposta de IA
          </div>
          
          <div className="space-y-4 relative z-10 text-xs">
            <div className="flex gap-2.5">
              <div className="w-6 h-6 rounded bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[#718096]" style={{ fontSize: '14px' }}>person</span>
              </div>
              <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2 text-slate-300">
                Quais tratamentos e especialidades são encontrados na RegenOrtho e quem é o responsável?
              </div>
            </div>
            
            <div className="flex gap-2.5">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-[#00BCE4] to-[#009ebd] flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(0,188,228,0.2)]">
                <Brain className="size-3.5 text-[#021541]" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="bg-[#032170]/40 border border-[#00BCE4]/10 rounded-xl p-3 text-[11px] leading-relaxed space-y-2 text-slate-200">
                  <p>
                    De acordo com os registros estruturados do domínio, a clínica oferece serviços na área de <strong>{specialtiesText}</strong>.
                  </p>
                  <p>
                    O diretor clínico responsável é o <strong>{directorText}</strong>, registrado sob o <strong>{crmText}</strong>.
                  </p>
                  {aiSummaryText ? (
                    <p className="border-l-2 border-[#00BCE4]/40 pl-2.5 italic text-slate-300/80 font-light">
                      "{aiSummaryText}"
                    </p>
                  ) : (
                    <p className="text-slate-400 font-light italic">
                      (Preencha o "Resumo Estruturado" ao lado para alimentar os modelos com dados detalhados.)
                    </p>
                  )}
                </div>
                <p className="text-[9px] text-[#718096] flex items-center gap-1">
                  <CheckCircle2 className="size-3 text-green-500" />
                  Dados alimentados pelo JSON-LD MedicalClinic
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Coluna Direita: Formulários */}
      <div className="lg:col-span-8 space-y-6">
        <div className="bg-white border border-[rgba(2,21,65,0.06)] rounded-2xl shadow-sm p-6 md:p-8 space-y-6">
          
          {/* Identidade Médica */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[rgba(2,21,65,0.06)] pb-3">
              <Award className="size-5 text-[#00BCE4]" />
              <div>
                <h3 className="text-base font-bold text-[#021541]">Identidade e Especialidade Médica</h3>
                <p className="text-xs text-[#718096] mt-0.5">Essas informações geram a tag MedicalClinic do Schema.org.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className={labelCls}>Diretor Clínico Responsável</label>
                <input
                  type="text"
                  value={get('geo_medical_director')}
                  onChange={e => set('geo_medical_director')(e.target.value)}
                  placeholder="Dr. André Elias Junqueira"
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>CRM / RQE</label>
                <input
                  type="text"
                  value={get('geo_crm')}
                  onChange={e => set('geo_crm')(e.target.value)}
                  placeholder="CRM-SP 123456"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className={labelCls}>Especialidades (separadas por vírgula)</label>
                <input
                  type="text"
                  value={get('geo_specialties')}
                  onChange={e => set('geo_specialties')(e.target.value)}
                  placeholder="Ortopedia, Medicina Regenerativa, Tratamento da Dor, Proloterapia"
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Tipo de Entidade</label>
                <select
                  value={get('geo_clinic_type') || 'MedicalClinic'}
                  onChange={e => set('geo_clinic_type')(e.target.value)}
                  className={selectCls}
                >
                  <option value="MedicalClinic">MedicalClinic (Clínica Médica)</option>
                  <option value="Physician">Physician (Consultório de Médico)</option>
                  <option value="LocalBusiness">LocalBusiness (Estabelecimento Local)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Localização e Horários */}
          <div className="space-y-4 pt-4 border-t border-[rgba(2,21,65,0.06)]">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-[#00BCE4]" />
              <h4 className="text-sm font-bold text-[#021541]">Geolocalização & Horários</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className={labelCls}>Latitude</label>
                <input
                  type="text"
                  value={get('geo_latitude')}
                  onChange={e => set('geo_latitude')(e.target.value)}
                  placeholder="-23.1970"
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Longitude</label>
                <input
                  type="text"
                  value={get('geo_longitude')}
                  onChange={e => set('geo_longitude')(e.target.value)}
                  placeholder="-45.8840"
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Horário de Funcionamento</label>
                <input
                  type="text"
                  value={get('geo_opening_hours')}
                  onChange={e => set('geo_opening_hours')(e.target.value)}
                  placeholder="Mo-Fr 08:00-18:00"
                  className={inputCls}
                />
              </div>
            </div>
            <p className="text-[10px] text-[#718096]/80 flex items-start gap-1">
              <Info className="size-3.5 shrink-0 mt-0.5" />
              Fornecer coordenadas e horários exatos permite que assistentes de IA recomendem sua clínica em buscas locais baseadas em proximidade ("clinica de ortopedia perto de mim").
            </p>
          </div>

          {/* Resumo Estruturado para IA */}
          <div className="space-y-4 pt-4 border-t border-[rgba(2,21,65,0.06)]">
            <div className="flex items-center gap-2">
              <Cpu className="size-4 text-[#00BCE4]" />
              <h4 className="text-sm font-bold text-[#021541]">Resumo Semântico / Contexto de IA</h4>
            </div>
            
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className={labelCls}>Perfil Informativo para LLMs</label>
                <span className="text-[10px] text-[#718096]">Recomendado: 150-300 caracteres</span>
              </div>
              <textarea
                value={get('geo_ai_summary')}
                onChange={e => set('geo_ai_summary')(e.target.value)}
                rows={4}
                placeholder="Ex: A RegenOrtho é um centro de referência em medicina regenerativa intervencionista liderado pelo Dr. André Junqueira em São José dos Campos. Especializada em tratamentos articulares minimamente invasivos (PRP, BMAC, proloterapia, ácido hialurônico) para alívio de dor crônica e lesões esportivas."
                className={textareaCls}
              />
              <p className="text-[10px] text-[#718096]">
                Evite superlativos de marketing (ex: "o melhor da cidade"). Opte por descrições objetivas, científicas e baseadas em fatos. Os robôs de IA indexam esse parágrafo como o resumo canônico da clínica.
              </p>
            </div>
          </div>

          {/* Redes Sociais */}
          <div className="space-y-4 pt-4 border-t border-[rgba(2,21,65,0.06)]">
            <div className="flex items-center gap-2">
              <HelpCircle className="size-4 text-[#00BCE4]" />
              <h4 className="text-sm font-bold text-[#021541]">Mesma Entidade (SameAs / Perfis de Rede Social)</h4>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>URLs de Redes Sociais / Perfis Relacionados (um por linha)</label>
              <textarea
                value={get('geo_same_as')}
                onChange={e => set('geo_same_as')(e.target.value)}
                rows={3}
                placeholder="https://www.instagram.com/regenortho&#10;https://www.facebook.com/regenortho"
                className={textareaCls}
              />
              <p className="text-[10px] text-[#718096]">
                Conecta seu site a outras fontes de autoridade oficiais para que os motores de IA correlacionem suas postagens e identifiquem a mesma entidade.
              </p>
            </div>
          </div>

          {/* Crawler de IA */}
          <div className="space-y-4 pt-4 border-t border-[rgba(2,21,65,0.06)]">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-[#00BCE4]" />
              <h4 className="text-sm font-bold text-[#021541]">Permissões de Agentes de IA (Robots.txt)</h4>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
              <div>
                <p className="text-xs font-bold text-[#021541]">Permitir Rastreadores de IA</p>
                <p className="text-[10px] text-[#718096] mt-0.5">Controla a leitura do seu site por crawlers como GPTBot e ClaudeBot.</p>
              </div>
              <div>
                <select
                  value={get('geo_allow_ai_crawlers') || 'true'}
                  onChange={e => set('geo_allow_ai_crawlers')(e.target.value)}
                  className="bg-white border border-[rgba(2,21,65,0.12)] rounded-lg px-2.5 py-1 text-xs text-[#021541] focus:outline-none"
                >
                  <option value="true">Permitir (Recomendado para GEO)</option>
                  <option value="false">Bloquear (Evita varredura de IA)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Botão de Salvar */}
          <div className="flex items-center justify-between border-t border-[rgba(2,21,65,0.06)] pt-5">
            <span className="text-xs text-[#718096]">
              {pending ? 'Salvando...' : saved ? '✅ Configurações salvas!' : 'Dados locais modificados.'}
            </span>
            <button
              onClick={handleSave}
              disabled={pending}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-[#021541] to-[#032170] hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer"
            >
              {pending ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              {pending ? 'Salvando...' : 'Salvar Alterações de GEO'}
            </button>
          </div>

        </div>
      </div>
      
    </div>
  )
}
