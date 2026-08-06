# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

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
