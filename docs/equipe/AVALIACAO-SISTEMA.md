# Avaliação do Sistema — RegenOrtho

Data: 2026-09-06 · Versão avaliada: 1.5.0 · Branch: `master`

> Só entra aqui o que foi **verificado no código ou medido em execução**.
> Suposição não vira achado.

---

## 1. O que o sistema é

CRM + prontuário + agenda + financeiro + site público de captação, para uma
clínica de ortopedia regenerativa.

| Dimensão | Número |
|---|---|
| Páginas do dashboard | 24 |
| Páginas do site público | 11 |
| Route handlers de API | 74 |
| Componentes de UI base | 28 |
| Papéis de acesso | 4 |
| Permissões granulares | ~40 |
| Testes (antes desta sessão) | 458 |
| Testes (depois) | 538 — 509 verdes, 29 vermelhos por desenho |

Stack: Next.js 14 App Router · React 18 (React Compiler ligado) · Drizzle +
Neon Postgres · NextAuth v5 · Tailwind v4 · shadcn/ui sobre `@base-ui/react`.

**Veredito geral:** a arquitetura é sólida e as decisões difíceis foram tomadas
com critério. Os problemas são de *cobertura* — lugares onde a regra existe mas
não foi aplicada em toda parte — não de fundação.

---

## 2. O que está bem-feito (e não deve ser mexido)

Vale registrar, porque é o que sustenta o resto:

- **Modelo de permissão real, não decorativo.** 4 papéis × ~40 permissões, com
  `customPermissions` por usuário e permissões sensíveis marcadas. 46 das 74
  rotas passam por `checkPermission`/`hasPermission`/`requireSettingsEdit`.
- **A sessão é revalidada contra o banco a cada 5 min** (`REVALIDATE_SESSION_MS`).
  Desativar ou rebaixar usuário tem efeito de verdade — a maioria dos sistemas
  com JWT erra exatamente aqui.
- **A allowlist de rotas públicas do `middleware.ts` é explícita e comentada**,
  cada exceção justificada no código.
- **Cron e webhook do WhatsApp são bem guardados**: `secretEquals()` (comparação
  resistente a timing) + `rateLimit()`. Rota sem sessão com guarda própria — certo.
- **Escalonamento de privilégio resiste.** 19 testes novos de escalonamento
  passaram de primeira: recepção não lê prontuário, financeiro não edita clínico,
  médico não vê DRE.
- **Falha de integração degrada, não derruba.** WhatsApp ou Google fora do ar não
  impedem lead nem agendamento.
- **A jornada do paciente tem teste ponta a ponta** (`jornada-1/2/3` + completa).
- **`googleapis` está em `serverComponentsExternalPackages`** — não vaza para o
  bundle do cliente.

---

## 3. Achados verificados

### 3.1 🔴 Vazamento de dados entre papéis no dashboard
`src/app/api/dashboard/route.ts:12`

A rota checa `dashboard:view` e **devolve tudo para qualquer papel**. Não há
filtragem por bloco.

| Papel | Recebe indevidamente |
|---|---|
| Médico | receita, despesa, resultado — sem `financial:view` |
| Recepcionista | receita, despesa, resultado — sem `financial:view` |
| Financeiro | leads recentes — sem `leads:view` |
| Financeiro | **nome e telefone dos pacientes do dia** — sem `agenda:view` |

A última linha é dado de saúde vazando entre papéis (LGPD).
Especificação já escrita: `tests/integration/rbac-dashboard-escopo.test.ts` (6 testes).

### 3.2 🔴 Senhas de seed públicas no repositório
`src/lib/db/seed.ts:15-18`

Quatro senhas literais versionadas para contas administrativas de e-mail
conhecido. Correção pronta: `npx tsx scripts/reset-passwords.ts`.

### 3.3 🔴 Connection string do Neon em texto plano no disco
`.claude/settings.local.json`

Com senha, dentro de uma regra de permissão. Fora do git, mas presente no disco.
Remover **não basta** — a senha já circulou, precisa rotacionar no painel do Neon.

### 3.4 🟠 Mais seis furos de projeção de dados por permissão

Cada um com teste escrito que falha hoje:

| Área | Testes | O que vaza |
|---|---|---|
| `/api/admin/google/**` | 7 | qualquer logado conecta/desconecta o Google da clínica |
| `/api/portal/**` | 5 | escopo do token do paciente |
| `/api/tratamentos/**` | 4 | custo interno para quem só tem `treatments:view` |
| `/api/pacientes/**` | 3 | dado financeiro sem `financial:view` |
| `/api/configuracoes/contas` | 2 | conta bancária e PIX para quem só tem `treatments:edit` |
| `/api/exames/**` | 2 | dado clínico |

**Padrão comum:** as rotas guardam o *acesso* (403 corretamente) mas não
**projetam as colunas** da resposta. Quem pode entrar, leva a linha inteira.
É um erro de classe, não seis erros isolados — e o conserto é o mesmo em todos.

### 3.5 🟠 Query de 2,6 MB na página do glossário
`src/app/(site)/site/glossario/page.tsx:~24` · **medido em execução**

```
Failed to set Next.js data cache, items over 2MB can not be cached (2622809 bytes)
```

Acima do teto de cache do Next: não cacheia e **reexecuta a query inteira a cada
request**, numa página pública indexável. Causa provável: `SELECT` trazendo a
coluna base64 sem precisar. Imagens em base64 são decisão deliberada do projeto e
estão certas — o defeito é o select sem colunas explícitas.

### 3.6 🟠 Faltam CSP, HSTS e Permissions-Policy
`next.config.mjs:6-17`

Só três headers. Sem CSP num sistema que renderiza HTML de evolução clínica e
conteúdo de site editável — é a defesa que sobra quando a sanitização falha.

### 3.7 🟠 Testes que passavam sem testar
`tests/e2e/*.spec.ts`

Quase toda spec de dashboard abre com `test.skip(!hasE2ECredentials)`. Sem
usuário de teste, **a suíte E2E passava verde sem executar nada**. Resolvido
nesta sessão com `scripts/seed-e2e-users.ts`; falta rodar.

### 3.8 🟠 Arquivos grandes demais para serem revisáveis

| Arquivo | Linhas | Limite |
|---|---|---|
| `src/app/(dashboard)/agenda/page.tsx` | **2019** | 800 |
| `src/app/(dashboard)/materiais/page.tsx` | 1633 | 800 |
| `src/app/(dashboard)/tratamentos/page.tsx` | 1584 | 800 |
| `src/app/(dashboard)/pacientes/[id]/page.tsx` | 1213 | 800 |

`src/components/agenda/` e `src/components/financeiro/` estão **vazios** —
toda a UI dessas telas mora dentro do `page.tsx`.

### 3.9 🟡 Ambiente local não compilava — corrigido
`node_modules/@next/swc-darwin-arm64` tinha só README e `package.json`; o binário
de 109 MB não existia, e sobrava um binário Windows de 130 MB. `npm run dev`
morria com "Failed to load SWC binary for darwin/arm64". Os browsers do Playwright
também não estavam instalados — nenhum teste E2E rodava nesta máquina.

Sinal de que `node_modules` veio de outra plataforma. Vale um `npm ci` limpo.

---

## 4. Cobertura de teste

**Antes:** 19 suítes de integração, 14 unitárias, 7 specs E2E.
**Sem nenhuma cobertura:** financeiro, compras, materiais, templates de
tratamento, exames, DRE, prontuário, portal, salas, WhatsApp.

Financeiro e prontuário sem teste era o pior par possível — um mexe em dinheiro,
o outro em dado de saúde. Ambos ganharam suíte nesta sessão (21 e 11 testes,
todos verdes).

**Estado atual:** 538 testes. 509 verdes. 29 vermelhos **por desenho** — são
especificações executáveis dos furos da seção 3.4, escritas para falhar hoje e
passar depois do conserto.

---

## 5. O que foi construído nesta sessão

| Entrega | Onde |
|---|---|
| 21 agentes especialistas | `.claude/agents/` |
| Time visual de 8 recrutas + 4 navegadores | canvas do Maestri |
| Prompts de UI para o Codex | `.codex/agents/` + `scripts/codex-ui.sh` |
| Ponte de briefing para o Antigravity | `.agent/briefings/` + `scripts/antigravity.sh` |
| Galeria de telas: 70 capturas, 7 viewports | `tests/visual/` + `npm run screens` |
| Usuários de teste por papel | `scripts/seed-e2e-users.ts` |
| 80 testes novos | `tests/integration/` |
| Documentação do time | `docs/equipe/` |

---

## 6. Ordem recomendada

1. **RO-001 e RO-003** — rotação de credencial. Só você pode fazer, e nada
   depende disso para começar.
2. **Seção 3.4 inteira** — projeção de colunas por permissão. Um padrão, seis
   rotas, 29 testes já escritos como rede de segurança.
3. **RO-006** — CSP e HSTS.
4. **Seção 3.5** — a query de 2,6 MB. Ganho medido, esforço pequeno.
5. **RO-002** — rodar o seed de E2E e acabar com o falso verde.
6. **RO-014** — quebrar os arquivos gigantes, para o resto do trabalho ficar possível.
