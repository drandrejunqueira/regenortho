import { getAllConfigs } from '@/lib/db/queries/configuracoes'
import { GeoClient } from '@/components/admin/GeoClient'

export const metadata = {
  title: 'GEO — Otimização para Motores de IA | Painel RegenOrtho',
}

export default async function ConfigGeoPage() {
  const configs = await getAllConfigs()

  return (
    <GeoClient initialConfigs={configs} />
  )
}
