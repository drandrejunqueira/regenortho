// Dados mockados para os testes autenticados — nunca tocam o banco real.
// IDs em formato UUID válido pois algumas rotas fazem z.string().uuid().

export function buildMockLead(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Paciente Teste E2E',
    phone: '12999990000',
    email: 'paciente.teste@example.com',
    status: 'new',
    source: 'google_ads',
    specialty: null,
    complaint: 'Dor no joelho',
    notes: null,
    assignedToId: null,
    patientId: null,
    utmSource: null,
    utmCampaign: null,
    tags: [],
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    ...overrides,
  }
}

export function buildMockLeadsBoard() {
  return [
    buildMockLead({ id: '11111111-1111-4111-8111-111111111111', name: 'Ana Teste (Novo)', status: 'new' }),
    buildMockLead({ id: '22222222-2222-4222-8222-222222222222', name: 'Bruno Teste (Contato)', status: 'contacted' }),
    buildMockLead({ id: '33333333-3333-4333-8333-333333333333', name: 'Carla Teste (Agendado)', status: 'scheduled' }),
    buildMockLead({ id: '44444444-4444-4444-8444-444444444444', name: 'Diego Teste (Compareceu)', status: 'attended' }),
    buildMockLead({ id: '55555555-5555-4555-8555-555555555555', name: 'Eva Teste (Perdido)', status: 'lost' }),
  ]
}

export function buildMockNotifications() {
  return [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      type: 'lead_new',
      title: 'Novo lead recebido',
      body: 'Ana Teste (Novo) — via Google Ads',
      link: '/leads',
      priority: 'normal',
      createdAt: new Date().toISOString(),
      isRead: false,
    },
    {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      type: 'appointment_new',
      title: 'Consulta agendada',
      body: 'Bruno Teste — 10:00',
      link: '/agenda',
      priority: 'normal',
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      isRead: true,
    },
  ]
}

export function buildMockAgendaHoje(overrides: Record<string, unknown> = {}) {
  return {
    dateLabel: 'quinta-feira, 6 de agosto',
    total: 2,
    confirmed: 1,
    slots: [
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        time: '09:00',
        patientName: 'Paciente Mock 1',
        typeLabel: 'Consulta',
        statusLabel: 'Confirmado',
        room: '1106',
      },
      {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        time: '11:00',
        patientName: 'Paciente Mock 2',
        typeLabel: 'PRP',
        statusLabel: 'Agendado',
        room: null,
      },
    ],
    ...overrides,
  }
}
