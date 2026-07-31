/**
 * Datas de vencimento das parcelas de um tratamento.
 *
 * `new Date(ano, mes + i, dia)` transborda quando o dia não existe no mês alvo:
 * dia 31 + 1 mês num mês de 30 dias cai no dia 1º do mês seguinte. Conclusões
 * nos dias 29, 30 e 31 geravam um mês sem parcela e outro com duas.
 *
 * Compartilhado entre o servidor (que grava) e a tela (que mostra a prévia),
 * para os dois não divergirem.
 */
export function vencimentoParcela(base: Date, indice: number): Date {
  const ano = base.getFullYear()
  const mes = base.getMonth()
  const dia = base.getDate()
  // Dia 0 do mês seguinte = último dia do mês alvo.
  const ultimoDiaDoMesAlvo = new Date(ano, mes + indice + 1, 0).getDate()
  return new Date(ano, mes + indice, Math.min(dia, ultimoDiaDoMesAlvo))
}

/** Lista de vencimentos para `total` parcelas a partir de `base`. */
export function vencimentosParcelas(base: Date, total: number): Date[] {
  return Array.from({ length: total }, (_, i) => vencimentoParcela(base, i))
}
