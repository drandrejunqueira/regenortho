'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import ImageUploader from '@/components/shared/ImageUploader'

const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/40 focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)]'
const textareaCls = inputCls + ' resize-none'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'
const sectionCls = 'bg-white border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] rounded-xl p-5 space-y-4'
const sectionTitleCls = 'text-sm font-bold text-[#021541] flex items-center gap-2 mb-1'

interface SeoSettings {
  seoTitle: string
  seoDescription: string
  seoKeywords: string
  ogImageUrl: string
  gaId: string
  gtmId: string
}

const DEFAULT: SeoSettings = { seoTitle: '', seoDescription: '', seoKeywords: '', ogImageUrl: '', gaId: '', gtmId: '' }

export default function SeoPage() {
  const [form, setForm] = useState<SeoSettings>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/configuracoes/sistema')
      .then((r) => r.json())
      .then(({ data }) => { if (data) setForm({ seoTitle: data.seoTitle ?? '', seoDescription: data.seoDescription ?? '', seoKeywords: data.seoKeywords ?? '', ogImageUrl: data.ogImageUrl ?? '', gaId: data.gaId ?? '', gtmId: data.gtmId ?? '' }) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function set(key: keyof SeoSettings, value: string) { setForm((p) => ({ ...p, [key]: value })) }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/configuracoes/sistema', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error()
      toast.success('SEO salvo!')
    } catch { toast.error('Erro ao salvar') } finally { setSaving(false) }
  }

  if (loading) return <p className="text-sm text-[#718096] py-8 text-center">Carregando...</p>

  const titleLen = (form.seoTitle ?? '').length
  const descLen = (form.seoDescription ?? '').length

  return (
    <div className="space-y-5">

      <div className={sectionCls}>
        <div className={sectionTitleCls}>
          <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '18px' }}>travel_explore</span>
          Meta Tags
        </div>
        <p className="text-xs text-[#718096] mb-4">Informações exibidas nos resultados de busca e ao compartilhar links.</p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className={labelCls}>Meta Title</label>
              <span className={`text-[10px] font-technical ${titleLen > 60 ? 'text-[#ffb4ab]' : 'text-[#718096]'}`}>{titleLen}/70</span>
            </div>
            <input value={form.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} maxLength={70} placeholder="Regem Orto — Clínica de Ortopedia em São José dos Campos" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className={labelCls}>Meta Description</label>
              <span className={`text-[10px] font-technical ${descLen > 155 ? 'text-[#ffb4ab]' : 'text-[#718096]'}`}>{descLen}/160</span>
            </div>
            <textarea value={form.seoDescription} onChange={(e) => set('seoDescription', e.target.value)} maxLength={160} rows={3} placeholder="Clínica especializada em ortopedia, medicina do esporte e procedimentos regenerativos..." className={textareaCls} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Palavras-chave (separadas por vírgula)</label>
            <input value={form.seoKeywords} onChange={(e) => set('seoKeywords', e.target.value)} placeholder="ortopedia, medicina esportiva, PRP, São José dos Campos" className={inputCls} />
          </div>

          {/* OG Image upload */}
          <ImageUploader
            type="og"
            label="Imagem de Preview (Open Graph)"
            hint="Arraste ou clique · 1200×630px · esta imagem aparece ao compartilhar o link"
            currentUrl={form.ogImageUrl || null}
            onUploaded={(url) => set('ogImageUrl', url)}
            previewAspect="1200/630"
          />
        </div>

        {/* SERP preview */}
        {(form.seoTitle || form.seoDescription) && (
          <div className="mt-2 p-4 bg-white rounded-xl border border-gray-200">
            <p className="text-[10px] text-gray-400 mb-2 uppercase tracking-wider font-bold">Pré-visualização no Google</p>
            <p className="text-xs text-green-700 mb-0.5">regemorto.com.br</p>
            <p className="text-base text-blue-600 font-medium leading-snug">{form.seoTitle || 'Título da página'}</p>
            <p className="text-sm text-gray-500 mt-1 leading-snug">{form.seoDescription || 'Descrição da página...'}</p>
          </div>
        )}
      </div>

      <div className={sectionCls}>
        <div className={sectionTitleCls}>
          <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '18px' }}>analytics</span>
          Analytics & Tag Manager
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={labelCls}>Google Analytics ID</label>
            <input value={form.gaId} onChange={(e) => set('gaId', e.target.value)} placeholder="G-XXXXXXXXXX" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Google Tag Manager ID</label>
            <input value={form.gtmId} onChange={(e) => set('gtmId', e.target.value)} placeholder="GTM-XXXXXXX" className={inputCls} />
          </div>
        </div>
        <p className="text-[11px] text-[#718096]/60 mt-1">Os IDs serão injetados automaticamente em todas as páginas públicas.</p>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#021541] to-[#032170] text-white hover:opacity-90 transition-opacity disabled:opacity-50">
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
          {saving ? 'Salvando...' : 'Salvar SEO'}
        </button>
      </div>
    </div>
  )
}
