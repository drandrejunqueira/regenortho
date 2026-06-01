import { getTermosAdmin } from '@/lib/db/queries/glossario'
import { getConfig } from '@/lib/db/queries/configuracoes'
import { GlossarioClient } from '@/components/admin/GlossarioClient'

export const metadata = {
  title: 'Glossário Técnico | Painel RegenOrtho',
}

export default async function GlossarioPage() {
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
