import { neon } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is missing!')
    process.exit(1)
  }
  const sql = neon(databaseUrl)
  console.log('Populando dados de teste no banco de dados (materiais + modelos de tratamento)...\n')

  // 1. Cadastrar Materiais em Estoque
  const materialsToSeed = [
    { name: 'Ácido Hialurônico (Ampola 2ml)', category: 'procedure', unit: 'Ampola', currentStock: 12, minimumStock: 3, unitCost: 450.00 },
    { name: 'Kit PRP RegenLab', category: 'procedure', unit: 'Kit', currentStock: 15, minimumStock: 5, unitCost: 180.00 },
    { name: 'Agulha Descartável 30G 1/2', category: 'consumable', unit: 'Unidade', currentStock: 120, minimumStock: 25, unitCost: 1.50 },
    { name: 'Seringa Descartável Luer Lock 5ml', category: 'consumable', unit: 'Unidade', currentStock: 95, minimumStock: 20, unitCost: 0.80 },
    { name: 'Luva de Procedimento Estéril (Par)', category: 'epi', unit: 'Par', currentStock: 60, minimumStock: 15, unitCost: 4.50 },
    { name: 'Gaze Estéril 7.5x7.5 (Pacote)', category: 'consumable', unit: 'Pacote', currentStock: 150, minimumStock: 30, unitCost: 2.20 },
    { name: 'Clorexidina Degermante 2%', category: 'consumable', unit: 'Frasco', currentStock: 6, minimumStock: 2, unitCost: 24.90 },
    { name: 'Tubo de Anestésico Xilocaína 2% (20ml)', category: 'consumable', unit: 'Frasco', currentStock: 10, minimumStock: 3, unitCost: 18.00 }
  ]

  const materialIds: Record<string, string> = {}

  for (const mat of materialsToSeed) {
    const existing = await sql`SELECT id FROM materials WHERE name = ${mat.name} LIMIT 1`
    if (existing && existing.length > 0) {
      console.log(`- Material '${mat.name}' já cadastrado com ID: ${existing[0].id}`)
      materialIds[mat.name] = existing[0].id
    } else {
      let status = 'ok'
      if (mat.currentStock === 0) status = 'out_of_stock'
      else if (mat.currentStock <= mat.minimumStock) status = 'critical'
      else if (mat.currentStock <= mat.minimumStock * 1.5) status = 'low'

      const inserted = await sql`
        INSERT INTO materials (id, name, category, unit, current_stock, minimum_stock, unit_cost, status, created_at, updated_at)
        VALUES (gen_random_uuid(), ${mat.name}, ${mat.category}, ${mat.unit}, ${mat.currentStock}, ${mat.minimumStock}, ${mat.unitCost}, ${status}, now(), now())
        RETURNING id
      `
      console.log(`✓ Material cadastrado: '${mat.name}' (${inserted[0].id})`)
      materialIds[mat.name] = inserted[0].id
    }
  }

  // 2. Cadastrar Modelos de Tratamento (Treatment Templates)
  const templatesToSeed = [
    {
      name: 'Infiltração de Joelho com Ácido Hialurônico',
      description: 'Procedimento de viscossuplementação intra-articular guiado por ultrassom para artrose.',
      category: 'hyaluronic_procedure',
      defaultPrice: 1500.00,
      estimatedCost: 474.80,
      items: [
        { type: 'material', materialName: 'Ácido Hialurônico (Ampola 2ml)', description: 'Ácido Hialurônico (Ampola 2ml)', quantity: 1, unitPrice: 450.00 },
        { type: 'material', materialName: 'Agulha Descartável 30G 1/2', description: 'Agulha de Aspiração/Aplicação', quantity: 1, unitPrice: 1.50 },
        { type: 'material', materialName: 'Seringa Descartável Luer Lock 5ml', description: 'Seringa de 5ml', quantity: 1, unitPrice: 0.80 },
        { type: 'material', materialName: 'Tubo de Anestésico Xilocaína 2% (20ml)', description: 'Anestésico Local (Fração)', quantity: 1, unitPrice: 18.00 },
        { type: 'fee', materialName: null, description: 'Honorários Médicos (Infiltração)', quantity: 1, unitPrice: 500.00 }
      ]
    },
    {
      name: 'PRP - Plasma Rico em Plaquetas (1 Sessão)',
      description: 'Coleta de sangue autólogo, centrifugação e infiltração de plasma rico em plaquetas para regeneração de tendões.',
      category: 'prp_procedure',
      defaultPrice: 1200.00,
      estimatedCost: 193.30,
      items: [
        { type: 'material', materialName: 'Kit PRP RegenLab', description: 'Kit PRP RegenLab Especializado', quantity: 1, unitPrice: 180.00 },
        { type: 'material', materialName: 'Seringa Descartável Luer Lock 5ml', description: 'Seringa para Aplicação', quantity: 1, unitPrice: 0.80 },
        { type: 'material', materialName: 'Agulha Descartável 30G 1/2', description: 'Agulha 30G', quantity: 2, unitPrice: 1.50 },
        { type: 'material', materialName: 'Luva de Procedimento Estéril (Par)', description: 'Luva Cirúrgica Estéril', quantity: 1, unitPrice: 4.50 },
        { type: 'material', materialName: 'Gaze Estéril 7.5x7.5 (Pacote)', description: 'Gaze de Assepsia', quantity: 2, unitPrice: 2.20 },
        { type: 'fee', materialName: null, description: 'Honorários de Coleta, Processamento e Aplicação', quantity: 1, unitPrice: 400.00 }
      ]
    },
    {
      name: 'Terapia de Viscossuplementação Dupla (Bilateral)',
      description: 'Aplicação bilateral de Ácido Hialurônico em joelhos sob orientação ultrassonográfica no mesmo ato.',
      category: 'hyaluronic_procedure',
      defaultPrice: 2700.00,
      estimatedCost: 940.60,
      items: [
        { type: 'material', materialName: 'Ácido Hialurônico (Ampola 2ml)', description: 'Ácido Hialurônico (Ampola 2ml)', quantity: 2, unitPrice: 450.00 },
        { type: 'material', materialName: 'Agulha Descartável 30G 1/2', description: 'Agulha de Aspiração/Aplicação', quantity: 2, unitPrice: 1.50 },
        { type: 'material', materialName: 'Seringa Descartável Luer Lock 5ml', description: 'Seringa de 5ml', quantity: 2, unitPrice: 0.80 },
        { type: 'material', materialName: 'Luva de Procedimento Estéril (Par)', description: 'Luva Estéril', quantity: 2, unitPrice: 4.50 },
        { type: 'fee', materialName: null, description: 'Honorários Médicos Infiltração Bilateral', quantity: 1, unitPrice: 800.00 }
      ]
    }
  ]

  const templateIds: Record<string, string> = {}

  for (const tmpl of templatesToSeed) {
    const existing = await sql`SELECT id FROM treatment_templates WHERE name = ${tmpl.name} LIMIT 1`
    let templateId: string

    if (existing && existing.length > 0) {
      console.log(`- Modelo '${tmpl.name}' já cadastrado com ID: ${existing[0].id}`)
      templateId = existing[0].id
      templateIds[tmpl.name] = templateId
    } else {
      const inserted = await sql`
        INSERT INTO treatment_templates (id, name, description, category, default_price, estimated_cost, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), ${tmpl.name}, ${tmpl.description}, ${tmpl.category}, ${tmpl.defaultPrice}, ${tmpl.estimatedCost}, true, now(), now())
        RETURNING id
      `
      templateId = inserted[0].id
      templateIds[tmpl.name] = templateId
      console.log(`✓ Modelo criado: '${tmpl.name}' (${templateId})`)

      for (let i = 0; i < tmpl.items.length; i++) {
        const item = tmpl.items[i]
        const matId = item.materialName ? materialIds[item.materialName] : null

        await sql`
          INSERT INTO treatment_template_items (id, template_id, type, material_id, description, quantity, unit_price, sort_order)
          VALUES (gen_random_uuid(), ${templateId}, ${item.type}, ${matId}, ${item.description}, ${item.quantity}, ${item.unitPrice}, ${i})
        `
      }
      console.log(`  → Cadastrados ${tmpl.items.length} itens para o modelo '${tmpl.name}'`)
    }
  }

  // 3. Cadastrar Forma de Pagamento Padrão se nenhuma existir
  console.log('\nVerificando formas de pagamento...')
  const existingPM = await sql`SELECT id FROM payment_methods LIMIT 1`
  let pmId: string

  if (existingPM && existingPM.length > 0) {
    pmId = existingPM[0].id
    console.log(`- Forma de pagamento existente vinculada: ID ${pmId}`)
  } else {
    const insertedPM = await sql`
      INSERT INTO payment_methods (id, name, type, fee_percent, max_installments, is_active, created_at)
      VALUES (gen_random_uuid(), 'Pix Clínica', 'pix', 0.00, 1, true, now())
      RETURNING id
    `
    pmId = insertedPM[0].id
    console.log(`✓ Forma de pagamento criada: 'Pix Clínica' (${pmId})`)
  }

  // 4. Buscar Usuário ativo (médico ou administrador) para vincular como responsável
  console.log('\nBuscando médico para os agendamentos e tratamentos...')
  const doctor = await sql`SELECT id, name FROM users WHERE role = 'doctor' OR role = 'admin' LIMIT 1`
  if (doctor.length === 0) {
    console.error('Nenhum usuário cadastrado no sistema para ser vinculado como médico!')
    process.exit(1)
  }
  const docId = doctor[0].id
  console.log(`- Médico responsável: ${doctor[0].name} (ID: ${docId})`)

  // 5. Cadastrar Jornada Completa de Teste (Carlos Teste Silva)
  console.log('\nLimpando dados anteriores do paciente de teste se existirem...')
  
  // Limpeza em cascata
  await sql`DELETE FROM lead_interactions WHERE lead_id IN (SELECT id FROM leads WHERE name = 'Carlos Teste Silva')`
  await sql`DELETE FROM transactions WHERE patient_id IN (SELECT id FROM patients WHERE name = 'Carlos Teste Silva')`
  await sql`DELETE FROM treatment_items WHERE treatment_id IN (SELECT id FROM treatments WHERE patient_id IN (SELECT id FROM patients WHERE name = 'Carlos Teste Silva'))`
  await sql`DELETE FROM treatments WHERE patient_id IN (SELECT id FROM patients WHERE name = 'Carlos Teste Silva')`
  await sql`DELETE FROM clinical_records WHERE patient_id IN (SELECT id FROM patients WHERE name = 'Carlos Teste Silva')`
  await sql`DELETE FROM appointments WHERE patient_id IN (SELECT id FROM patients WHERE name = 'Carlos Teste Silva')`
  await sql`DELETE FROM leads WHERE name = 'Carlos Teste Silva'`
  await sql`DELETE FROM patients WHERE name = 'Carlos Teste Silva'`

  console.log('Criando nova jornada completa de teste (Carlos Teste Silva)...')

  // Data base (5 dias atrás) para o início da jornada
  const cincoDiasAtras = new Date()
  cincoDiasAtras.setDate(cincoDiasAtras.getDate() - 5)
  const cincoDiasAtrasStr = cincoDiasAtras.toISOString().split('T')[0]

  // a. Paciente
  const insertedPatient = await sql`
    INSERT INTO patients (id, name, email, phone, cpf, birth_date, gender, address, city, notes, is_active, created_at, updated_at)
    VALUES (
      gen_random_uuid(), 
      'Carlos Teste Silva', 
      'carlos.teste@gmail.com', 
      '(12) 99887-7665', 
      '123.456.789-00', 
      '1978-05-15', 
      'male', 
      'Rua das Palmeiras, 120', 
      'São José dos Campos', 
      'Paciente de teste criado para demonstração da jornada 360.', 
      true, 
      ${cincoDiasAtras.toISOString()}, 
      now()
    )
    RETURNING id
  `
  const patId = insertedPatient[0].id
  console.log(`✓ Paciente criado: Carlos Teste Silva (${patId})`)

  // b. Lead do CRM (Origem)
  const insertedLead = await sql`
    INSERT INTO leads (id, name, phone, email, status, source, specialty, complaint, notes, assigned_to_id, converted_at, patient_id, utm_source, utm_campaign, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'Carlos Teste Silva',
      '(12) 99887-7665',
      'carlos.teste@gmail.com',
      'active_patient',
      'google_ads',
      'joelho',
      'Dor crônica no joelho esquerdo ao subir escadas, com limitação física.',
      'Lead converteu rápido. Veio focado em viscossuplementação após pesquisa de dor no joelho.',
      ${docId},
      ${cincoDiasAtras.toISOString()},
      ${patId},
      'google',
      'joelho_artrose_sjc',
      ${cincoDiasAtras.toISOString()},
      now()
    )
    RETURNING id
  `
  const leadId = insertedLead[0].id
  console.log(`✓ CRM Lead criado com UTMs de tráfego (${leadId})`)

  // c. Interação do Lead
  await sql`
    INSERT INTO lead_interactions (id, lead_id, user_id, type, content, created_at)
    VALUES (
      gen_random_uuid(),
      ${leadId},
      ${docId},
      'note',
      'Contato telefônico inicial efetuado pela recepção. Carlos confirma dor no joelho esquerdo há 6 meses. Consulta de avaliação agendada.',
      ${cincoDiasAtras.toISOString()}
    )
  `

  // d. Agendamento (Consulta Inicial)
  const dataConsulta = new Date(cincoDiasAtras)
  dataConsulta.setHours(14, 0, 0, 0)
  const dataFimConsulta = new Date(dataConsulta)
  dataFimConsulta.setHours(15, 0, 0, 0)

  const returnDeadline = new Date(dataConsulta)
  returnDeadline.setDate(returnDeadline.getDate() + 15) // Direito a retorno por 15 dias

  const returnEstimatedAt = new Date(dataConsulta)
  returnEstimatedAt.setDate(returnEstimatedAt.getDate() + 7) // Médico sugere retorno em 7 dias

  const insertedAppt = await sql`
    INSERT INTO appointments (id, patient_id, lead_id, doctor_id, type, status, start_at, end_at, title, notes, confirmed_at, reminder_sent, created_by_id, created_at, updated_at, return_deadline, return_estimated_at)
    VALUES (
      gen_random_uuid(),
      ${patId},
      ${leadId},
      ${docId},
      'consultation',
      'attended',
      ${dataConsulta.toISOString()},
      ${dataFimConsulta.toISOString()},
      'Consulta Inicial - Dr. André',
      'Primeira avaliação de dor crônica no joelho. Apresenta exames de imagem sugerindo osteoartrite.',
      ${cincoDiasAtras.toISOString()},
      true,
      ${docId},
      ${cincoDiasAtras.toISOString()},
      now(),
      ${returnDeadline.toISOString()},
      ${returnEstimatedAt.toISOString()}
    )
    RETURNING id
  `
  const apptId = insertedAppt[0].id
  console.log(`✓ Agendamento da consulta inicial criado e marcado como Compareceu (${apptId})`)

  // e. Evolução Clínica (Prontuário)
  await sql`
    INSERT INTO clinical_records (id, patient_id, appointment_id, doctor_id, type, content, created_at)
    VALUES (
      gen_random_uuid(),
      ${patId},
      ${apptId},
      ${docId},
      'evolution',
      'Paciente Carlos Teste Silva, 48 anos. Queixa-se de dor insidiosa em joelho esquerdo há cerca de 6 meses, com piora ao subir/descer escadas e repouso prolongado. Ao exame físico: dor à palpação da interlinha articular medial esquerda, crepitação articular discreta, sem sinais inflamatórios exuberantes ou instabilidade ligamentar. Traz radiografia mostrando redução do espaço articular femorotibial interno (grau II Kellgren-Lawrence). Conduta: Indicada viscossuplementação com Ácido Hialurônico de alta densidade no joelho esquerdo. Paciente optou por iniciar o ciclo hoje.',
      ${dataConsulta.toISOString()}
    )
  `
  console.log(`✓ Registro de Prontuário (Evolução Clínica) criado`)

  // f. Financeiro (Cobrança da Consulta)
  await sql`
    INSERT INTO transactions (id, type, category, description, amount, date, due_date, paid_at, is_paid, patient_id, appointment_id, created_by_id, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'income',
      'consultation_fee',
      'Pagamento Consulta Médica - Carlos Teste Silva',
      350.00,
      ${cincoDiasAtrasStr},
      ${cincoDiasAtrasStr},
      ${dataConsulta.toISOString()},
      true,
      ${patId},
      ${apptId},
      ${docId},
      ${cincoDiasAtras.toISOString()},
      now()
    )
  `
  console.log(`✓ Transação de pagamento da consulta registrada (R$ 350,00 via Pix)`)

  // g. Lançamento do Tratamento (Infiltração de Joelho)
  const templateIdInfilt = templateIds['Infiltração de Joelho com Ácido Hialurônico']
  const insertedTreatment = await sql`
    INSERT INTO treatments (id, patient_id, appointment_id, doctor_id, payment_method_id, template_id, name, category, status, subtotal, discount, total_sale, total_cost, installments, notes, created_by_id, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      ${patId},
      ${apptId},
      ${docId},
      ${pmId},
      ${templateIdInfilt},
      'Tratamento Infiltração Joelho Esquerdo',
      'hyaluronic_procedure',
      'in_progress',
      1500.00,
      0.00,
      1500.00,
      474.80,
      3,
      'Viscossuplementação de joelho esquerdo programada em 3 parcelas.',
      ${docId},
      ${cincoDiasAtras.toISOString()},
      now()
    )
    RETURNING id
  `
  const treatId = insertedTreatment[0].id
  console.log(`✓ Plano de Tratamento lançado: R$ 1.500,00 (${treatId})`)

  // h. Itens do Tratamento (Copiados do catálogo)
  const itemsToCreate = [
    { type: 'material', matName: 'Ácido Hialurônico (Ampola 2ml)', qty: 1, cost: 450.00, price: 450.00 },
    { type: 'material', matName: 'Agulha Descartável 30G 1/2', qty: 1, cost: 1.50, price: 1.50 },
    { type: 'material', matName: 'Seringa Descartável Luer Lock 5ml', qty: 1, cost: 0.80, price: 0.80 },
    { type: 'material', matName: 'Tubo de Anestésico Xilocaína 2% (20ml)', qty: 1, cost: 18.00, price: 18.00 },
    { type: 'fee', matName: null, qty: 1, cost: 0.00, price: 1029.70 } // Ajustado para fechar em 1500.00
  ]

  for (let i = 0; i < itemsToCreate.length; i++) {
    const item = itemsToCreate[i]
    const mId = item.matName ? materialIds[item.matName] : null
    const totalItem = item.qty * item.price

    await sql`
      INSERT INTO treatment_items (id, treatment_id, type, material_id, description, quantity, unit_cost, unit_price, total, sort_order)
      VALUES (gen_random_uuid(), ${treatId}, ${item.type}, ${mId}, ${item.matName || 'Honorários do Procedimento'}, ${item.qty}, ${item.cost}, ${item.price}, ${totalItem}, ${i})
    `
  }

  // i. Financeiro do Tratamento (Parcelamento: 3x de R$ 500,00)
  // Parcela 1: Paga há 5 dias
  await sql`
    INSERT INTO transactions (id, type, category, description, amount, date, due_date, paid_at, is_paid, patient_id, treatment_id, installment_number, installment_total, created_by_id, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'income',
      'hyaluronic_procedure',
      'Infiltração de Joelho - Parcela 1/3',
      500.00,
      ${cincoDiasAtrasStr},
      ${cincoDiasAtrasStr},
      ${dataConsulta.toISOString()},
      true,
      ${patId},
      ${treatId},
      1,
      3,
      ${docId},
      ${cincoDiasAtras.toISOString()},
      now()
    )
  `
  // Parcela 2: Vence em 25 dias
  const dataVenc2 = new Date()
  dataVenc2.setDate(dataVenc2.getDate() + 25)
  const dataVenc2Str = dataVenc2.toISOString().split('T')[0]
  await sql`
    INSERT INTO transactions (id, type, category, description, amount, date, due_date, is_paid, patient_id, treatment_id, installment_number, installment_total, created_by_id, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'income',
      'hyaluronic_procedure',
      'Infiltração de Joelho - Parcela 2/3',
      500.00,
      ${dataVenc2Str},
      ${dataVenc2Str},
      false,
      ${patId},
      ${treatId},
      2,
      3,
      ${docId},
      ${cincoDiasAtras.toISOString()},
      now()
    )
  `
  // Parcela 3: Vence em 55 dias
  const dataVenc3 = new Date()
  dataVenc3.setDate(dataVenc3.getDate() + 55)
  const dataVenc3Str = dataVenc3.toISOString().split('T')[0]
  await sql`
    INSERT INTO transactions (id, type, category, description, amount, date, due_date, is_paid, patient_id, treatment_id, installment_number, installment_total, created_by_id, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'income',
      'hyaluronic_procedure',
      'Infiltração de Joelho - Parcela 3/3',
      500.00,
      ${dataVenc3Str},
      ${dataVenc3Str},
      false,
      ${patId},
      ${treatId},
      3,
      3,
      ${docId},
      ${cincoDiasAtras.toISOString()},
      now()
    )
  `
  console.log(`✓ Faturamento do tratamento registrado (3 parcelas de R$ 500,00 lançadas no financeiro)`)

  console.log('\nPopulação de dados de teste concluída com sucesso!')
}

main().catch((e) => {
  console.error('Erro na população dos dados:', e)
  process.exit(1)
})
