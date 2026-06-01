'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'

const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/40 focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)]'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'
const sectionCls = 'bg-white border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] rounded-xl p-5 space-y-4'

interface Settings {
  evolutionApiUrl: string
  evolutionApiKey: string
  evolutionInstance: string
  notifyNewLeadNumber: string
  notifyWeeklyReportNumber: string
  notifyMonthlyReportNumber: string
  notifyReportDay: number
  sendAppointmentReminder: boolean
  reminderHoursBefore: number
  sendTreatmentSummary: boolean
  notifyEmailNewLead: boolean
  notifyEmailNewPatient: boolean
  notifyEmailWeeklyReport: boolean
  alertEmailRecipients: string
}

const DEFAULT: Settings = {
  evolutionApiUrl: '',
  evolutionApiKey: '',
  evolutionInstance: '',
  notifyNewLeadNumber: '',
  notifyWeeklyReportNumber: '',
  notifyMonthlyReportNumber: '',
  notifyReportDay: 30,
  sendAppointmentReminder: true,
  reminderHoursBefore: 24,
  sendTreatmentSummary: true,
  notifyEmailNewLead: false,
  notifyEmailNewPatient: false,
  notifyEmailWeeklyReport: false,
  alertEmailRecipients: '',
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm text-[#021541]">{label}</p>
        {description && <p className="text-xs text-[#718096] mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-[#00BCE4]' : 'bg-[#f5f6f8]'}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

export default function NotificacoesPage() {
  const [form, setForm] = useState<Settings>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testNumber, setTestNumber] = useState('')

  useEffect(() => {
    fetch('/api/configuracoes/sistema')
      .then(r => r.json())
      .then(({ data }) => {
        if (data) setForm({
          evolutionApiUrl: data.evolutionApiUrl ?? '',
          evolutionApiKey: data.evolutionApiKey ?? '',
          evolutionInstance: data.evolutionInstance ?? '',
          notifyNewLeadNumber: data.notifyNewLeadNumber ?? '',
          notifyWeeklyReportNumber: data.notifyWeeklyReportNumber ?? '',
          notifyMonthlyReportNumber: data.notifyMonthlyReportNumber ?? '',
          notifyReportDay: data.notifyReportDay ?? 30,
          sendAppointmentReminder: data.sendAppointmentReminder ?? true,
          reminderHoursBefore: data.reminderHoursBefore ?? 24,
          sendTreatmentSummary: data.sendTreatmentSummary ?? true,
          notifyEmailNewLead: data.notifyEmailNewLead ?? false,
          notifyEmailNewPatient: data.notifyEmailNewPatient ?? false,
          notifyEmailWeeklyReport: data.notifyEmailWeeklyReport ?? false,
          alertEmailRecipients: data.alertEmailRecipients ?? '',
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function set(key: keyof Settings, value: unknown) { setForm(p => ({ ...p, [key]: value })) }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/configuracoes/sistema', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast.success('Notificações salvas!')
    } catch { toast.error('Erro ao salvar') } finally { setSaving(false) }
  }

  async function testWhatsApp() {
    if (!testNumber) { toast.error('Informe o número de teste'); return }
    setTesting(true)
    try {
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: testNumber }),
      })
      if (!res.ok) throw new Error()
      toast.success('Mensagem de teste enviada!')
    } catch { toast.error('Erro ao enviar. Verifique as credenciais da Evolution API.') } finally { setTesting(false) }
  }

  if (loading) return <p className="text-sm text-[#718096] py-8 text-center">Carregando...</p>

  return (
    <div className="space-y-5">

      {/* WhatsApp / Evolution API */}
      <div className={sectionCls}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-[#25d366]/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#25d366' }}>chat</span>
          </div>
          <div>
            <p className="text-sm font-bold text-[#021541]">WhatsApp — Evolution API</p>
            <p className="text-xs text-[#718096]">Configure sua instância auto-hospedada da Evolution API</p>
          </div>
          {form.evolutionApiUrl && form.evolutionApiKey && (
            <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00BCE4]/10 text-[#00BCE4] uppercase tracking-wider">Configurado</span>
          )}
        </div>

        <div className="space-y-3 pt-2 border-t border-[rgba(2,21,65,0.08)]">
          <div className="space-y-1.5">
            <label className={labelCls}>URL da Evolution API</label>
            <input value={form.evolutionApiUrl} onChange={e => set('evolutionApiUrl', e.target.value)} placeholder="https://evolution.suaempresa.com" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>API Key</label>
              <input type="password" value={form.evolutionApiKey} onChange={e => set('evolutionApiKey', e.target.value)} placeholder="••••••••" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Nome da Instância</label>
              <input value={form.evolutionInstance} onChange={e => set('evolutionInstance', e.target.value)} placeholder="regemorto" className={inputCls} />
            </div>
          </div>
          {/* Test connection */}
          <div className="flex gap-2">
            <input value={testNumber} onChange={e => setTestNumber(e.target.value)} placeholder="Número para teste: 5512999999999" className={`${inputCls} flex-1`} />
            <button onClick={testWhatsApp} disabled={testing || !form.evolutionApiUrl} className="px-3 py-2 rounded-xl text-sm font-medium bg-[#25d366]/10 text-[#25d366] hover:bg-[#25d366]/20 transition-colors disabled:opacity-50 shrink-0 whitespace-nowrap">
              {testing ? 'Enviando...' : 'Testar'}
            </button>
          </div>
        </div>
      </div>

      {/* Números de alerta */}
      <div className={sectionCls}>
        <p className="text-sm font-bold text-[#021541]">Números para Notificações</p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className={labelCls}>Novo Lead no CRM</label>
            <input value={form.notifyNewLeadNumber} onChange={e => set('notifyNewLeadNumber', e.target.value)} placeholder="5512999999999" className={inputCls} />
            <p className="text-[11px] text-[#718096]/60">Recebe mensagem sempre que um novo lead entrar no sistema</p>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Fechamento Semanal</label>
            <input value={form.notifyWeeklyReportNumber} onChange={e => set('notifyWeeklyReportNumber', e.target.value)} placeholder="5512999999999" className={inputCls} />
            <p className="text-[11px] text-[#718096]/60">Envia resumo toda sexta-feira às 18h</p>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Fechamento Mensal</label>
            <div className="flex gap-3">
              <input value={form.notifyMonthlyReportNumber} onChange={e => set('notifyMonthlyReportNumber', e.target.value)} placeholder="5512999999999" className={`${inputCls} flex-1`} />
              <select value={form.notifyReportDay} onChange={e => set('notifyReportDay', Number(e.target.value))} className="bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)] shrink-0">
                <option value={15}>Dia 15</option>
                <option value={30}>Dia 30</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Automações de disparo */}
      <div className={sectionCls}>
        <p className="text-sm font-bold text-[#021541]">Automações WhatsApp</p>
        <div className="space-y-4 divide-y divide-[#1A2B56]/15">
          <Toggle
            checked={form.sendAppointmentReminder}
            onChange={v => set('sendAppointmentReminder', v)}
            label="Lembrete de consulta"
            description={`Envia mensagem ao paciente ${form.reminderHoursBefore}h antes do agendamento`}
          />
          {form.sendAppointmentReminder && (
            <div className="pt-3 space-y-1.5">
              <label className={labelCls}>Horas antes do agendamento</label>
              <input type="number" min="1" max="72" value={form.reminderHoursBefore} onChange={e => set('reminderHoursBefore', Number(e.target.value))} className="w-24 bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2 text-sm text-[#021541] focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)]" />
            </div>
          )}
          <div className="pt-4">
            <Toggle
              checked={form.sendTreatmentSummary}
              onChange={v => set('sendTreatmentSummary', v)}
              label="Comprovante pós-tratamento"
              description="Envia resumo do tratamento ao paciente após conclusão"
            />
          </div>
        </div>
      </div>

      {/* Alertas por e-mail */}
      <div className={sectionCls}>
        <p className="text-sm font-bold text-[#021541]">Alertas por E-mail</p>
        <div className="space-y-4 divide-y divide-[#1A2B56]/15">
          <Toggle checked={form.notifyEmailNewLead} onChange={v => set('notifyEmailNewLead', v)} label="Novo lead no CRM" />
          <div className="pt-4">
            <Toggle checked={form.notifyEmailNewPatient} onChange={v => set('notifyEmailNewPatient', v)} label="Novo paciente cadastrado" />
          </div>
          <div className="pt-4">
            <Toggle checked={form.notifyEmailWeeklyReport} onChange={v => set('notifyEmailWeeklyReport', v)} label="Resumo semanal por e-mail" />
          </div>
        </div>
        {(form.notifyEmailNewLead || form.notifyEmailNewPatient || form.notifyEmailWeeklyReport) && (
          <div className="space-y-1.5 pt-2">
            <label className={labelCls}>Destinatários (separados por vírgula)</label>
            <input value={form.alertEmailRecipients} onChange={e => set('alertEmailRecipients', e.target.value)} placeholder="dr@regemorto.com.br, financeiro@regemorto.com.br" className={inputCls} />
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#021541] to-[#032170] text-white hover:opacity-90 transition-opacity disabled:opacity-50">
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
          {saving ? 'Salvando...' : 'Salvar notificações'}
        </button>
      </div>
    </div>
  )
}
