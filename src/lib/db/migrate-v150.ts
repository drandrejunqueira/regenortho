/**
 * v1.5.0 — atribuição completa do lead + índices das tabelas quentes.
 *
 * 1) leads.tracking_data (jsonb): guarda o objeto de atribuição inteiro
 *    (fbclid/gclid/gbraid/wbraid, utm_medium/content/term, referrer). Antes só
 *    utm_source e utm_campaign sobreviviam ao POST — sem o resto é impossível
 *    montar a conversão offline para Meta/Google e a origem gravada não é
 *    auditável.
 * 2) Índices de appointments, treatments, clinical_records, exam_orders,
 *    transactions e leads: essas tabelas estavam inteiras em seq scan. Só a
 *    ficha do paciente dispara 6 queries sobre elas.
 *
 * Idempotente: IF NOT EXISTS em tudo, pode rodar de novo sem efeito.
 * Executa: npx tsx src/lib/db/migrate-v150.ts
 */
import { config } from 'dotenv'
import { sql } from 'drizzle-orm'

config({ path: '.env.local' })

async function run() {
  console.log('▶ migrate-v150: tracking completo do lead + índices')

  // Import dinâmico: o módulo do banco lê DATABASE_URL no topo e um import
  // estático seria avaliado antes do config() acima.
  const { db } = await import('./index')

  await db.execute(sql`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS tracking_data jsonb
  `)
  console.log('  ✔ leads.tracking_data')

  // Funil: ordena sempre por entrada e costuma filtrar um status junto.
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at)
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS leads_status_created_at_idx ON leads (status, created_at)
  `)
  console.log('  ✔ índices de leads')

  // Agenda/dashboard/lembretes recortam por janela de start_at; a agenda do
  // médico e o histórico do paciente já entram com o dono da linha na condição.
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS appointments_start_at_idx ON appointments (start_at)
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS appointments_doctor_start_idx ON appointments (doctor_id, start_at)
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS appointments_patient_start_idx ON appointments (patient_id, start_at)
  `)
  console.log('  ✔ índices de appointments')

  // Ficha do paciente: prontuário, exames e tratamentos abrem por paciente.
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS clinical_records_patient_created_idx ON clinical_records (patient_id, created_at)
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS exam_orders_patient_created_idx ON exam_orders (patient_id, created_at)
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS treatments_patient_status_idx ON treatments (patient_id, status)
  `)
  console.log('  ✔ índices de clinical_records, exam_orders e treatments')

  // Financeiro: aba do paciente, estorno do lançamento da consulta e DRE.
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS transactions_patient_date_idx ON transactions (patient_id, date)
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS transactions_appointment_idx ON transactions (appointment_id)
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS transactions_treatment_idx ON transactions (treatment_id)
  `)
  console.log('  ✔ índices de transactions')

  console.log('✅ migrate-v150 concluída')
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
