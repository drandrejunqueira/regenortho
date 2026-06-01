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

const inputCls = 'w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-3 py-2.5 text-sm text-[#021541] placeholder:text-[#718096] focus:outline-none focus:ring-2 focus:ring-[rgba(0,188,228,0.2)] focus:border-[#00BCE4] transition-colors'
const labelCls = 'text-[10px] font-bold text-[#718096] uppercase tracking-wider'

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
      <DialogContent className="max-w-md bg-white border border-[rgba(2,21,65,0.10)] shadow-[0_8px_40px_rgba(2,21,65,0.12)]">
        <DialogHeader>
          <DialogTitle className="text-[#021541] font-bold">Novo Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label htmlFor="name" className={labelCls}>Nome *</label>
              <input
                id="name"
                placeholder="Nome completo"
                className={inputCls}
                {...register('name')}
              />
              {errors.name && <p className="text-xs text-[#DC2626]">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="phone" className={labelCls}>Telefone *</label>
              <input
                id="phone"
                placeholder="(11) 99999-9999"
                className={inputCls}
                {...register('phone')}
              />
              {errors.phone && <p className="text-xs text-[#DC2626]">{errors.phone.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className={labelCls}>E-mail</label>
              <input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                className={inputCls}
                {...register('email')}
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Origem *</label>
              <Select value={watch('source') ?? 'other'} onValueChange={(v) => setValue('source', v ?? 'other')}>
                <SelectTrigger className="bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl text-sm text-[#021541] h-10 focus:ring-[rgba(0,188,228,0.2)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-[rgba(2,21,65,0.10)]">
                  {SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-[#021541] text-sm">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="specialty" className={labelCls}>Especialidade</label>
              <input
                id="specialty"
                placeholder="ex: joelho, coluna..."
                className={inputCls}
                {...register('specialty')}
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <label htmlFor="complaint" className={labelCls}>Queixa principal</label>
              <textarea
                id="complaint"
                placeholder="Descreva a queixa do lead..."
                rows={3}
                className={`${inputCls} resize-none`}
                {...register('complaint')}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#718096] hover:text-[#021541] bg-[#f5f6f8] hover:bg-[rgba(2,21,65,0.06)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-[#021541] to-[#032170] text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
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
