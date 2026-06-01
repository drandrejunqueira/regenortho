import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import bcrypt from 'bcryptjs'
import { addDays, addHours, startOfWeek, setHours, setMinutes } from 'date-fns'

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...')

  // ── USUÁRIOS ──────────────────────────────────────────────
  const adminHash = await bcrypt.hash('Regem@2025', 12)
  const medicoHash = await bcrypt.hash('Medico@2025', 12)
  const recepcaoHash = await bcrypt.hash('Recepcao@2025', 12)
  const financeiroHash = await bcrypt.hash('Financeiro@2025', 12)

  const [admin] = await db.insert(schema.users).values({
    name: 'Dr. André Elias Junqueira',
    email: 'admin@regemorto.com.br',
    passwordHash: adminHash,
    role: 'admin',
    phone: '(12) 99999-0001',
  }).returning()

  await db.insert(schema.users).values({
    name: 'Dr. André Elias Junqueira',
    email: 'medico@regemorto.com.br',
    passwordHash: medicoHash,
    role: 'doctor',
    phone: '(12) 99999-0004',
  })

  const [recepcao] = await db.insert(schema.users).values({
    name: 'Carla Santos',
    email: 'recepcao@regemorto.com.br',
    passwordHash: recepcaoHash,
    role: 'receptionist',
    phone: '(12) 99999-0002',
  }).returning()

  await db.insert(schema.users).values({
    name: 'Marcos Financeiro',
    email: 'financeiro@regemorto.com.br',
    passwordHash: financeiroHash,
    role: 'financial',
    phone: '(12) 99999-0003',
  })

  console.log('✅ Usuários criados')

  // ── PACIENTES ─────────────────────────────────────────────
  const [pac1] = await db.insert(schema.patients).values({
    name: 'Roberto Alves Pereira',
    email: 'roberto.alves@email.com',
    phone: '(12) 98765-4321',
    cpf: '123.456.789-01',
    birthDate: '1975-03-15',
    gender: 'male',
    city: 'São José dos Campos',
    insurance: 'Unimed',
    notes: 'Paciente de joelho. Fez PRP em março/2024.',
  }).returning()

  const [pac2] = await db.insert(schema.patients).values({
    name: 'Marina Costa Souza',
    email: 'marina.costa@email.com',
    phone: '(12) 97654-3210',
    cpf: '987.654.321-09',
    birthDate: '1982-07-22',
    gender: 'female',
    city: 'Taubaté',
    notes: 'Dor no ombro direito. Aguarda resultado de exame.',
  }).returning()

  const [pac3] = await db.insert(schema.patients).values({
    name: 'Carlos Eduardo Lima',
    email: 'carlos.lima@email.com',
    phone: '(12) 96543-2109',
    birthDate: '1968-11-30',
    gender: 'male',
    city: 'Jacareí',
    notes: 'Coluna lombar. Proloterapia em andamento.',
  }).returning()

  const [pac4] = await db.insert(schema.patients).values({
    name: 'Fernanda Oliveira',
    email: 'fernanda.oliveira@email.com',
    phone: '(12) 95432-1098',
    birthDate: '1990-05-10',
    gender: 'female',
    city: 'São José dos Campos',
    nps: 9,
  }).returning()

  console.log('✅ Pacientes criados')

  // ── LEADS ─────────────────────────────────────────────────
  await db.insert(schema.leads).values([
    {
      name: 'Juliana Mendes',
      phone: '(12) 94321-0987',
      email: 'juliana.mendes@gmail.com',
      status: 'new',
      source: 'google_ads',
      specialty: 'joelho',
      complaint: 'Dor no joelho há 6 meses, dificuldade para subir escadas',
      utmSource: 'google',
      utmCampaign: 'prp-joelho-sjc',
    },
    {
      name: 'Thiago Barbosa',
      phone: '(12) 93210-9876',
      email: 'thiago.b@hotmail.com',
      status: 'contacted',
      source: 'meta_ads',
      specialty: 'ombro',
      complaint: 'Tendinite no ombro, fisioterapia sem resultado',
      assignedToId: recepcao.id,
    },
    {
      name: 'Patricia Ferreira',
      phone: '(12) 92109-8765',
      status: 'scheduled',
      source: 'referral',
      specialty: 'coluna',
      complaint: 'Hérnia de disco L4-L5',
      assignedToId: recepcao.id,
    },
    {
      name: 'Eduardo Santos',
      phone: '(12) 91098-7654',
      email: 'edu.santos@gmail.com',
      status: 'attended',
      source: 'instagram_organic',
      specialty: 'joelho',
      complaint: 'Artrose grau II no joelho direito',
    },
    {
      name: 'Luciana Rodrigues',
      phone: '(12) 90987-6543',
      status: 'active_patient',
      source: 'google_organic',
      specialty: 'quadril',
      patientId: pac1.id,
    },
    {
      name: 'Felipe Nascimento',
      phone: '(12) 89876-5432',
      status: 'lost',
      source: 'meta_ads',
      specialty: 'joelho',
      lostReason: 'Optou por cirurgia convencional',
    },
    {
      name: 'Renata Gomes',
      phone: '(12) 88765-4321',
      email: 'renata.gomes@email.com',
      status: 'new',
      source: 'whatsapp',
      specialty: 'tornozelo',
      complaint: 'Entorse recorrente no tornozelo',
    },
    {
      name: 'Diego Carvalho',
      phone: '(12) 87654-3210',
      status: 'contacted',
      source: 'google_ads',
      specialty: 'coluna',
      complaint: 'Dor lombar crônica, trabalha em home office',
      assignedToId: recepcao.id,
    },
  ])

  console.log('✅ Leads criados')

  // ── AGENDAMENTOS ─────────────────────────────────────────
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 })

  await db.insert(schema.appointments).values([
    {
      patientId: pac1.id,
      doctorId: admin.id,
      type: 'consultation',
      status: 'confirmed',
      startAt: setMinutes(setHours(monday, 8), 0),
      endAt: setMinutes(setHours(monday, 8), 50),
      title: 'Consulta - Roberto Alves',
      room: 'Consultório 1',
      createdById: recepcao.id,
    },
    {
      patientId: pac2.id,
      doctorId: admin.id,
      type: 'prp',
      status: 'scheduled',
      startAt: setMinutes(setHours(monday, 10), 0),
      endAt: setMinutes(setHours(monday, 10), 30),
      title: 'PRP - Marina Costa',
      room: 'Sala de Procedimentos',
      createdById: recepcao.id,
    },
    {
      patientId: pac3.id,
      doctorId: admin.id,
      type: 'return',
      status: 'scheduled',
      startAt: setMinutes(setHours(addDays(monday, 1), 9), 0),
      endAt: setMinutes(setHours(addDays(monday, 1), 9), 50),
      title: 'Retorno - Carlos Lima',
      room: 'Consultório 1',
      createdById: recepcao.id,
    },
    {
      patientId: pac4.id,
      doctorId: admin.id,
      type: 'bmac',
      status: 'confirmed',
      startAt: setMinutes(setHours(addDays(monday, 2), 14), 0),
      endAt: setMinutes(setHours(addDays(monday, 2), 16), 0),
      title: 'BMAC - Fernanda Oliveira',
      room: 'Sala de Procedimentos',
      createdById: recepcao.id,
    },
    {
      patientId: pac1.id,
      doctorId: admin.id,
      type: 'return',
      status: 'attended',
      startAt: setMinutes(setHours(addDays(monday, -7), 10), 0),
      endAt: setMinutes(setHours(addDays(monday, -7), 10), 50),
      title: 'Retorno - Roberto Alves',
      room: 'Consultório 1',
      createdById: recepcao.id,
    },
    {
      patientId: pac2.id,
      doctorId: admin.id,
      type: 'consultation',
      status: 'attended',
      startAt: setMinutes(setHours(addDays(monday, -5), 8), 0),
      endAt: setMinutes(setHours(addDays(monday, -5), 8), 50),
      title: 'Consulta - Marina Costa',
      room: 'Consultório 1',
      createdById: recepcao.id,
    },
  ])

  console.log('✅ Agendamentos criados')

  // ── TRANSAÇÕES ────────────────────────────────────────────
  const today = new Date()

  await db.insert(schema.transactions).values([
    {
      type: 'income',
      category: 'consultation_fee',
      description: 'Consulta - Roberto Alves Pereira',
      amount: '350.00',
      date: addDays(today, -15).toISOString().split('T')[0],
      isPaid: true,
      patientId: pac1.id,
      createdById: admin.id,
    },
    {
      type: 'income',
      category: 'prp_procedure',
      description: 'PRP Joelho - Marina Costa Souza',
      amount: '1800.00',
      date: addDays(today, -10).toISOString().split('T')[0],
      isPaid: true,
      patientId: pac2.id,
      createdById: admin.id,
    },
    {
      type: 'income',
      category: 'bmac_procedure',
      description: 'BMAC - Fernanda Oliveira',
      amount: '4500.00',
      date: addDays(today, -3).toISOString().split('T')[0],
      isPaid: true,
      patientId: pac4.id,
      createdById: admin.id,
    },
    {
      type: 'income',
      category: 'consultation_fee',
      description: 'Consulta - Carlos Eduardo Lima',
      amount: '350.00',
      date: addDays(today, -5).toISOString().split('T')[0],
      isPaid: true,
      patientId: pac3.id,
      createdById: admin.id,
    },
    {
      type: 'expense',
      category: 'rent',
      description: 'Aluguel da clínica — Abril/2025',
      amount: '4500.00',
      date: today.toISOString().split('T')[0],
      dueDate: addDays(today, 5).toISOString().split('T')[0],
      isPaid: false,
      createdById: admin.id,
    },
    {
      type: 'expense',
      category: 'staff',
      description: 'Salário recepcionista — Março/2025',
      amount: '2800.00',
      date: addDays(today, -5).toISOString().split('T')[0],
      isPaid: true,
      createdById: admin.id,
    },
    {
      type: 'expense',
      category: 'marketing',
      description: 'Google Ads — Março/2025',
      amount: '1200.00',
      date: addDays(today, -2).toISOString().split('T')[0],
      isPaid: true,
      createdById: admin.id,
    },
    {
      type: 'expense',
      category: 'materials',
      description: 'Kit PRP — Compra 10 unidades',
      amount: '950.00',
      date: addDays(today, -8).toISOString().split('T')[0],
      isPaid: true,
      createdById: admin.id,
    },
    {
      type: 'income',
      category: 'consultation_fee',
      description: 'Consulta — Thiago Barbosa',
      amount: '350.00',
      date: addDays(today, 2).toISOString().split('T')[0],
      isPaid: false,
      createdById: admin.id,
    },
    {
      type: 'expense',
      category: 'accounting',
      description: 'Honorários contabilidade — Março/2025',
      amount: '600.00',
      date: addDays(today, -1).toISOString().split('T')[0],
      isPaid: true,
      createdById: admin.id,
    },
  ])

  console.log('✅ Transações financeiras criadas')

  // ── MATERIAIS ─────────────────────────────────────────────
  const [mat1] = await db.insert(schema.materials).values({
    name: 'Kit PRP (tubos separadores)',
    category: 'procedure',
    unit: 'unid',
    currentStock: 3,
    minimumStock: 5,
    unitCost: '95.00',
    supplier: 'MedLab Distribuição',
    supplierContact: '0800-123-4567',
    status: 'critical',
    expiresAt: addDays(today, 180).toISOString().split('T')[0],
  }).returning()

  const [mat2] = await db.insert(schema.materials).values({
    name: 'Seringa 20ml',
    category: 'consumable',
    unit: 'caixa',
    currentStock: 8,
    minimumStock: 5,
    unitCost: '45.00',
    supplier: 'BD Medical',
    supplierContact: '(11) 3333-4444',
    status: 'low',
  }).returning()

  await db.insert(schema.materials).values([
    {
      name: 'Agulha Spinal 22G',
      category: 'procedure',
      unit: 'caixa',
      currentStock: 15,
      minimumStock: 5,
      unitCost: '85.00',
      supplier: 'BD Medical',
      status: 'ok',
    },
    {
      name: 'Luvas Cirúrgicas M',
      category: 'epi',
      unit: 'caixa',
      currentStock: 12,
      minimumStock: 4,
      unitCost: '38.00',
      supplier: 'Medline',
      status: 'ok',
    },
    {
      name: 'Álcool 70% 1L',
      category: 'cleaning',
      unit: 'frasco',
      currentStock: 6,
      minimumStock: 3,
      unitCost: '12.00',
      status: 'ok',
    },
    {
      name: 'Ácido Hialurônico 2ml',
      category: 'procedure',
      unit: 'unid',
      currentStock: 0,
      minimumStock: 3,
      unitCost: '380.00',
      supplier: 'Hyalgan Brasil',
      supplierContact: '(11) 4444-5555',
      status: 'out_of_stock',
      expiresAt: addDays(today, 365).toISOString().split('T')[0],
    },
    {
      name: 'Gaze Estéril 7,5x7,5',
      category: 'consumable',
      unit: 'caixa',
      currentStock: 20,
      minimumStock: 5,
      unitCost: '25.00',
      status: 'ok',
    },
    {
      name: 'Kit BMAC (centrífuga + tubos)',
      category: 'procedure',
      unit: 'unid',
      currentStock: 2,
      minimumStock: 2,
      unitCost: '450.00',
      supplier: 'Harvest Technologies',
      status: 'critical',
    },
  ])

  // Movimentações de exemplo
  await db.insert(schema.stockMovements).values([
    { materialId: mat1.id, type: 'in', quantity: 10, reason: 'Compra inicial', userId: admin.id },
    { materialId: mat1.id, type: 'out', quantity: 7, reason: 'Procedimentos PRP', userId: admin.id },
    { materialId: mat2.id, type: 'in', quantity: 10, reason: 'Compra', userId: admin.id },
    { materialId: mat2.id, type: 'out', quantity: 2, reason: 'Uso em consultas', userId: admin.id },
  ])

  console.log('✅ Materiais e movimentações criados')

  // ── META MENSAL ───────────────────────────────────────────
  await db.insert(schema.monthlyGoals).values({
    month: today.getMonth() + 1,
    year: today.getFullYear(),
    revenueGoal: '25000.00',
    leadsGoal: 40,
    consultationsGoal: 30,
    proceduresGoal: 15,
  })

  console.log('✅ Metas mensais criadas')
  console.log('')
  console.log('🎉 Seed concluído com sucesso!')
  console.log('')
  console.log('Credenciais:')
  console.log('  Admin       → admin@regemorto.com.br / Regem@2025')
  console.log('  Médico      → medico@regemorto.com.br / Medico@2025')
  console.log('  Recepção    → recepcao@regemorto.com.br / Recepcao@2025')
  console.log('  Financeiro  → financeiro@regemorto.com.br / Financeiro@2025')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Erro no seed:', err)
  process.exit(1)
})
