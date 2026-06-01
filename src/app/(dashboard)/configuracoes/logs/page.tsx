'use client'

import { useState, useEffect } from 'react'

const MODULE_COLORS: Record<string, string> = {
  leads:     '#00BCD4',
  agenda:    '#e6c364',
  patients:  '#a8d5a2',
  financial: '#ffb4ab',
  materials: '#94A3B8',
  users:     '#c5b4e3',
  settings:  '#94A3B8',
}

const MODULE_LABELS: Record<string, string> = {
  leads: 'CRM de Leads', agenda: 'Agenda', patients: 'Pacientes',
  financial: 'Financeiro', materials: 'Materiais', users: 'Usuários', settings: 'Configurações',
}

// Mock logs for demo (real data comes from API)
const MOCK_LOGS = [
  { id: '1', userName: 'Dr. André Elias Junqueira', action: 'login',           module: 'users',     targetName: null,              ip: '189.100.20.5',  createdAt: new Date(Date.now() - 2 * 60000).toISOString() },
  { id: '2', userName: 'Carla Santos',               action: 'lead:create',    module: 'leads',     targetName: 'Maria da Silva',  ip: '189.100.20.6',  createdAt: new Date(Date.now() - 15 * 60000).toISOString() },
  { id: '3', userName: 'Dr. André Elias Junqueira', action: 'agenda:edit',    module: 'agenda',    targetName: '#003 - João Melo',ip: '189.100.20.5',  createdAt: new Date(Date.now() - 42 * 60000).toISOString() },
  { id: '4', userName: 'Marcos Financeiro',          action: 'financial:create',module: 'financial', targetName: 'R$ 800,00',       ip: '189.100.20.10', createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: '5', userName: 'Carla Santos',               action: 'patient:create', module: 'patients',  targetName: 'Pedro Santos',    ip: '189.100.20.6',  createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: '6', userName: 'Dr. André Elias Junqueira', action: 'settings:edit',  module: 'settings',  targetName: null,              ip: '189.100.20.5',  createdAt: new Date(Date.now() - 5 * 3600000).toISOString() },
  { id: '7', userName: 'Marcos Financeiro',          action: 'financial:edit', module: 'financial', targetName: 'Lançamento #012', ip: '189.100.20.10', createdAt: new Date(Date.now() - 24 * 3600000).toISOString() },
  { id: '8', userName: 'Carla Santos',               action: 'lead:delete',   module: 'leads',     targetName: 'Lead descartado', ip: '189.100.20.6',  createdAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString() },
]

const ACTION_LABELS: Record<string, { label: string; icon: string }> = {
  'login':            { label: 'Login',               icon: 'login' },
  'lead:create':      { label: 'Lead criado',          icon: 'person_add' },
  'lead:edit':        { label: 'Lead editado',         icon: 'edit' },
  'lead:delete':      { label: 'Lead excluído',        icon: 'delete' },
  'agenda:create':    { label: 'Agendamento criado',   icon: 'event' },
  'agenda:edit':      { label: 'Agendamento alterado', icon: 'edit_calendar' },
  'patient:create':   { label: 'Paciente criado',      icon: 'person_add' },
  'patient:edit':     { label: 'Paciente editado',     icon: 'edit' },
  'financial:create': { label: 'Lançamento criado',    icon: 'add_circle' },
  'financial:edit':   { label: 'Lançamento editado',   icon: 'edit' },
  'settings:edit':    { label: 'Config. alterada',     icon: 'settings' },
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return 'Agora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min atrás`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`
  return `${Math.floor(diff / 86400000)}d atrás`
}

function userInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('')
}

export default function LogsPage() {
  const [logs, setLogs] = useState(MOCK_LOGS)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/configuracoes/logs')
      .then((r) => r.json())
      .then(({ data }) => { if (data && data.length > 0) setLogs(data) })
      .catch(() => {})
  }, [])

  const filtered = logs.filter((log) => {
    const matchModule = filter === 'all' || log.module === filter
    const matchSearch = !search || log.userName.toLowerCase().includes(search.toLowerCase()) || (log.targetName ?? '').toLowerCase().includes(search.toLowerCase()) || log.action.toLowerCase().includes(search.toLowerCase())
    return matchModule && matchSearch
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" style={{ fontSize: '16px' }}>search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nos logs..."
            className="bg-white border border-[rgba(2,21,65,0.12)] rounded-xl pl-9 pr-4 py-2 text-sm text-[#021541] placeholder:text-[#718096]/40 focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)] w-64"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {[['all', 'Todos', 'filter_list'], ...Object.entries(MODULE_LABELS).map(([k, v]) => [k, v, ''])].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === key ? 'bg-[#f5f6f8] text-[#021541]' : 'text-[#718096]/70 hover:text-[#021541] hover:bg-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="ml-auto font-technical text-xs text-[#718096]">{filtered.length} registros</span>
      </div>

      {/* Log table */}
      <div className="rounded-xl overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f5f6f8]">
              {['Usuário', 'Ação', 'Módulo', 'Alvo', 'IP', 'Quando'].map((h) => (
                <th key={h} className="px-4 py-3 text-[10px] font-bold text-[#718096] uppercase tracking-wider text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A2B56]/15">
            {filtered.map((log) => {
              const action = ACTION_LABELS[log.action] ?? { label: log.action, icon: 'info' }
              const color = MODULE_COLORS[log.module ?? ''] ?? '#94A3B8'
              return (
                <tr key={log.id} className="hover:bg-[#f5f6f8]/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#0097a7] flex items-center justify-center text-[#021541] text-[10px] font-bold shrink-0">
                        {userInitials(log.userName ?? '')}
                      </div>
                      <span className="text-xs text-[#021541] truncate max-w-[140px]">{log.userName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#718096]" style={{ fontSize: '14px' }}>{action.icon}</span>
                      <span className="text-xs text-[#021541]">{action.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: `${color}15`, color }}>
                      {MODULE_LABELS[log.module ?? ''] ?? log.module}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#718096] max-w-[140px] truncate">{log.targetName ?? '—'}</td>
                  <td className="px-4 py-3 font-technical text-[11px] text-[#718096]">{log.ip}</td>
                  <td className="px-4 py-3 font-technical text-[11px] text-[#718096] whitespace-nowrap">{relativeTime(log.createdAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-sm text-[#718096] py-10 text-center">Nenhum log encontrado</p>
        )}
      </div>
    </div>
  )
}
