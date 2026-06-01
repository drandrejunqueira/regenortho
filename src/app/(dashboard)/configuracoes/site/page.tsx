import { getAllConfigs } from '@/lib/db/queries/configuracoes'
import { ConfiguracoesClient } from '@/components/admin/ConfiguracoesClient'
import { GKEYS } from '@/lib/google/oauth'

export const metadata = {
  title: 'Configurações do Site & SEO | Painel RegenOrtho',
}

export default async function ConfigSitePage() {
  const configs = await getAllConfigs()
  
  const googleConnected = Boolean(configs[GKEYS.refreshToken])
  const googleEmail = configs[GKEYS.email] || null
  const googleConnectedAt = configs[GKEYS.connectedAt] || null

  return (
    <ConfiguracoesClient
      initialConfigs={configs}
      googleConnected={googleConnected}
      googleEmail={googleEmail}
      googleConnectedAt={googleConnectedAt}
    />
  )
}
