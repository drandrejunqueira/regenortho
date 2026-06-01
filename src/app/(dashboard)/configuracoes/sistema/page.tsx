'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import ImageUploader from '@/components/shared/ImageUploader'

const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096] focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)] focus:border-[#00BCE4] transition-colors'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'
const sectionCls = 'bg-white border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] rounded-xl p-5 space-y-4'
const sectionTitleCls = 'text-sm font-bold text-[#021541] flex items-center gap-2 mb-4'

interface Settings {
  name: string
  cnpj: string | null
  crm: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  website: string | null
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  logoUrl: string | null
  headerImageUrl: string | null
  primaryColor: string | null
  documentHeader: string | null
  documentFooter: string | null
}

const DEFAULT: Settings = {
  name: 'Regem Orto',
  cnpj: '',
  crm: '',
  phone: '',
  whatsapp: '',
  email: '',
  website: '',
  address: '',
  city: 'São José dos Campos',
  state: 'SP',
  zipCode: '',
  logoUrl: '',
  headerImageUrl: '',
  primaryColor: '#00BCD4',
  documentHeader: '',
  documentFooter: 'Regem Orto — Clínica de Ortopedia e Medicina do Esporte',
}

export default function SistemaPage() {
  const [form, setForm] = useState<Settings>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/configuracoes/sistema')
      .then((r) => r.json())
      .then(({ data }) => { if (data) setForm((prev) => ({ ...prev, ...data })) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function set(key: keyof Settings, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/configuracoes/sistema', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast.success('Configurações salvas!')
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-[#718096] py-8 text-center">Carregando...</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Identidade */}
        <div className={sectionCls}>
          <div className={sectionTitleCls}>
            <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '18px' }}>badge</span>
            Identidade da Clínica
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Nome da clínica *</label>
              <input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls}>CNPJ</label>
                <input value={form.cnpj ?? ''} onChange={(e) => set('cnpj', e.target.value)} placeholder="00.000.000/0001-00" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>CRM</label>
                <input value={form.crm ?? ''} onChange={(e) => set('crm', e.target.value)} placeholder="12345/SP" className={inputCls} />
              </div>
            </div>
          </div>
        </div>

        {/* Contato */}
        <div className={sectionCls}>
          <div className={sectionTitleCls}>
            <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '18px' }}>contacts</span>
            Contato
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls}>Telefone</label>
                <input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="(12) 3456-7890" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>WhatsApp</label>
                <input value={form.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} placeholder="(12) 99999-0000" className={inputCls} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>E-mail</label>
              <input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} placeholder="contato@clinica.com.br" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Website</label>
              <input value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} placeholder="https://regemorto.com.br" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className={sectionCls}>
          <div className={sectionTitleCls}>
            <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '18px' }}>location_on</span>
            Endereço
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Logradouro</label>
              <input value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} placeholder="Rua das Flores, 123 — Sala 4" className={inputCls} />
            </div>
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-3 space-y-1.5">
                <label className={labelCls}>Cidade</label>
                <input value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>UF</label>
                <input value={form.state ?? ''} onChange={(e) => set('state', e.target.value)} maxLength={2} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>CEP</label>
                <input value={form.zipCode ?? ''} onChange={(e) => set('zipCode', e.target.value)} placeholder="12345-678" className={inputCls} />
              </div>
            </div>
          </div>
        </div>

        {/* Logomarca */}
        <div className={sectionCls}>
          <div className={sectionTitleCls}>
            <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '18px' }}>imagesmode</span>
            Logomarca, Ícone & Cor Principal
          </div>
          <div className="space-y-4">

            {/* Logo */}
            <ImageUploader
              type="logo"
              label="Logo da Clínica"
              hint="Clique ou arraste · PNG, SVG, WEBP recomendado (fundo transparente)"
              currentUrl={form.logoUrl}
              onUploaded={(url) => set('logoUrl', url)}
              previewAspect="3/1"
              previewClass="object-contain p-3"
            />

            {/* Ícone (favicon) */}
            <ImageUploader
              type="icon"
              label="Ícone / Favicon"
              hint="PNG quadrado (512×512px) ou ICO · aparece na aba do navegador"
              currentUrl={form.headerImageUrl}
              onUploaded={(url) => set('headerImageUrl', url)}
              previewAspect="1/1"
              previewClass="object-contain p-2"
            />

            {/* Cor Principal */}
            <div className="space-y-1.5">
              <label className={labelCls}>Cor Principal</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.primaryColor ?? '#00BCD4'}
                  onChange={(e) => set('primaryColor', e.target.value)}
                  className="w-10 h-10 rounded-lg border-none cursor-pointer bg-transparent"
                />
                <input value={form.primaryColor ?? ''} onChange={(e) => set('primaryColor', e.target.value)} placeholder="#00BCD4" className={inputCls} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Document preview */}
      <div className={sectionCls}>
        <div className={sectionTitleCls}>
          <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '18px' }}>description</span>
          Modelo de Cabeçalho — Comprovantes e Documentos
        </div>

        {/* Editable fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div className="space-y-1.5">
            <label className={labelCls}>Texto do cabeçalho (1ª linha)</label>
            <input
              value={form.documentHeader ?? ''}
              onChange={(e) => set('documentHeader', e.target.value)}
              placeholder="Ex: Clínica de Ortopedia e Medicina do Esporte"
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Rodapé dos documentos</label>
            <input
              value={form.documentFooter ?? ''}
              onChange={(e) => set('documentFooter', e.target.value)}
              placeholder="Ex: CNPJ: 00.000.000/0001-00 | CRM: 12345/SP"
              className={inputCls}
            />
          </div>
        </div>

        {/* Live preview */}
        <div>
          <p className={labelCls + ' mb-3'}>Pré-visualização</p>
          <div className="rounded-xl overflow-hidden border border-[rgba(2,21,65,0.10)] bg-white shadow-[0_2px_8px_rgba(2,21,65,0.04)]">
            {/* Header */}
            <div className="p-4 border-b border-gray-200" style={{ backgroundColor: '#f8f9fa' }}>
              {form.headerImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.headerImageUrl} alt="Header" className="w-full max-h-24 object-contain" />
              ) : (
                <div className="flex items-center gap-4">
                  {form.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.logoUrl} alt="Logo" className="h-12 object-contain" />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: form.primaryColor ?? '#00BCD4' }}
                    >
                      {(form.name ?? 'RO').split(' ').map((n) => n[0]).slice(0, 2).join('')}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-gray-800 text-base">{form.name || 'Nome da Clínica'}</p>
                    {form.documentHeader && (
                      <p className="text-sm text-gray-500">{form.documentHeader}</p>
                    )}
                    <div className="flex gap-3 mt-1 text-xs text-gray-400">
                      {form.phone && <span>{form.phone}</span>}
                      {form.email && <span>{form.email}</span>}
                    </div>
                    {(form.address || form.city) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[form.address, form.city, form.state].filter(Boolean).join(' — ')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Content area */}
            <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Comprovante de Consulta</p>
                  <p className="text-lg font-bold text-gray-800 mt-0.5">#0001</p>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <p>Data: 03/04/2026</p>
                  <p>Horário: 14:00</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Paciente</span>
                  <span className="font-medium text-gray-800">João da Silva</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Procedimento</span>
                  <span className="font-medium text-gray-800">Consulta Ortopédica</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Valor</span>
                  <span className="font-bold text-gray-800">R$ 350,00</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 text-center text-xs text-gray-400" style={{ backgroundColor: '#f8f9fa' }}>
              {form.documentFooter || `${form.name} — ${form.address ?? ''}`}
              {form.cnpj && ` | CNPJ: ${form.cnpj}`}
              {form.crm && ` | CRM: ${form.crm}`}
            </div>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#021541] to-[#032170] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  )
}
