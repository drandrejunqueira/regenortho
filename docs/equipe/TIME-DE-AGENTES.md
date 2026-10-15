# Time de Agentes — RegenOrtho

> Quem faz o quê, com qual ferramenta, e como acionar.

## Divisão de ferramentas

| Ferramenta | Papel | Por quê |
|---|---|---|
| **Claude Code** | Orquestração, domínio, testes, segurança | Rodam como subagentes em paralelo, com acesso ao repo inteiro |
| **Codex CLI** (`gpt-6-astra`, xhigh) | UI, design system, QA visual | Headless via `scripts/codex-ui.sh`; entrega TSX e tokens prontos |
| **Antigravity IDE** | Implementação e revisão de código | Usa o kit local `.agent/` (personas + regras) dentro do IDE |

Nenhuma das três faz merge sozinha. O Claude verifica o que as outras entregam.

---

## 1. Facilitadores (Claude) — 8

| Agente | Território | Aciona quando |
|---|---|---|
| `regen-orquestrador` | tudo | tarefa cruza módulos, "avalie o sistema", "rode os testes", dúvida de roteamento |
| `regen-jornada-paciente` | lead → paciente → agenda → tratamento → financeiro | registro some/duplica entre etapas |
| `regen-crm` | `/leads`, `/api/leads/**`, captação | kanban, filtros, tags, período, conversão |
| `regen-clinico` | pacientes, prontuário, tratamentos, exames, portal | qualquer coisa que toque PHI |
| `regen-financeiro` | transações, parcelas, DRE, formas de pagamento | cálculo de dinheiro, relatório |
| `regen-integracoes` | WhatsApp, Google Calendar, cron, webhook, GTM | integração externa |
| `regen-dados` | schema, migration, query, índice | mudança de banco |
| `regen-seo-site` | site público, LP, glossário, SEO/GEO | conteúdo e conversão do site |

## 2. Testadores (Claude) — 7

| Agente | Cobre | Entrega |
|---|---|---|
| `regen-qa-e2e` | Playwright, desktop + mobile | spec + saída real da execução |
| `regen-qa-integracao` | Vitest sobre `/api/**` | 5 casos por endpoint (feliz, 400, 403, 404, efeito colateral) |
| `regen-qa-permissoes` | 4 papéis × ~40 permissões × ~70 rotas | `MATRIZ-RBAC.md` + teste por furo |
| `regen-qa-seguranca` | OWASP, segredos, rate limit, PHI/LGPD | `AUDITORIA-SEGURANCA.md` |
| `regen-qa-dados` | cascata, atomicidade, timezone, dinheiro, idempotência | tabela de invariantes |
| `regen-qa-performance` | CWV, bundle, N+1, base64 | orçamento por rota |
| `regen-qa-acessibilidade` | WCAG 2.2 AA | achado com critério citado |

## 3. UI via Codex — 4 prompts + 2 pontes

Prompts em `.codex/agents/`, disparados por `scripts/codex-ui.sh`:

```bash
npm run ui:designer      "<tarefa>" [arquivos...]   # direção visual, tokens, TSX
npm run ui:qa            "<tarefa>" [manifest]      # qualidade visual das capturas
npm run ui:responsivo    "<tarefa>" [manifest]      # breakpoints
npm run ui:design-system "<tarefa>"                 # tokens, duplicação, extração
```

Pontes no Claude: `regen-ui-designer` (prepara contexto e audita o retorno) e
`regen-ui-qa` (captura a galeria, dispara, vira cards no kanban).

Relatórios saem em `.codex/out/<agente>-<timestamp>.md`.

## 4. Código e revisão via Antigravity — 2 pontes

```bash
scripts/antigravity.sh new  RO-014 "Extrair componentes de /financeiro"
# preencher .agent/briefings/RO-014.md
scripts/antigravity.sh open RO-014
scripts/antigravity.sh list
```

Pontes no Claude: `regen-code-antigravity` (monta o briefing) e
`regen-review-antigravity` (monta o pacote de revisão e faz a passada
independente de verificação).

O Antigravity carrega automaticamente `.clauderules` + `.agent/rules/` +
a persona indicada no briefing.

---

## Galeria de telas

O material que os testadores de UI auditam:

```bash
npm run seed:e2e        # cria os 4 usuários de teste (uma vez)
set -a && source .env.e2e && set +a
npm run screens         # 36 rotas × 7 viewports
npm run screens:open    # abre a galeria no navegador
```

Viewports: 320 · 375 · 414 · 768 · 1024 · 1440 · 1920.
A galeria marca automaticamente overflow horizontal e erro de console por tela.

---

## Fluxo padrão de um ciclo

```
1. regen-orquestrador       decompõe e dispara os especialistas em paralelo
2. testadores               achados → cards RO-### no KANBAN.md
3. regen-code-antigravity   briefing → Antigravity implementa
4. regen-ui-designer        Codex desenha o que for de UI
5. regen-review-antigravity revisão dupla + npm run typecheck && test && lint
6. regen-qa-e2e             prova no navegador, desktop e mobile
```

## Onde o time não decide sozinho

- Commit, push, deploy e migration destrutiva: só com o Daniel pedindo.
- Rotação de credencial: o agente aponta, o Daniel executa.
- Descartar achado de segurança: nunca em silêncio.

---

# Time no canvas do Maestri

Além dos subagentes do Claude Code (que rodam dentro desta sessão), existe um
time **visual e persistente** no canvas do Maestri: cada integrante é um terminal
próprio, com role fixo, ligado aos colegas e aos navegadores internos.

## Os 8 recrutas

| Codinome | Ferramenta | Role | Território |
|---|---|---|---|
| **Bisturi** | Claude Code | RegenOrtho Jornada | jornada lead → paciente → agenda → tratamento → financeiro |
| **Cofre** | Claude Code | Security Reviewer | OWASP, segredos, PHI/LGPD |
| **Pendulo** | Claude Code | Performance Engineer | mede antes, número antes/depois |
| **Crivo** | Claude Code | QA Tester | Vitest + Playwright |
| **Atelie** | Codex | UI Designer | direção visual e design system |
| **Retina** | Codex | RegenOrtho UI Visual | QA visual e responsivo, dirige os portais |
| **Bigorna** | Antigravity | RegenOrtho Implementador | implementa a partir dos briefings |
| **Lupa** | Antigravity | Code Reviewer | revisa e reporta, nunca edita |

A divisão de ferramentas segue a sua: **Codex** desenha, **Antigravity** escreve e
revisa código, **Claude Code** coordena, domina o negócio e testa.

## Navegadores internos (portais)

| Portal | URL | Tamanho | Quem dirige |
|---|---|---|---|
| **Vitrine** | `localhost:3000/site` | 1440×900 | Retina, Atelie |
| **Painel** | `localhost:3000/login` | 1440×900 | Retina, Atelie, Crivo |
| **Captacao Mobile** | `localhost:3000/site/agendar` | 375×812 | Retina, Crivo |
| **Galeria** | `tests/visual/gallery/index.html` | 1440×900 | Retina |

Comandos que o time usa nos portais:

```bash
maestri portal snapshot "Vitrine"          # árvore acessível com refs @e1, @e2...
maestri portal resize   "Vitrine" 375 812  # auditoria responsiva
maestri portal click    "Painel" @e3
maestri portal fill     "Painel" @e2 "texto"
maestri portal logs     "Vitrine"          # console do navegador
maestri portal screenshot "Captacao Mobile"
```

`resize` é a peça central da auditoria responsiva: o mesmo portal percorre
320 → 375 → 414 → 768 → 1024 → 1440 → 1920 sem precisar recapturar a galeria.

## Como as ligações foram desenhadas

```
                    painel-regenortho  (nota compartilhada com todos)
                              │
  Bisturi ──── Bigorna ──── Lupa ──── Cofre
   (jornada)  (implementa) (revisa)  (segurança)
      │           │  │
    Crivo    Pendulo  Retina ──── Atelie
    (QA)      (perf)  (QA visual)  (design)
                        │
              Vitrine · Painel · Captacao Mobile · Galeria
```

O caminho normal de uma tarefa: **Bisturi** define o efeito na jornada →
**Bigorna** implementa → **Lupa** revisa → **Crivo** prova com teste →
**Retina** confere nas telas. **Cofre** e **Pendulo** entram quando a mudança
toca segurança ou velocidade. **Atelie** entra quando é desenho novo.

## Nota compartilhada

`painel-regenortho` é o quadro que todos leem: quem é quem, os portais, os
bloqueadores abertos, e as regras da casa. Atualize-a quando o kanban mudar:

```bash
maestri note read  "painel-regenortho"
maestri note edit  "painel-regenortho" "texto antigo" "texto novo"
```

## Delegar

```bash
maestri ask "Retina" "audite /leads nos 7 viewports pelo portal Painel"
maestri check "Retina"

# vários ao mesmo tempo, em paralelo:
maestri ask --batch '{"Cofre":"audite o rate limit do login","Pendulo":"meça o First Load JS por rota"}'
```
