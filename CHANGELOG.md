# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.6.0] - 2026-10-15

Relatório de captação de leads para enviar ao cliente, filtro por canal no CRM e um pacote
de correções de permissão que fechava vazamentos de dado financeiro e clínico entre papéis.

### Adicionado
- **Filtro por canal no CRM de Leads**: botões Google / Instagram / Outros, combináveis com o período. Google = Google Ads + orgânico; Instagram = Instagram, Facebook e anúncios Meta; Outros = WhatsApp, indicação e sem origem (`src/lib/leadChannels.ts`). O cabeçalho mostra quantos leads o recorte tem e `GET /api/leads` aceita `channel`.
- **Relatório de leads em PDF** (`/leads/relatorio`, `GET /api/leads/relatorio`): total com variação contra o período anterior, média por dia, agendamentos, pacientes, leads por canal, série diária (mensal acima de 92 dias) empilhada por canal, origem detalhada, situação no funil e interesse. Períodos: hoje, 7/15/30 dias, este mês, mês passado e personalizado (até 366 dias). "Baixar PDF" imprime a folha em A4.
- **Motivo de perda obrigatório**: marcar lead como perdido (no detalhe ou arrastando no quadro) abre o `LostReasonDialog`; a API exige `lostReason` e o limpa quando o lead é reativado.
- **Alerta de SLA de leads** no WhatsApp da recepção (cron a cada 15 minutos).
- **Galeria visual de telas** (`npm run screens`) e semente de usuários de teste (`npm run seed:e2e`).

### Segurança
- `GET /api/configuracoes/contas`: quem não tem `payments:view` recebe só id, nome e banco — agência, conta, chave PIX e saldo saíam para quem entrava por `treatments:edit`.
- `GET /api/exames`: hipótese, CID-10, laudo e observações só com `patients:view_clinical`; o corte é na projeção do banco.
- `GET /api/pacientes`: a listagem não traz mais as transações de todos os pacientes da página para médico e recepção.
- `GET /api/tratamentos`: custo por procedimento e receita total só com `reports:balancete` — dava para remontar o DRE somando a resposta.
- `GET /api/dashboard`: blocos financeiro, leads, agenda e estoque recortados pelas permissões de cada papel.
- `GET /api/portal/token`: valida o formato do UUID e registra auditoria quando a credencial do portal é lida.
- Conexão Google (`/api/admin/google/connect` e `callback`): exige a mesma permissão de configuração do sistema; estar logado não bastava para sobrescrever o token da clínica.

### Corrigido
- **Lint voltou a rodar**: a config do ESLint era incompatível com o `eslint-config-next` 14 sob ESLint 9 e quebrava antes de checar qualquer arquivo. Os 148 erros que estavam escondidos foram corrigidos e o `next build` volta a barrar erro de lint.
- **Glossário público**: a listagem trafega só o resumo de cada verbete, não o artigo inteiro.
- **Acessibilidade**: campos do `/site/agendar` com label associado e nome acessível no botão de perfil do menu lateral.

### Testes
- 579 testes de unidade e integração passando (eram 443 na 1.5.0) e 177 cenários E2E (desktop e Pixel 7).
- Novos: 9 suítes `rbac-*` de permissão por papel, `financeiro`, `prontuario`, `lead-motivo-perda`, `leads-relatorio` e `unit/leadReport`.

## [1.5.0] - 2026-08-28

Auditoria ponta a ponta da jornada do paciente (lead → agendamento → paciente → tratamento),
com 20 falhas corrigidas e 110 testes novos cobrindo cada etapa e a costura entre elas.

### Adicionado
- **Filtro de período no CRM de Leads**: chips Hoje / 7 / 15 / 30 dias / Personalizado / Tudo, com recorte padrão de 30 dias calculado no fuso da clínica (`src/lib/leadPeriod.ts`). O teto de cards subiu para 300 e a resposta passou a devolver `meta.truncated`, tornando visível o corte que antes era silencioso.
- **Conversão atômica de lead**: novo `POST /api/leads/[id]/converter` executa ficha + agendamento + vínculo em uma requisição, substituindo as três chamadas orquestradas pelo navegador. Idempotente na ficha (reusa `lead.patientId` e busca por telefone normalizado).
- **Validação de conflito de horário**: `src/app/api/agenda/conflitos.ts` compartilhado entre `POST /api/agenda`, `PATCH /api/agenda/[id]` e a conversão de lead. Sobreposição estrita (encostar não conflita), ignora cancelados e o próprio registro na edição. Devolve 409 com o horário ocupado.
- **Registro de resultado de exame**: diálogo na aba Exames da ficha do paciente consumindo o `PATCH /api/exames/[id]`, que existia sem nenhum chamador — quatro dos cinco status do enum eram inalcançáveis.
- **Persistência da atribuição completa**: coluna `leads.tracking_data` (jsonb, com allowlist e truncagem) guardando os 17 parâmetros de tracking que eram descartados após derivar a origem.
- **11 índices** nas tabelas quentes: agenda por médico e por paciente, prontuário, exames, tratamentos, transações e funil de leads.

### Corrigido
- **Consulta paga cobrada em dobro**: `POST /api/financeiro` passou a reconhecer a `consultation_fee` já lançada no agendamento (escopo `treatment_id IS NULL`) e atualizar em vez de criar a segunda. A tela de finalizar consulta não marca mais a cobrança quando ela já existe.
- **Conversão lead→paciente sem rollback**: três requisições sem atomicidade deixavam ficha órfã ou lead "Agendado" sem consulta; o retry criava um segundo prontuário. Resolvido pelo endpoint único, com ordem defensiva (ficha e consulta antes do vínculo) e reuso idempotente — o driver `neon-http` não suporta transação interativa.
- **Deduplicação de paciente**: `POST /api/pacientes` devolve 409 com a ficha existente quando o telefone (só dígitos) já está cadastrado.
- **Médico sem `agenda:edit`**: o preset bloqueava "Finalizar Consulta" com 403, perdendo evolução do prontuário e tratamento. `agenda:create` e `agenda:delete` seguem fora do preset.
- **Conclusão de tratamento travada**: a exigência cumulativa de `treatments:edit` + `financial:create` criava um beco sem saída entre médico e financeiro. Trava extra removida.
- **Conclusão de tratamento não-atômica**: o status virava `completed` antes do estoque e das parcelas; uma falha no meio deixava o tratamento concluído sem recebíveis e o retry batia no 409. Agora o trecho pós-reivindicação é compensado — em erro, o status volta ao anterior.
- **`POST /api/tratamentos` com uuid vazio**: `paymentMethodId`/`templateId` vindos como `''` da tela geravam 400 sem explicação. Coerção para `null`, mantendo 400 para uuid preenchido inválido.
- **Tratamento sem itens quebrava em 500**: `db.insert(treatmentItems).values([])` lançava no Drizzle. O insert só ocorre havendo itens.
- **Modelo de tratamento pela agenda**: copiava só nome e preço, criando um item de procedimento com `unitCost: 0` — sem baixa de estoque e com margem bruta falsa no DRE. Agora copia os itens, relendo o custo do estoque.
- **Baixa de estoque fracionada**: `Math.round()` zerava quantidades como 0,4 sobre coluna `numeric(8,3)`. A fração é preservada em toda a camada de aplicação; `darBaixaEstoque` passou a retornar `{ saldo, baixado, faltou }` e saldo insuficiente vira aviso na resposta e notificação, em vez de sucesso silencioso.
- **`dueDate` em UTC**: consultas após as 21h BRT venciam no dia seguinte. `toDateBR()` nos dois caminhos (agendamento e reconciliação).
- **`paymentMethodId` não propagado**: gravado em `appointments` e ausente em `transactions`, zerando qualquer relatório por meio de recebimento.
- **Funil parado em "Agendado"**: `PATCH /api/agenda/[id]` com `attended` agora promove o lead (por `leadId` ou pelo `patientId`), sem regredir quem já está adiante.
- **Consulta paga sem `patientId`**: gravava o preço e não gerava receita, em silêncio. Agora 400 antes de qualquer escrita.
- **Teste de cron preso a data fixa**: `cron-agenda-medicos` só passava em 06/08/2026; o relógio passou a ser congelado.

### Segurança
- **`GET /api/exames` sem `patientId`** devolvia hipótese diagnóstica e CID-10 dos 100 pedidos mais recentes de qualquer paciente, com `exams:view` presente no preset da recepção. `patientId` passou a ser obrigatório, como já era no prontuário.
- **Trilha de auditoria** em prontuário, exames e tratamentos — os únicos módulos sem `logActivity`, justamente os de dado mais sensível. O `details` não carrega conteúdo clínico.
- **Tags do lead sem validação** furavam `TAG_NAME_RE` e chegavam ao contexto do assistente de WhatsApp. Regex, tamanho e quantidade aplicados no POST e no PATCH.

### Testes
- 443 testes passando, 0 falhando (era 265 passando com 1 falha crônica).
- Novos: `jornada-1-captacao`, `jornada-2-agendamento`, `jornada-3-tratamento`, `jornada-completa`, `lead-conversao`, `leads-periodo`, `unit/leadPeriod`.
- `jornada-completa` encadeia as sete etapas passando o id de uma para a próxima — o formato que pega o elo quebrado que nenhum teste por rota detecta.

### Migração
```bash
npx tsx src/lib/db/migrate-v150.ts
```
Idempotente (`ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`). **Precisa rodar antes do deploy do código**: as rotas públicas de lead passam a gravar em `leads.tracking_data`.

## [1.4.0] - 2026-08-06

### Adicionado
- **Tags do Sistema em Configurações**: Gerenciamento centralizado de tags (nome + cor) em Configurações → Tags, eliminando duplicações por grafia no funil do CRM. Renomear uma tag reflete automaticamente em todos os leads associados.
- **Filtros Avançados no CRM de Leads**: Filtragem no servidor por tags (múltiplas seleções), origem do lead, responsável e período de entrada.
- **Atribuição de Responsável**: Seletor de responsável pelo atendimento direto no painel do lead com filtro dedicado "Sem responsável".
- **Resumo Diário da Agenda no WhatsApp do Médico**: Envio automático da agenda individual às 8h no WhatsApp do médico configurável no perfil (com botão de envio de teste).

### Alterado
- **Aviso Sonoro de Lead Novo**: Toque sonoro próprio mais longo com controle liga/desliga no sino de notificações e atualização a cada 20 segundos.
- **Horário do Relatório Geral**: Relatório automático enviado ao grupo do WhatsApp reprogramado para as 8h (BRT).

### Segurança
- **Auditoria Geral de Segurança**: Correção na exposição de dados clínicos e telefones em endpoints da agenda, limite de tentativas no WhatsApp, guarda do último admin, política de senhas (mín. 8 caracteres), rate limits, e sanitização contra injeção de HTML e IA.

---

## [1.3.0] - 2026-08-06

### Adicionado
- **Resumo Diário da Agenda no WhatsApp**: Notificação individual para médicos com a pauta de atendimentos do dia.

### Alterado
- **Alerta Sonoro de Leads**: Som dedicado para notificações de novos leads.

---

## [1.2.2] - 2026-08-05

### Alterado
- **Quadro Kanban Responsivo**: Redimensionamento adaptativo das colunas do CRM de leads e fluxo otimizado até o estágio "Compareceu".

---

## [1.2.1] - 2026-08-04

### Corrigido
- **Acesso da Recepção**: Permissão para leitura de formas de pagamento no agendamento de consultas pagas.

---

## [1.2.0] - 2026-07-30

### Corrigido
- **Correções de Segurança e Dados**: Exclusão segura de paciente sem apagar prontuário, código único no portal do paciente, faturamento real no dashboard e correções no controle de estoque/parcelamento.

---

## [1.1.0] - 2026-07-30

### Adicionado
- **Central de Avisos e Google Ads**: Notificações no topo do sistema e painel de campanhas do Google Ads.
