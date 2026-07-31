'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useClinicSettings } from '@/hooks/useClinicSettings'
import { getTrackingParams } from '@/lib/tracking'

export default function InteractiveWhatsAppFab() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const clinic = useClinicSettings()

  const handleWhatsAppRedirect = () => {
    // Tenta pegar o whatsapp das configs, remove tudo que não for número
    let waNumber = clinic.whatsapp ? clinic.whatsapp.replace(/\D/g, '') : '5512981767896'
    
    // Se não começar com 55 (código do Brasil), adiciona
    if (waNumber.length === 10 || waNumber.length === 11) {
      waNumber = `55${waNumber}`
    } else if (!waNumber) {
      waNumber = '5512981767896' // fallback de segurança
    }

    const message = encodeURIComponent(`Olá! Meu nome é ${name} e gostaria de mais informações.`)
    window.open(`https://wa.me/${waNumber}?text=${message}`, '_blank')
    setOpen(false)
    setName('')
    setPhone('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || phone.replace(/\D/g, '').length < 10) {
      toast.error('Preencha nome e um telefone válido.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/site/agendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          procedure: 'Contato WhatsApp (Botão Flutuante)',
          // Sem isto o lead entrava no CRM sem nenhuma atribuição.
          tracking: getTrackingParams(),
        }),
      })

      if (!res.ok) {
        throw new Error('Erro ao salvar lead')
      }

      // Sucesso no cadastro do Lead, redireciona para o WhatsApp
      handleWhatsAppRedirect()
    } catch (err) {
      console.error(err)
      // Mesmo com erro no CRM, não impedimos o contato do cliente
      toast.error('Tivemos um problema interno, mas vamos te redirecionar para o WhatsApp.')
      handleWhatsAppRedirect()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        render={
          <button
            className="whatsapp-fab"
            aria-label="Fale conosco pelo WhatsApp"
            id="whatsapp-fab"
          />
        }
      >
        <svg className="w-7 h-7 fill-white" viewBox="0 0 24 24">
          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.185-.573c.948.517 2.04.794 3.144.794h.002c3.181 0 5.767-2.586 5.767-5.766 0-3.18-2.585-5.766-5.767-5.766zm3.377 8.203c-.145.405-.837.74-1.159.789-.323.05-.63.072-1.84-.407-1.458-.578-2.397-2.055-2.47-2.152-.072-.097-.585-.778-.585-1.496 0-.717.376-1.07.509-1.216.133-.145.29-.182.387-.182h.278c.084 0 .193-.036.302.218l.434 1.054c.036.085.06.182.012.278-.048.096-.072.156-.145.241-.072.085-.157.193-.223.265-.072.073-.145.151-.06.296.084.145.374.616.804 1.002.554.496 1.02.65 1.165.723.145.073.23.06.314-.036.084-.096.362-.423.459-.567.096-.145.193-.121.326-.072.133.048.845.398.99.47.145.073.242.109.278.169.036.06.036.35-.109.754zM12 2C6.48 2 2 6.48 2 12c0 1.76.46 3.42 1.26 4.86L2 22l5.34-1.4c1.4.74 3 1.17 4.66 1.17 5.52 0 10-4.48 10-10S17.52 2 12 2z" />
        </svg>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md border-0 bg-white shadow-2xl rounded-2xl overflow-hidden p-0">
        <div className="bg-[#25D366] text-white p-6">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-8 h-8 fill-white" viewBox="0 0 24 24">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.185-.573c.948.517 2.04.794 3.144.794h.002c3.181 0 5.767-2.586 5.767-5.766 0-3.18-2.585-5.766-5.767-5.766zm3.377 8.203c-.145.405-.837.74-1.159.789-.323.05-.63.072-1.84-.407-1.458-.578-2.397-2.055-2.47-2.152-.072-.097-.585-.778-.585-1.496 0-.717.376-1.07.509-1.216.133-.145.29-.182.387-.182h.278c.084 0 .193-.036.302.218l.434 1.054c.036.085.06.182.012.278-.048.096-.072.156-.145.241-.072.085-.157.193-.223.265-.072.073-.145.151-.06.296.084.145.374.616.804 1.002.554.496 1.02.65 1.165.723.145.073.23.06.314-.036.084-.096.362-.423.459-.567.096-.145.193-.121.326-.072.133.048.845.398.99.47.145.073.242.109.278.169.036.06.036.35-.109.754zM12 2C6.48 2 2 6.48 2 12c0 1.76.46 3.42 1.26 4.86L2 22l5.34-1.4c1.4.74 3 1.17 4.66 1.17 5.52 0 10-4.48 10-10S17.52 2 12 2z" />
              </svg>
              <DialogTitle className="text-xl font-bold tracking-tight m-0 text-white">
                Fale pelo WhatsApp
              </DialogTitle>
            </div>
            <DialogDescription className="text-white/90 text-sm">
              Para um atendimento mais ágil, por favor, nos informe seu nome e número.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="wa-name" className="text-xs font-bold text-[#021541] uppercase tracking-wider">
              Seu Nome
            </label>
            <input
              id="wa-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite seu nome"
              required
              className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-4 py-3 text-sm text-[#021541] placeholder:text-[#718096] focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-colors"
            />
          </div>
          
          <div className="space-y-1.5">
            <label htmlFor="wa-phone" className="text-xs font-bold text-[#021541] uppercase tracking-wider">
              Seu WhatsApp
            </label>
            <input
              id="wa-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              required
              className="w-full bg-[#f5f6f8] border border-[rgba(2,21,65,0.12)] rounded-xl px-4 py-3 text-sm text-[#021541] placeholder:text-[#718096] focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 mt-2 rounded-xl text-sm font-bold text-white bg-[#25D366] hover:bg-[#1ebd5a] active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: '18px' }}>
                progress_activity
              </span>
            ) : (
              <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
            {loading ? 'Iniciando...' : 'Iniciar Conversa'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
