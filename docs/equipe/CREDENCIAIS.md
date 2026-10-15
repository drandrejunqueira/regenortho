# Notas de Credenciais — RegenOrtho

> **Este arquivo nunca contém senha, token ou connection string.**
> Ele descreve onde cada credencial mora, quem precisa dela e como rotacionar.
> Valores reais ficam em `.env.local` e `.env.e2e` — ambos ignorados pelo git.

Última revisão: 2026-09-06

---

## 1. Inventário de segredos

| Segredo | Onde mora | Usado por | Rotação |
|---|---|---|---|
| `DATABASE_URL` | `.env.local`, Vercel env | Drizzle/Neon, todas as rotas | Painel do Neon → reset da senha do role |
| `NEXTAUTH_SECRET` | `.env.local`, Vercel env | assinatura do JWT de sessão | `openssl rand -base64 32` — **derruba todas as sessões** |
| `NEXTAUTH_URL` | `.env.local`, Vercel env | callback do NextAuth | muda com o domínio |
| Token do Google Calendar | tabela `users` (refresh token) | `/api/perfil/google-agenda/**` | revogar em myaccount.google.com → reconectar no app |
| Chave da Evolution API (WhatsApp) | env / `/configuracoes/integracoes` | `src/lib/evolution.ts` | painel da Evolution |
| Segredo do cron | env | `/api/cron/**` | trocar env + redeploy |
| Chave de IA (glossário) | env | `src/lib/ai.ts` | painel do provedor |
| `E2E_*` | `.env.e2e` (gerado) | Playwright | `npm run seed:e2e` gera tudo de novo |

> `.env.example` hoje lista só `DATABASE_URL`, `NEXTAUTH_SECRET` e `NEXTAUTH_URL`.
> Está **desatualizado** em relação ao que o código lê — ver card `RO-004`.

---

## 2. Contas de aplicação (papéis)

Quatro papéis, definidos em `src/lib/permissions.ts`:

| Papel | Rótulo | Enxerga | Não enxerga |
|---|---|---|---|
| `admin` | Administrador | tudo | — |
| `doctor` | Médico | agenda, pacientes, prontuário, tratamentos, exames, portal | financeiro, DRE, usuários |
| `receptionist` | Recepcionista | leads, agenda, pacientes, materiais, relatórios | financeiro, prontuário clínico |
| `financial` | Financeiro | financeiro, pagamentos, DRE, tráfego, relatórios | prontuário clínico, edição de agenda |

**Regra que pega todo mundo:** `customPermissions` **substitui inteiramente** o
preset do papel. Usuário com lista personalizada não herda nada do papel — ver
`getEffectivePermissions()`. Todo teste de permissão precisa cobrir esse ramo.

**Revogação:** a sessão JWT é reconferida contra o banco a cada 5 minutos
(`REVALIDATE_SESSION_MS`). Desativar (`isActive = false`) ou rebaixar um usuário
derruba a sessão dele em até 5 min — não é instantâneo.

---

## 3. ⚠️ Senhas de seed são públicas

`src/lib/db/seed.ts` tem quatro senhas **literais no código versionado**, para as
contas `admin@`, `medico@`, `recepcao@` e `financeiro@regemorto.com.br`.

Qualquer pessoa com acesso ao repositório consegue lê-las. Se o banco de produção
ainda tiver essas contas com a senha do seed, é **acesso administrativo aberto**.

**Correção (já existe script pronto):**

```bash
npx tsx scripts/reset-passwords.ts
```

Gera senha aleatória de 16 caracteres para as quatro contas e imprime **uma vez**.
Entregue cada uma ao seu dono e confirme a troca. Card: `RO-001`.

---

## 4. Usuários de teste (E2E)

Contas dedicadas, em domínio `.test`, uma por papel — nunca as de produção:

```bash
npm run seed:e2e                       # cria/atualiza e grava .env.e2e
set -a && source .env.e2e && set +a    # carrega
npm run test:e2e
npm run screens                        # galeria com as telas autenticadas
```

O script **recusa** rodar sem `E2E_DATABASE_URL` apontando para um banco de
teste. Para forçar num banco descartável: `ALLOW_PROD_SEED=1`.

**Por que isso importa:** sem `E2E_USER_EMAIL`/`E2E_USER_PASSWORD`, as specs de
dashboard começam com `test.skip(...)` e a suíte **passa verde sem testar nada**.
Falso verde é pior que teste vermelho. Card: `RO-002`.

---

## 5. Higiene

- [ ] `.env*` e `.claude/` estão no `.gitignore` — confirmado.
- [ ] **`.claude/settings.local.json` contém uma connection string do Neon com
      senha, em texto plano, dentro de uma regra de permissão.** Não está no git,
      mas está no disco e vaza em qualquer print de tela ou backup da pasta.
      Remover a entrada e rotacionar a senha do Neon. Card: `RO-003`.
- [ ] Nunca colar segredo em issue, chat, log ou resposta de API.
- [ ] Segredo exposto = rotacionar primeiro, investigar depois.
- [ ] Rodar `npm run seed:e2e` de novo invalida as credenciais anteriores.

---

## 6. Onde NÃO guardar credencial

`docs/**` · `README.md` · `CHANGELOG.md` · comentário de código · mensagem de
commit · `tests/**` (use env) · `.claude/settings*.json` · print de tela.
