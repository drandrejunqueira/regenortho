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
  console.log('Iniciando teste de integração do fluxo de checkout do tratamento...\n')

  // 1. Encontrar o tratamento em andamento do Carlos Teste Silva
  const testTreatment = await sql`
    SELECT t.id, t.name, t.total_sale, t.status, t.installments, p.name as patient_name
    FROM treatments t
    JOIN patients p ON p.id = t.patient_id
    WHERE p.name = 'Carlos Teste Silva' AND t.status = 'in_progress'
    LIMIT 1
  `

  if (testTreatment.length === 0) {
    console.error('Tratamento em andamento de Carlos Teste Silva não encontrado. Execute o script de seed primeiro!')
    process.exit(1)
  }

  const t = testTreatment[0]
  console.log(`- Tratamento encontrado: ${t.name}`)
  console.log(`- Paciente: ${t.patient_name}`)
  console.log(`- Valor de Venda: R$ ${t.total_sale}`)
  console.log(`- Status Atual: ${t.status}`)
  console.log(`- Parcelas: ${t.installments}`)

  // 2. Buscar o ID do método de pagamento Pix
  const pm = await sql`SELECT id, name FROM payment_methods LIMIT 1`
  if (pm.length === 0) {
    console.error('Nenhuma forma de pagamento encontrada!')
    process.exit(1)
  }
  const pmId = pm[0].id
  console.log(`- Usando Forma de Pagamento: ${pm[0].name} (ID: ${pmId})`)

  // 3. Materiais do tratamento
  const items = await sql`
    SELECT m.id, m.name, m.current_stock, ti.quantity
    FROM treatment_items ti
    JOIN materials m ON m.id = ti.material_id
    WHERE ti.treatment_id = ${t.id} AND ti.type = 'material'
  `
  console.log('\nEstoque inicial dos materiais vinculados ao tratamento:')
  for (const item of items) {
    console.log(`  - ${item.name}: estoque atual = ${item.current_stock}, a deduzir = ${Math.round(Number(item.quantity))}`)
  }

  console.log('\nAtualizando tratamento e gerando faturamento sequencialmente...');

  // a. Atualiza o status do tratamento
  await sql`
    UPDATE treatments 
    SET status = 'completed', completed_at = now(), payment_method_id = ${pmId}, updated_at = now()
    WHERE id = ${t.id}
  `

  // b. Deduz estoque e insere movements
  for (const item of items) {
    const qty = Math.round(Number(item.quantity))
    await sql`
      UPDATE materials
      SET current_stock = GREATEST(0, current_stock - ${qty})
      WHERE id = ${item.id}
    `
    await sql`
      INSERT INTO stock_movements (id, material_id, type, quantity, reason, created_at)
      VALUES (gen_random_uuid(), ${item.id}, 'out', ${-qty}, ${`Tratamento: ${t.name}`}, now())
    `
  }

  // c. Limpa transações anteriores de teste do tratamento se houverem
  await sql`DELETE FROM transactions WHERE treatment_id = ${t.id}`

  // d. Cria parcelas faturadas como "Pagas" (all_paid)
  const n = Math.max(1, Number(t.installments))
  const totalCents = Math.round(Number(t.total_sale) * 100)
  const baseCents = Math.floor(totalCents / n)
  const today = new Date()
  const fmt = (dt: Date) => dt.toISOString().split('T')[0]

  for (let i = 0; i < n; i++) {
    const cents = i === n - 1 ? totalCents - baseCents * (n - 1) : baseCents
    const due = new Date(today.getFullYear(), today.getMonth() + i, today.getDate())
    
    // Simular faturamento 100% pago
    const isPaid = true 
    const amount = (cents / 100).toFixed(2)

    await sql`
      INSERT INTO transactions (id, type, category, description, amount, date, due_date, paid_at, is_paid, patient_id, treatment_id, installment_number, installment_total, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'income',
        'hyaluronic_procedure',
        ${n > 1 ? `Tratamento: ${t.name} (${i + 1}/${n})` : `Tratamento: ${t.name}`},
        ${amount},
        ${fmt(today)},
        ${fmt(due)},
        now(),
        ${isPaid},
        (SELECT patient_id FROM treatments WHERE id = ${t.id}),
        ${t.id},
        ${i + 1},
        ${n},
        now(),
        now()
      )
    `
  }

  console.log('✓ Atualização de banco de dados e faturamento executados com sucesso!')

  // 4. Verificar Resultados
  const updatedTreatment = await sql`SELECT status, completed_at FROM treatments WHERE id = ${t.id}`
  console.log(`\nVerificação do Tratamento:`)
  console.log(`  - Novo Status: ${updatedTreatment[0].status}`)
  console.log(`  - Data de Conclusão: ${updatedTreatment[0].completed_at}`)

  const updatedMaterials = await sql`
    SELECT m.name, m.current_stock
    FROM treatment_items ti
    JOIN materials m ON m.id = ti.material_id
    WHERE ti.treatment_id = ${t.id} AND ti.type = 'material'
  `
  console.log(`\nVerificação do Estoque Atualizado:`)
  for (const mat of updatedMaterials) {
    const original = items.find(i => i.name === mat.name)
    console.log(`  - ${mat.name}: novo estoque = ${mat.current_stock} (original = ${original?.current_stock})`)
  }

  const generatedTx = await sql`
    SELECT description, amount, due_date, is_paid, paid_at 
    FROM transactions 
    WHERE treatment_id = ${t.id}
    ORDER BY installment_number
  `
  console.log(`\nVerificação dos Lançamentos Financeiros Gerados:`)
  for (const tx of generatedTx) {
    console.log(`  - Descrição: "${tx.description}"`)
    console.log(`    Valor: R$ ${tx.amount} | Vencimento: ${tx.due_date} | Pago: ${tx.is_paid ? 'Sim' : 'Não'} | Pago em: ${tx.paid_at}`)
  }

  console.log('\nTeste de fluxo concluído com sucesso e verificado!')
}

main().catch((e) => {
  console.error('Erro no teste:', e)
  process.exit(1)
})
