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
    versao: '1.5.0',
    data: '2026-08-28',
    resumo: 'Jornada do paciente auditada: agendamento seguro, cobrança sem duplicidade e filtro de período no CRM',
    mudancas: [
      {
        tipo: 'novidade',
        titulo: 'Filtro de período no CRM de Leads',
        detalhe:
          'O quadro abre com os últimos 30 dias e você troca o recorte num clique: Hoje, 7, 15, 30 dias, um período personalizado ou tudo. Antes o CRM carregava o funil inteiro e cortava em 200 cards sem avisar — os leads mais antigos simplesmente sumiam da tela. Agora, quando ainda há lead fora da janela, o quadro diz isso na cara.',
      },
      {
        tipo: 'correcao',
        titulo: 'A consulta não é mais cobrada duas vezes',
        detalhe:
          'Consulta paga marcada no agendamento e depois finalizada na agenda gerava DOIS lançamentos no contas a receber — uma consulta de R$ 350 virava R$ 700. Agora o sistema reconhece a cobrança que já existe e atualiza em vez de duplicar. A tela de finalizar consulta também avisa quando a consulta já foi cobrada.',
      },
      {
        tipo: 'novidade',
        titulo: 'Aviso de conflito de horário',
        detalhe:
          'O sistema agora impede marcar dois atendimentos para o mesmo médico ou na mesma sala em horários que se sobrepõem, e mostra qual é o agendamento que está no caminho. Encostar continua permitido: 14h–15h e 15h–16h convivem normalmente.',
      },
      {
        tipo: 'correcao',
        titulo: 'Agendar pelo CRM ficou seguro contra falha no meio do caminho',
        detalhe:
          'Agendar a partir de um lead eram três operações separadas: se a última falhasse, sobrava uma ficha de paciente criada, o lead marcado como "Agendado" e nenhuma consulta na agenda. Agora é uma operação só, e tentar de novo reaproveita a ficha em vez de abrir um segundo prontuário para a mesma pessoa.',
      },
      {
        tipo: 'correcao',
        titulo: 'Paciente repetido não vira dois prontuários',
        detalhe:
          'Quem preenchia o formulário do site e depois chamava no WhatsApp virava dois cadastros, rachando histórico clínico e financeiro em dois. O sistema agora reconhece o telefone já cadastrado e avisa, oferecendo a ficha que já existe.',
      },
      {
        tipo: 'correcao',
        titulo: 'O médico consegue finalizar a própria consulta',
        detalhe:
          'Faltava permissão: o médico clicava em "Compareceu", recebia acesso negado e perdia a evolução do prontuário e o tratamento que estava criando junto. Corrigido — marcar e cancelar consulta continua sendo da recepção.',
      },
      {
        tipo: 'correcao',
        titulo: 'Concluir tratamento não trava mais no financeiro',
        detalhe:
          'Concluir exigia duas permissões que ninguém tinha ao mesmo tempo: o médico era barrado no financeiro e o financeiro era barrado no tratamento, então só o administrador conseguia faturar. Agora quem conduz o tratamento consegue concluí-lo.',
      },
      {
        tipo: 'correcao',
        titulo: 'Tratamento concluído não fica sem as parcelas',
        detalhe:
          'Se algo falhasse no meio da conclusão, o tratamento ficava marcado como concluído com zero parcelas no contas a receber e não dava para tentar de novo — dinheiro que ninguém ia cobrar. Agora, se der erro, o tratamento volta ao estado anterior e a conclusão pode ser refeita.',
      },
      {
        tipo: 'correcao',
        titulo: 'Novo Tratamento parou de dar erro sem explicação',
        detalhe:
          'Criar um tratamento sem escolher modelo do catálogo e forma de pagamento — ambos opcionais na tela — falhava com "Erro ao criar tratamento" e o trabalho era perdido. Criar tratamento pela ficha do paciente, sem itens, também quebrava.',
      },
      {
        tipo: 'correcao',
        titulo: 'O modelo de tratamento leva os materiais junto',
        detalhe:
          'Iniciar um tratamento pela agenda copiava só o nome e o preço do modelo: os materiais ficavam para trás, o custo aparecia como zero e o insumo saía do armário sem baixa no estoque. Agora os itens do modelo vão junto, com o custo atual do estoque.',
      },
      {
        tipo: 'correcao',
        titulo: 'Baixa de estoque com quantidade fracionada e aviso de saldo insuficiente',
        detalhe:
          'Meio frasco de material era arredondado para zero e não saía do estoque. E quando não havia saldo suficiente, a conclusão dizia que deu tudo certo. Agora a fração é respeitada e, faltando material, você é avisado na hora.',
      },
      {
        tipo: 'correcao',
        titulo: 'Consulta da noite deixou de vencer no dia seguinte',
        detalhe:
          'Toda consulta a partir das 21h entrava no contas a receber com vencimento um dia à frente, por diferença de fuso horário. Corrigido também nas parcelas de tratamento.',
      },
      {
        tipo: 'correcao',
        titulo: 'A forma de pagamento chega ao financeiro',
        detalhe:
          'A recepção agendava a consulta no PIX e o financeiro recebia a receita sem forma de pagamento nenhuma — qualquer relatório por meio de recebimento perdia todas as taxas de consulta.',
      },
      {
        tipo: 'correcao',
        titulo: 'O lead avança no funil quando o paciente comparece',
        detalhe:
          'O card ficava preso em "Agendado" para sempre, mesmo depois do atendimento, e a etapa seguinte do funil no painel mostrava zero permanentemente. Agora marcar a consulta como atendida move o lead junto.',
      },
      {
        tipo: 'correcao',
        titulo: 'Consulta paga sem ficha de paciente não é mais aceita em silêncio',
        detalhe:
          'Marcar uma consulta paga para alguém sem ficha gravava o valor e não gerava receita nenhuma no financeiro, sem erro nem aviso. Agora o sistema pede a ficha antes.',
      },
      {
        tipo: 'novidade',
        titulo: 'Registrar o resultado do exame',
        detalhe:
          'Na aba Exames da ficha do paciente agora dá para atualizar a situação do pedido (agendado, coletado, resultado disponível, arquivado) e anexar o link do resultado. Antes o pedido ficava em "Aguardando resultado" para sempre, porque não havia onde registrar.',
      },
      {
        tipo: 'seguranca',
        titulo: 'Dados clínicos e trilha de auditoria',
        detalhe:
          'A lista de exames deixou de poder devolver hipótese diagnóstica e CID-10 de pacientes que não são os da consulta em questão. Prontuário, exames e tratamentos passaram a registrar quem fez o quê no log de auditoria — antes eram os únicos módulos sem esse rastro.',
      },
      {
        tipo: 'seguranca',
        titulo: 'Tags e origem do lead',
        detalhe:
          'As tags do lead passaram pela mesma validação das tags do sistema, fechando uma brecha em que um texto forjado podia chegar ao assistente de WhatsApp. E a atribuição completa da campanha passou a ser guardada, o que permite medir de verdade qual anúncio trouxe o paciente.',
      },
      {
        tipo: 'melhoria',
        titulo: 'Sistema mais rápido nas telas de paciente e agenda',
        detalhe:
          'Índices no banco para as consultas mais usadas: ficha do paciente, agenda por médico, funil de leads e extrato financeiro.',
      },
    ],
  },
  {
    versao: '1.4.0',
    data: '2026-08-06',
    resumo: 'Filtros no CRM de Leads e tags cadastradas do sistema',
    mudancas: [
      {
        tipo: 'novidade',
        titulo: 'Tags do sistema, cadastradas em Configurações',
        detalhe:
          'As tags agora são cadastradas em Configurações → Tags, com nome e cor, e no lead você escolhe da lista em vez de digitar. Isso acaba com "Convênio", "convenio" e "convênío" virando três marcações diferentes no funil. Renomear uma tag atualiza automaticamente todos os leads que a usam.',
      },
      {
        tipo: 'novidade',
        titulo: 'Filtros no CRM de Leads',
        detalhe:
          'A barra do CRM ganhou filtro por tags (várias ao mesmo tempo), origem do lead, responsável pelo atendimento e período de entrada. Os filtros rodam no servidor, então alcançam todos os leads da clínica e não só os que já estavam na tela.',
      },
      {
        tipo: 'novidade',
        titulo: 'Responsável pelo lead',
        detalhe:
          'Agora dá para definir quem é o responsável por cada lead, direto no painel dele. O filtro "Sem responsável" mostra de uma vez tudo o que ainda ninguém assumiu.',
      },
      {
        tipo: 'seguranca',
        titulo: 'Auditoria de segurança do sistema',
        detalhe:
          'Rodada completa de revisão: correções em exposição de dados de paciente, limites de envio no WhatsApp, política de senha, proteção do glossário público e validação dos formulários públicos do site.',
      },
    ],
  },
  {
    versao: '1.3.0',
    data: '2026-08-06',
    resumo: 'Alerta sonoro de lead novo e resumo diário da agenda no WhatsApp do médico',
    mudancas: [
      {
        tipo: 'novidade',
        titulo: 'Resumo diário da agenda no WhatsApp do médico',
        detalhe:
          'Cada médico pode ativar, no próprio perfil (aba "Agenda do dia"), o envio automático da agenda dele às 8h no WhatsApp. A mesma tela mostra a prévia dos atendimentos de hoje e tem o botão "Enviar agora" para testar. Dias sem consulta não geram mensagem.',
      },
      {
        tipo: 'melhoria',
        titulo: 'Aviso sonoro reforçado quando entra um lead novo',
        detalhe:
          'Lead novo passa a ter um toque próprio, mais longo, para ser ouvido mesmo com o sistema em outra aba. O sino agora tem um botão de som que liga e desliga o aviso, e a lista atualiza a cada 20 segundos.',
      },
      {
        tipo: 'melhoria',
        titulo: 'Resumo geral da clínica no grupo passou para as 8h',
        detalhe:
          'O relatório automático enviado ao grupo do WhatsApp saía por volta das 7h e agora sai às 8h, junto com o resumo individual dos médicos.',
      },
    ],
  },
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
