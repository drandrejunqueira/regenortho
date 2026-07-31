import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { VERSOES, VERSAO_ATUAL, TIPO_LABEL, TIPO_COR } from '@/lib/changelog'

export const metadata = {
  title: 'Atualizações do Sistema | Regen Orto',
}

/** Commit publicado — a Vercel injeta estas variáveis na build. */
function infoDaPublicacao() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? null
  return {
    commit: sha ? sha.slice(0, 7) : null,
    ambiente: process.env.VERCEL_ENV ?? 'local',
  }
}

const fmtData = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

export default async function AtualizacoesPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user.role as UserRole
  if (!hasPermission(role, 'settings:view', session.user.customPermissions)) {
    redirect('/dashboard')
  }

  const { commit, ambiente } = infoDaPublicacao()

  return (
    <div className="space-y-5">
      {/* Versão publicada */}
      <div className="bg-white rounded-2xl border border-[rgba(2,21,65,0.06)] shadow-[0_2px_8px_rgba(2,21,65,0.04)] p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-bold text-[#718096] uppercase tracking-widest">
              Versão em uso
            </p>
            <p className="text-3xl font-bold text-[#021541] mt-1 font-technical">{VERSAO_ATUAL}</p>
            <p className="text-xs text-[#718096] mt-1">
              Publicada em {fmtData(VERSOES[0].data)}
            </p>
          </div>
          <div className="text-right space-y-1">
            {commit && (
              <p className="text-[11px] text-[#718096]">
                Publicação{' '}
                <span className="font-technical text-[#021541] bg-[rgba(2,21,65,0.04)] px-1.5 py-0.5 rounded">
                  {commit}
                </span>
              </p>
            )}
            <p className="text-[11px] text-[#718096]">
              Ambiente{' '}
              <span className="font-technical text-[#021541]">
                {ambiente === 'production' ? 'produção' : ambiente}
              </span>
            </p>
          </div>
        </div>
        <p className="text-sm text-[#718096] mt-3 pt-3 border-t border-[rgba(2,21,65,0.06)]">
          {VERSOES[0].resumo}
        </p>
      </div>

      {/* Histórico */}
      <div className="space-y-4">
        {VERSOES.map((v, i) => (
          <div
            key={v.versao}
            className="bg-white rounded-2xl border border-[rgba(2,21,65,0.06)] shadow-[0_2px_8px_rgba(2,21,65,0.04)] p-5"
          >
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h2 className="text-base font-bold text-[#021541] font-technical">
                Versão {v.versao}
              </h2>
              {i === 0 && (
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ color: '#16a34a', background: 'rgba(22,163,74,0.10)' }}
                >
                  Atual
                </span>
              )}
              <span className="text-xs text-[#718096] ml-auto">{fmtData(v.data)}</span>
            </div>
            <p className="text-xs text-[#718096] mb-4">{v.resumo}</p>

            <ul className="space-y-3">
              {v.mudancas.map((m) => {
                const estilo = TIPO_COR[m.tipo]
                return (
                  <li key={m.titulo} className="flex items-start gap-3">
                    <span
                      className="material-symbols-outlined shrink-0 mt-0.5 rounded-lg p-1"
                      style={{ fontSize: '16px', color: estilo.cor, background: estilo.fundo }}
                    >
                      {estilo.icone}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-[#021541] font-medium">{m.titulo}</span>
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ color: estilo.cor, background: estilo.fundo }}
                        >
                          {TIPO_LABEL[m.tipo]}
                        </span>
                      </div>
                      {m.detalhe && (
                        <p className="text-xs text-[#718096] mt-0.5 leading-relaxed">{m.detalhe}</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-[#718096] text-center pb-2">
        O histórico é publicado junto com cada atualização do sistema.
      </p>
    </div>
  )
}
