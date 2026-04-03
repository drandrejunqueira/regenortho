'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginForm) {
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        toast.error('E-mail ou senha inválidos. Tente novamente.')
      } else {
        toast.success('Bem-vindo!')
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      toast.error('Erro ao conectar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#10141a]">
      <div className="w-full max-w-sm px-4">
        {/* Logo / header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#006e72] to-[#61d8dd] text-[#003739] text-2xl font-bold mb-4">
            RO
          </div>
          <h1 className="text-2xl font-bold text-[#dfe2eb]">Regem Orto</h1>
          <p className="text-sm text-[#bec9c9] mt-1">Sistema de Gestão Clínica</p>
        </div>

        {/* Card */}
        <div className="bg-[#1c2026] rounded-2xl p-8 space-y-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* E-mail */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider">
                E-mail
              </label>
              <div className="relative">
                <span
                  className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#bec9c9]/40"
                  style={{ fontSize: '18px' }}
                >
                  mail
                </span>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com.br"
                  className="w-full bg-[#31353c] border-none rounded-xl pl-10 pr-4 py-3 text-sm text-[#dfe2eb] placeholder:text-[#bec9c9]/40 focus:outline-none focus:ring-2 focus:ring-[#61d8dd]/30"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-[#ffb4ab]">{errors.email.message}</p>
              )}
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[10px] font-bold text-[#bec9c9] uppercase tracking-wider">
                Senha
              </label>
              <div className="relative">
                <span
                  className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#bec9c9]/40"
                  style={{ fontSize: '18px' }}
                >
                  lock
                </span>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full bg-[#31353c] border-none rounded-xl pl-10 pr-4 py-3 text-sm text-[#dfe2eb] placeholder:text-[#bec9c9]/40 focus:outline-none focus:ring-2 focus:ring-[#61d8dd]/30"
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <p className="text-xs text-[#ffb4ab]">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-br from-[#006e72] to-[#61d8dd] text-[#003739] font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <span
                    className="material-symbols-outlined animate-spin"
                    style={{ fontSize: '18px' }}
                  >
                    refresh
                  </span>
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-[#bec9c9]/50">
            Problemas para acessar?{' '}
            <span className="text-[#bec9c9]/70 cursor-pointer hover:text-[#dfe2eb] transition-colors">
              Fale com o administrador
            </span>
          </p>
        </div>

        <p className="text-center text-xs text-[#bec9c9]/30 mt-6">
          Regem Orto © {new Date().getFullYear()} · São José dos Campos, SP
        </p>
      </div>
    </div>
  )
}
