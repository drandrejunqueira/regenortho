import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { hasPermission } from '@/lib/permissions'
import { parseReportFilters } from '@/lib/leadReportFilters'
import { LeadReportClient } from '@/components/leads/report/LeadReportClient'
import type { UserRole } from '@/types'

export default async function LeadReportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!hasPermission(session.user.role as UserRole, 'leads:view', session.user.customPermissions)) {
    redirect('/dashboard')
  }

  // Parâmetro repetido na URL chega como array — vale só o primeiro.
  const params = Object.fromEntries(
    Object.entries(searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
  )

  return <LeadReportClient initial={parseReportFilters(params)} />
}
