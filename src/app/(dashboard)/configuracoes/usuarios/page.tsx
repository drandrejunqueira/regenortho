'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { ROLE_LABELS } from '@/lib/constants'

interface User {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  phone: string | null
  lastLoginAt: string | null
  createdAt: string
}

const inputCls = 'w-full bg-[#31353c] border-none rounded-xl px-3 py-2.5 text-sm text-[#dfe2eb] placeholder:text-[#bec9c9]/40 focus:outline-none focus:ring-2 focus:ring-[#61d8dd]/30'
const labelCls = 'text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider'

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [newDialog, setNewDialog] = useState(false)

  async function fetchUsers() {
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
  }

  useEffect(() => { fetchUsers() }, [])

  async function toggleActive(user: User) {
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

  return (
    <div>
      <PageHeader
        title="Gestão de Usuários"
        description="Administre os acessos ao sistema"
        action={
          <button
            onClick={() => setNewDialog(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-[#006e72] to-[#61d8dd] text-[#003739] text-sm font-bold hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Novo Usuário
          </button>
        }
      />

      {loading ? (
        <p className="text-sm text-[#bec9c9] py-8 text-center">Carregando...</p>
      ) : (
        <div className="rounded-xl overflow-hidden bg-[#1c2026]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#262a31]">
                {['Usuário', 'Perfil', 'Status', 'Último acesso', ''].map((h) => (
                  <th key={h} className={`px-5 py-3 text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider ${h === '' ? 'w-24' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3e4949]/20">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-[#262a31]/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#006e72] flex items-center justify-center text-[#dfe2eb] font-bold text-xs shrink-0 select-none">
                        {user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                      </div>
                      <div>
                        <p className="font-medium text-[#dfe2eb]">{user.name}</p>
                        <p className="text-xs text-[#bec9c9]">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge type="role" value={user.role} />
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      user.isActive ? 'bg-[#61d8dd]/10 text-[#61d8dd]' : 'bg-[#31353c] text-[#bec9c9]'
                    }`}>
                      {user.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-technical text-xs text-[#bec9c9]">
                    {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Nunca'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => toggleActive(user)}
                      className={`text-xs font-bold flex items-center gap-1 ml-auto px-3 py-1.5 rounded-lg transition-colors ${
                        user.isActive
                          ? 'text-[#ffb4ab] bg-[#ffb4ab]/10 hover:bg-[#ffb4ab]/20'
                          : 'text-[#61d8dd] bg-[#61d8dd]/10 hover:bg-[#61d8dd]/20'
                      }`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                        {user.isActive ? 'close' : 'check'}
                      </span>
                      {user.isActive ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewUserDialog open={newDialog} onOpenChange={setNewDialog} onCreated={fetchUsers} />
    </div>
  )
}

function NewUserDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
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
      <DialogContent className="max-w-md bg-[#1c2026] border-[#3e4949]/20">
        <DialogHeader>
          <DialogTitle className="text-[#dfe2eb] font-bold">Novo Usuário</DialogTitle>
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
              <SelectTrigger className="bg-[#31353c] border-none rounded-xl text-sm text-[#dfe2eb] h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#31353c] border-[#3e4949]/30">
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-[#dfe2eb] text-sm">{v}</SelectItem>
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
          <button onClick={() => onOpenChange(false)} disabled={loading} className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#bec9c9] bg-[#31353c] hover:bg-[#262a31] transition-colors">
            Cancelar
          </button>
          <button onClick={submit} disabled={loading} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#006e72] to-[#61d8dd] text-[#003739] hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? 'Criando...' : 'Criar Usuário'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
