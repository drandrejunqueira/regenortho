// Composição do dashboard por papel. Puro (sem DB, sem React) para ser testável.
//
// Regra: o que aparece é decidido pela permissão EFETIVA (getEffectivePermissions),
// nunca só pelo papel — customPermissions substitui o preset inteiro, então um
// médico com permissões customizadas sem 'exams:view' não vê o bloco de exames.
import type { Permission, UserRole } from '@/lib/permissions'
import type { LoaderId } from './types'

export type BlockId =
  | 'chegadas'
  | 'nao-confirmados'
  | 'leads-sem-contato'
  | 'estoque'
  | 'proximo-paciente'
  | 'minha-agenda'
  | 'exames'
  | 'caixa-hoje'
  | 'vencidas'
  | 'previsto-mes'
  | 'vencimentos-7d'
  | 'receita-meta'
  | 'funil-mes'
  | 'ocupacao'
  | 'pulso-hoje'

export interface BlockDef {
  id: BlockId
  permission: Permission
  needs: LoaderId[]
  /** Bloco "tinta": o hero invertido do papel. No máximo um por layout. */
  hero?: boolean
  /** Altura mínima compartilhada entre bloco real e skeleton — sem salto de layout. */
  size: BlockSize
}

export type BlockSize = 'hero' | 'card' | 'strip'

export const SIZE_CLASS: Record<BlockSize, string> = {
  hero: 'min-h-[320px]',
  card: 'min-h-[280px]',
  strip: 'min-h-[88px]',
}

export const LOADER_PERMISSION: Record<LoaderId, Permission> = {
  chegadas: 'agenda:view',
  naoConfirmados: 'agenda:view',
  leadsNovos: 'leads:view',
  estoque: 'materials:view',
  minhaAgenda: 'agenda:view',
  exames: 'exams:view',
  caixaHoje: 'financial:view',
  vencidas: 'financial:view',
  previstoMes: 'financial:view',
  vencimentos7d: 'financial:view',
  funilMes: 'leads:view',
  ocupacao7d: 'agenda:view',
}

export const BLOCKS: Record<BlockId, BlockDef> = {
  'chegadas':          { id: 'chegadas',          permission: 'agenda:view',    needs: ['chegadas'], hero: true, size: 'hero' },
  'nao-confirmados':   { id: 'nao-confirmados',   permission: 'agenda:view',    needs: ['naoConfirmados'], size: 'card' },
  'leads-sem-contato': { id: 'leads-sem-contato', permission: 'leads:view',     needs: ['leadsNovos'], size: 'card' },
  'estoque':           { id: 'estoque',           permission: 'materials:view', needs: ['estoque'], size: 'strip' },
  'proximo-paciente':  { id: 'proximo-paciente',  permission: 'agenda:view',    needs: ['minhaAgenda'], hero: true, size: 'hero' },
  'minha-agenda':      { id: 'minha-agenda',      permission: 'agenda:view',    needs: ['minhaAgenda'], size: 'card' },
  'exames':            { id: 'exames',            permission: 'exams:view',     needs: ['exames'], size: 'card' },
  'caixa-hoje':        { id: 'caixa-hoje',        permission: 'financial:view', needs: ['caixaHoje', 'vencidas'], hero: true, size: 'hero' },
  'vencidas':          { id: 'vencidas',          permission: 'financial:view', needs: ['vencidas'], size: 'card' },
  'previsto-mes':      { id: 'previsto-mes',      permission: 'financial:view', needs: ['previstoMes'], size: 'card' },
  'vencimentos-7d':    { id: 'vencimentos-7d',    permission: 'financial:view', needs: ['vencimentos7d'], size: 'card' },
  'receita-meta':      { id: 'receita-meta',      permission: 'financial:view', needs: ['previstoMes'], hero: true, size: 'hero' },
  'funil-mes':         { id: 'funil-mes',         permission: 'leads:view',     needs: ['funilMes'], size: 'card' },
  'ocupacao':          { id: 'ocupacao',          permission: 'agenda:view',    needs: ['ocupacao7d'], size: 'card' },
  // Frase editorial do admin: cada fato entra só se a permissão do loader existir.
  'pulso-hoje':        { id: 'pulso-hoje',        permission: 'dashboard:view', needs: ['chegadas', 'leadsNovos', 'estoque'], size: 'card' },
}

export interface LayoutSlot {
  id: BlockId
  /** Classes de grid (12 colunas em lg, 2 em md, 1 abaixo). Strings literais para o Tailwind enxergar. */
  span: string
}

/**
 * Ordem = prioridade. É a ordem de leitura no celular e a ordem da entrada
 * escalonada. O primeiro bloco de cada papel é o que ele precisa ver em 3s.
 */
export const ROLE_LAYOUT: Record<UserRole, LayoutSlot[]> = {
  receptionist: [
    { id: 'chegadas',          span: 'md:col-span-2 lg:col-span-7 lg:row-span-2' },
    { id: 'nao-confirmados',   span: 'lg:col-span-5' },
    { id: 'leads-sem-contato', span: 'lg:col-span-5' },
    { id: 'estoque',           span: 'md:col-span-2 lg:col-span-12' },
  ],
  doctor: [
    // No celular a agenda vem logo abaixo do próximo paciente; em lg os exames
    // sobem para a coluna da direita.
    { id: 'proximo-paciente',  span: 'md:col-span-2 lg:col-span-7 order-1' },
    { id: 'minha-agenda',      span: 'md:col-span-2 lg:col-span-7 order-2 lg:order-3' },
    { id: 'exames',            span: 'md:col-span-2 lg:col-span-5 lg:row-span-2 order-3 lg:order-2' },
  ],
  financial: [
    { id: 'caixa-hoje',        span: 'md:col-span-2 lg:col-span-5 lg:row-span-2' },
    { id: 'vencidas',          span: 'lg:col-span-7' },
    { id: 'previsto-mes',      span: 'lg:col-span-7' },
    { id: 'vencimentos-7d',    span: 'md:col-span-2 lg:col-span-12' },
  ],
  admin: [
    { id: 'receita-meta',      span: 'md:col-span-2 lg:col-span-7' },
    { id: 'pulso-hoje',        span: 'lg:col-span-5' },
    { id: 'funil-mes',         span: 'lg:col-span-5' },
    { id: 'ocupacao',          span: 'md:col-span-2 lg:col-span-7' },
    { id: 'estoque',           span: 'md:col-span-2 lg:col-span-12' },
  ],
}

export interface ResolvedBlock extends LayoutSlot {
  def: BlockDef
  /** Loaders que este bloco pode consumir dado o conjunto de permissões. */
  loaders: LoaderId[]
}

/** Blocos visíveis para o papel, já filtrados pela permissão efetiva. */
export function resolveBlocks(role: UserRole, permissions: readonly Permission[]): ResolvedBlock[] {
  const perms = new Set(permissions)
  const layout = ROLE_LAYOUT[role] ?? []
  return layout
    .map((slot) => ({ slot, def: BLOCKS[slot.id] }))
    .filter(({ def }) => perms.has(def.permission))
    .map(({ slot, def }) => ({
      ...slot,
      def,
      loaders: def.needs.filter((l) => perms.has(LOADER_PERMISSION[l])),
    }))
    // Um bloco cujo único loader foi barrado por permissão não tem o que mostrar.
    .filter((b) => b.loaders.length > 0)
}

/** União (sem repetição) dos loaders necessários — cada query roda uma vez só. */
export function neededLoaders(blocks: readonly ResolvedBlock[]): LoaderId[] {
  const set = new Set<LoaderId>()
  for (const b of blocks) for (const l of b.loaders) set.add(l)
  return [...set]
}

/** Algum bloco do layout mostra dinheiro? Decide se o botão "ocultar valores" aparece. */
export function showsMoney(blocks: readonly ResolvedBlock[]): boolean {
  return blocks.some((b) => b.def.permission === 'financial:view')
}
