export type UserRole = 'admin' | 'receptionist' | 'financial' | 'doctor'
export type LeadStatus = 'new' | 'contacted' | 'scheduled' | 'attended' | 'active_patient' | 'lost'
export type LeadSource = 'google_ads' | 'meta_ads' | 'instagram_organic' | 'facebook_organic' | 'google_organic' | 'referral' | 'whatsapp' | 'other'
export type AppointmentType = 'consultation' | 'prp' | 'bmac' | 'hyaluronic' | 'prolotherapy' | 'surgery' | 'return' | 'block' | 'google_event'
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'attended' | 'no_show' | 'rescheduled' | 'cancelled'
export type TransactionType = 'income' | 'expense'
export type StockStatus = 'ok' | 'low' | 'critical' | 'out_of_stock'
export type Gender = 'male' | 'female' | 'other'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar: string | null
  phone: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface Lead {
  id: string
  name: string
  phone: string
  email: string | null
  status: LeadStatus
  source: LeadSource
  specialty: string | null
  complaint: string | null
  notes: string | null
  assignedToId: string | null
  patientId: string | null
  utmSource: string | null
  utmCampaign: string | null
  tags?: string[] | null
  createdAt: string
  updatedAt: string
  assignedTo?: Pick<User, 'id' | 'name'>
}

export interface LeadInteraction {
  id: string
  leadId: string
  userId: string | null
  type: string
  content: string
  createdAt: string
  user?: Pick<User, 'id' | 'name'>
}

export interface Patient {
  id: string
  name: string
  email: string | null
  phone: string
  cpf: string | null
  birthDate: string | null
  gender: Gender | null
  address: string | null
  city: string | null
  insurance: string | null
  insuranceNum: string | null
  notes: string | null
  photoUrl: string | null
  internalNotes: string | null
  isActive: boolean
  nps: number | null
  createdAt: string
}

export interface Room {
  id: string
  name: string
  color: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Appointment {
  id: string
  patientId: string | null
  leadId: string | null
  doctorId: string | null
  type: AppointmentType
  status: AppointmentStatus
  startAt: string
  endAt: string
  title: string | null
  notes: string | null
  room: string | null
  roomId: string | null
  confirmedAt: string | null
  reminderSent: boolean
  returnDeadline?: string | null
  returnEstimatedAt?: string | null
  isPaidConsultation: boolean
  consultationPrice?: string | null
  paymentMethodId?: string | null
  paymentTiming?: string | null
  paymentStatus?: string | null
  paymentReceiptUrl?: string | null
  createdAt: string
  patient?: Pick<Patient, 'id' | 'name' | 'phone'>
  lead?: Pick<Lead, 'id' | 'name' | 'phone'>
  doctor?: Pick<User, 'id' | 'name'>
  roomObj?: Pick<Room, 'id' | 'name' | 'color'> | null
}

export interface Transaction {
  id: string
  type: TransactionType
  category: string
  description: string
  amount: string
  date: string
  dueDate: string | null
  isPaid: boolean
  paidAt: string | null
  patientId: string | null
  appointmentId: string | null
  notes: string | null
  createdAt: string
  patient?: Pick<Patient, 'id' | 'name'>
}

export interface Material {
  id: string
  name: string
  category: string
  unit: string
  currentStock: number
  minimumStock: number
  unitCost: string | null
  supplier: string | null
  supplierContact: string | null
  batchNumber: string | null
  expiresAt: string | null
  status: StockStatus
  notes: string | null
  createdAt: string
}

export interface StockMovement {
  id: string
  materialId: string
  type: 'in' | 'out'
  quantity: number
  reason: string | null
  createdAt: string
  user?: Pick<User, 'id' | 'name'>
}

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'received' | 'cancelled'

export interface PurchaseOrderItem {
  id: string
  purchaseOrderId: string
  materialId: string
  quantity: number
  unitCost: string
  total: string
  notes: string | null
  material?: Pick<Material, 'id' | 'name' | 'unit' | 'unitCost'>
}

export interface PurchaseOrder {
  id: string
  supplier: string
  status: PurchaseOrderStatus
  orderDate: string
  expectedDate: string | null
  receivedDate: string | null
  totalAmount: string
  notes: string | null
  transactionId: string | null
  createdById: string | null
  createdAt: string
  updatedAt: string
  items: PurchaseOrderItem[]
  createdBy?: Pick<User, 'id' | 'name'>
}

export interface DashboardData {
  kpis: {
    leadsThisMonth: number
    leadsGrowth: number
    revenue: number
    revenueGoal: number
    revenueGrowth: number
    consultations: number
    occupancyRate: number
    avgCpl: number
  }
  recentLeads: Lead[]
  todayAppointments: Appointment[]
  financialSummary: {
    income: number
    expenses: number
    netResult: number
  }
  stockAlerts: Material[]
  conversionFunnel: {
    new: number
    contacted: number
    scheduled: number
    attended: number
    active: number
  }
}
