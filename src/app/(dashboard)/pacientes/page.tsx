'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ImageUploader from '@/components/shared/ImageUploader'
import PatientPreview from '@/components/patients/PatientPreview'
import Link from 'next/link'
import { toast } from 'sonner'
import type { Patient } from '@/types'

const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096] focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'

const EMPTY_FORM = {
  name: '', phone: '', email: '', cpf: '', birthDate: '',
  gender: '' as '' | 'male' | 'female' | 'other',
  address: '', city: '', insurance: '', insuranceNum: '', notes: '',
  photoUrl: '', internalNotes: '',
}

function NovoPacienteDialog({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void
}) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)

  function set<K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }

  function reset() { setForm(EMPTY_FORM) }

  async function submit() {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return }
    if (!form.phone.trim()) { toast.error('Telefone é obrigatório'); return }
    setLoading(true)
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email || null,
        cpf: form.cpf || null,
        birthDate: form.birthDate || null,
        gender: (form.gender || null) as 'male' | 'female' | 'other' | null,
        address: form.address || null,
        city: form.city || null,
        insurance: form.insurance || null,
        insuranceNum: form.insuranceNum || null,
        notes: form.notes || null,
        photoUrl: form.photoUrl || null,
        internalNotes: form.internalNotes || null,
      }
      const res = await fetch('/api/pacientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao cadastrar')
      toast.success('Paciente cadastrado com sucesso!')
      onOpenChange(false)
      reset()
      onCreated(data.data.id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao cadastrar paciente')
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-2xl bg-white border border-[rgba(2,21,65,0.06)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#021541] font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '20px' }}>person_add</span>
            Novo Paciente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Dados pessoais com Foto */}
          <div>
            <p className="text-[10px] font-bold text-[#00BCE4] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>person</span>
              Dados Pessoais
            </p>
            <div className="flex gap-4 items-start mb-3">
              <div className="w-24 shrink-0">
                <ImageUploader
                  type="logo"
                  label="Foto"
                  hint="Enviar foto"
                  currentUrl={form.photoUrl}
                  onUploaded={(url) => set('photoUrl', url)}
                  previewAspect="1/1"
                  previewClass="rounded-full object-cover w-20 h-20"
                />
              </div>
              <div className="flex-1 space-y-3">
                <div className="space-y-1.5">
                  <label className={labelCls}>Nome completo *</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nome do Paciente" className={inputCls} autoFocus />
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className={labelCls}>CPF</label>
                  <input value={form.cpf} onChange={e => set('cpf', e.target.value)} placeholder="000.000.000-00" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Data de nascimento</label>
                  <input type="date" value={form.birthDate} onChange={e => set('birthDate', e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Gênero</label>
                  <Select value={form.gender} onValueChange={v => set('gender', v as typeof form.gender)}>
                    <SelectTrigger className="bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl text-sm text-[#021541] h-10">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-[rgba(2,21,65,0.08)]">
                      <SelectItem value="male" className="text-[#021541] text-sm">Masculino</SelectItem>
                      <SelectItem value="female" className="text-[#021541] text-sm">Feminino</SelectItem>
                      <SelectItem value="other" className="text-[#021541] text-sm">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Contato */}
          <div>
            <p className="text-[10px] font-bold text-[#00BCE4] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>contact_phone</span>
              Contato
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls}>Telefone / WhatsApp *</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(12) 99999-9999" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>E-mail</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div>
            <p className="text-[10px] font-bold text-[#00BCE4] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>location_on</span>
              Endereço
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label className={labelCls}>Endereço</label>
                <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Rua, número, bairro" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Cidade</label>
                <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="São José dos Campos" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Convênio */}
          <div>
            <p className="text-[10px] font-bold text-[#00BCE4] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>health_and_safety</span>
              Convênio / Plano de Saúde
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls}>Convênio</label>
                <input value={form.insurance} onChange={e => set('insurance', e.target.value)} placeholder="Unimed, Bradesco, Particular..." className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Nº da carteirinha</label>
                <input value={form.insuranceNum} onChange={e => set('insuranceNum', e.target.value)} placeholder="000000000" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Observações Iniciais */}
          <div>
            <p className="text-[10px] font-bold text-[#00BCE4] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>note</span>
              Observações Iniciais
            </p>
            <div className="space-y-1.5">
              <label className={labelCls}>Queixa principal / motivo da consulta / histórico relevante</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Anotações iniciais sobre o paciente, queixa principal, histórico médico relevante..."
                className={inputCls + ' resize-none'}
              />
            </div>
          </div>

          {/* Observações Internas */}
          <div>
            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>lock</span>
              Observações Internas (Uso da Clínica)
            </p>
            <div className="space-y-1.5">
              <label className={labelCls}>Alertas, notas confidenciais ou preferências restritas à equipe</label>
              <textarea
                rows={3}
                value={form.internalNotes}
                onChange={e => set('internalNotes', e.target.value)}
                placeholder="Ex: Paciente possui preferência por atendimento no período da manhã, ou possui sensibilidade..."
                className={inputCls + ' resize-none border-rose-100 bg-rose-50/5'}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <button onClick={() => onOpenChange(false)} disabled={loading} className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] border border-[rgba(2,21,65,0.08)] hover:bg-[rgba(2,21,65,0.04)] transition-colors">
            Cancelar
          </button>
          <button onClick={submit} disabled={loading} className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold bg-[#021541] text-white hover:bg-[#032170] transition-colors disabled:opacity-50">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
            {loading ? 'Cadastrando...' : 'Cadastrar Paciente'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function PacientesPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [financialFilter, setFinancialFilter] = useState('all')
  const [treatmentFilter, setTreatmentFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [newDialog, setNewDialog] = useState(false)

  const fetchPatients = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (financialFilter !== 'all') params.set('financialStatus', financialFilter)
      if (treatmentFilter) params.set('treatment', treatmentFilter)
      const res = await fetch(`/api/pacientes?${params}`)
      if (res.ok) {
        const { data } = await res.json()
        setPatients(data)
      }
    } finally {
      setLoading(false)
    }
  }, [search, financialFilter, treatmentFilter])

  useEffect(() => { fetchPatients() }, [fetchPatients])

  function calcAge(birthDate: string | null) {
    if (!birthDate) return '—'
    const age = Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
    return `${age} anos`
  }

  function handleCreated(id: string) {
    window.location.href = `/pacientes/${id}`
  }

  return (
    <div>
      <PageHeader
        title="Pacientes"
        description="Gerencie a base de pacientes da clínica"
        action={
          <button
            onClick={() => setNewDialog(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#021541] text-white text-sm font-bold hover:bg-[#032170] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
            Novo Paciente
          </button>
        }
      />

      {/* Seção de Filtros */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative max-w-xs flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" style={{ fontSize: '18px' }}>search</span>
          <input
            placeholder="Buscar por nome, CPF ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-[rgba(2,21,65,0.10)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#021541] placeholder:text-[#718096] focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30 h-[42px]"
          />
        </div>

        {/* Filtro Financeiro */}
        <div className="w-56">
          <Select value={financialFilter} onValueChange={(v) => setFinancialFilter(v || 'all')}>
            <SelectTrigger className="bg-white border border-[rgba(2,21,65,0.10)] rounded-xl text-sm text-[#021541] h-[42px]">
              <SelectValue placeholder="Status Financeiro" />
            </SelectTrigger>
            <SelectContent className="bg-white border border-[rgba(2,21,65,0.08)]">
              <SelectItem value="all" className="text-[#021541] text-sm">Todos os status financeiros</SelectItem>
              <SelectItem value="devendo" className="text-[#021541] text-sm">Com débitos vencidos (Devendo)</SelectItem>
              <SelectItem value="a_vencer" className="text-[#021541] text-sm">Com parcelas a vencer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filtro por Tratamento */}
        <div className="relative w-56">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" style={{ fontSize: '16px' }}>vaccines</span>
          <input
            placeholder="Filtrar por tratamento..."
            value={treatmentFilter}
            onChange={(e) => setTreatmentFilter(e.target.value)}
            className="w-full bg-white border border-[rgba(2,21,65,0.10)] rounded-xl pl-10 pr-4 py-2 text-sm text-[#021541] placeholder:text-[#718096] focus:outline-none focus:ring-2 focus:ring-[#00BCE4]/30 h-[42px]"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 w-full rounded-xl bg-[rgba(2,21,65,0.04)] animate-pulse" />
          ))}
        </div>
      ) : patients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-[rgba(2,21,65,0.06)] rounded-xl gap-4">
          <div className="w-14 h-14 rounded-full bg-[rgba(2,21,65,0.04)] flex items-center justify-center">
            <span className="material-symbols-outlined text-[#718096]" style={{ fontSize: '28px' }}>group</span>
          </div>
          <div>
            <p className="text-sm font-medium text-[#021541]">Nenhum paciente encontrado</p>
            <p className="text-sm text-[#718096] mt-1">{search || financialFilter !== 'all' || treatmentFilter ? 'Tente buscar com outros termos ou limpar os filtros' : 'Clique em "Novo Paciente" para começar'}</p>
          </div>
          {!search && financialFilter === 'all' && !treatmentFilter && (
            <button
              onClick={() => setNewDialog(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#021541] text-white text-sm font-bold hover:bg-[#032170] transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
              Cadastrar primeiro paciente
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)]">
          <table className="w-full bg-white text-sm">
            <thead>
              <tr className="bg-[rgba(2,21,65,0.03)]">
                {['Paciente', 'Idade', 'Telefone', 'Cidade', 'Status', ''].map((h) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-[#021541] uppercase tracking-wider whitespace-nowrap ${h === '' ? 'w-10' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id} className="border-b border-[rgba(2,21,65,0.05)] hover:bg-[rgba(2,21,65,0.015)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#f5f6f8] flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden border border-[rgba(2,21,65,0.06)] relative">
                        {patient.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={patient.photoUrl} alt={patient.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#0097a7] to-[#00BCE4] flex items-center justify-center">
                            {patient.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                          </div>
                        )}
                      </div>
                      <div>
                        <PatientPreview patient={patient}>
                          <p className="font-semibold text-[#021541] hover:text-[#00BCE4] transition-colors whitespace-nowrap">{patient.name}</p>
                        </PatientPreview>
                        {patient.insurance && (
                          <p className="text-xs text-[#718096]">{patient.insurance}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-technical text-xs text-[#718096] whitespace-nowrap">{calcAge(patient.birthDate)}</td>
                  <td className="px-4 py-3 font-technical text-xs text-[#718096] whitespace-nowrap">{patient.phone}</td>
                  <td className="px-4 py-3 text-xs text-[#718096] whitespace-nowrap">{patient.city ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                      patient.isActive
                        ? 'bg-[rgba(0,188,228,0.1)] text-[#00BCE4]'
                        : 'bg-[rgba(2,21,65,0.05)] text-[#718096]'
                    }`}>
                      {patient.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/pacientes/${patient.id}`}
                      className="p-1.5 rounded-lg bg-[rgba(2,21,65,0.04)] text-[#718096] hover:text-[#00BCE4] hover:bg-[rgba(0,188,228,0.08)] transition-all inline-flex"
                      aria-label="Ver paciente"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chevron_right</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NovoPacienteDialog open={newDialog} onOpenChange={setNewDialog} onCreated={handleCreated} />
    </div>
  )
}
