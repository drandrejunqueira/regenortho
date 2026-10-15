# Auditoria de Segurança — RegenOrtho

> Dono: `regen-qa-seguranca` · Versão auditada: `v1.5.0` (`master` @ `6b96d6e`)
> Escopo: OWASP Top 10, gestão de segredo, rate limit, injeção de prompt, XSS, PHI/LGPD.
> Severidade: **CRÍTICO** (trava release) · **ALTO** · **MÉDIO**.

> **Status de validação — 2026-09-06.** A versão anterior deste arquivo foi escrita
> por um agente interrompido antes de terminar e nunca foi conferida. Todos os
> achados foram reverificados um a um contra o código em `6b96d6e`. O que sobreviveu
> está abaixo, com arquivo:linha reconferido e cenário de falha concreto. Cinco
> achados foram **removidos** por não terem impacto reproduzível, e duas afirmações
> da versão anterior estavam **erradas em direção perigosa** — ambas registradas em
> [§ Removido na validação](#removido-na-validação), para que ninguém as recoloque.
>
> **Regra deste documento:** descrevemos a *classe* do problema e o caminho de
> correção. Nenhum valor de segredo é reproduzido aqui, e nenhum achado vem
> acompanhado de roteiro de exploração.

---

## Resumo executivo

| Severidade | Qtd | Bloqueia release? |
|---|---|---|
| 🔴 CRÍTICO | 3 | **Sim** |
| 🟠 ALTO | 5 | Sim, para dado de paciente |
| 🟡 MÉDIO | 13 | Não, mas entra no próximo ciclo |
| ✅ Corrigido nesta passagem | 1 | — |
| ❌ Removido na validação | 5 | — |

**O que trava o go-live:** as quatro contas administrativas têm e-mail conhecido
(estão no repositório), senha candidata conhecida (`src/lib/db/seed.ts:15-18`) e o
endpoint de login não tem nenhum freio de tentativa. Os três achados isolados são
graves; juntos são uma porta aberta.

**Correção da versão anterior — leia antes de priorizar:** a connection string do
Neon **está no histórico do git**, no commit `de17c33`, que é ancestral de `master`.
A auditoria anterior afirmava o contrário ("histórico limpo") e isso rebaixaria a
urgência da rotação. Rotacionar a senha do role no Neon é obrigatório, não opcional.

---

## 🔴 CRÍTICO

### SEC-01 · Login sem qualquer freio de força bruta
**Onde:** `src/lib/auth/config.ts:26-54` (`authorize`) · `src/app/api/auth/[...nextauth]/route.ts:1-3`
**Classe:** ausência de controle anti-automação em endpoint de autenticação (OWASP A07).

**Evidência verificada:** `authorize()` valida o schema, busca o usuário, compara o
bcrypt e devolve. Não há chamada a `rateLimit()`. A lista completa de arquivos que
importam `@/lib/rate-limit` é: `cron/agenda-medicos`, `cron/whatsapp-report`,
`perfil/agenda-hoje`, `portal/me`, `public/leads`, `site/agendar`. **`/api/auth/**`
não está nela.** Também não existe lockout: a tabela `users`
(`src/lib/db/schema.ts:165-188`) não tem coluna de tentativas falhas nem de bloqueio.

**Medição reproduzível (feita nesta validação, offline, sem tocar em rede):**
`bcrypt.compare` com cost 12 — o cost usado em `seed.ts` e em `reset-passwords.ts` —
custa **~203 ms** nesta máquina. É o único custo imposto ao atacante: ~5 tentativas/s
por instância serializada, teto que desaparece com paralelismo, já que a Vercel
escala instâncias sob carga.

**Cenário de falha:** os quatro e-mails administrativos são públicos (`admin@`,
`medico@`, `recepcao@`, `financeiro@regemorto.com.br` — aparecem em `seed.ts` e em
`scripts/reset-passwords.ts:15-20`). Com usuário conhecido e tentativa ilimitada,
qualquer lista de senhas comuns roda até o fim, de quantos IPs o atacante quiser. O
prêmio é uma conta `admin`, que enxerga prontuário, financeiro e configuração da
clínica inteira. Secundário: cada tentativa custa uma query + ~203 ms de tempo de
função — é também um vetor de custo.

**Correção:**
1. `rateLimit()` dentro de `authorize()`, com **duas chaves**: por IP e por e-mail
   (a chave por e-mail é a que protege a conta quando o atacante distribui IPs).
2. Lockout progressivo por conta — colunas `failedLoginAttempts` e `lockedUntil` em
   `users`, com backoff exponencial e reset no login bem-sucedido.
3. O balde precisa ser compartilhado entre instâncias (ver `SEC-19`), senão o limite
   por conta não vale nada em serverless.
4. Registrar falha de login em `activityLogs` — hoje só o `lastLoginAt` do sucesso é
   gravado, então uma campanha de força bruta é invisível para o admin.

**Pronto quando:** teste de integração provando 429 antes da N-ésima tentativa para
o mesmo e-mail vindo de IPs diferentes, e conta bloqueada após o limite.

---

### SEC-02 · Senhas de seed literais no repositório
**Onde:** `src/lib/db/seed.ts:15-18` · **Card:** `RO-001`
**Classe:** credencial versionada / senha padrão em produção (OWASP A07).

**Evidência verificada:** quatro senhas em texto no código versionado, uma para cada
papel, para contas de e-mail conhecido (`seed.ts:15-18`, `bcrypt.hash(<literal>, 12)`).
**Ainda presentes no `master`**, e não há no repositório nenhuma evidência (log,
marcador, migration) de que `scripts/reset-passwords.ts` tenha sido executado contra
o banco de produção.

O script de correção foi lido e está **correto**: `crypto.randomBytes`, alfabeto sem
caractere ambíguo, 16 caracteres, bcrypt cost 12, impressão única
(`scripts/reset-passwords.ts:22-65`).

**Cenário de falha:** combinado com `SEC-01`, um atacante que leia o repositório (ou
qualquer cópia dele) tenta quatro pares e-mail/senha conhecidos, sem limite de
tentativa. Se o seed nunca foi rotacionado em produção, o primeiro par já entra.

**Correção:** executar `npx tsx scripts/reset-passwords.ts` apontando para produção,
entregar as credenciais aos quatro donos por canal fora de banda, e confirmar que o
login com a senha antiga falha. Depois, trocar as literais do `seed.ts` por leitura
de env (`SEED_ADMIN_PASSWORD` etc.) com recusa de rodar sem elas — assim o problema
não volta no próximo seed.

**Nota:** rotacionar não apaga o histórico. As senhas já circularam; considere-as
queimadas para sempre e nunca reutilizadas em outro ambiente.

---

### SEC-03 · Connection string do Neon em disco **e no histórico do git**
**Onde:** `.claude/settings.local.json` (regra de permissão `Bash(export DATABASE_URL=…)`) · commit `de17c33`
**Card:** `RO-003`
**Classe:** segredo de longa duração em texto claro fora do cofre.

**Evidência verificada** (valor **não** reproduzido; verificação feita por contagem e
por comparação de hash, sem imprimir a credencial):
- O arquivo em disco contém **1** connection string PostgreSQL completa, com a senha
  do role `neondb_owner`. ✔
- O arquivo está coberto pelo `.gitignore:53` (`.claude/`). ✔
- **O histórico do git NÃO está limpo.** `.claude/settings.local.json` aparece em
  quatro commits (`284e5c0`, `c829d26`, `de17c33`, `9230d75`). A versão em
  **`de17c33` contém a connection string**, e o hash dessa string é **idêntico** ao
  da que está no disco hoje — é a mesma credencial viva. `de17c33` é ancestral de
  `master`, ou seja, alcançável por qualquer clone do repositório.
- Varredura por `postgres(ql)://usuario:senha@` em `src/`, `scripts/`, `tests/`,
  `docs/` e `.env.example`: **zero ocorrências**. Nenhum outro segredo real fora do
  arquivo de config local. ✔

**Cenário de falha:** qualquer pessoa com uma cópia do repositório — clone antigo,
fork, backup, CI que guarda o working dir — roda `git show de17c33` e obtém acesso
direto de leitura e escrita ao banco de produção, contornando toda a camada de RBAC
da aplicação: prontuário, CPF, financeiro e os tokens do portal (ver `SEC-23`).

**Correção:**
1. **Rotacionar a senha do role no painel do Neon — primeiro passo, antes de
   qualquer limpeza.** Reescrever histórico sem rotacionar não resolve: a credencial
   já está em clones de terceiros.
2. Atualizar `DATABASE_URL` no `.env.local` e nas envs da Vercel.
3. Remover a regra de permissão do `.claude/settings.local.json`.
4. Só então, se quiser, expurgar o blob do histórico (`git filter-repo`) — com a
   senha já rotacionada isso vira higiene, não contenção.

---

## 🟠 ALTO

### SEC-04 · Portal do paciente: código de 6 dígitos com freio só por IP
**Onde:** `src/app/api/portal/me/route.ts:8-17` · `src/lib/rate-limit.ts:55-59`
**Classe:** credencial de baixa entropia protegida por controle contornável (OWASP A07 + A01).

**Evidência verificada:**
1. **A chave do balde é `portal:${ip}` — só o IP** (`portal/me/route.ts:11`, limite
   12 / 5 min). Não há contador por código, nem invalidação do código após N falhas.
   Um IP novo é um orçamento novo — isso decorre diretamente da fórmula da chave.
2. **O IP vem de um header.** `getClientIp()` (`rate-limit.ts:55-59`) lê
   `x-forwarded-for` e pega o **elemento mais à esquerda** — a posição controlada
   pelo cliente sempre que houver um proxy que *acrescenta* em vez de substituir. Na
   Vercel a plataforma normalmente reescreve esse header, mas o código não deve
   *depender* de um comportamento de plataforma não declarado.
3. **Espaço de busca:** `crypto.randomInt(100000, 1000000)`
   (`portal/token/route.ts:110`) → 900.000 combinações.
4. **A busca é horizontal.** O atacante não persegue *um* código; testa códigos
   contra *todos* os pacientes com acesso ativo ao mesmo tempo. Com N códigos ativos,
   a chance por tentativa é N/900.000 — o espaço efetivo encolhe na proporção do
   sucesso do portal.
5. Código e token compartilham o mesmo `expiresAt` de **7 dias**
   (`portal/token/route.ts:102-103,131-136`).

**Cenário de falha:** um acerto devolve, em uma única resposta, dados cadastrais +
consultas + tratamentos + pedidos de exame + financeiro do paciente **e ainda o
token de 7 dias** (`portal/me/route.ts:108`), que é a credencial longa. Dado de
saúde, LGPD art. 11.

**Correção:**
1. Contador **por código** (não só por IP): após N falhas contra o mesmo código,
   desativar o registro e exigir novo envio pela clínica.
2. Encurtar a validade do **código** para minutos (o token de 7 dias continua sendo
   o mecanismo de sessão).
3. Segundo fator trivial: exigir código **+** data de nascimento do paciente. Sobe o
   espaço de busca sem custo de usabilidade.
4. Trocar a origem do IP para a fonte confiável da plataforma
   (`x-vercel-forwarded-for` / `request.ip`), com `x-forwarded-for` como fallback
   documentado.
5. Balde compartilhado (`SEC-19`).
6. Limite global de falhas do portal, com alerta — hoje uma campanha contra o portal
   não gera nenhum sinal.

---

### SEC-05 · Credencial do portal viaja e persiste na URL
**Onde:** `src/app/api/portal/me/route.ts:19-20` · `src/app/(portal)/portal/page.tsx:71,87,99,131,134`
**Classe:** credencial em query string (OWASP A02) + LGPD art. 46.

**Evidência verificada:** o token e o código chegam por `?token=` / `?code=`
(`portal/me:19-20`; `fetch` em `page.tsx:87` e `:119`). Mesmo quando o paciente entra
pelo **código**, a página **grava o token de volta na barra de endereço** —
`window.history.replaceState({}, '', \`/portal?token=${...}\`)` em `page.tsx:99` e
`:134` — e o guarda em `localStorage` (`page.tsx:71` e `:131`).

**Cenário de falha, sem nenhum atacante ativo:** o token de 7 dias vaza por access
log da Vercel, header `Referer` enviado a qualquer recurso de terceiro carregado
pela página, `document.referrer` de qualquer link de saída, histórico do navegador,
sincronização de abas entre dispositivos, print de tela e compartilhamento de link
("olha, meu resultado"). Em dispositivo compartilhado o `localStorage` mantém o
acesso vivo por 7 dias — o botão de sair existe (`page.tsx:250,278`), mas depende do
paciente lembrar de usá-lo.

**Correção:** aceitar a credencial por header (`Authorization`) ou corpo POST;
trocá-la, no primeiro contato, por um cookie de sessão `HttpOnly`, `Secure`,
`SameSite=Strict` com validade curta; remover o `replaceState` que reescreve o token
na URL e limpar a query após o consumo. Manter o link com token apenas como
*entrada* (é o formato que a clínica envia por WhatsApp), nunca como estado
persistente.

---

### SEC-06 · Content-Type arbitrário em rota pública de asset
**Onde:** `src/app/api/og-image/route.ts:15-28` · `src/app/api/favicon/route.ts:15-28` · `middleware.ts:30-33`
**Classe:** XSS armazenado via reflexo de Content-Type não validado (OWASP A03).

**Evidência verificada:** as duas rotas leem um data URL guardado em `clinicSettings`
(`ogImageUrl` / `headerImageUrl`), extraem o MIME do **cabeçalho do próprio data
URL** e o devolvem como `Content-Type` da resposta, sem allowlist:

```ts
const mimeMatch = header.match(/data:([^;]+);base64/)
const mime = mimeMatch?.[1] ?? 'image/png'
return new NextResponse(buffer, { headers: { 'Content-Type': mime, ... } })
```

`middleware.ts:30-33` declara as duas rotas públicas (sem sessão).

**Cenário de falha:** quem controla `ogImageUrl` / `headerImageUrl` controla o tipo
de conteúdo servido pela **própria origem da aplicação**, numa URL alcançável **sem
sessão**. Um data URL com `text/html` vira HTML executado em
`https://<dominio>/api/og-image`. `X-Content-Type-Options: nosniff` não ajuda: o tipo
não está sendo adivinhado, está sendo declarado. Sem CSP (`SEC-09`), não há segunda
linha. Some-se `SEC-12`: o servidor não valida o prefixo do data URL na gravação, e
`processImageToDataUrl` não rasteriza SVG — o arquivo entra no banco intacto.

O campo de origem exige `settings:edit` (só `admin`), o que segura a severidade em
ALTO e não CRÍTICO. Mas o efeito é transformar um comprometimento de admin — ou um
erro de operação — em execução de script persistente na origem da app, e em base
para phishing hospedado no domínio da clínica.

**Correção:** allowlist rígida de MIME (`image/png`, `image/jpeg`, `image/webp`,
`image/x-icon`), qualquer outro valor cai no fallback estático; validar também no
**gravador** (`/api/configuracoes/sistema` PATCH), não só no leitor; adicionar
`Content-Disposition: inline` e teto de tamanho do buffer.

---

### SEC-07 · Bot do WhatsApp entrega prontuário sem permissão nem auditoria
**Onde:** `src/lib/whatsappBot.ts:443-496` (dispatch) · `:262-345` (montagem do contexto)
**Classe:** falha de controle de acesso em canal alternativo (OWASP A01) + LGPD.

**Evidência verificada:** o app tem uma matriz RBAC boa e consistente —
`patients:view_clinical` é exigida em `/api/prontuario:22` e projetada
condicionalmente em `/api/pacientes/[id]:68`. **Esse controle não existe no caminho
do WhatsApp.** A assinatura é `dispatchGroupMessage(text: string)`
(`whatsappBot.ts:443`): recebe **só o texto**, sem identidade do remetente. O arquivo
inteiro tem **zero ocorrências de `hasPermission`** e **zero de `logActivity`**, e
consulta CPF (`:278`), notas de consulta (`:289`) e o conteúdo do prontuário
(`clinicalRecords.content`, `:314`) para publicar a resposta no grupo.

**Cenário de falha:** qualquer participante do grupo digita "informações sobre o
paciente Fulano?" e recebe no grupo o prontuário completo — alcance maior que o de
um `receptionist` logado no sistema, que nem prontuário enxerga. **Estar no grupo do
WhatsApp virou uma credencial de fato.** Nada disso passa por `logActivity`: o acesso
a dado de saúde por esse caminho é invisível na auditoria. Agrava: quem adiciona e
remove membro do grupo não é o RBAC da aplicação, e um aparelho de funcionário
perdido carrega o acesso junto.

**Correção:**
1. Mapear o remetente (`participant` JID) para um usuário do sistema e aplicar
   `hasPermission(...)` antes de montar contexto clínico. Remetente não mapeado →
   responder só o que é público.
2. Registrar toda leitura via bot em `activityLogs` (ação, quem, qual paciente).
3. Restringir por padrão: o bot responde agenda e números agregados; prontuário
   individual exige usuário mapeado com `patients:view_clinical`.
4. Considerar responder no privado do solicitante quando a resposta contiver dado
   individual.

---

### SEC-08 · Faltam CSP, HSTS e Permissions-Policy
**Onde:** `next.config.mjs:6-17` · **Card:** `RO-006`
**Classe:** ausência de defesa em profundidade no navegador.

**Evidência verificada:** o bloco `headers()` devolve exatamente três headers —
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`. Faltam:

- **CSP** — é a rede que segura `SEC-06` e qualquer falha futura de sanitização. O
  sistema renderiza HTML gerado por IA (`dangerouslySetInnerHTML` em
  `src/app/(site)/site/glossario/[slug]/page.tsx:128,130,138`) e serve conteúdo de
  site editável. Site público e dashboard compartilham origem, então script executado
  no site alcança o cookie de sessão do NextAuth.
- **HSTS** — sem ele, o primeiro acesso continua rebaixável para HTTP.
- **Permissions-Policy** — câmera, microfone e geolocalização liberados por omissão
  numa aplicação que não usa nenhum dos três.

**Correção:** CSP com nonce por requisição (sem `'unsafe-inline'` em `script-src`),
`Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`,
`Permissions-Policy: camera=(), microphone=(), geolocation=()`. Subir a CSP primeiro
em `Report-Only` para achar o que quebra no site público (GTM/GA são os suspeitos),
depois promover.

---

## 🟡 MÉDIO

### SEC-09 · Erro de banco devolvido ao cliente
**Onde:** `src/app/api/agenda/route.ts:250` · `src/app/api/rooms/route.ts:70` · `src/app/api/rooms/[id]/route.ts:42,63`

```ts
return NextResponse.json({ error: 'Erro no banco de dados', details: err.message }, { status: 500 })
```

**Evidência verificada:** as quatro ocorrências existem, com esse texto exato.
`err.message` do driver Postgres/Drizzle carrega nome de tabela, nome de coluna, nome
de constraint violada e, dependendo do erro, fragmento do valor rejeitado.

**Cenário de falha e escopo real:** só **uma** das quatro cruza fronteira de
privilégio — `agenda:250`, no POST, que exige `agenda:create` e portanto é alcançável
por `receptionist`. Uma recepcionista que force uma violação de constraint (data
inválida, FK inexistente) recebe o mapa do schema, que é o insumo de reconhecimento
que antecede um ataque dirigido. As três de `rooms` exigem `settings:edit` (admin) —
ali é defesa em profundidade, não fronteira. Por isso o achado é **MÉDIO** e não ALTO,
como constava na versão anterior.

**Correção:** `console.error(err)` no servidor (já existe em `agenda:249`) e uma
mensagem genérica com um `requestId` correlacionável na resposta. Aplicar o mesmo
padrão nas quatro ocorrências.

---

### SEC-10 · Segredos da clínica sem máscara na resposta da API
**Onde:** `src/app/api/configuracoes/sistema/route.ts:83-92` (GET) e `:130-137` (PATCH)

**Evidência verificada:** o GET devolve `...settings` inteiro. As colunas
`whatsappToken` (`schema.ts:221`), `smtpPass` (`:226`) e `evolutionApiKey` (`:233`)
fazem parte de `clinicSettings`, então saem em texto claro no JSON. Além disso o GET
anexa `googleClientSecret` lido do KV (`:91`) e o **PATCH ecoa o mesmo segredo de
volta** (`:135`).

**Cenário de falha:** exige `settings:view` (só `admin`), o que limita o alcance, mas
segredo em texto claro numa resposta HTTP acaba em devtools aberto na frente de
terceiros, em HAR anexado a um chamado de suporte, em cache de proxy corporativo e na
memória de qualquer script que rode na página de configurações. Um XSS na origem
(ver `SEC-06`/`SEC-08`) lê todos eles de uma vez.

**Correção:** devolver máscara (`••••••1234`) mais um booleano `configurado`; aceitar
o valor só na escrita; nunca ecoar no retorno do PATCH.

---

### SEC-11 · Enumeração de usuário por diferença de tempo no login
**Onde:** `src/lib/auth/config.ts:36-38`

**Evidência verificada:** `if (!user || !user.isActive) return null` (`:36`) acontece
**antes** do `bcrypt.compare` (`:38`).

**Cenário de falha:** e-mail inexistente responde em poucos milissegundos; e-mail
existente paga os **~203 ms** do bcrypt cost 12 medidos nesta validação. A diferença
é grande demais para se perder no ruído da rede — é um oráculo confiável de "esta
conta existe", disponível sem autenticação, e o insumo que torna `SEC-01` dirigido em
vez de cego.

**Correção:** comparar contra um hash-fantasma de custo equivalente quando o usuário
não existir, para que os dois caminhos gastem o mesmo tempo.

---

### SEC-12 · Upload base64 sem teto no servidor
**Onde:** `src/app/api/perfil/route.ts:23-26` · `src/app/api/configuracoes/sistema/route.ts:24-25,32` · `src/lib/upload.ts:49,56-61` · `src/components/shared/ImageUploader.tsx:36-41` · `src/components/layout/Sidebar.tsx:140-147`

**Evidência verificada** — todas as linhas conferidas:

| Camada | Limite hoje |
|---|---|
| `ImageUploader.tsx:36-41` | 2/1/4/4 MB por tipo — **cliente**, contornável |
| `Sidebar.tsx:144` (avatar) | **nenhum**; só `file.type.startsWith('image/')` |
| `/api/perfil` (`avatar`) | `z.string().refine(startsWith('data:image/') \|\| http)` — **sem `.max()`** |
| `/api/configuracoes/sistema` (`logoUrl`, `headerImageUrl`, `ogImageUrl`) | `z.string()` cru — **sem validação nenhuma** |
| Plataforma | na Vercel, o corpo da função é limitado (~4,5 MB) — é o único freio real, e ele é *externo ao código* |

**Cenário de falha:** a defesa contra payload gigante hoje é uma característica da
plataforma, não uma decisão da aplicação — em `next start` self-hosted ela não existe.
O avatar é devolvido em toda chamada de `/api/perfil` e o logo em `/api/site/config`
(público, `revalidate 60`), então uma imagem inflada vira custo de banda recorrente.
Segundo ponto: `processImageToDataUrl` **não rasteriza SVG** (`upload.ts:56-61`) —
`RASTER_TYPES` cobre só PNG/JPEG/WEBP e o resto passa direto (`upload.ts:61`). O
arquivo entra no banco intacto e, combinado com `SEC-06`, é servido pela origem da
app com o Content-Type que o próprio data URL declarar.

**Correção:** `.max()` no zod de todo campo que aceita data URL (teto em bytes ×
1,37 do base64); validar o prefixo contra allowlist de MIME
(`data:image/(png|jpeg|webp|x-icon);base64,`); rejeitar `image/svg+xml` no servidor a
menos que haja necessidade comprovada — e, se houver, sanitizar o SVG; replicar o
limite de tamanho do `ImageUploader` no `Sidebar`.

---

### SEC-13 · Leitura de prontuário não é auditada
**Onde:** `src/app/api/prontuario/route.ts:19-49` (GET) · `src/app/api/pacientes/[id]/route.ts:64-71`

**Evidência verificada:** o GET de `/api/prontuario` faz o controle de acesso certo
(`patients:view_clinical`, `:22`) e exige `patientId` (`:31`, correção anterior de
vazamento em massa, mantida), mas **não chama `logActivity`** — as duas ocorrências
de `logActivity` no arquivo estão no caminho de escrita. O mesmo vale para o ramo de
`/api/pacientes/[id]` que projeta `clinicalRecords` (`:68`).

**Cenário de falha:** quem abriu o prontuário de quem, e quando, não é respondível
hoje. Se um funcionário com acesso legítimo consultar a ficha de um paciente que não
é dele — vizinho, ex-cônjuge, figura pública — não existe registro que permita
detectar ou provar. É a pergunta que tanto a LGPD (art. 37) quanto a prática do CFM
esperam que um sistema de saúde responda.

**Correção:** `logActivity` com ação `prontuario:read` no GET de `/api/prontuario` e
no ramo de `/api/pacientes/[id]` que projeta `clinicalRecords`, gravando `patientId`
em `targetId` e **nada de conteúdo clínico** no `details`.

---

### SEC-14 · Dado de saúde em claro no log de auditoria
**Onde:** `src/app/api/exames/route.ts:125` · `src/app/api/tratamentos/route.ts:232` · `src/app/api/configuracoes/logs/route.ts:16-19` · `src/lib/db/schema.ts:259`

> Linhas corrigidas nesta validação: a versão anterior citava `exames:106` e
> `tratamentos:215`; os pontos reais são `:125` e `:232`.

**Evidência verificada:** o `activityLogs` acertou no geral — `details` guarda IDs,
não conteúdo. Duas exceções gravam informação de saúde no `targetName`:

- `exames:125`: `targetName: d.exams.map(e => e.name).join(', ')` → **quais exames**
  foram pedidos, com `patientId` no `details` da mesma linha (`:128`).
- `tratamentos:232`: `targetName: treatment.name` → **qual procedimento**.

**Cenário de falha:** isso é dado sensível (LGPD art. 11) sentado numa tabela cuja
rota de leitura (`configuracoes/logs:16-19`) devolve os 200 registros mais recentes
**sem filtro nem paginação**, para qualquer um com `settings:view`. Quem abre a tela
de logs lê, numa única resposta, o vínculo paciente↔procedimento de dezenas de
pacientes — sem precisar de `patients:view_clinical`. Some-se o IP do funcionário em
cada linha (`schema.ts:259`), que é dado pessoal com prazo de retenção próprio.

**Correção:** trocar o `targetName` clínico por rótulo neutro (`"Pedido de exame"`,
`"Plano de tratamento"`) mantendo o `targetId` para rastrear; paginar e filtrar a
rota de logs; definir e implementar prazo de expurgo do `activityLogs`.

---

### SEC-15 · PHI enviado a provedor de IA de terceiros
**Onde:** `src/lib/whatsappBot.ts:274-345` → `src/lib/ai.ts:69-79,123` · `src/lib/transcribe.ts:8`

**Evidência verificada:** o contexto montado para o LLM inclui nome, telefone, e-mail,
**CPF** (`whatsappBot.ts:278`), notas de consulta (`:289`) e **conteúdo do
prontuário** (`:314`). Vai para o provedor configurado em `configuracoes` — OpenAI,
OpenRouter, Groq, DeepSeek, Gemini ou Anthropic —, e os headers
`HTTP-Referer: https://regenortho.com.br` / `X-Title: REGENORTHO` (`ai.ts:74-75`)
ainda identificam a origem. Áudio do grupo vai para a Groq (`transcribe.ts:8`).

**Cenário de falha:** transferência internacional de dado de saúde (LGPD art. 33),
que exige base legal, contrato de operador e registro no ROPA — nada disso está
documentado no repositório. Pior, tecnicamente: `ia_motor_nome` é um campo livre e
`ai.ts:123` monta a base URL como
`PROVIDER_BASES[cfg.provider] ?? \`https://api.${cfg.provider}.com/v1\``. Um valor
não previsto nesse campo — erro de digitação ou escolha maliciosa de um admin — faz o
prontuário sair para um domínio arbitrário controlado por terceiro, sem nenhum erro
visível.

**Correção:** restringir `ia_motor_nome` a uma **allowlist fechada** e remover o
fallback genérico de URL (correção mais barata e de maior efeito); documentar base
legal e contrato por provedor; avaliar minimizar o contexto (o bot precisa mesmo de
CPF?); considerar provedor com residência de dados no Brasil ou opt-out contratual de
treinamento.

---

### SEC-16 · Wildcard de `LIKE` vindo do modelo de IA
**Onde:** `src/lib/whatsappBot.ts:263-269`

> Linha corrigida nesta validação: a versão anterior citava `:479-483`, onde não há
> nenhuma query.

```ts
const queryName = `%${params.searchPatientName.trim()}%`
… .where(ilike(patients.name, queryName)).limit(5)
```

**Evidência verificada:** a query é parametrizada pelo Drizzle (sem injeção de SQL),
mas `%` e `_` **não são escapados**, e não há exigência de tamanho mínimo.
`searchPatientName` tem duas origens: o JSON produzido pelo LLM a partir da mensagem
do grupo (`:226`) e um fallback por regex (`:251`).

**Cenário de falha e precondição honesta:** o fallback por regex exige
`[A-ZÀ-Ú][a-zà-ú]+` e **não** consegue produzir `%` — o vetor depende do caminho do
LLM, ou seja, de haver um motor de IA configurado e de ele devolver o wildcard no
campo. Nessa condição, um participante do grupo que peça a ficha de "um paciente cujo
nome contenha %" faz `ilike '%%%'` casar todo mundo e o `limit(5)` virar "os cinco
primeiros do banco", com prontuário completo publicado no grupo. A diferença para
`SEC-07` é relevante: sem wildcard o solicitante precisa **saber o nome** de alguém;
com wildcard ele **enumera** pacientes que não conhece.

**Correção:** escapar `%`, `_` e `\` antes de compor o padrão, e exigir tamanho
mínimo (≥3 caracteres) para aceitar a busca.

---

### SEC-17 · `/api/track` público sem rate limit
**Onde:** `src/app/api/track/route.ts:23-62` · `middleware.ts:15`

**Evidência verificada:** rota declarada pública em `middleware.ts:15`, aceita lote de
até 50 eventos por requisição (`track:36`) e **não importa `@/lib/rate-limit`**
(zero ocorrências no arquivo).

**Cenário de falha:** escrita direta e ilimitada na tabela de analytics por qualquer
um na internet — custo de armazenamento no Neon e métrica de tráfego envenenada, e as
decisões de mídia paga saem desses números.

**Correção:** `rateLimit()` por IP, no mesmo padrão de `/api/public/leads`
(`lead:${ip}`, 5 / 10 min).

---

### SEC-18 · Allowlist do middleware é por prefixo
**Onde:** `middleware.ts:10-48`

**Evidência verificada:** `isApiSite = pathname.startsWith('/api/site')`
(`middleware.ts:14`) torna **todo** `/api/site/**` público. Hoje moram ali exatamente
duas rotas — `config` (projeção segura) e `agendar` (com `rateLimit` 5/10 min) — então
está correto *hoje*. O mesmo padrão de prefixo vale para `/site`, `/portal` e
`/api/cron` (este mitigado: cada handler valida o próprio `CRON_SECRET`).

**Cenário de falha:** a próxima rota criada sob `/api/site/` nasce **sem sessão,
silenciosamente**. Não há erro, não há teste que quebre — só um endpoint novo aberto
para a internet. O risco é de construção, não de estado atual.

**Correção:** trocar prefixo por lista exata de caminhos públicos, com comentário por
entrada explicando a guarda própria de cada uma. Fail-closed por construção.

---

### SEC-19 · Rate limit em memória, por instância
**Onde:** `src/lib/rate-limit.ts:1-24,55-59`

**Evidência verificada:** `const buckets = new Map<string, Bucket>()` no escopo do
módulo (`:14`). O próprio arquivo documenta a limitação nos comentários `:1-7`, o que
é honesto — mas ela é pré-requisito de `SEC-01` e `SEC-04`.

**Cenário de falha:** em serverless o teto real é `limite × nº de instâncias
quentes`, e um atacante que gera concorrência multiplica o próprio orçamento. Somado
a `getClientIp` confiando na posição mais à esquerda do `x-forwarded-for` (`:57`), o
limitador vira sugestão.

**Correção:** backend compartilhado (Vercel KV / Upstash Redis) atrás da mesma
interface `rateLimit()` — a assinatura já está pronta para a troca. Trocar a origem
do IP para a fonte confiável da plataforma.

---

### SEC-20 · Prompt do glossário sem `sanitizeForPrompt`
**Onde:** `src/app/api/admin/glossario/gerar-conteudo/route.ts:129-130`

**Evidência verificada:** `termo.termo` e `termo.nicho` são interpolados crus no
prompt. O arquivo tem **zero** ocorrências de `sanitizeForPrompt`, enquanto
`whatsappBot.ts` aplica a função em todo valor de contexto.

**Cenário de falha:** a origem é `settings:edit` (admin), então o risco prático é
baixo — um admin que já pode editar o site injeta instrução no prompt e publica a
saída numa página indexada. Fica registrado porque é a **única** entrada de prompt do
sistema que não passa pela defesa que o próprio projeto construiu
(`src/lib/promptSafety.ts`): inconsistência de defesa é o que faz a próxima revisão
presumir cobertura que não existe.

**Correção:** aplicar `sanitizeForPrompt()` nos dois valores e validar `termo` na
gravação.

---

### SEC-21 · Token do portal guardado em texto claro na tabela
**Onde:** `src/lib/db/schema.ts:684`

**Evidência verificada:** `token: text('token').notNull().unique()` — o token de 7
dias é persistido em claro, assim como o `code` de 6 dígitos (`:685`).

**Cenário de falha (encadeado com `SEC-03`):** este achado seria teórico se o banco
fosse inalcançável. Não é — a connection string de produção está no histórico do git
(`SEC-03`). Quem tiver uma cópia do repositório faz um `SELECT` e sai com credenciais
de portal **funcionais** de todos os pacientes com acesso ativo, sem precisar
adivinhar nada e sem passar por rate limit nenhum.

**Correção:** guardar hash do token (e do código) e comparar por hash; o valor em
claro só existe no momento da emissão, na mensagem enviada ao paciente.

---

## ✅ Corrigido nesta passagem

### SEC-22 · `/api/admin/google/**` checava sessão, não permissão — **CORRIGIDO**
**Onde:** `src/app/api/admin/google/connect/route.ts` · `callback/route.ts` · **Card:** `RO-005`

**O que era:** as duas rotas chamavam `auth()` e paravam por aí. Qualquer usuário
logado — recepcionista, médico, financeiro — iniciava e concluía a conexão Google da
clínica inteira. O `google_refresh_token` gravado em `configuracoes` é credencial
única e global: alimenta `/trafego` (Search Console, GA4, Ads) e o fallback de
escrita da agenda em `src/lib/google/calendar.ts`, que grava nome de paciente e
observações no corpo do evento.

**Correção aplicada:** `requireSettingsEdit()` (`src/lib/apiGuards.ts:10`) nas duas
rotas, depois da checagem de sessão (que segue redirecionando para `/login` quem não
está logado, já que são rotas navegadas pelo browser). Mesma permissão que já protege
`/api/configuracoes/sistema`, onde o client id/secret do Google são editados.

**Prova:** `tests/integration/rbac-google-integracao.test.ts` — 9/9 passando: 403 para
`doctor`, `receptionist` e `financial` nas duas rotas, 307 para `admin`, e 403 para
`admin` cujas `customPermissions` substituem o preset sem incluir `settings:edit`.

O tratamento de open redirect em `connect:19-21` e `callback:19-20` foi revisado junto
e está correto.

---

## Removido na validação

Registrado com o motivo para que nenhum destes volte por inércia na próxima revisão.

| Achado anterior | Veredito | Motivo |
|---|---|---|
| "Histórico do git limpo quanto à connection string" (afirmado em `SEC-03` e na tabela de aprovados) | **ERRADO — invertido** | O commit `de17c33` **contém** a connection string, e é a mesma credencial que está em disco hoje (comparação por hash). É ancestral de `master`. A afirmação anterior rebaixaria a urgência da rotação; virou o núcleo do `SEC-03`. |
| "`docs/equipe/KANBAN.md:38` repete a credencial e precisa ser mascarada" | **FALSO POSITIVO** | A linha contém o literal `postgresql://…` (reticência, placeholder) seguido de "(valor **não** reproduzido aqui)". Zero credenciais no arquivo — a varredura por `usuario:senha@` em `docs/` não retorna nada. Nada a mascarar. |
| `error.message` em resposta 500 de rotas `settings:edit` (`glossario/gerar-conteudo:199`, `gerar-termos:188`, `whatsapp/instance/**`) | **REMOVIDO** | O código é real, mas **nenhuma fronteira de privilégio é cruzada**: quem recebe a mensagem já é admin com `settings:edit` e já enxerga o schema, as configurações e os segredos pela UI. Sem cenário de impacto, é ruído. (A mesma classe **com** fronteira permanece em `SEC-09`.) |
| `dividirConteudo` corta HTML por índice de caractere (`GlossarioCta.tsx:55-72`) | **FALSO POSITIVO** | O mecanismo descrito está errado: a função corta nas **posições casadas por `/<h2[\s>]/`**, não em índice arbitrário — nunca no meio de uma tag. E opera sobre HTML já sanitizado por `sanitizeGlossaryHtml` (`glossario/[slug]/page.tsx:66`). A própria versão anterior admitia "sem impacto de XSS". Não é achado de segurança. |
| Redirect para URL de configuração em rota pública (`og-image:31`, `favicon:31`) | **FALSO POSITIVO** | `url?.startsWith('http') → redirect(url)` **é a funcionalidade**: permite hospedar a imagem fora do banco. O destino é definido por admin com `settings:edit`; nenhuma entrada de atacante alcança o parâmetro. Não é open redirect. |
| `.env.example` lista 3 de ~10 variáveis | **REMOVIDO** | Verdadeiro (o arquivo tem `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`), mas é lacuna de documentação, não vulnerabilidade. Não há cenário de falha. Pertence ao backlog de DX. |
| `secretEquals` vaza o comprimento do segredo | **REMOVIDO** | A checagem de comprimento é intencional e está documentada em `src/lib/secrets.ts:6-12` — sem ela `timingSafeEqual` lançaria e viraria 500 em vez de rejeição. Não há vetor demonstrável; a própria versão anterior classificava como "aceito". Achado sem impacto não deve ocupar linha num relatório de segurança. |

---

## O que passou na auditoria

Reverificado nesta validação. Registrado para que a próxima revisão não gaste tempo
aqui de novo.

| Área | Verificação | Resultado |
|---|---|---|
| **Cron** | `secretEquals` + fail-closed sem `CRON_SECRET` (`agenda-medicos:19-24`) + `rateLimit` por rota | ✔ `src/app/api/cron/*/route.ts` |
| **`secretEquals`** | timing-safe de fato — `timingSafeEqual` do `node:crypto`, com a checagem de tamanho na ordem certa | ✔ `src/lib/secrets.ts:14-19` |
| **`sanitizeHtml`** | `ALLOWED_TAGS` fechado com `#text` presente, `ALLOWED_ATTR` de 4 entradas, `KEEP_CONTENT: false` — `on*` impossível por construção. Aplicado **na gravação e na renderização** | ✔ `src/lib/sanitizeHtml.ts:13-31`; consumidores: `gerar-conteudo/route.ts:9`, `glossario/[slug]/page.tsx:66` |
| **`dangerouslySetInnerHTML`** | 7 ocorrências reais, todas revisadas: 3 são JSON-LD com `<` escapado (`layout.tsx:67`, `especialidades:65`, `glossario/[slug]:72`), 1 é CSS estático interno (`motion-footer.tsx:280`), 3 recebem conteúdo já sanitizado (`glossario/[slug]:128,130,138`). **Nenhum caminho de HTML não sanitizado** | ✔ |
| **Injeção indireta de prompt** | cerca com UUID por requisição (`whatsappBot.ts:463`) — o dado do banco não tem como forjá-la —, `sanitizeForPrompt` em todos os valores do contexto, instrução explícita de "dado, nunca comando" | ✔ **defesa bem construída**; ressalvas em `SEC-16` e `SEC-20` |
| **SQL** | **zero `sql.raw`** em todo o `src/`, zero concatenação de string em query | ✔ |
| **RBAC** | `hasPermission` aplicada de forma consistente; projeção condicional de campo clínico e financeiro em `pacientes/[id]:68-69`; `/api/prontuario` exige `patientId` | ✔ (exceções: `SEC-07`, e `SEC-22` já corrigido) |
| **CORS** | nenhum header `Access-Control-Allow-*` em `src/`, `next.config.mjs` ou `middleware.ts` | ✔ |
| **Sessão** | JWT revalidado contra o banco a cada 5 min; usuário desativado ou removido derruba a sessão; avatar deliberadamente fora do token | ✔ `src/lib/auth/config.ts:73-87` |
| **Captação pública** | `/api/public/leads:28` e `/api/site/agendar:26` têm `rateLimit(\`lead:${ip}\`, 5, 10 min)` | ✔ |
| **Segredo hardcoded** | varredura por `postgres(ql)://usuario:senha@` em `src/`, `scripts/`, `tests/`, `docs/`, `.env.example` | ✔ nenhum; ver `SEC-03` para o arquivo de config local e o histórico |

**Não reverificado nesta passagem** (a versão anterior os declarava aprovados, mas
exigem execução, não leitura — não os considere cobertos): comportamento do webhook
do WhatsApp em runtime, presença do token CSRF do NextAuth no fluxo de credenciais, e
a varredura de `console.*` por conteúdo sensível.

---

## Ordem de execução recomendada

```
1. SEC-03   ROTACIONAR a senha do Neon           ← antes de tudo (está no git)
2. SEC-02   reset-passwords.ts em produção
3. SEC-01   rate limit + lockout no login        (depende de SEC-19)
4. SEC-19   balde compartilhado (KV/Redis)
5. SEC-04   endurecer o código do portal         (depende de SEC-19)
6. SEC-09   parar de devolver err.message        ← barato, faz junto
7. SEC-06   allowlist de MIME em og-image/favicon
8. SEC-15   allowlist fechada de provedor de IA  ← barato, alto efeito
9. SEC-08   CSP / HSTS / Permissions-Policy
10. SEC-05  tirar credencial do portal da URL
11. SEC-21  hash do token do portal
12. SEC-07  permissão + auditoria no bot do WhatsApp
```

Os itens 1, 2, 6 e 8 são de minutos. O 3 e o 4 andam juntos. O 12 é o de maior
esforço e o de maior valor para LGPD.

---

## Cards no KANBAN

Só entram aqui os vínculos **conferidos** contra `docs/equipe/KANBAN.md`.

| Achado | Card | Situação |
|---|---|---|
| SEC-02 | `RO-001` · "Senhas de seed são públicas no repositório" | já existia — confirmado ainda aberto |
| SEC-03 | `RO-003` · "Connection string do Neon em texto plano no disco" | já existia — **precisa ser atualizado**: o card diz "não está no git"; está |
| SEC-08 | `RO-006` · "Faltam CSP, HSTS e Permissions-Policy" | já existia |
| SEC-22 | `RO-005` · "`/api/admin/google/**` checa sessão, não permissão" | **pode ser fechado** — corrigido e coberto por teste |

Os demais achados **não têm card**. A versão anterior deste relatório mapeava
`SEC-01→RO-015`, `SEC-04→RO-016`, `SEC-05→RO-017` e `SEC-06→RO-018`, mas esses quatro
cards já existem e tratam de outros assuntos (dashboard, projeção de colunas, query
do glossário, auditoria visual); e citava `RO-019`…`RO-030`, que **não existem**.
Ao abrir os cards novos, comece em `RO-019`.

---

## Método

Revisão manual dos 74 route handlers, do middleware, das bibliotecas de autenticação,
permissão, sanitização, segredo, rate limit, IA e upload, do schema e do histórico do
git. Cada achado desta versão foi reaberto no código e reconferido linha a linha; as
linhas divergentes foram corrigidas e as divergências estão anotadas no próprio
achado.

Uma medição foi executada, offline e sem rede: custo de `bcrypt.compare` com cost 12
nesta máquina (~203 ms), usado em `SEC-01` e `SEC-11`. A verificação do histórico do
git foi feita por **contagem de ocorrências e comparação de hash** — em nenhum momento
o valor da credencial foi impresso, copiado ou transmitido. Nenhum teste foi executado
contra produção.
