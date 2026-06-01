import { db } from '@/lib/db'
import { configuracoes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const getConfig = async (chave: string): Promise<string | null> => {
  const row = await db.select().from(configuracoes).where(eq(configuracoes.chave, chave)).limit(1)
  return row[0]?.valor ?? null
}

export const getAllConfigs = async (): Promise<Record<string, string>> => {
  const rows = await db.select().from(configuracoes)
  return Object.fromEntries(rows.map(r => [r.chave, r.valor ?? '']))
}

export const setConfig = async (chave: string, valor: string, descricao?: string) => {
  await db
    .insert(configuracoes)
    .values({ chave, valor, descricao, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: configuracoes.chave,
      set: { valor, updatedAt: new Date() },
    })
}
