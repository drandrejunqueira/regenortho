import { auth } from '@/lib/auth/config'
import { notFound } from 'next/navigation'
import { hasPermission } from '@/lib/permissions'
import { db } from '@/lib/db'
import { patients, appointments, transactions, clinicalRecords } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatCurrency } from '@/lib/utils'
import { APPOINTMENT_TYPE_LABELS, APPOINTMENT_STATUS_LABELS } from '@/lib/constants'
import { Phone, Mail, MapPin, Shield } from 'lucide-react'
import type { UserRole } from '@/types'

type Params = { params: Promise<{ id: string }> }

export default async function PacienteDetailPage({ params }: Params) {
  const { id } = await params
  const session = await auth()
  if (!session) notFound()
  const role = session.user.role as UserRole

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, id),
    with: {
      appointments: {
        orderBy: (a, { desc }) => [desc(a.startAt)],
        with: { doctor: { columns: { id: true, name: true } } },
      },
      transactions: {
        orderBy: (t, { desc }) => [desc(t.date)],
      },
      clinicalRecords: {
        orderBy: (r, { desc }) => [desc(r.createdAt)],
      },
    },
  })

  if (!patient) notFound()

  const age = patient.birthDate
    ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null

  const canViewClinical = hasPermission(role, 'patients:view_clinical')
  const canViewFinancial = hasPermission(role, 'financial:view')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
              {patient.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold">{patient.name}</h2>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {age && <span className="text-sm text-muted-foreground">{age} anos</span>}
                {patient.insurance && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Shield className="w-3 h-3" /> {patient.insurance}
                  </Badge>
                )}
                <Badge variant={patient.isActive ? 'default' : 'secondary'}>
                  {patient.isActive ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
                <a href={`tel:${patient.phone}`} className="flex items-center gap-1 hover:text-foreground">
                  <Phone className="w-3.5 h-3.5" /> {patient.phone}
                </a>
                {patient.email && (
                  <a href={`mailto:${patient.email}`} className="flex items-center gap-1 hover:text-foreground">
                    <Mail className="w-3.5 h-3.5" /> {patient.email}
                  </a>
                )}
                {patient.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {patient.city}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="historico">
        <TabsList>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          {canViewClinical && <TabsTrigger value="prontuario">Prontuário</TabsTrigger>}
          {canViewFinancial && <TabsTrigger value="financeiro">Financeiro</TabsTrigger>}
          <TabsTrigger value="dados">Dados Cadastrais</TabsTrigger>
        </TabsList>

        <TabsContent value="historico" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Histórico de Atendimentos</CardTitle></CardHeader>
            <CardContent>
              {patient.appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum atendimento registrado</p>
              ) : (
                <ul className="space-y-3">
                  {patient.appointments.map((apt) => (
                    <li key={apt.id} className="flex items-start justify-between gap-3 pb-3 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{APPOINTMENT_TYPE_LABELS[apt.type]}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(apt.startAt)}</p>
                        {apt.notes && <p className="text-xs text-muted-foreground mt-0.5">{apt.notes}</p>}
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {APPOINTMENT_STATUS_LABELS[apt.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canViewClinical && (
          <TabsContent value="prontuario" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Registros Clínicos</CardTitle></CardHeader>
              <CardContent>
                {patient.clinicalRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum registro clínico</p>
                ) : (
                  <ul className="space-y-3">
                    {patient.clinicalRecords.map((rec) => (
                      <li key={rec.id} className="pb-3 border-b last:border-0">
                        <p className="text-xs text-muted-foreground">{formatDate(rec.createdAt)} — {rec.type}</p>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{rec.content}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canViewFinancial && (
          <TabsContent value="financeiro" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Transações Financeiras</CardTitle></CardHeader>
              <CardContent>
                {patient.transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma transação</p>
                ) : (
                  <ul className="space-y-2">
                    {patient.transactions.map((tx) => (
                      <li key={tx.id} className="flex items-center justify-between pb-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{tx.description}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {tx.isPaid ? 'Pago' : 'Pendente'}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="dados" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Dados Cadastrais</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div><dt className="text-muted-foreground">CPF</dt><dd>{patient.cpf ?? '—'}</dd></div>
                <div><dt className="text-muted-foreground">Data de nascimento</dt><dd>{patient.birthDate ? formatDate(patient.birthDate) : '—'}</dd></div>
                <div><dt className="text-muted-foreground">Gênero</dt><dd>{patient.gender === 'male' ? 'Masculino' : patient.gender === 'female' ? 'Feminino' : patient.gender ?? '—'}</dd></div>
                <div><dt className="text-muted-foreground">Cidade</dt><dd>{patient.city ?? '—'}</dd></div>
                <div className="col-span-2"><dt className="text-muted-foreground">Endereço</dt><dd>{patient.address ?? '—'}</dd></div>
                <div><dt className="text-muted-foreground">Convênio</dt><dd>{patient.insurance ?? '—'}</dd></div>
                <div><dt className="text-muted-foreground">Nº convênio</dt><dd>{patient.insuranceNum ?? '—'}</dd></div>
                {patient.notes && <div className="col-span-2"><dt className="text-muted-foreground">Observações</dt><dd>{patient.notes}</dd></div>}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
