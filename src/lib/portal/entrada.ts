// Limites da entrada por código no portal do paciente (/api/portal/me).
// Ficam fora do route handler porque o Next recusa exports que não sejam de rota.
//
// O código tem só 900 mil combinações e o atacante testa contra *todos* os
// acessos ativos ao mesmo tempo, então o freio por IP sozinho não segura. Daí:
// - segundo fator: código + data de nascimento;
// - limite por código: 3 nascimentos errados contra o mesmo código o anulam
//   (o link continua valendo; a clínica gera um código novo);
// - limite global: falhas de código somadas de todos os IPs, contadas no banco,
//   suspendem a entrada por código por 15 min e avisam a clínica.

export const LIMITE_PORTAL_POR_IP = 12
export const JANELA_PORTAL_IP_MS = 5 * 60 * 1000

export const MAX_FALHAS_POR_CODIGO = 3
export const LIMITE_GLOBAL_FALHAS_CODIGO = 30
export const JANELA_GLOBAL_CODIGO_MS = 15 * 60 * 1000

export const ACAO_CODIGO_INVALIDO = 'portal:codigo_invalido'
export const ACAO_CODIGO_FALHOU = 'portal:codigo_nascimento_errado'
export const ACAO_CODIGO_ANULADO = 'portal:codigo_anulado'
