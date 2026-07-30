'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/40 focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)]'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'

const EVENTS = [
  { id: 'lead.created',        label: 'Lead criado',              module: 'CRM' },
  { id: 'lead.status_changed', label: 'Status do lead alterado',  module: 'CRM' },
  { id: 'lead.deleted',        label: 'Lead excluído',            module: 'CRM' },
  { id: 'agenda.created',      label: 'Agendamento criado',       module: 'Agenda' },
  { id: 'agenda.updated',      label: 'Agendamento alterado',     module: 'Agenda' },
  { id: 'agenda.cancelled',    label: 'Agendamento cancelado',    module: 'Agenda' },
  { id: 'patient.created',     label: 'Paciente criado',          module: 'Pacientes' },
  { id: 'patient.updated',     label: 'Paciente atualizado',      module: 'Pacientes' },
  { id: 'financial.created',   label: 'Lançamento financeiro',    module: 'Financeiro' },
  { id: 'financial.deleted',   label: 'Lançamento excluído',      module: 'Financeiro' },
  { id: 'backup.completed',    label: 'Backup concluído',         module: 'Sistema' },
  { id: 'user.created',        label: 'Usuário criado',           module: 'Sistema' },
]

interface Webhook {
  id: string
  name: string
  url: string
  events: string[]
  secret: string | null
  isActive: boolean
  lastTriggeredAt: string | null
  lastStatus: number | null
}

function relativeTime(iso: string | null) {
  if (!iso) return 'Nunca'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min atrás`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`
  return `${Math.floor(diff / 86400000)}d atrás`
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [dialog, setDialog] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', secret: '', events: new Set<string>() })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/configuracoes/webhooks')
      .then((r) => r.json())
      .then(({ data }) => { if (data && data.length > 0) setWebhooks(data) })
      .catch(() => {})
  }, [])

  function toggleEvent(id: string) {
    setForm((prev) => {
      const next = new Set(prev.events)
      next.has(id) ? next.delete(id) : next.add(id)
      return { ...prev, events: next }
    })
  }

  async function create() {
    if (!form.name || !form.url || form.events.size === 0) {
      toast.error('Preencha nome, URL e ao menos 1 evento')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/configuracoes/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, url: form.url, secret: form.secret || null, events: Array.from(form.events) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error()
      setWebhooks((prev) => [data.data, ...prev])
      setDialog(false)
      setForm({ name: '', url: '', secret: '', events: new Set() })
      toast.success('Webhook criado!')
    } catch { toast.error('Erro ao criar webhook') } finally { setSaving(false) }
  }

  async function toggleActive(wh: Webhook) {
    const res = await fetch('/api/configuracoes/webhooks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: wh.id, isActive: !wh.isActive }) })
    // O switch virava na tela mesmo com a API recusando: o webhook aparecia
    // ativo e nunca disparava (ou o contrário).
    if (!res.ok) {
      toast.error('Não foi possível alterar o status do webhook')
      return
    }
    setWebhooks((prev) => prev.map((w) => w.id === wh.id ? { ...w, isActive: !w.isActive } : w))
  }

  async function remove(id: string) {
    if (!confirm('Excluir este webhook? As integrações que dependem dele param de receber eventos.')) return
    const res = await fetch('/api/configuracoes/webhooks', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (!res.ok) {
      toast.error('Não foi possível remover o webhook')
      return
    }
    setWebhooks((prev) => prev.filter((w) => w.id !== id))
    toast.success('Webhook removido')
  }

  const grouped = EVENTS.reduce<Record<string, typeof EVENTS>>((acc, e) => {
    acc[e.module] = [...(acc[e.module] ?? []), e]
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#718096]">{webhooks.length} webhook{webhooks.length !== 1 ? 's' : ''} configurado{webhooks.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setDialog(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-[#021541] to-[#032170] text-white text-sm font-bold hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
          Novo Webhook
        </button>
      </div>

      {/* Aviso honesto: webhooks são salvos, mas o disparo ainda não está implementado */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-[#fff8e6] border border-[#e6c364]/30">
        <span className="material-symbols-outlined text-[#b08a15] shrink-0" style={{ fontSize: '20px' }}>construction</span>
        <div className="text-xs text-[#718096] leading-relaxed">
          <p className="font-bold text-[#021541] mb-1">Disparo automático em breve</p>
          <p>Você já pode cadastrar e salvar webhooks, mas o envio automático de eventos ainda está em desenvolvimento — nenhum evento é disparado no momento.</p>
        </div>
      </div>

      {/* List */}
      {webhooks.length === 0 ? (
        <div className="bg-white rounded-xl p-12 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#f5f6f8] flex items-center justify-center">
            <span className="material-symbols-outlined text-[#718096]" style={{ fontSize: '28px' }}>webhook</span>
          </div>
          <p className="text-sm font-bold text-[#021541]">Nenhum webhook configurado</p>
          <p className="text-xs text-[#718096] max-w-xs">Conecte o Regem Orto com ferramentas como n8n, Make ou Zapier para automatizar fluxos.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div key={wh.id} className="bg-white rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${wh.isActive ? 'bg-[#00BCE4]/10' : 'bg-[#f5f6f8]'}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: wh.isActive ? '#00BCD4' : '#94A3B8' }}>webhook</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-[#021541]">{wh.name}</p>
                    {wh.isActive ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00BCE4]/10 text-[#00BCE4] uppercase tracking-wider">Ativo</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f5f6f8] text-[#718096] uppercase tracking-wider">Pausado</span>
                    )}
                    {wh.lastStatus && (
                      <span className={`font-technical text-[10px] px-2 py-0.5 rounded-full ${wh.lastStatus >= 200 && wh.lastStatus < 300 ? 'bg-[#a8d5a2]/10 text-[#a8d5a2]' : 'bg-[#ffb4ab]/10 text-[#ffb4ab]'}`}>
                        {wh.lastStatus}
                      </span>
                    )}
                  </div>
                  <p className="font-technical text-xs text-[#718096] mt-0.5 truncate">{wh.url}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {wh.events.map((e) => (
                      <span key={e} className="px-2 py-0.5 rounded-full text-[10px] bg-[#f5f6f8] text-[#718096]">{e}</span>
                    ))}
                  </div>
                  <p className="font-technical text-[10px] text-[#1A2B56] mt-2">
                    Último disparo: {relativeTime(wh.lastTriggeredAt)}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => toggleActive(wh)} title={wh.isActive ? 'Pausar' : 'Ativar'} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#718096] hover:text-[#021541] hover:bg-[#f5f6f8] transition-colors">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{wh.isActive ? 'pause' : 'play_arrow'}</span>
                  </button>
                  <button onClick={() => remove(wh.id)} title="Excluir" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#718096] hover:text-[#ffb4ab] hover:bg-[#ffb4ab]/10 transition-colors">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg bg-white border-[rgba(2,21,65,0.08)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#021541] font-bold">Novo Webhook</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Nome *</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ex: n8n — Automação de leads" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>URL de destino *</label>
              <input value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} placeholder="https://..." className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Secret (opcional)</label>
              <input value={form.secret} onChange={(e) => setForm((p) => ({ ...p, secret: e.target.value }))} placeholder="Para verificar assinatura HMAC-SHA256" className={inputCls} />
            </div>
            <div className="space-y-2">
              <label className={labelCls}>Eventos *</label>
              {Object.entries(grouped).map(([module, events]) => (
                <div key={module}>
                  <p className="text-[10px] text-[#718096] uppercase tracking-wider font-bold mb-1.5">{module}</p>
                  <div className="space-y-1">
                    {events.map((ev) => {
                      const checked = form.events.has(ev.id)
                      return (
                        <button key={ev.id} type="button" onClick={() => toggleEvent(ev.id)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-left ${checked ? 'bg-[#00BCE4]/10' : 'hover:bg-[#f5f6f8]'}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: checked ? '#00BCD4' : '#1A2B56' }}>
                            {checked ? 'check_box' : 'check_box_outline_blank'}
                          </span>
                          <span className="text-xs text-[#021541]">{ev.label}</span>
                          <code className="ml-auto font-technical text-[10px] text-[#718096]/50">{ev.id}</code>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <button onClick={() => setDialog(false)} disabled={saving} className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] hover:bg-[#f5f6f8] transition-colors">Cancelar</button>
            <button onClick={create} disabled={saving} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#021541] to-[#032170] text-white hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? 'Criando...' : 'Criar Webhook'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
