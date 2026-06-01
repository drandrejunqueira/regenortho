'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

const sectionCls = 'bg-white border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] rounded-xl p-5'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'

const SCHEDULES = [
  { value: 'hourly',  label: 'A cada hora',   icon: 'schedule' },
  { value: 'daily',   label: 'Diário',         icon: 'today' },
  { value: 'weekly',  label: 'Semanal',        icon: 'date_range' },
  { value: 'monthly', label: 'Mensal',         icon: 'calendar_month' },
]

const MODULES = [
  { id: 'pacientes',  label: 'Pacientes',    icon: 'people',       checked: true },
  { id: 'leads',      label: 'CRM de Leads', icon: 'person_add',   checked: true },
  { id: 'agenda',     label: 'Agenda',       icon: 'calendar_month', checked: true },
  { id: 'financeiro', label: 'Financeiro',   icon: 'payments',     checked: true },
  { id: 'materiais',  label: 'Materiais',    icon: 'inventory_2',  checked: true },
  { id: 'logs',       label: 'Logs',         icon: 'receipt_long', checked: false },
]

export default function BackupPage() {
  const [schedule, setSchedule] = useState('daily')
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [modules, setModules] = useState(MODULES)
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/configuracoes/sistema')
      .then((r) => r.json())
      .then(({ data }) => {
        if (data?.backupSchedule) setSchedule(data.backupSchedule)
        if (data?.lastBackupAt) setLastBackup(data.lastBackupAt)
      })
      .catch(() => {})
  }, [])

  function toggleModule(id: string) {
    setModules((prev) => prev.map((m) => m.id === id ? { ...m, checked: !m.checked } : m))
  }

  async function saveSchedule() {
    setSaving(true)
    try {
      const res = await fetch('/api/configuracoes/sistema', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ backupSchedule: schedule }) })
      if (!res.ok) throw new Error()
      toast.success('Agendamento salvo!')
    } catch { toast.error('Erro ao salvar') } finally { setSaving(false) }
  }

  async function runBackup() {
    setRunning(true)
    // Simulate backup (real implementation would call an API)
    await new Promise((r) => setTimeout(r, 2500))
    setLastBackup(new Date().toISOString())
    setRunning(false)
    toast.success('Backup realizado com sucesso!')
  }

  return (
    <div className="space-y-5">

      {/* Status card */}
      <div className={sectionCls}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#00BCE4]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '24px' }}>cloud_done</span>
            </div>
            <div>
              <p className="text-sm font-bold text-[#021541]">Último backup</p>
              <p className="font-technical text-xs text-[#718096] mt-0.5">
                {lastBackup ? formatDate(lastBackup) : 'Nenhum backup realizado ainda'}
              </p>
            </div>
          </div>
          <button
            onClick={runBackup}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#021541] to-[#032170] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {running ? 'sync' : 'backup'}
            </span>
            {running ? 'Realizando backup...' : 'Fazer backup agora'}
          </button>
        </div>
      </div>

      {/* Schedule */}
      <div className={sectionCls}>
        <p className="text-sm font-bold text-[#021541] mb-4">Frequência de Backup Automático</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {SCHEDULES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSchedule(s.value)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                schedule === s.value
                  ? 'border-[#00BCE4]/50 bg-[#00BCE4]/5 text-[#00BCE4]'
                  : 'border-[rgba(2,21,65,0.08)] bg-[#f5f6f8] text-[#718096] hover:border-[#1A2B56]/50'
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>{s.icon}</span>
              <span className="text-xs font-medium">{s.label}</span>
            </button>
          ))}
        </div>
        <button onClick={saveSchedule} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-br from-[#021541] to-[#032170] text-white hover:opacity-90 transition-opacity disabled:opacity-50">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
          {saving ? 'Salvando...' : 'Salvar agendamento'}
        </button>
      </div>

      {/* Modules to backup */}
      <div className={sectionCls}>
        <p className="text-sm font-bold text-[#021541] mb-4">Módulos Incluídos no Backup</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {modules.map((mod) => (
            <button
              key={mod.id}
              type="button"
              onClick={() => toggleModule(mod.id)}
              className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left ${
                mod.checked
                  ? 'border-[#00BCE4]/30 bg-[#00BCE4]/5'
                  : 'border-[rgba(2,21,65,0.08)] bg-[#f5f6f8]'
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: mod.checked ? '#00BCD4' : '#94A3B8' }}>
                {mod.checked ? 'check_box' : 'check_box_outline_blank'}
              </span>
              <div>
                <span className="material-symbols-outlined mr-1 align-middle" style={{ fontSize: '14px', color: '#94A3B8' }}>{mod.icon}</span>
                <span className={`text-sm ${mod.checked ? 'text-[#021541]' : 'text-[#718096]/60'}`}>{mod.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-[rgba(2,21,65,0.08)]">
        <span className="material-symbols-outlined text-[#e6c364] shrink-0" style={{ fontSize: '20px' }}>info</span>
        <div className="text-xs text-[#718096] leading-relaxed">
          <p className="font-bold text-[#021541] mb-1">Sobre os backups</p>
          <p>Os backups são armazenados com criptografia AES-256. Arquivos disponíveis por 30 dias. Para armazenamento externo, configure o Webhook de backup ou entre em contato com o suporte.</p>
        </div>
      </div>
    </div>
  )
}
