# Kanban — RegenOrtho

> Cards gerados na avaliação de 2026-09-06. ID `RO-###`.
> Severidade: 🔴 CRÍTICO (trava release) · 🟠 ALTO · 🟡 MÉDIO · ⚪ BAIXO
> Dono = agente do time (`docs/equipe/TIME-DE-AGENTES.md`).

---

## ✅ FEITO nesta sessão

| ID | Card | Dono |
|---|---|---|
| RO-009 | 🟠 Ambiente local não compilava — `node_modules/@next/swc-darwin-arm64` tinha só README + package.json (binário de 109 MB ausente) e sobrava um `.swc-win32-x64-msvc` de 130 MB. `npm run dev` morria com "Failed to load SWC binary for darwin/arm64". **Reinstalado + lixo do Windows removido.** | `regen-dados` |
| RO-010 | 🟡 Browsers do Playwright não instalados — nenhum teste E2E rodava nesta máquina. **`npx playwright install chromium` executado.** | `regen-qa-e2e` |
| RO-012 | 🟡 Sem harness de captura de telas. **Criado**: `tests/visual/` (36 rotas × 7 viewports), galeria HTML com filtro por área/viewport e detecção automática de overflow horizontal e erro de console. | `regen-ui-qa` |
| RO-013 | 🟠 Sem usuários de teste → E2E em falso verde. **Criado** `scripts/seed-e2e-users.ts` (4 papéis, senha aleatória, recusa rodar fora de banco de teste). Falta **executar**. | `regen-qa-e2e` |

---

## 🔴 A FAZER — Bloqueadores

### RO-001 · Senhas de seed são públicas no repositório
**Dono:** `regen-qa-seguranca` · **Onde:** `src/lib/db/seed.ts:15-18`

Quatro senhas literais versionadas (`Regem@2025`, `Medico@2025`, `Recepcao@2025`,
`Financeiro@2025`) para as contas `admin@`, `medico@`, `recepcao@` e
`financeiro@regemorto.com.br`. Qualquer um com acesso ao repo entra como admin,
se produção ainda tiver a senha do seed.

**Pronto quando:** `npx tsx scripts/reset-passwords.ts` rodado em produção, as 4
senhas entregues aos donos, e login com a senha antiga falhando.

---

### RO-003 · Connection string do Neon em texto plano no disco
**Dono:** `regen-qa-seguranca` · **Onde:** `.claude/settings.local.json`

Uma regra de permissão guarda um `export DATABASE_URL=postgresql://…` (valor **não** reproduzido aqui) completo,
**com a senha**. Não está no git (`.claude/` é ignorado), mas está no disco e vaza
em qualquer print de tela, backup de pasta ou compartilhamento da máquina.

**Pronto quando:** a entrada foi removida do arquivo **e** a senha do role do Neon
foi rotacionada no painel (remover sem rotacionar não resolve — a senha já circulou).

---

## 🟠 A FAZER — Alto

### RO-002 · Executar o seed de usuários de teste
**Dono:** `regen-qa-e2e` · **Depende de:** RO-013 (feito)

Sem `E2E_USER_EMAIL`/`E2E_USER_PASSWORD`, as specs de dashboard começam com
`test.skip(!hasE2ECredentials)` — **a suíte passa verde sem testar nada.**
Falso verde é pior que teste vermelho.

```bash
# criar um branch de teste no Neon, apontar E2E_DATABASE_URL para ele
npm run seed:e2e
set -a && source .env.e2e && set +a
npm run test:e2e     # agora deve realmente executar
npm run screens      # galeria completa, com as telas autenticadas
```

**Pronto quando:** `npm run test:e2e` reporta 0 skipped nas specs de dashboard.

---

### RO-006 · Faltam CSP, HSTS e Permissions-Policy
**Dono:** `regen-qa-seguranca` · **Onde:** `next.config.mjs:6-17`

Só três headers hoje: `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`. Sem **CSP** (a defesa que sobra quando a sanitização falha —
e o sistema renderiza HTML de evolução clínica e conteúdo de site editável),
sem **HSTS**, sem **Permissions-Policy** (câmera/microfone/geolocalização).

**Pronto quando:** CSP com nonce por requisição (sem `unsafe-inline` em script),
HSTS `max-age=31536000; includeSubDomains; preload`, Permissions-Policy
restritiva — e o site + dashboard funcionando sem erro de console.

---

### RO-007 · Buraco de cobertura em 10 áreas da API
**Dono:** `regen-qa-integracao` · **Onde:** `tests/integration/`

19 suítes cobrem a jornada do paciente, leads, tags, notificações, perfil e crons.
**Sem nenhum teste de integração:** `/api/financeiro/**`, `/api/compras/**`,
`/api/materiais/**` (lotes e movimentação), `/api/tratamentos/templates/**`,
`/api/exames/**`, `/api/relatorios/dre`, `/api/prontuario`, `/api/portal/**`,
`/api/rooms/**`, `/api/whatsapp/**`.

Financeiro e prontuário sem teste é o pior par possível: um mexe em dinheiro, o
outro em dado de saúde.

**Pronto quando:** cada rota tem os 5 casos do padrão (feliz, 400, 403, 404,
efeito colateral) e `npm run test:coverage` ≥ 80%.

---

### RO-014 · `/agenda/page.tsx` com 2019 linhas e `components/agenda/` vazio
**Dono:** `regen-code-antigravity` + `regen-ui-designer`

| Arquivo | Linhas | Componentes extraídos |
|---|---|---|
| `src/app/(dashboard)/agenda/page.tsx` | **2019** | `src/components/agenda/` está **vazio** |
| `src/app/(dashboard)/materiais/page.tsx` | 1633 | 3 componentes |
| `src/app/(dashboard)/tratamentos/page.tsx` | 1584 | — |
| `src/app/(dashboard)/pacientes/[id]/page.tsx` | 1213 | 1 componente |
| — | — | `src/components/financeiro/` também **vazio** |

Limite da casa é 800 linhas. Arquivo de 2000 linhas não é revisável, não é
testável em unidade e trava qualquer trabalho paralelo na tela.

**Pronto quando:** nenhum arquivo em `src/app/(dashboard)/` passa de 800 linhas;
`agenda/` e `financeiro/` têm componentes de verdade; `npm run typecheck && npm test` verde.

---

## 🟡 A FAZER — Médio

### RO-005 · `/api/admin/google/**` checa sessão, não permissão
**Dono:** `regen-qa-permissoes` · **Onde:** `src/app/api/admin/google/connect/route.ts:9-12`

A rota faz `auth()` e para por aí. **Qualquer usuário logado** — inclusive
recepcionista — consegue iniciar (e o callback concluir) a conexão Google da
clínica inteira. É rota sob `/api/admin/`; deveria exigir `settings:edit`.

**Pronto quando:** `requireSettingsEdit()` aplicado em `connect` e `callback`,
com teste de 403 para `receptionist`, `doctor` e `financial`.

---

### RO-004 · `.env.example` desatualizado
**Dono:** `regen-integracoes` · **Onde:** `.env.example`

Lista 3 variáveis. O código lê, além dessas: segredo do cron, credenciais da
Evolution/WhatsApp, OAuth do Google e chave de IA do glossário. Quem clona o repo
não consegue subir o sistema, e descobre cada variável faltando por erro em runtime.

**Pronto quando:** toda env lida pelo código aparece no exemplo, com comentário de
para que serve e se é obrigatória.

---

### RO-008 · Auditoria visual da galeria (Codex)
**Dono:** `regen-ui-qa` · **Depende de:** RO-002

Com a galeria completa capturada:

```bash
npm run ui:qa            "Auditar as telas do dashboard." tests/visual/gallery/manifest.json
npm run ui:responsivo    "Comparar as rotas nos 7 viewports." tests/visual/gallery/manifest.json
npm run ui:design-system "Auditar deriva de token e duplicação."
```

**Pronto quando:** os 3 relatórios estão em `.codex/out/`, deduplicados em cards
`RO-###` (mesmo problema em 8 rotas = 1 card), ordenados por alcance × severidade.

---

### RO-011 · O time de agentes não é versionado
**Dono:** `regen-orquestrador` · **Onde:** `.gitignore:53`

`.gitignore` ignora `.claude/` inteiro — os 19 agentes em `.claude/agents/` moram
só nesta máquina. Se o Daniel trocar de computador ou outra pessoa entrar, o time
some.

**Opção:** desbloquear só a pasta dos agentes, mantendo os segredos fora:

```gitignore
.claude/*
!.claude/agents/
```

`.claude/settings.local.json` (que hoje guarda a connection string do RO-003)
continua ignorado.

**Pronto quando:** decidido com o Daniel e aplicado.

---

## ⚪ Backlog

Ver `docs/equipe/MELHORIAS.md` — melhorias de produto e arquitetura que não são
defeito, priorizadas por impacto na clínica.


---

## 🔴 VERIFICADO NESTA RODADA — em execução pelo time

### RO-015 · Dashboard entrega tudo para todos
**Dono:** Bigorna (Antigravity) · **Onde:** `src/app/api/dashboard/route.ts:12`
**Status:** em correção

A rota checa `dashboard:view` e devolve a resposta inteira, sem filtrar por bloco.
Médico e recepção recebem receita/despesa sem `financial:view`. O financeiro
recebe leads sem `leads:view` e **nome + telefone dos pacientes do dia** sem
`agenda:view` — dado de saúde cruzando papel (LGPD).

**Especificação:** `tests/integration/rbac-dashboard-escopo.test.ts` — 6 testes
vermelhos que definem o comportamento certo.
**Pronto quando:** 6/6 verdes, typecheck limpo, 509 testes anteriores intactos.

---

### RO-016 · Rotas guardam o acesso mas não projetam as colunas
**Donos:** Cofre, Crivo, Bisturi · **Status:** em correção

Erro de **classe**, não seis erros isolados: as rotas retornam 403 corretamente
para quem não pode entrar, mas quem entra leva a **linha inteira do banco**,
incluindo campos que o papel dele não deveria ver.

| Área | Testes vermelhos | O que vaza | Dono |
|---|---|---|---|
| `/api/admin/google/**` | 7 | qualquer logado conecta/desconecta o Google da clínica | Cofre |
| `/api/portal/**` | 5 | escopo do token do paciente | Bisturi |
| `/api/tratamentos/**` | 4 | custo interno com só `treatments:view` | Crivo |
| `/api/pacientes/**` | 3 | dado financeiro sem `financial:view` | Crivo |
| `/api/configuracoes/contas` | 2 | conta bancária e PIX com só `treatments:edit` | Crivo |
| `/api/exames/**` | 2 | dado clínico | Bisturi |

**Pronto quando:** os 29 testes passam e o padrão de projeção por permissão está
aplicado igual em todas as seis áreas.

---

### RO-017 · Query de 2,6 MB no glossário público
**Dono:** Pendulo · **Onde:** `src/app/(site)/site/glossario/page.tsx` · **Medido**

```
Failed to set Next.js data cache, items over 2MB can not be cached (2622809 bytes)
```

Acima do teto de cache do Next → não cacheia e reexecuta a query a cada request,
numa página pública indexável. Causa provável: `SELECT` trazendo coluna base64.
Base64 no banco é decisão deliberada e está certa — o defeito é o select sem
colunas explícitas.

**Pronto quando:** a query cabe no cache, com o tamanho antes/depois medido, e o
mesmo padrão foi varrido nas demais rotas de listagem.

---

### RO-018 · Auditoria visual da captação
**Dono:** Retina · **Status:** em execução

`/site/agendar` é por onde entra dinheiro, e o público é majoritariamente idoso.
Auditoria nos 7 viewports pelos portais + as 70 capturas da galeria.

**Pronto quando:** `docs/equipe/AUDITORIA-VISUAL.md` com placar por severidade e
as 3 prioridades.

---

## ✅ Confirmado saudável (não mexer)

- Escalonamento de privilégio **resiste**: 19 testes novos passaram de primeira.
- Cron e webhook do WhatsApp: `secretEquals()` + `rateLimit()` — corretos.
- Sessão revalidada contra o banco a cada 5 min: revogação funciona de verdade.
- `googleapis` fora do bundle de cliente.
- Financeiro (21 testes) e prontuário (11 testes): suítes novas, todas verdes.

---

## Como trabalhar um card

```
1. regen-orquestrador     confirma prioridade e dono
2. regen-code-antigravity monta o briefing → scripts/antigravity.sh open RO-###
3. Antigravity IDE        implementa com a persona e as regras do briefing
4. regen-review-antigravity revisão dupla + typecheck && test && lint
5. testador do card       prova o critério de pronto
6. move para FEITO com o comando de verificação colado
```
