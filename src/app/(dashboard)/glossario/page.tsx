import { getTermosAdmin } from '@/lib/db/queries/glossario'
import { getConfig } from '@/lib/db/queries/configuracoes'
import { GlossarioClient } from '@/components/admin/GlossarioClient'
import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'

export const metadata = {
  title: 'Glossário Técnico | Painel RegenOrtho',
}

export default async function GlossarioPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user.role as UserRole
  if (!hasPermission(role, 'settings:view', session.user.customPermissions)) redirect('/dashboard')

  const initialTermos = await getTermosAdmin({})
  const leituraAtiva = (await getConfig('glossario_leitura_ativo')) === 'true'
  const adsAtivo = (await getConfig('glossario_ads_ativo')) === 'true'

  return (
    <GlossarioClient
      initialTermos={initialTermos}
      leituraAtiva={leituraAtiva}
      adsAtivo={adsAtivo}
    />
  )
}
