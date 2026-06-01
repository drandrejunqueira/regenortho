'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { ROLE_LABELS } from '@/lib/constants'
import {
  MODULES,
  ROLE_META,
  ROLE_PRESETS,
  type UserRole,
} from '@/lib/permissions'

interface User {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  phone: string | null
  lastLoginAt: string | null
  createdAt: string
  customPermissions: string[] | null
}

const inputCls =
  'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/40 focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)]'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'

function userInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('')
}

function matchesPreset(role: UserRole, perms: Set<string>): boolean {
  const preset = ROLE_PRESETS[role]
  if (preset.length !== perms.size) return false
  return preset.every((p) => perms.has(p))
}

function detectRole(perms: Set<string>): UserRole | null {
  const roles: UserRole[] = ['admin', 'doctor', 'receptionist', 'financial']
  return roles.find((r) => matchesPreset(r, perms)) ?? null
}

// ── Toggle ───────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
        checked ? 'bg-[#00BCE4]' : 'bg-[#1A2B56]/60'
      }`}
    >
      <span
        className={`pointer-events-none mt-0.5 inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

// ── Permissions Sheet ─────────────────────────────────────────

function PermissionsSheet({
  user,
  open,
  onOpenChange,
  onSaved,
}: {
  user: User | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const [perms, setPerms] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [expandedMods, setExpandedMods] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return
    const base =
      user.customPermissions && user.customPermissions.length > 0
        ? user.customPermissions
        : ROLE_PRESETS[user.role as UserRole] ?? []
    setPerms(new Set(base))
    const exp = new Set<string>()
    MODULES.forEach((m) => {
      if (m.permissions.some((p) => base.includes(p.id))) exp.add(m.id)
    })
    setExpandedMods(exp)
  }, [user])

  if (!user) return null

  const detectedRole = detectRole(perms)
  const isCustom = !detectedRole

  function applyPreset(role: UserRole) {
    setPerms(new Set(ROLE_PRESETS[role]))
  }

  function togglePerm(id: string) {
    setPerms((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleModule(moduleId: string, enable: boolean) {
    const mod = MODULES.find((m) => m.id === moduleId)
    if (!mod) return
    setPerms((prev) => {
      const next = new Set(prev)
      mod.permissions.forEach((p) => { enable ? next.add(p.id) : next.delete(p.id) })
      return next
    })
  }

  function toggleExpand(moduleId: string) {
    setExpandedMods((prev) => {
      const next = new Set(prev)
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId)
      return next
    })
  }

  async function save() {
    if (!user) return
    setSaving(true)
    try {
      const permArray = Array.from(perms)
      const inferredRole = detectRole(perms) ?? (user.role as UserRole)
      const isDefault = matchesPreset(inferredRole, perms)
      const res = await fetch(`/api/usuarios/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: inferredRole,
          customPermissions: isDefault ? null : permArray,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Permissões salvas com sucesso!')
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error('Erro ao salvar permissões')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-[540px] bg-white border-l border-[rgba(2,21,65,0.08)] flex flex-col gap-0 p-0 overflow-hidden"
      >
        {/* User header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-[rgba(2,21,65,0.08)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#0097a7] flex items-center justify-center text-[#021541] font-bold shrink-0">
              {userInitials(user.name)}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-[#021541] font-bold text-base truncate">{user.name}</SheetTitle>
              <p className="text-xs text-[#718096] truncate">{user.email}</p>
            </div>
            {isCustom ? (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e6c364]/10 text-[#e6c364] uppercase tracking-wider">
                Personalizado
              </span>
            ) : (
              <span
                className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: `${ROLE_META[detectedRole!].color}15`,
                  color: ROLE_META[detectedRole!].color,
                }}
              >
                {ROLE_META[detectedRole!].label}
              </span>
            )}
          </div>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Role presets */}
          <div>
            <p className={labelCls + ' mb-3'}>Categoria do Perfil</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ROLE_META) as UserRole[]).map((role) => {
                const meta = ROLE_META[role]
                const active = detectedRole === role
                const count = ROLE_PRESETS[role].length
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => applyPreset(role)}
                    className={`flex flex-col gap-1.5 p-3 rounded-xl border text-left transition-all ${
                      active
                        ? 'border-[#00BCE4]/50 bg-[#00BCE4]/5'
                        : 'border-[rgba(2,21,65,0.08)] bg-white hover:border-[#1A2B56]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${meta.color}20` }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: meta.color }}>
                          {meta.icon}
                        </span>
                      </div>
                      {active && (
                        <span className="material-symbols-outlined text-[#00BCE4]" style={{ fontSize: '16px' }}>
                          check_circle
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-[#021541]">{meta.label}</p>
                    <p className="text-[11px] text-[#718096] leading-snug">{meta.description}</p>
                    <p className="font-technical text-[10px] text-[#1A2B56] mt-0.5">{count} permissões</p>
                  </button>
                )
              })}
            </div>
            {isCustom && (
              <p className="mt-2 text-[11px] text-[#e6c364] flex items-center gap-1.5">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>info</span>
                Permissões personalizadas — nenhuma categoria corresponde exatamente
              </p>
            )}
          </div>

          {/* Per-module permissions */}
          <div>
            <p className={labelCls + ' mb-3'}>Permissões por Módulo</p>
            <div className="space-y-2">
              {MODULES.map((mod) => {
                const allIds = mod.permissions.map((p) => p.id)
                const activeCount = allIds.filter((id) => perms.has(id)).length
                const someActive = activeCount > 0
                const expanded = expandedMods.has(mod.id)

                return (
                  <div key={mod.id} className="rounded-xl border border-[#1A2B56]/15 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 bg-white">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          someActive ? 'bg-[#00BCE4]/10' : 'bg-[#f5f6f8]'
                        }`}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: '16px', color: someActive ? '#00BCD4' : '#94A3B8' }}
                        >
                          {mod.icon}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#021541]">{mod.label}</p>
                        <p className="font-technical text-[10px] text-[#718096]">
                          {activeCount}/{allIds.length} ativas
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Toggle checked={someActive} onChange={() => toggleModule(mod.id, !someActive)} />
                        <button
                          type="button"
                          onClick={() => toggleExpand(mod.id)}
                          className="text-[#718096] hover:text-[#021541] transition-colors"
                        >
                          <span
                            className="material-symbols-outlined transition-transform duration-200"
                            style={{ fontSize: '18px', transform: expanded ? 'rotate(180deg)' : 'none' }}
                          >
                            expand_more
                          </span>
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="bg-[#f5f6f8] divide-y divide-[#1A2B56]/10">
                        {mod.permissions.map((perm) => {
                          const on = perms.has(perm.id)
                          return (
                            <div
                              key={perm.id}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-[#2e3340]/50 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className={`text-sm ${on ? 'text-[#021541]' : 'text-[#718096]/50'}`}>
                                    {perm.label}
                                  </p>
                                  {perm.sensitive && (
                                    <span
                                      className="material-symbols-outlined text-[#e6c364]"
                                      style={{ fontSize: '12px' }}
                                      title="Ação sensível"
                                    >
                                      warning
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[#718096]/40 mt-0.5">{perm.description}</p>
                              </div>
                              <Toggle checked={on} onChange={() => togglePerm(perm.id)} />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[rgba(2,21,65,0.08)] flex justify-between items-center shrink-0">
          <p className="text-[11px] text-[#718096]">
            <span className="font-technical text-[#00BCE4]">{perms.size}</span> permissões ativas
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] hover:bg-[#f5f6f8] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-br from-[#021541] to-[#032170] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar permissões'}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [newDialog, setNewDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/usuarios')
      if (res.ok) {
        const { data } = await res.json()
        setUsers(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function toggleActive(e: React.MouseEvent, user: User) {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/usuarios/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      if (!res.ok) throw new Error()
      toast.success(user.isActive ? 'Usuário desativado' : 'Usuário ativado')
      fetchUsers()
    } catch {
      toast.error('Erro ao atualizar usuário')
    }
  }

  function getRoleBadge(user: User) {
    const role = user.role as UserRole
    if (user.customPermissions && user.customPermissions.length > 0) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#e6c364]/10 text-[#e6c364]">
          Personalizado
        </span>
      )
    }
    const meta = ROLE_META[role]
    if (!meta) return null
    return (
      <span
        className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
        style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
      >
        {meta.label}
      </span>
    )
  }

  return (
    <div>
      <PageHeader
        title="Gestão de Usuários"
        description="Clique em um usuário para gerenciar suas permissões de acesso"
        action={
          <button
            onClick={() => setNewDialog(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-[#021541] to-[#032170] text-white text-sm font-bold hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Novo Usuário
          </button>
        }
      />

      {loading ? (
        <p className="text-sm text-[#718096] py-8 text-center">Carregando...</p>
      ) : (
        <div className="rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f5f6f8]">
                {['Usuário', 'Perfil', 'Permissões', 'Status', 'Último acesso', ''].map((h) => (
                  <th
                    key={h}
                    className={`px-5 py-3 text-[10px] font-bold text-[#718096] uppercase tracking-wider ${
                      h === '' ? 'w-28' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(2,21,65,0.06)]">
              {users.map((user) => {
                const effectiveCount =
                  user.customPermissions && user.customPermissions.length > 0
                    ? user.customPermissions.length
                    : (ROLE_PRESETS[user.role as UserRole] ?? []).length

                return (
                  <tr
                    key={user.id}
                    onClick={() => { setSelectedUser(user); setSheetOpen(true) }}
                    className="hover:bg-[#f5f6f8]/60 transition-colors cursor-pointer group"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#0097a7] flex items-center justify-center text-[#021541] font-bold text-xs shrink-0">
                          {userInitials(user.name)}
                        </div>
                        <div>
                          <p className="font-medium text-[#021541]">{user.name}</p>
                          <p className="text-xs text-[#718096]">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">{getRoleBadge(user)}</td>
                    <td className="px-5 py-3">
                      <span className="font-technical text-xs text-[#718096]">{effectiveCount} permissões</span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          user.isActive ? 'bg-[#00BCE4]/10 text-[#00BCE4]' : 'bg-[#f5f6f8] text-[#718096]'
                        }`}
                      >
                        {user.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-technical text-xs text-[#718096]">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Nunca'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={(e) => toggleActive(e, user)}
                          className={`text-xs font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                            user.isActive
                              ? 'text-[#ffb4ab] bg-[#ffb4ab]/10 hover:bg-[#ffb4ab]/20'
                              : 'text-[#00BCE4] bg-[#00BCE4]/10 hover:bg-[#00BCE4]/20'
                          }`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                            {user.isActive ? 'close' : 'check'}
                          </span>
                          {user.isActive ? 'Desativar' : 'Ativar'}
                        </button>
                        <span
                          className="material-symbols-outlined text-[#1A2B56] group-hover:text-[#00BCE4] transition-colors"
                          style={{ fontSize: '18px' }}
                        >
                          tune
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <PermissionsSheet
        user={selectedUser}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={fetchUsers}
      />

      <NewUserDialog open={newDialog} onOpenChange={setNewDialog} onCreated={fetchUsers} />
    </div>
  )
}

// ── New user dialog ───────────────────────────────────────────

function NewUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'receptionist', phone: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function submit() {
    const errs: Record<string, string> = {}
    if (!form.name) errs.name = 'Obrigatório'
    if (!form.email) errs.email = 'Obrigatório'
    if (!form.password || form.password.length < 8) errs.password = 'Mínimo 8 caracteres'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro ao criar usuário'); return }
      toast.success('Usuário criado com sucesso!')
      onOpenChange(false)
      onCreated()
      setForm({ name: '', email: '', password: '', role: 'receptionist', phone: '' })
    } catch {
      toast.error('Erro ao criar usuário')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border-[rgba(2,21,65,0.08)]">
        <DialogHeader>
          <DialogTitle className="text-[#021541] font-bold">Novo Usuário</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className={labelCls}>Nome *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            {errors.name && <p className="text-xs text-[#ffb4ab]">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>E-mail *</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
            {errors.email && <p className="text-xs text-[#ffb4ab]">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Senha *</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls} />
            {errors.password && <p className="text-xs text-[#ffb4ab]">{errors.password}</p>}
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Perfil *</label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v ?? 'receptionist' })}>
              <SelectTrigger className="bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl text-sm text-[#021541] h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#f5f6f8] border-[rgba(2,21,65,0.10)]">
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-[#021541] text-sm">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Telefone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={() => onOpenChange(false)} disabled={loading} className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] hover:bg-[#f5f6f8] transition-colors">
            Cancelar
          </button>
          <button onClick={submit} disabled={loading} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#021541] to-[#032170] text-white hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? 'Criando...' : 'Criar Usuário'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
