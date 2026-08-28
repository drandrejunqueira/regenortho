import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { treatments, treatmentItems, materials, stockMovements, patients, transactions, bankAccounts } from '@/lib/db/schema'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { z } from 'zod'
import { eq, and, ne, sql } from 'drizzle-orm'
import { sendAndLog, tplTreatmentSummary } from '@/lib/whatsapp'
import { vencimentoParcela } from '@/lib/parcelas'
import { darBaixaEstoque } from '@/lib/materials-stock'
import { notify } from '@/lib/notifications'
import { logActivity } from '@/lib/db/logger'

const TREATMENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  approved: 'Aprovado',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

const itemSchema = z.object({
  type: z.enum(['procedure', 'material', 'fee']),
  materialId: z.string().uuid().optional().nullable(),
  description: z.string().min(1).max(255),
  quantity: z.number().min(0.001),
  unitCost: z.number().min(0),
  unitPrice: z.number().min(0),
  sortOrder: z.number().int().min(0),
})

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.enum(['consultation_fee','prp_procedure','bmac_procedure','hyaluronic_procedure','surgery_fee','other_income']).optional(),
  paymentMethodId: z.string().uuid().optional().nullable(),
  bankAccountId: z.string().uuid().optional().nullable(),
  discount: z.number().min(0).optional(),
  installments: z.number().int().min(1).optional(),
  notes: z.string().optional().nullable(),
  cancelReason: z.string().optional().nullable(),
  status: z.enum(['draft', 'approved', 'in_progress', 'completed', 'cancelled']).optional(),
  paymentStatus: z.enum(['pending', 'first_paid', 'all_paid']).optional(),
  items: z.array(itemSchema).min(1).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'treatments:view', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const [treatment] = await db.select().from(treatments).where(eq(treatments.id, id))
  if (!treatment) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const items = await db.select().from(treatmentItems).where(eq(treatmentItems.treatmentId, id)).orderBy(treatmentItems.sortOrder)

  return NextResponse.json({ data: { ...treatment, items } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'treatments:edit', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const [existing] = await db.select().from(treatments).where(eq(treatments.id, id))
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  const d = parsed.data
  if (d.name !== undefined) updates.name = d.name
  if (d.category !== undefined) updates.category = d.category
  if (d.paymentMethodId !== undefined) updates.paymentMethodId = d.paymentMethodId
  if (d.notes !== undefined) updates.notes = d.notes
  if (d.cancelReason !== undefined) updates.cancelReason = d.cancelReason

  // Recalculate when items are replaced
  let newSubtotal = Number(existing.subtotal)
  let newTotalCost = Number(existing.totalCost)
  if (d.items !== undefined) {
    await db.delete(treatmentItems).where(eq(treatmentItems.treatmentId, id))
    if (d.items.length > 0) {
      await db.insert(treatmentItems).values(
        d.items.map((it, i) => ({
          treatmentId: id,
          type: it.type,
          materialId: it.materialId ?? null,
          description: it.description,
          quantity: String(it.quantity),
          unitCost: String(it.unitCost),
          unitPrice: String(it.unitPrice),
          sortOrder: it.sortOrder ?? i,
        }))
      )
    }
    newSubtotal = d.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
    newTotalCost = d.items.reduce((s, it) => s + it.quantity * it.unitCost, 0)
    updates.subtotal = String(newSubtotal)
    updates.totalCost = String(newTotalCost)
  }

  const effectiveSubtotal = d.items !== undefined ? newSubtotal : Number(existing.subtotal)
  const effectiveDiscount = d.discount !== undefined ? d.discount : Number(existing.discount)
  if (d.discount !== undefined || d.items !== undefined) {
    updates.discount = String(effectiveDiscount)
    updates.totalSale = String(Math.max(0, effectiveSubtotal - effectiveDiscount))
  }

  // Avisos que não impedem a conclusão, mas que a tela precisa mostrar em vez
  // de fingir que deu tudo certo (hoje: estoque que não cobriu a baixa).
  const avisos: string[] = []

  if (d.installments !== undefined) updates.installments = d.installments
  if (d.status !== undefined) {
    updates.status = d.status
    if (d.status === 'completed' && existing.status !== 'completed') {
      // Concluir gera recebíveis, mas exigir `financial:create` AQUI fechava o
      // fluxo inteiro: o médico tem treatments:edit e não tem financial:create
      // (403 "peça ao financeiro"), e o financeiro tem financial:create mas não
      // tem treatments:edit — parava na guarda da entrada da rota. Ninguém além
      // do admin conseguia faturar. Lançar as parcelas é parte de concluir o
      // tratamento, e quem tem treatments:edit é justamente quem o conduz.
      if (d.bankAccountId && !hasPermission(session.user.role as UserRole, 'payments:edit', session.user.customPermissions)) {
        return NextResponse.json(
          { error: 'Sem permissão para creditar saldo em conta bancária.' },
          { status: 403 }
        )
      }

      // Reivindica a conclusão ANTES de baixar estoque, lançar parcelas e
      // creditar saldo. A guarda `existing.status !== 'completed'` só passava a
      // valer depois do UPDATE final, lá embaixo: se a função expirasse no meio,
      // o usuário via erro, reenviava e duplicava parcelas e crédito no saldo.
      // Este UPDATE condicional é atômico — o segundo clique não retorna linha.
      const [reivindicado] = await db
        .update(treatments)
        .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(treatments.id, id), ne(treatments.status, 'completed')))
        .returning({ id: treatments.id })

      if (!reivindicado) {
        return NextResponse.json(
          { error: 'Este tratamento já foi concluído.' },
          { status: 409 }
        )
      }

      // Daqui para baixo o tratamento JÁ consta como concluído. O driver
      // neon-http não abre transação interativa, então a única rede de proteção
      // possível é compensatória: se estoque, parcelas ou saldo falharem no
      // meio, devolvemos o status ao valor anterior. Sem isso um timeout deixava
      // o tratamento concluído com ZERO recebíveis e o reenvio batia no 409 da
      // guarda de concorrência — só um UPDATE manual no banco destravava.
      let parcelasLancadas = 0
      try {
        // Deduct materials from stock
        const items = await db.select().from(treatmentItems)
          .where(and(eq(treatmentItems.treatmentId, id), eq(treatmentItems.type, 'material')))

        for (const item of items) {
          if (item.materialId) {
            const solicitado = Number(item.quantity)
            // Consome os lotes (FEFO) quando o material é controlado por lote, e
            // recalcula o status. Antes a baixa mexia só na coluna: o próximo
            // recálculo por lotes restaurava o saldo já consumido, e o material
            // podia cair abaixo do mínimo continuando marcado como 'ok'.
            // A quantidade vai fracionada: o `Math.round` que havia aqui fazia
            // "0,4 frasco" virar 0 — nada saía do estoque e o movimento era
            // gravado com -0.
            const { saldo, baixado, faltou } = await darBaixaEstoque(item.materialId, solicitado)
            const material = await db.query.materials.findFirst({
              where: eq(materials.id, item.materialId),
              columns: { name: true, minimumStock: true, unit: true },
            })
            const nomeMaterial = material?.name ?? item.description

            if (faltou > 0) {
              // O estoque do sistema não cobria o que o procedimento consumiu.
              // Concluir mesmo assim é o certo (o material já foi usado), mas
              // calar sobre isso deixa o inventário divergente para sempre.
              avisos.push(
                `Estoque insuficiente de ${nomeMaterial}: faltaram ${faltou} ${material?.unit ?? 'un'}. Ajuste o inventário.`,
              )
              await notify({
                type: 'stock_low',
                title: `Estoque insuficiente: ${nomeMaterial}`,
                body: `Tratamento "${existing.name}" consumiu ${solicitado}, mas só havia ${baixado} em estoque.`,
                link: '/materiais',
                entityId: item.materialId,
                priority: 'high',
              })
            }

            if (material && saldo <= material.minimumStock) {
              await notify({
                type: 'stock_low',
                title: `Estoque baixo: ${material.name}`,
                body: `Restam ${saldo} ${material.unit} (mínimo: ${material.minimumStock})`,
                link: '/materiais',
                entityId: item.materialId,
                priority: 'high',
              })
            }
            // O movimento registra o que saiu de fato (coluna integer): gravar
            // a fração daria um movimento arredondado para zero, que é
            // exatamente o rastro que sumia.
            await db.insert(stockMovements).values({
              materialId: item.materialId,
              type: 'out',
              quantity: -baixado,
              reason: `Tratamento: ${existing.name}${baixado !== solicitado ? ` (${solicitado} solicitado)` : ''}`.slice(0, 255),
              userId: session.user.id,
            })
          }
        }

        // Lança o financeiro: divide o valor de venda em parcelas (recebimentos
        // futuros), com vencimento mensal a partir da conclusão. Cada parcela fica
        // como "a receber" (isPaid=false) para o financeiro baixar conforme entra.
        const n = Math.max(1, d.installments !== undefined ? d.installments : existing.installments)
        const totalSaleVal = d.discount !== undefined ? Math.max(0, Number(existing.subtotal) - d.discount) : Number(existing.totalSale)
        const totalCents = Math.round(totalSaleVal * 100)
        const baseCents = Math.floor(totalCents / n)
        const today = new Date()
        const fmt = (dt: Date) => dt.toISOString().split('T')[0]
        const paymentStatus = d.paymentStatus ?? 'pending'

        // Forma de pagamento (intenção) e conta de recebimento das parcelas pagas
        const paymentMethodId = d.paymentMethodId ?? existing.paymentMethodId ?? null
        const bankAccountId = d.bankAccountId ?? null

        let paidCents = 0
        const rows = Array.from({ length: n }, (_, i) => {
          // a última parcela absorve o arredondamento
          const cents = i === n - 1 ? totalCents - baseCents * (n - 1) : baseCents
          const due = vencimentoParcela(today, i)
          const isPaid = paymentStatus === 'all_paid' || (paymentStatus === 'first_paid' && i === 0)
          if (isPaid) paidCents += cents
          return {
            type: 'income' as const,
            category: existing.category,
            amount: (cents / 100).toFixed(2),
            description: n > 1
              ? `Tratamento: ${existing.name} (${i + 1}/${n})`
              : `Tratamento: ${existing.name}`,
            date: fmt(today),
            dueDate: fmt(due),
            isPaid,
            paidAt: isPaid ? today : null,
            patientId: existing.patientId,
            appointmentId: existing.appointmentId,
            treatmentId: existing.id,
            paymentMethodId,
            // conta só é vinculada quando a parcela já entrou (foi recebida)
            bankAccountId: isPaid ? bankAccountId : null,
            installmentNumber: i + 1,
            installmentTotal: n,
            createdById: session.user.id,
          }
        })
        await db.insert(transactions).values(rows)
        parcelasLancadas = rows.length

        // Credita o saldo da conta de recebimento com o total já pago
        if (bankAccountId && paidCents > 0) {
          const paidValue = (paidCents / 100).toFixed(2)
          await db.update(bankAccounts)
            .set({ currentBalance: sql`current_balance + ${paidValue}`, updatedAt: new Date() })
            .where(eq(bankAccounts.id, bankAccountId))
        }
      } catch (erro) {
        console.error('[tratamentos] falha ao faturar conclusão, revertendo status', { id, erro })
        try {
          await db.update(treatments)
            .set({ status: existing.status, completedAt: existing.completedAt ?? null, updatedAt: new Date() })
            .where(eq(treatments.id, id))
        } catch (erroRollback) {
          // Reversão falhou: o tratamento fica travado em 'completed' e o 409
          // impede o retry. Precisa aparecer no log para alguém destravar.
          console.error('[tratamentos] falha ao reverter conclusão', { id, erroRollback })
        }
        return NextResponse.json(
          { error: 'Falha ao lançar o faturamento do tratamento. Nada foi concluído — tente novamente.' },
          { status: 500 }
        )
      }

      // Registra a conclusão à parte de uma edição comum: é o evento que move
      // dinheiro (recebíveis) e estoque.
      await logActivity({
        userId: session.user.id,
        userName: session.user.name || session.user.email || null,
        action: 'tratamento:complete',
        module: 'tratamentos',
        targetId: id,
        targetName: existing.name,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        details: {
          totalSale: existing.totalSale,
          parcelas: parcelasLancadas,
          paymentStatus: d.paymentStatus ?? 'pending',
          bankAccountId: d.bankAccountId ?? null,
          avisos,
        },
      })

      // Send WhatsApp summary if patient has phone
      try {
        const [patient] = await db.select({ name: patients.name, phone: patients.phone }).from(patients).where(eq(patients.id, existing.patientId))
        if (patient?.phone) {
          const msg = tplTreatmentSummary(patient.name, existing.name, existing.totalSale, existing.installments)
          await sendAndLog('treatment_summary', patient.phone, msg, { patientId: existing.patientId })
        }
      } catch { /* non-blocking */ }
    }
  }

  const [updated] = await db.update(treatments).set(updates).where(eq(treatments.id, id)).returning()

  if (d.status !== undefined && d.status !== existing.status) {
    await notify({
      type: 'treatment_status',
      title: `Tratamento ${TREATMENT_STATUS_LABELS[d.status] ?? d.status}: ${updated.name}`,
      body: `R$ ${updated.totalSale}` + (d.cancelReason ? ` • Motivo: ${d.cancelReason}` : ''),
      link: '/tratamentos',
      entityId: updated.id,
    })
  }

  // A conclusão já foi registrada com ação própria acima; aqui fica a edição
  // (valores, itens, desconto, cancelamento), que também mexe no que será
  // cobrado do paciente.
  const concluiuAgora = d.status === 'completed' && existing.status !== 'completed'
  if (!concluiuAgora) {
    await logActivity({
      userId: session.user.id,
      userName: session.user.name || session.user.email || null,
      action: 'tratamento:edit',
      module: 'tratamentos',
      targetId: id,
      targetName: updated?.name ?? existing.name,
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      details: {
        statusAnterior: existing.status,
        status: d.status ?? existing.status,
        totalSale: updated?.totalSale ?? existing.totalSale,
        cancelReason: d.cancelReason ?? null,
        itensSubstituidos: d.items?.length ?? null,
      },
    })
  }

  return NextResponse.json({ data: updated, ...(avisos.length > 0 ? { avisos } : {}) })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!hasPermission(session.user.role as UserRole, 'treatments:delete', session.user.customPermissions)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const [existing] = await db.select().from(treatments).where(eq(treatments.id, id))
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  if (!['draft', 'cancelled'].includes(existing.status)) {
    return NextResponse.json({ error: 'Apenas tratamentos em rascunho ou cancelados podem ser excluídos' }, { status: 400 })
  }

  await db.delete(treatments).where(eq(treatments.id, id))

  // Exclusão apaga os itens em cascata: sem o log não sobra rastro nenhum de
  // que o orçamento existiu, nem de quem o removeu.
  await logActivity({
    userId: session.user.id,
    userName: session.user.name || session.user.email || null,
    action: 'tratamento:delete',
    module: 'tratamentos',
    targetId: id,
    targetName: existing.name,
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    details: {
      status: existing.status,
      totalSale: existing.totalSale,
      patientId: existing.patientId,
    },
  })

  return NextResponse.json({ ok: true })
}
