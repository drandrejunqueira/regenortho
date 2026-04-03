'use client'

import { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  phone: z.string().min(8, 'Telefone inválido'),
  email: z.string().optional(),
  source: z.string().min(1),
  specialty: z.string().optional(),
  complaint: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}

const SOURCES = [
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'instagram_organic', label: 'Instagram' },
  { value: 'referral', label: 'Indicação' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'google_organic', label: 'Google Orgânico' },
  { value: 'other', label: 'Outro' },
]

export function NewLeadDialog({ open, onOpenChange, onCreated }: Props) {
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { source: 'other' },
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, email: data.email || null }),
      })
      if (!res.ok) throw new Error()
      toast.success('Lead criado com sucesso!')
      reset()
      onOpenChange(false)
      onCreated()
    } catch {
      toast.error('Erro ao criar lead')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#1c2026] border-[#3e4949]/20">
        <DialogHeader>
          <DialogTitle className="text-[#dfe2eb] font-bold">Novo Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label htmlFor="name" className="text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider">
                Nome *
              </label>
              <input
                id="name"
                placeholder="Nome completo"
                className="w-full bg-[#31353c] border-none rounded-xl px-3 py-2.5 text-sm text-[#dfe2eb] placeholder:text-[#bec9c9]/40 focus:outline-none focus:ring-2 focus:ring-[#61d8dd]/30"
                {...register('name')}
              />
              {errors.name && <p className="text-xs text-[#ffb4ab]">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider">
                Telefone *
              </label>
              <input
                id="phone"
                placeholder="(11) 99999-9999"
                className="w-full bg-[#31353c] border-none rounded-xl px-3 py-2.5 text-sm text-[#dfe2eb] placeholder:text-[#bec9c9]/40 focus:outline-none focus:ring-2 focus:ring-[#61d8dd]/30"
                {...register('phone')}
              />
              {errors.phone && <p className="text-xs text-[#ffb4ab]">{errors.phone.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                className="w-full bg-[#31353c] border-none rounded-xl px-3 py-2.5 text-sm text-[#dfe2eb] placeholder:text-[#bec9c9]/40 focus:outline-none focus:ring-2 focus:ring-[#61d8dd]/30"
                {...register('email')}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider">
                Origem *
              </label>
              <Select value={watch('source') ?? 'other'} onValueChange={(v) => setValue('source', v ?? 'other')}>
                <SelectTrigger className="bg-[#31353c] border-none rounded-xl text-sm text-[#dfe2eb] h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#31353c] border-[#3e4949]/30">
                  {SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-[#dfe2eb] text-sm">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="specialty" className="text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider">
                Especialidade
              </label>
              <input
                id="specialty"
                placeholder="ex: joelho, coluna..."
                className="w-full bg-[#31353c] border-none rounded-xl px-3 py-2.5 text-sm text-[#dfe2eb] placeholder:text-[#bec9c9]/40 focus:outline-none focus:ring-2 focus:ring-[#61d8dd]/30"
                {...register('specialty')}
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <label htmlFor="complaint" className="text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider">
                Queixa principal
              </label>
              <textarea
                id="complaint"
                placeholder="Descreva a queixa do lead..."
                rows={3}
                className="w-full bg-[#31353c] border-none rounded-xl px-3 py-2.5 text-sm text-[#dfe2eb] placeholder:text-[#bec9c9]/40 focus:outline-none focus:ring-2 focus:ring-[#61d8dd]/30 resize-none"
                {...register('complaint')}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#bec9c9] hover:text-[#dfe2eb] bg-[#31353c] hover:bg-[#262a31] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#006e72] to-[#61d8dd] text-[#003739] hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>refresh</span>
                  Criando...
                </>
              ) : (
                'Criar Lead'
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
