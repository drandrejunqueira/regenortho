# Melhorias — RegenOrtho

> Não são defeitos (defeito está no `KANBAN.md`). São oportunidades, ordenadas
> por impacto na operação da clínica. Cada uma tem o agente que a conduziria.

---

## Nível 1 — Impacto direto em faturamento e tempo de equipe

### M-01 · Estados vazios que ensinam, não que constatam
`regen-ui-designer` (Codex)

Toda lista do sistema (leads, pacientes, agenda, financeiro, materiais,
tratamentos) precisa de um estado vazio que diga **o próximo passo**, não
"nenhum resultado". Recepção nova no sistema aprende pelo estado vazio.

Por tela: ícone com intenção, uma frase do que aquilo faz, e o botão da ação
principal. É a mudança de UX de menor custo e maior retorno num CRM.

### M-02 · Busca global (⌘K)
`regen-ui-designer` + `regen-crm`

`cmdk` já está instalado e `src/components/ui/command.tsx` existe — está pago e
sem uso. Uma paleta que busca paciente, lead, agendamento e navega para
configurações elimina cliques da recepção o dia inteiro.

Escopo por permissão: recepção não acha prontuário na busca.

### M-03 · Kanban de leads utilizável no celular
`regen-crm` + `regen-ui-responsivo`

`@dnd-kit` funciona por ponteiro. No celular, arrastar card entre colunas em tela
de 375px é frustrante — e o médico/recepção usa celular. Alternativa: menu
"mover para" no card, que também resolve a acessibilidade por teclado
(hoje o kanban não tem alternativa sem mouse — ver checklist do
`regen-qa-acessibilidade`).

### M-04 · Paginação em todas as listas
`regen-dados` + `regen-qa-performance`

Só `/pacientes` tem teste de paginação. `/leads`, `/financeiro`, `/materiais` e
`/tratamentos` crescem para sempre; em 2 anos a recepção espera 8 segundos por uma
tela. Paginação por cursor + índice para cada filtro de lista.

### M-05 · Onde o paciente está, em uma tela
`regen-jornada-paciente`

Hoje a jornada mora em 5 telas: lead → paciente → agenda → tratamento →
financeiro. Uma linha do tempo única na ficha do paciente ("veio do Instagram em
12/03, agendou 15/03, 1ª sessão 20/03, 2 parcelas pagas de 4") responde de
imediato a pergunta que a recepção mais faz no telefone.

---

## Nível 2 — Confiabilidade

### M-06 · Fila para integração externa
`regen-integracoes`

WhatsApp e Google Calendar são chamados em linha no fluxo de request. A regra
atual (falha degrada, não derruba) está certa, mas a mensagem **se perde**.
Uma fila com retry (Vercel Queues, ou tabela `outbox` + cron) garante que o aviso
de agendamento chega mesmo se a Evolution estiver fora no momento do clique.

### M-07 · Idempotência explícita nos crons
`regen-qa-dados`

`/api/cron/whatsapp-report` já deduplica via `wa_report_last_sent`. Falta o mesmo
rigor em `/api/cron/agenda-medicos` (roda de hora em hora). Reprocessamento do
Vercel Cron não pode gerar aviso duplicado para o médico.

### M-08 · Monitoramento de erro em produção
`regen-integracoes`

Não há Sentry nem equivalente. Hoje um 500 em produção só aparece se alguém
reclamar. Erro em `/api/leads` é lead perdido, e ninguém fica sabendo.

### M-09 · Backup verificado, não só configurado
`regen-dados`

Existe `/configuracoes/backup`. Backup que nunca foi restaurado não é backup.
Rotina trimestral: restaurar num branch do Neon e rodar a suíte de integração
contra ele.

---

## Nível 3 — Base do produto

### M-10 · Extrair componentes de agenda e financeiro
`regen-code-antigravity` — ver card `RO-014`

`agenda/page.tsx` tem 2019 linhas e `src/components/agenda/` está vazio. Enquanto
isso, nenhuma dessas telas é testável em unidade nem trabalhável em paralelo.

### M-11 · Tokens de design de verdade
`regen-ui-design-system` (Codex)

`ROLE_META` carrega cor em hex literal no TypeScript (`#ffb4ab`, `#61d8dd`,
`#e6c364`, `#a8d5a2`). Cor de domínio deveria ser custom property, com par
claro/escuro e contraste verificado — dois desses tons não passam em 4.5:1 sobre
fundo claro.

### M-12 · Cobertura de teste com portão no CI
`regen-qa-integracao`

A meta de 80% existe na regra, mas nada a força. Sem `--coverage` bloqueando o
merge, a cobertura só cai. Ver `RO-007` para as áreas descobertas.

### M-13 · Índices para os filtros que existem
`regen-dados`

`leads` filtra por status, origem, dono e período; `appointments` por data e
médico; `financial_transactions` por data e tipo. Confirmar índice para cada
combinação realmente usada — hoje funciona porque a base é pequena.

---

## Nível 4 — Crescimento

### M-14 · GEO/AEO no glossário
`regen-seo-site`

O glossário já é gerado por IA e tem página por termo. Falta a camada que faz
ChatGPT, Perplexity e AI Overviews **citarem** a clínica: resposta na primeira
frase, JSON-LD de `MedicalWebPage`/`FAQPage`, autoridade de entidade ligando
termo → tratamento → médico. É o caminho mais barato de aquisição orgânica aqui.

### M-15 · Atribuição íntegra até a conversão
`regen-integracoes`

`src/lib/tracking.ts` já centraliza a captura (LEI 10). Verificar ponta a ponta
que `utm_*`, `fbclid`, `gclid`, `_fbp`, `_fbc` e `_ga` chegam do anúncio até o
lead no banco — e aparecem em `/trafego`. Sem isso, a clínica otimiza campanha no
escuro.

### M-16 · Portal do paciente que reduz telefonema
`regen-clinico`

O portal existe com acesso por token/código. Cada coisa que o paciente resolve
sozinho (ver próxima sessão, confirmar presença, baixar pedido de exame,
ver parcelas) é uma ligação a menos na recepção.

### M-17 · Notificação que chega antes da reclamação
`regen-integracoes`

`src/lib/notifications.ts` existe. Regras que valem o esforço: lead sem contato
há 48h, paciente com parcela vencida, material abaixo do mínimo, agendamento
amanhã sem confirmação.

---

## Como priorizar

Quando estiver em dúvida entre dois itens, pergunte nesta ordem:

1. Isso faz a clínica **perder dinheiro hoje**? (lead perdido, parcela não cobrada)
2. Isso faz a equipe **perder tempo todo dia**? (cliques, espera, retrabalho)
3. Isso **quebra em silêncio**? (falso verde, erro sem monitoramento)
4. Isso trava o **trabalho futuro**? (arquivo de 2000 linhas, sem teste)

O que responde "sim" mais alto na lista vai primeiro.
