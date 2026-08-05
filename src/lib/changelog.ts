/**
 * Histórico de atualizações do sistema.
 *
 * Fica no código de propósito: o changelog da versão X sobe junto com a versão
 * X, sem tabela, sem migration e sem tela de cadastro para manter. Ao publicar
 * uma atualização, acrescente uma entrada NO TOPO de VERSOES.
 *
 * O texto é para a equipe da clínica, não para quem programa — descreva o que
 * mudou na rotina de quem usa, não o arquivo que foi alterado.
 */

export type TipoMudanca = 'correcao' | 'novidade' | 'seguranca' | 'melhoria'

export interface Mudanca {
  tipo: TipoMudanca
  titulo: string
  /** Opcional: o que a pessoa vai notar na prática. */
  detalhe?: string
}

export interface Versao {
  versao: string
  /** YYYY-MM-DD */
  data: string
  /** Resumo de uma linha, mostrado junto do número da versão. */
  resumo: string
  mudancas: Mudanca[]
}

export const TIPO_LABEL: Record<TipoMudanca, string> = {
  correcao: 'Correção',
  novidade: 'Novidade',
  seguranca: 'Segurança',
  melhoria: 'Melhoria',
}

export const TIPO_COR: Record<TipoMudanca, { cor: string; fundo: string; icone: string }> = {
  correcao: { cor: '#d97706', fundo: 'rgba(217,119,6,0.10)', icone: 'build' },
  novidade: { cor: '#00BCE4', fundo: 'rgba(0,188,228,0.10)', icone: 'auto_awesome' },
  seguranca: { cor: '#dc2626', fundo: 'rgba(220,38,38,0.10)', icone: 'shield' },
  melhoria: { cor: '#16a34a', fundo: 'rgba(22,163,74,0.10)', icone: 'trending_up' },
}

export const VERSOES: Versao[] = [
  {
    versao: '1.2.2',
    data: '2026-08-05',
    resumo: 'Layout responsivo do Quadro Kanban de Leads e otimização do Funil',
    mudancas: [
      {
        tipo: 'melhoria',
        titulo: 'Quadro Kanban de Leads responsivo em colunas adaptativas',
        detalhe:
          'O quadro de leads agora ajusta as colunas dinamicamente na tela sem necessidade de scroll horizontal, com cards compactos e adaptáveis para qualquer tamanho de monitor.',
      },
      {
        tipo: 'melhoria',
        titulo: 'Fluxo de atendimento simplificado no CRM de Leads',
        detalhe:
          'Os estágios do Kanban agora acompanham a jornada até "Compareceu". A partir do comparecimento, o lead vira paciente e passa a ser acompanhado na área dedicada de Pacientes.',
      },
    ],
  },
  {
    versao: '1.2.1',
    data: '2026-08-04',
    resumo: 'Recepção volta a escolher a forma de pagamento ao agendar',
    mudancas: [
      {
        tipo: 'correcao',
        titulo: 'Formas de pagamento aparecem para a recepção no agendamento',
        detalhe:
          'Ao marcar a consulta como paga — no CRM de leads ou na Agenda — a lista de formas de pagamento vinha vazia para quem não tem acesso ao financeiro, e a consulta não podia ser fechada. Agora quem pode agendar também enxerga as formas de pagamento.',
      },
    ],
  },
  {
    versao: '1.2.0',
    data: '2026-07-30',
    resumo: 'Correções de estoque, financeiro, prontuário e portal do paciente',
    mudancas: [
      {
        tipo: 'seguranca',
        titulo: 'Excluir paciente não apaga mais o prontuário',
        detalhe:
          'O histórico clínico era apagado junto com o paciente, mesmo o sistema avisando que isso não aconteceria. Agora a exclusão é bloqueada e o sistema informa quantos registros existem.',
      },
      {
        tipo: 'seguranca',
        titulo: 'Código do portal do paciente agora é único',
        detalhe:
          'Dois pacientes podiam receber o mesmo código de 6 dígitos, e quem digitasse abriria a ficha do outro.',
      },
      {
        tipo: 'correcao',
        titulo: 'Dashboard deixou de contar parcela não recebida como faturamento',
        detalhe:
          'O valor cheio do tratamento entrava no mês da conclusão. A meta era batida com dinheiro que ainda não tinha entrado.',
      },
      {
        tipo: 'correcao',
        titulo: 'Estoque não perde mais as baixas dos tratamentos',
        detalhe:
          'Editar um lote restaurava a quantidade já consumida. As saídas agora consomem os lotes pela validade mais próxima.',
      },
      {
        tipo: 'correcao',
        titulo: 'Receber a mesma compra duas vezes não credita em dobro',
        detalhe: 'Dois cliques no botão lançavam o estoque e a despesa duplicados.',
      },
      {
        tipo: 'correcao',
        titulo: 'Relatórios passam a mostrar dados reais',
        detalhe: 'As abas Geral, Leads e Financeiro exibiam números de exemplo, não os da clínica.',
      },
      {
        tipo: 'correcao',
        titulo: 'Parcelas param de pular mês quando o tratamento fecha nos dias 29 a 31',
      },
      {
        tipo: 'correcao',
        titulo: 'Agenda da semana mostra a manhã de segunda-feira',
        detalhe: 'A grade começava no horário atual e escondia os agendamentos anteriores.',
      },
      {
        tipo: 'correcao',
        titulo: 'Adicionar uma segunda etiqueta no lead não apaga mais a primeira',
      },
      {
        tipo: 'melhoria',
        titulo: 'Botões que dariam erro de permissão não aparecem mais',
        detalhe:
          'E o prontuário passa a dizer "sem permissão" em vez de "nenhum registro" quando o acesso é negado.',
      },
      {
        tipo: 'melhoria',
        titulo: 'Confirmação antes de excluir lote, rascunho de compra e cancelar agendamento',
      },
      {
        tipo: 'melhoria',
        titulo: 'Médico consegue faturar tratamento e escolher o responsável pelo agendamento',
      },
    ],
  },
  {
    versao: '1.1.0',
    data: '2026-07-30',
    resumo: 'Central de avisos, Google Ads e correções críticas',
    mudancas: [
      {
        tipo: 'novidade',
        titulo: 'Central de avisos no sino do topo',
        detalhe:
          'Novo lead, agendamento, tratamento e estoque baixo aparecem com aviso sonoro e notificação na área de trabalho.',
      },
      {
        tipo: 'novidade',
        titulo: 'Campanhas do Google Ads no painel de Tráfego',
        detalhe:
          'Com a configuração da integração na própria tela. Sem o token do Google, as campanhas vêm pelo Analytics.',
      },
      {
        tipo: 'seguranca',
        titulo: 'Portal do paciente voltou a funcionar',
        detalhe: 'Todo link e código enviado ao paciente caía na tela de login do sistema.',
      },
      {
        tipo: 'seguranca',
        titulo: 'Ficha do paciente deixou de mostrar dados de outros pacientes',
        detalhe: 'As abas Consultas e Financeiro listavam os registros da clínica inteira.',
      },
      {
        tipo: 'seguranca',
        titulo: 'Permissões personalizadas passaram a valer',
        detalhe:
          'O que era configurado na tela de usuários era ignorado — só o perfil valia. Desativar um usuário também não encerrava a sessão dele.',
      },
      {
        tipo: 'correcao',
        titulo: 'Editar agendamento não apaga mais as parcelas do tratamento',
      },
      {
        tipo: 'correcao',
        titulo: 'Origem dos leads deixou de marcar tráfego pago como orgânico',
        detalhe: 'Cliques de anúncio pelo celular chegavam sem identificação de campanha.',
      },
      {
        tipo: 'correcao',
        titulo: 'Número do lote não some mais ao reabrir o material',
        detalhe: 'Os 17 lotes que já estavam cadastrados foram recuperados.',
      },
      {
        tipo: 'correcao',
        titulo: 'Telas pararam de confirmar sucesso sem ter salvado',
        detalhe:
          'Lead sem e-mail, cobrança da consulta finalizada e conversão de lead em paciente falhavam em silêncio.',
      },
    ],
  },
]

/** Versão publicada — a mais recente da lista. */
export const VERSAO_ATUAL = VERSOES[0]?.versao ?? '—'
