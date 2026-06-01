'use client'

import { useState, useTransition } from 'react'
import {
  Globe, Search, Key, Sparkles, RefreshCw, AlertCircle,
  ExternalLink, CheckCircle2, XCircle, Link2, Unlink, Server
} from 'lucide-react'
import { toast } from 'sonner'
import { saveConfigs, reenviarSitemapAgora, desconectarContaGoogle } from '@/app/actions/configuracoes'
import { cn } from '@/lib/utils'

interface Props {
  initialConfigs: Record<string, string>
  googleConnected: boolean
  googleEmail: string | null
  googleConnectedAt: string | null
}

export function ConfiguracoesClient({
  initialConfigs,
  googleConnected,
  googleEmail,
  googleConnectedAt
}: Props) {
  const [activeTab, setActiveTab] = useState<'site' | 'google' | 'ia'>('site')
  const [configs, setConfigs] = useState<Record<string, string>>(initialConfigs)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  // Sitemap sending states
  const [loadingSitemap, setLoadingSitemap] = useState(false)
  const [sitemapStatus, setSitemapStatus] = useState<{ google: boolean; indexnow: boolean } | null>(null)

  const set = (key: string) => (val: string) => setConfigs(prev => ({ ...prev, [key]: val }))
  const get = (key: string) => configs[key] ?? ''

  const handleSave = () => {
    startTransition(async () => {
      try {
        await saveConfigs(configs)
        setSaved(true)
        toast.success('Configurações salvas com sucesso!')
        setTimeout(() => setSaved(false), 3000)
      } catch (err) {
        toast.error('Erro ao salvar configurações.')
      }
    })
  }

  const handleConnectGoogle = () => {
    window.location.href = '/api/admin/google/connect'
  }

  const handleDisconnectGoogle = async () => {
    if (!confirm('Deseja realmente desconectar a conta do Google? O painel de tráfego perderá a integração.')) return
    try {
      await desconectarContaGoogle()
      toast.success('Conta Google desconectada!')
      window.location.reload()
    } catch {
      toast.error('Erro ao desconectar conta Google.')
    }
  }

  const handleReenviarSitemap = async () => {
    setLoadingSitemap(true)
    setSitemapStatus(null)
    try {
      const res = await reenviarSitemapAgora()
      setSitemapStatus(res)
      if (res.google && res.indexnow) {
        toast.success('Sitemap e IndexNow enviados com sucesso!')
      } else {
        toast.warning('Sitemap enviado, mas houve falha parcial no IndexNow ou Google.')
      }
    } catch {
      toast.error('Erro ao reenviar sitemap.')
    } finally {
      setLoadingSitemap(false)
    }
  }

  const sitemapUrl = `${get('site_url').replace(/\/$/, '')}/sitemap.xml`

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-7xl mx-auto">
      {/* Sidebar de Abas */}
      <div className="lg:col-span-3 space-y-2 bg-white p-4 border border-[rgba(2,21,65,0.06)] rounded-2xl shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab('site')}
          className={cn(
            "w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-left",
            activeTab === 'site'
              ? "bg-[#021541] text-white shadow-sm"
              : "text-[#718096] hover:text-[#021541] hover:bg-[rgba(2,21,65,0.04)]"
          )}
        >
          <Globe className="size-4" />
          Site & Sitemap
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('google')}
          className={cn(
            "w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-left",
            activeTab === 'google'
              ? "bg-[#021541] text-white shadow-sm"
              : "text-[#718096] hover:text-[#021541] hover:bg-[rgba(2,21,65,0.04)]"
          )}
        >
          <Search className="size-4" />
          Google GA4 & GSC
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ia')}
          className={cn(
            "w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-left",
            activeTab === 'ia'
              ? "bg-[#021541] text-white shadow-sm"
              : "text-[#718096] hover:text-[#021541] hover:bg-[rgba(2,21,65,0.04)]"
          )}
        >
          <Key className="size-4" />
          Inteligência Artificial
        </button>
      </div>

      {/* Painel de Configurações */}
      <div className="lg:col-span-9 space-y-6">
        <div className="bg-white border border-[rgba(2,21,65,0.06)] rounded-2xl shadow-sm p-6 md:p-8 space-y-6">
          
          {/* TAB 1: SITE & SITEMAP */}
          {activeTab === 'site' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-[#021541] flex items-center gap-2">
                  <Globe className="size-5 text-[#00BCE4]" />
                  Domínio e SEO Básico
                </h3>
                <p className="text-xs text-[#718096] mt-1 leading-relaxed">
                  Defina o endereço canônico do seu site e chaves de validação do domínio.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">URL Base do Site</label>
                  <input
                    type="url"
                    value={get('site_url')}
                    onChange={e => set('site_url')(e.target.value)}
                    placeholder="https://regenortho.com.br"
                    className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-xs text-[#021541] focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)] font-mono"
                  />
                  <p className="text-[10px] text-[#718096]">Sem barra no final. Ex: https://regenortho.com.br</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">Google Site Verification</label>
                  <input
                    type="text"
                    value={get('google_site_verification')}
                    onChange={e => set('google_site_verification')(e.target.value)}
                    placeholder="abc123xyz..."
                    className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-xs text-[#021541] focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)] font-mono"
                  />
                  <p className="text-[10px] text-[#718096]">Código da meta tag para provar posse no Google Search Console.</p>
                </div>
              </div>

              <div className="border-t border-[rgba(2,21,65,0.06)] pt-5 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-[#021541] flex items-center gap-1.5">
                    <Server className="size-4 text-[#00BCE4]" />
                    Parâmetros do Sitemap XML
                  </h4>
                  <p className="text-xs text-[#718096] mt-0.5">Controla como o sitemap é estruturado para os indexadores.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">Frequência de Atualização</label>
                    <select
                      value={get('sitemap_frequencia') || 'daily'}
                      onChange={e => set('sitemap_frequencia')(e.target.value)}
                      className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-xs text-[#021541] focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)]"
                    >
                      <option value="always">Sempre (always)</option>
                      <option value="hourly">Por hora (hourly)</option>
                      <option value="daily">Diariamente (daily)</option>
                      <option value="weekly">Semanalmente (weekly)</option>
                      <option value="monthly">Mensalmente (monthly)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">Prioridade Padrão</label>
                    <select
                      value={get('sitemap_prioridade') || '0.8'}
                      onChange={e => set('sitemap_prioridade')(e.target.value)}
                      className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-xs text-[#021541] focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)] font-mono"
                    >
                      {['1.0','0.9','0.8','0.7','0.6','0.5'].map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {get('site_url') && (
                  <div className="flex items-center gap-2 p-3.5 bg-[rgba(0,188,228,0.04)] border border-[rgba(0,188,228,0.1)] rounded-xl">
                    <Globe className="size-4 text-[#00BCE4] shrink-0" />
                    <span className="text-[11px] text-[#718096]">Sitemap público ativo em:</span>
                    <a
                      href={sitemapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#00BCE4] font-bold font-mono hover:underline flex items-center gap-1"
                    >
                      {sitemapUrl}
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {/* Submissão Manual */}
              <div className="border-t border-[rgba(2,21,65,0.06)] pt-5 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-[#021541] flex items-center gap-1.5">
                    <Sparkles className="size-4 text-[#00BCE4]" />
                    Notificar Mecanismos de Busca
                  </h4>
                  <p className="text-xs text-[#718096] mt-0.5">Envie e force a indexação do sitemap no Google e Bing (IndexNow).</p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-4">
                  <p className="text-xs text-[#718096] leading-relaxed font-light">
                    O sitemap é atualizado automaticamente. Clique no botão abaixo para forçar o reenvio das novas páginas (incluindo LP e termos do glossário) para Google Search Console e o protocolo IndexNow.
                  </p>
                  
                  <button
                    type="button"
                    onClick={handleReenviarSitemap}
                    disabled={loadingSitemap || !get('site_url')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-[#021541] to-[#032170] hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    <RefreshCw className={cn("size-3.5", loadingSitemap && "animate-spin")} />
                    {loadingSitemap ? 'Enviando...' : 'Reenviar Sitemap Agora'}
                  </button>

                  {sitemapStatus && (
                    <div className={cn(
                      "flex items-start gap-3 p-4 rounded-xl border text-xs",
                      sitemapStatus.google && sitemapStatus.indexnow
                        ? "bg-green-500/10 border-green-500/20 text-green-800"
                        : "bg-amber-500/10 border-amber-500/20 text-amber-800"
                    )}>
                      {sitemapStatus.google && sitemapStatus.indexnow ? (
                        <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-green-600" />
                      ) : (
                        <AlertCircle className="size-4 mt-0.5 shrink-0 text-amber-600" />
                      )}
                      <div>
                        <p className="font-bold">Resultado do envio:</p>
                        <ul className="list-disc list-inside mt-1 space-y-0.5">
                          <li>Google Search Console: {sitemapStatus.google ? '✅ Sucesso' : '❌ Falha'}</li>
                          <li>IndexNow (Bing / Yandex): {sitemapStatus.indexnow ? '✅ Sucesso' : '❌ Falha'}</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GOOGLE INTEGRATIONS */}
          {activeTab === 'google' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-[#021541] flex items-center gap-2">
                  <Search className="size-5 text-[#00BCE4]" />
                  Google APIs & OAuth
                </h3>
                <p className="text-xs text-[#718096] mt-1 leading-relaxed">
                  Conecte a conta administrativa Google para ler dados de buscas e acessos das Landing Pages no painel de tráfego.
                </p>
              </div>

              {/* Status Conexão */}
              <div className="p-5 rounded-2xl border border-[rgba(2,21,65,0.06)] shadow-sm bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                    googleConnected ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"
                  )}>
                    {googleConnected ? <Link2 className="size-5" /> : <Unlink className="size-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-[#021541] text-sm">
                      {googleConnected ? 'Conectado ao Google' : 'Sem Conexão Ativa'}
                    </h4>
                    <p className="text-xs text-[#718096] mt-0.5">
                      {googleConnected
                        ? `Conta: ${googleEmail || 'Desconhecida'} · Conexão em: ${googleConnectedAt ? new Date(googleConnectedAt).toLocaleDateString('pt-BR') : '—'}`
                        : 'Permita ao sistema acessar seus dados de GSC e Google Analytics.'
                      }
                    </p>
                  </div>
                </div>

                <div>
                  {googleConnected ? (
                    <button
                      type="button"
                      onClick={handleDisconnectGoogle}
                      className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                    >
                      <Unlink className="size-3.5" />
                      Desconectar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnectGoogle}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#00BCE4] hover:bg-[#009ebd] text-[#021541] text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      <Link2 className="size-3.5" />
                      Conectar Google
                    </button>
                  )}
                </div>
              </div>

              {/* Parâmetros Google GSC & GA4 */}
              <div className="border-t border-[rgba(2,21,65,0.06)] pt-5 space-y-4">
                <h4 className="text-sm font-bold text-[#021541]">Identificação das Propriedades</h4>
                <p className="text-xs text-[#718096] leading-relaxed">
                  Informe quais propriedades da sua conta do Search Console e do Analytics 4 representam este site para que os relatórios leiam os dados corretos.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">Site do Search Console</label>
                    <input
                      type="text"
                      value={get('google_gsc_site')}
                      onChange={e => set('google_gsc_site')(e.target.value)}
                      placeholder="https://regenortho.com.br/"
                      className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-xs text-[#021541] focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)] font-mono"
                    />
                    <p className="text-[10px] text-[#718096]">Deve corresponder exatamente à URL (com barra) ou domínio "sc-domain:..."</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">ID da Propriedade GA4</label>
                    <input
                      type="text"
                      value={get('google_ga4_property')}
                      onChange={e => set('google_ga4_property')(e.target.value)}
                      placeholder="123456789"
                      className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-xs text-[#021541] focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)] font-mono"
                    />
                    <p className="text-[10px] text-[#718096]">Apenas os números da propriedade. Encontre no painel Admin do GA4.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ARTIFICIAL INTELLIGENCE */}
          {activeTab === 'ia' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-[#021541] flex items-center gap-2">
                  <Key className="size-5 text-[#00BCE4]" />
                  Inteligência Artificial (Glossário e Copywriting)
                </h3>
                <p className="text-xs text-[#718096] mt-1 leading-relaxed">
                  Configure as chaves e modelos de Inteligência Artificial para gerar verbetes e copy do glossário clínico automaticamente.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">Motor de IA Padrão</label>
                  <select
                    value={get('ia_motor_nome') || 'gemini'}
                    onChange={e => set('ia_motor_nome')(e.target.value)}
                    className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-xs text-[#021541] focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)]"
                  >
                    <option value="gemini">Gemini API (Google)</option>
                    <option value="openai">OpenAI GPT (Microsoft)</option>
                    <option value="openrouter">OpenRouter API (Multi-Modelos)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">Modelo Preferido</label>
                  <input
                    type="text"
                    value={get('ia_modelo') || 'gemini-1.5-flash'}
                    onChange={e => set('ia_modelo')(e.target.value)}
                    placeholder="gemini-1.5-flash"
                    className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-xs text-[#021541] focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)] font-mono"
                  />
                  <p className="text-[10px] text-[#718096]">Modelo utilizado para a escrita clínica técnica. Ex: gemini-1.5-flash ou gpt-4o-mini.</p>
                </div>
              </div>

              <div className="border-t border-[rgba(2,21,65,0.06)] pt-5 space-y-4">
                <h4 className="text-sm font-bold text-[#021541]">Chaves de API (Credentials)</h4>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">Gemini API Key</label>
                    <input
                      type="password"
                      value={get('gemini_api_key')}
                      onChange={e => set('gemini_api_key')(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-xs text-[#021541] focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)] font-mono"
                    />
                    <p className="text-[10px] text-[#718096]">Chave obtida no Google AI Studio. Usada quando o motor for Gemini.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">OpenAI API Key</label>
                    <input
                      type="password"
                      value={get('openai_api_key')}
                      onChange={e => set('openai_api_key')(e.target.value)}
                      placeholder="sk-..."
                      className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-xs text-[#021541] focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)] font-mono"
                    />
                    <p className="text-[10px] text-[#718096]">Chave de API da OpenAI. Usada quando o motor for OpenAI.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">OpenRouter API Key</label>
                    <input
                      type="password"
                      value={get('openrouter_api_key')}
                      onChange={e => set('openrouter_api_key')(e.target.value)}
                      placeholder="sk-or-..."
                      className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-xs text-[#021541] focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)] font-mono"
                    />
                    <p className="text-[10px] text-[#718096]">Chave de API obtida no OpenRouter. Usada quando o motor for OpenRouter.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botão de Salvar Alterações */}
          <div className="flex items-center justify-between border-t border-[rgba(2,21,65,0.06)] pt-5">
            <span className="text-xs text-[#718096]">
              {pending ? 'Salvando alterações...' : saved ? '✅ Salvo!' : 'Campos modificados localmente.'}
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-[#021541] to-[#032170] hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer"
            >
              {pending ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              {pending ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
