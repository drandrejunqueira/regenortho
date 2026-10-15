import { createHmac } from 'node:crypto'
import { secretEquals } from '@/lib/secrets'

// Sessão do portal do paciente.
//
// O link com token (o que a clínica manda pelo WhatsApp) e o código de 6 dígitos
// são só a *entrada*. No primeiro contato eles viram este cookie HttpOnly de
// validade curta, e a credencial longa (token de 7 dias) para de circular: não
// fica na URL, no histórico, no localStorage nem em resposta JSON.
//
// O valor é `<id do acesso>.<expira em ms>.<assinatura>`. Roubar o cookie dá no
// máximo o resto das 2h, não o token — e revogar o acesso na clínica derruba a
// sessão, porque cada leitura reconfere o registro no banco.

export const COOKIE_SESSAO_PORTAL = 'portal_sessao'
export const DURACAO_SESSAO_PORTAL_MS = 2 * 60 * 60 * 1000
// Só a rota do portal recebe o cookie — nenhuma outra rota da origem o enxerga.
export const CAMINHO_COOKIE_PORTAL = '/api/portal/me'

function segredo(): string {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET/NEXTAUTH_SECRET ausente: sessão do portal não pode ser assinada')
  return s
}

function assinar(dados: string): string {
  // Prefixo de domínio: a mesma chave assina o JWT do NextAuth, e uma assinatura
  // daqui não pode ser reaproveitada em outro contexto.
  return createHmac('sha256', segredo()).update(`portal-sessao:${dados}`).digest('base64url')
}

export function criarValorSessaoPortal(acessoId: string, expiraEm: number): string {
  const dados = `${acessoId}.${expiraEm}`
  return `${dados}.${assinar(dados)}`
}

/** Devolve o id do acesso quando o cookie é autêntico e não venceu; senão null. */
export function lerValorSessaoPortal(valor: string | undefined | null, agora = Date.now()): string | null {
  if (!valor) return null
  const partes = valor.split('.')
  if (partes.length !== 3) return null
  const [acessoId, expira, assinatura] = partes
  if (!secretEquals(assinatura, assinar(`${acessoId}.${expira}`))) return null
  if (!(Number(expira) > agora)) return null
  return acessoId
}
