'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Room {
  id: string
  name: string
  color: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const PRESET_COLORS = [
  '#00BCE4', // Ciano
  '#e6c364', // Dourado
  '#10b981', // Verde Esmeralda
  '#8b5cf6', // Roxo
  '#f97316', // Laranja
  '#ef4444', // Vermelho
  '#ec4899', // Rosa
  '#3b82f6', // Azul
]

const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096]/40 focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)]'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'

export default function SalasPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  
  // Form states
  const [name, setName] = useState('')
  const [color, setColor] = useState('#00BCE4')
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const fetchRooms = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/rooms')
      if (res.ok) {
        const { data } = await res.json()
        setRooms(data || [])
      } else {
        toast.error('Erro ao carregar salas')
      }
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRooms()
  }, [])

  const openCreateDialog = () => {
    setEditingRoom(null)
    setName('')
    setColor('#00BCE4')
    setIsActive(true)
    setDialogOpen(true)
  }

  const openEditDialog = (room: Room) => {
    setEditingRoom(room)
    setName(room.name)
    setColor(room.color)
    setIsActive(room.isActive)
    setDialogOpen(true)
  }

  const saveRoom = async () => {
    if (!name.trim()) {
      toast.error('Nome da sala é obrigatório')
      return
    }

    setSubmitting(true)
    const isEdit = !!editingRoom
    const url = isEdit ? `/api/rooms/${editingRoom.id}` : '/api/rooms'
    const method = isEdit ? 'PATCH' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color, isActive }),
      })
      const data = await res.json()

      if (res.ok) {
        toast.success(isEdit ? 'Sala atualizada com sucesso!' : 'Sala criada com sucesso!')
        setDialogOpen(false)
        fetchRooms()
      } else {
        toast.error(data.error || 'Erro ao salvar sala')
      }
    } catch {
      toast.error('Erro de conexão ao salvar')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteRoom = async (room: Room) => {
    if (!confirm(`Deseja realmente remover a sala "${room.name}"?`)) return

    try {
      const res = await fetch(`/api/rooms/${room.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Sala removida com sucesso!')
        fetchRooms()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erro ao remover sala')
      }
    } catch {
      toast.error('Erro de conexão ao deletar')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gerenciamento de Salas"
        description="Cadastre e configure as salas da clínica e suas cores de exibição na agenda"
        action={
          <button
            onClick={openCreateDialog}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#021541] text-white text-sm font-bold hover:bg-[#032170] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Nova Sala
          </button>
        }
      />

      {loading ? (
        <p className="text-sm text-[#718096] py-8 text-center">Carregando salas...</p>
      ) : rooms.length === 0 ? (
        <div className="bg-white border border-[rgba(2,21,65,0.06)] rounded-xl p-8 text-center text-[#718096] space-y-2">
          <span className="material-symbols-outlined text-[rgba(2,21,65,0.15)] text-5xl">meeting_room</span>
          <p className="text-sm font-bold text-[#021541]">Nenhuma sala cadastrada</p>
          <p className="text-xs max-w-sm mx-auto">Cadastre as salas de atendimento para poder organizá-las por cores na agenda e controlar o fluxo de consultas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="bg-white border border-[rgba(2,21,65,0.06)] shadow-[0_2px_12px_rgba(2,21,65,0.04)] rounded-xl p-4 flex flex-col justify-between space-y-4 transition-all hover:shadow-[0_4px_16px_rgba(2,21,65,0.08)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-4 h-4 rounded-full shrink-0 border border-black/5"
                    style={{ backgroundColor: room.color }}
                  />
                  <div>
                    <h3 className="text-sm font-bold text-[#021541]">{room.name}</h3>
                    <p className="text-[10px] text-[#718096]">
                      {room.isActive ? (
                        <span className="text-[#10b981] font-semibold">Ativa</span>
                      ) : (
                        <span className="text-red-500 font-semibold">Inativa</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditDialog(room)}
                    className="p-1.5 rounded-lg text-[#718096] hover:text-[#00BCE4] hover:bg-[#f5f6f8] transition-all"
                    title="Editar sala"
                  >
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </button>
                  <button
                    onClick={() => deleteRoom(room)}
                    className="p-1.5 rounded-lg text-[#718096] hover:text-red-50 hover:bg-red-50/50 hover:text-red-600 transition-all"
                    title="Excluir sala"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-white border border-[rgba(2,21,65,0.06)]">
          <DialogHeader>
            <DialogTitle className="text-[#021541] font-bold">
              {editingRoom ? 'Editar Sala' : 'Nova Sala'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className={labelCls}>Nome da Sala *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Consultório 1, Sala de Procedimento..."
                className={inputCls}
                maxLength={100}
                required
              />
            </div>

            <div className="space-y-2">
              <label className={labelCls}>Cor de exibição na agenda *</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      'w-7 h-7 rounded-full border transition-all cursor-pointer relative',
                      color === c ? 'border-black scale-110 shadow-sm' : 'border-black/10 hover:scale-105'
                    )}
                    style={{ backgroundColor: c }}
                  >
                    {color === c && (
                      <span className="material-symbols-outlined absolute inset-0 flex items-center justify-center text-white text-[14px] drop-shadow-sm font-bold">
                        check
                      </span>
                    )}
                  </button>
                ))}
                
                {/* Seletor customizado */}
                <div className="flex items-center gap-1.5 pl-1.5 border-l border-[rgba(2,21,65,0.12)]">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-7 h-7 rounded-lg border border-black/10 p-0 cursor-pointer overflow-hidden bg-transparent"
                    title="Outra cor"
                  />
                  <span className="text-[10px] font-mono text-[#718096] uppercase">{color}</span>
                </div>
              </div>
            </div>

            {editingRoom && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#f5f6f8] border border-[rgba(2,21,65,0.06)]">
                <div>
                  <p className="text-xs font-bold text-[#021541]">Sala Ativa?</p>
                  <p className="text-[10px] text-[#718096]">Salas inativas não aparecem como opção na agenda</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
                    isActive ? 'bg-[#00BCE4]' : 'bg-[#1A2B56]/30'
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none mt-0.5 inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                      isActive ? 'translate-x-[18px]' : 'translate-x-0.5'
                    )}
                  />
                </button>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <button
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] bg-[#f5f6f8] border border-[rgba(2,21,65,0.08)] hover:bg-[rgba(2,21,65,0.04)] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={saveRoom}
              disabled={submitting}
              className="px-4 py-2 rounded-full text-sm font-bold bg-[#021541] text-white hover:bg-[#032170] transition-colors disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Salvar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
