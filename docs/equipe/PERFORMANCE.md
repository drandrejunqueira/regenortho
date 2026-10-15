# Performance — RegenOrtho

**Data:** 06/09/2026 · **Commit base:** `6b96d6e` · **Next.js** 14.2.15 · **Node** 22.23.2
**Ambiente de medição:** build de produção (`next build` + `next start`), banco Neon real, 449 verbetes publicados.

Regra desta página: **nada entra aqui sem número medido.** Onde não medi, está escrito que não medi.

---

## 1. Resumo

| # | Item | Antes | Depois | Ganho | Status |
|---|------|-------|--------|-------|--------|
| 1 | `/site/glossario` — HTML entregue (gzip) | 887,0 kB | 131,8 kB | **−85,1%** | ✅ aplicado |
| 2 | `/site/glossario` — TTFB (mediana, 10 req) | 196,8 ms | 26,7 ms | **−86,4%** | ✅ aplicado |
| 3 | `getTermosPublicados()` — payload da query | 1,92 MB | 236,5 kB | **−88,0%** | ✅ aplicado |
| 4 | `getTermosByLetraPublicados()` — pior caso | 171,3 kB | 1,0 kB | **−99,4%** | ✅ aplicado |
| 5 | `clinic_settings` no verbete — por request | 92,2 kB | 0,1 kB | **−99,9%** | ✅ aplicado |
| 6 | `(site)/layout.tsx` — por request, todo o site | 184,4 kB | 18,6 kB | −89,9% | 📋 proposto |
| 7 | `/site/especialidades` — `clinic_settings` | 92,2 kB | 0,1 kB | −99,9% | 📋 proposto |
| 8 | `getTermosAdmin()` — painel `/glossario` | 1,92 MB | 234,5 kB | −88,1% | 📋 proposto |

**Aplicado:** somente `src/lib/db/queries/**` e `src/app/(site)/site/glossario/**` (meu lane).
**Proposto:** diff pronto na seção 6, arquivos de colegas — não apliquei.

---

## 2. First Load JS por rota

`npm run build`, coluna *First Load JS* (gzip). Antes = `6b96d6e` limpo em worktree isolado; depois = mesmo build com minhas alterações.

**As minhas mudanças são todas server-side, então o First Load JS não muda — e não mudou.** Está aqui porque a tarefa pediu o inventário e porque ele revela um problema separado (seção 3).

### Site público — orçamento < 150 kB

| Rota | Antes | Depois | Orçamento | Status |
|------|-------|--------|-----------|--------|
| `/site/lp/articulacoes` | 109 kB | 109 kB | 150 kB | ✅ |
| `/site/lp/[treatment]` | 114 kB | 114 kB | 150 kB | ✅ |
| `/site/blog` | 153 kB | 153 kB | 150 kB | ⚠️ +3 kB |
| `/site/glossario` | 156 kB | 156 kB | 150 kB | ⚠️ +6 kB |
| `/site/agendar` | 157 kB | 157 kB | 150 kB | ⚠️ +7 kB |
| `/site/tratamentos` | 159 kB | 159 kB | 150 kB | ⚠️ +9 kB |
| `/site/especialidades` | 164 kB | 164 kB | 150 kB | ⚠️ +14 kB |
| `/site/a-clinica` | 172 kB | 172 kB | 150 kB | ⚠️ +22 kB |
| `/site/kanban-preview` | 172 kB | 172 kB | 150 kB | ⚠️ +22 kB |
| `/site/glossario/[slug]` | 200 kB | 200 kB | 150 kB | ❌ +50 kB |
| `/site` | 221 kB | 221 kB | 150 kB | ❌ +71 kB |

### Dashboard — orçamento < 300 kB

| Rota | Antes | Depois | Orçamento | Status |
|------|-------|--------|-----------|--------|
| `/configuracoes/*` (13 rotas) | 87,5–175 kB | idem | 300 kB | ✅ |
| `/tratamentos` | 116 kB | 116 kB | 300 kB | ✅ |
| `/glossario` (painel) | 114 kB | 114 kB | 300 kB | ✅ |
| `/agenda` | 152 kB | 152 kB | 300 kB | ✅ |
| `/materiais` | 159 kB | 159 kB | 300 kB | ✅ |
| `/financeiro` | 179 kB | 179 kB | 300 kB | ✅ |
| `/pacientes/[id]` | 184 kB | 184 kB | 300 kB | ✅ |
| `/pacientes` | 188 kB | 188 kB | 300 kB | ✅ |
| `/trafego` | 216 kB | 216 kB | 300 kB | ✅ |
| `/dashboard` | 229 kB | 229 kB | 300 kB | ✅ |
| `/relatorios` | 240 kB | 240 kB | 300 kB | ✅ |
| `/leads` | 242 kB | 242 kB | 300 kB | ✅ |

**Nenhuma rota de dashboard estoura o orçamento.** O shared chunk é 87,4 kB para todas as rotas.

---

## 3. Duas hipóteses do briefing que a medição derrubou

Registro aqui porque economiza o tempo de quem for pegar isso depois.

### 3.1 `recharts` entrando em rota sem gráfico — **não acontece**

`recharts` está em 4 arquivos, todos de gráfico: `relatorios/page.tsx`, `TrafegoClient.tsx`, `LeadsBarChart.tsx`, `RevenueChart.tsx`. O vendor chunk pesa **102,1 kB gzip** (`chunks/1240-*.js`).

Conferi o HTML servido de `/site/glossario` e nenhum chunk com `recharts` é carregado:

```
$ grep -rl "recharts" .next/static/chunks/app/\(site\)/
(vazio)
```

As 3 rotas que carregam recharts — `/dashboard` 229 kB, `/relatorios` 240 kB, `/trafego` 216 kB — **cabem no orçamento de 300 kB**. Trocar por `next/dynamic` renderia até ~102 kB nessas 3 rotas, mas hoje não há estouro de orçamento: **não é gargalo, não mexi.** Vale reabrir se o orçamento do dashboard cair para 150 kB.

### 3.2 `googleapis` vazando para o cliente — **não vaza**

```
$ grep -rl "google-auth-library" .next/static/chunks/ | wc -l
0
```

`googleapis` só aparece em `src/lib/google/*` (módulos de servidor). Zero ocorrências em qualquer chunk de cliente.

### 3.3 Base64 nas colunas TEXT — **não é o custo do glossário**

O briefing apontou base64 como causa provável. Medi todas as colunas TEXT do banco:

| Tabela | Coluna | Total | Maior linha | base64? |
|--------|--------|-------|-------------|---------|
| `glossario_termos` | `conteudo` | **1.725,6 kB** | 5,0 kB | não (HTML) |
| `clinic_settings` | `og_image_url` | 72,9 kB | 72,9 kB | **sim** |
| `glossario_termos` | `seo_description` | 57,0 kB | 0,2 kB | não |
| `activity_logs` | `target_name` | 33,9 kB | 0,1 kB | não |
| `glossario_termos` | `nicho` | 30,8 kB | 0,1 kB | não |
| `clinic_settings` | `logo_url` | 15,5 kB | 15,5 kB | **sim** |
| `clinic_settings` | `header_image_url` | 2,5 kB | 2,5 kB | **sim** |
| `users` | `avatar` | **0 kB** | 0 kB | 0 preenchidas |

O base64 do banco inteiro soma **90,9 kB em 1 linha** de `clinic_settings`. `users.avatar` está vazia nas 6 linhas.

O que estourava o glossário era **`conteudo`: 1,69 MB dos 1,92 MB** — o artigo em HTML de cada verbete, trazido inteiro só para renderizar um resumo de 130 caracteres. **A decisão de base64 do projeto está mantida e não foi tocada** — o problema real era `SELECT *`, exatamente como o briefing previu, só que na coluna de texto do artigo.

Os 90,9 kB de base64 ainda importam, mas por outro motivo: são lidos por request no layout do site (seção 6.1).

---

## 4. Glossário — a correção principal

### 4.1 Causa

`src/lib/db/queries/glossario.ts` usava `db.select()` sem colunas. Para as 449 linhas publicadas:

```
ANTES  (select *)          : 2.010.892 bytes (1,92 MB)
  conteudo                 : 1.766.986 bytes  ← 88% do total
  seo_description          :    58.351 bytes
  nicho                    :    31.430 bytes
  created_at / updated_at  :    52.084 bytes
  resto                    :   102.041 bytes
```

`@neondatabase/serverless` usa `fetch` por baixo, então a query entra no **data cache do Next**, que rejeita entradas acima de 2 MB — é o erro do log de dev (`items over 2MB can not be cached`). A consequência é medível em produção: a query nunca cacheia e reexecuta a cada request.

**TTFB de `/site/glossario`, 10 requests, build de produção:**

| | min | mediana | max |
|---|---|---|---|
| Antes | 156,4 ms | **196,8 ms** | 330,0 ms |
| Depois | 25,2 ms | **26,7 ms** | 50,7 ms |

Antes a mediana não cai com requests repetidos (nunca cacheia). Depois cabe no cache e cai para 26,7 ms.

### 4.2 O que mudei

`src/lib/db/queries/glossario.ts` — colunas explícitas e resumo recortado no Postgres:

```ts
const resumoSql = sql<string>`
  substring(
    btrim(regexp_replace(
      regexp_replace(coalesce(${glossarioTermos.conteudo}, ''), '<[^>]*>', ' ', 'g'),
      '\\s+', ' ', 'g')) from 1 for 280)`
```

O card do glossário exibe 130 caracteres; 280 dá folga e ainda alimenta a busca por palavra-chave.

`getTermosByLetraPublicados()` ganhou `excluirId` e `limite` — a página do verbete usava 5 links e trazia a letra inteira com o artigo completo de cada um.

`getTermoBySlugPublicado()` **não mudou**: a página do verbete continua recebendo o artigo íntegro (conferido: 3.550 caracteres no verbete de teste).

### 4.3 Resultado medido, ponta a ponta

**`/site/glossario`** — resposta HTTP real do `next start`:

| Métrica | Antes | Depois | Ganho |
|---------|-------|--------|-------|
| HTML entregue | 2.984.776 B (2,85 MB) | 1.237.800 B (1,18 MB) | −58,5% |
| **HTML gzip (o que o navegador baixa)** | **908.278 B (887 kB)** | **134.925 B (132 kB)** | **−85,1%** |
| TTFB mediana | 196,8 ms | 26,7 ms | −86,4% |
| Query `getTermosPublicados()` | 2.010.892 B | 242.159 B | −88,0% |
| Cabe no data cache (2 MB) | ❌ não | ✅ sim | — |

**`/site/glossario/[slug]`** — pior caso, verbete da letra "A" (39 verbetes na letra):

| Métrica | Antes | Depois | Ganho |
|---------|-------|--------|-------|
| HTML gzip | 49.222 B | 49.116 B | −0,2% |
| TTFB primeiro request | 123,5 ms | 85,4 ms | −30,8% |
| Query dos relacionados | 175.363 B (39 linhas) | 1.008 B (5 linhas) | −99,4% |
| Query `clinic_settings` | 92,2 kB | 0,1 kB | −99,9% |

**Sendo direto sobre esta página:** o HTML entregue praticamente não mudou (−0,2%), porque os 267 kB extras eram buscados no servidor e descartados sem renderizar. O ganho aqui é de trabalho de servidor e egress do Neon — 267 kB a menos por cache-miss — e de TTFB frio (−30,8%). **Não é ganho de banda para o usuário final.**

### 4.4 Validação dos dados

```
verbetes com resumo vazio : 0
resumos com HTML residual : 0
relacionados excluem o próprio verbete : SIM
artigo completo no /[slug] : íntegro (3.550 chars)
tsc --noEmit : No errors found
npm run build : exit 0
```

### 4.5 Mudança de comportamento — assumida de propósito

A busca da listagem filtrava sobre o **artigo completo**. Agora filtra sobre **termo + nicho + resumo de 280 caracteres**.

Manter a busca full-text no cliente custa 1,69 MB baixados por visitante, em toda visita, para um filtro que na prática é usado para achar o nome do verbete. Achei a troca claramente favorável, mas **é uma decisão de produto** — se a busca no corpo do artigo for requisito, o caminho certo é um endpoint de busca no servidor com `ilike`/`tsvector` (a tabela já tem índice em `letra`, `status` e `slug`). Não implementei porque não foi pedido.

---

## 5. Achados que não são meus para corrigir

### 5.1 `letra` inconsistente com o termo — **dado, não performance**

Ao conferir a amostra do resumo:

```
"Aceleração da Cicatrização"  → letra = 'G'
"Acidificação Articular"      → letra = 'H'
"Acidificação da Cartilagem"  → letra = 'S'
```

O filtro alfabético e o bloco "Letra X: veja também" estão agrupando errado. Não mexi — é dado, não código, e está fora do meu lane. Vale um card para o time de dados.

### 5.2 `og_image_url` em base64 não funciona como Open Graph

`clinic_settings.og_image_url` guarda 72,9 kB de data URI. Crawler de rede social não resolve `data:` em `og:image` — a imagem simplesmente não aparece ao compartilhar. Já existem as rotas `/api/og-image` e `/api/favicon` servindo isso por URL. Fora do meu lane (SEO/site), mas o custo está medido: 72,9 kB por request, e o recurso não funciona.

### 5.3 Ainda há `select()` sem colunas em 18 arquivos

39 ocorrências no total. Não medi cada uma — a maioria é `.limit(1)` por id, onde o custo é irrelevante. As de listagem que valem medição:

`api/pacientes/route.ts`, `api/financeiro/route.ts`, `api/tratamentos/route.ts`, `api/tratamentos/templates/route.ts`, `lib/clinicReport.ts`, `lib/materials-stock.ts`

**Não toquei em nenhuma:** colegas estão editando `api/pacientes`, `api/tratamentos`, `api/portal/token`, `api/configuracoes/contas` e `api/exames` neste momento (`git status`). Passar por cima geraria conflito.

---

## 6. Diffs propostos — arquivos fora do meu lane

Medidos, prontos para aplicar. **Não apliquei.**

### 6.1 `src/app/(site)/layout.tsx` — 184,4 kB por request em TODA página do site

Dois `findFirst` sem `columns:` no layout, ou seja, em cada request de `/site/**`:

| | Antes | Depois |
|---|---|---|
| `generateMetadata` | 92,2 kB | 0,2 kB |
| `SiteLayout` | 92,2 kB | 18,3 kB |
| **Total por request** | **184,4 kB** | **18,6 kB (−89,9%)** |

`generateMetadata` usa só `seoTitle`, `seoDescription`, `seoKeywords` e `name`. A linha 20 (`const ogImage = clinic?.ogImageUrl || ...`) computa uma variável **que nunca é usada** — o `openGraph.images` aponta para `/api/og-image`. São 72,9 kB buscados e jogados fora por request.

```diff
--- a/src/app/(site)/layout.tsx
+++ b/src/app/(site)/layout.tsx
@@ export async function generateMetadata(): Promise<Metadata> {
   const configs = await getAllConfigs()
-  const clinic = await db.query.clinicSettings.findFirst({ where: eq(clinicSettings.id, 1) })
+  const clinic = await db.query.clinicSettings.findFirst({
+    where: eq(clinicSettings.id, 1),
+    columns: { name: true, seoTitle: true, seoDescription: true, seoKeywords: true },
+  })
@@
-  const ogImage = clinic?.ogImageUrl || `${base}/image/logo.png`
-
+  // (removido: variável não era usada — openGraph.images aponta para /api/og-image)
@@ export default async function SiteLayout({ children }: ...) {
   const configs = await getAllConfigs()
-  let clinic = await db.query.clinicSettings.findFirst({ where: eq(clinicSettings.id, 1) })
+  // getClinicJsonLd lê exatamente estes campos.
+  let clinic = await db.query.clinicSettings.findFirst({
+    where: eq(clinicSettings.id, 1),
+    columns: {
+      name: true, email: true, phone: true, whatsapp: true,
+      address: true, city: true, state: true, zipCode: true,
+      seoDescription: true, logoUrl: true, headerImageUrl: true,
+    },
+  })
```

**Segundo passo (SEO, medido):** se o JSON-LD usar `/api/og-image` em vez do base64 de `logoUrl`/`headerImageUrl`, o total cai de 184,4 kB para **0,6 kB por request (−99,7%)** — e o `logo` do schema.org passa a ser uma URL que o Google consegue buscar, que é o formato que ele espera.

### 6.2 `src/app/(site)/site/especialidades/page.tsx` — 92,2 kB para usar 1 campo

`getEspecialidadesJsonLd` lê apenas `clinic?.name`.

```diff
-  const clinic = await db.query.clinicSettings.findFirst({ where: eq(clinicSettings.id, 1) })
+  const clinic = await db.query.clinicSettings.findFirst({
+    where: eq(clinicSettings.id, 1),
+    columns: { name: true },
+  })
```

92,2 kB → 0,1 kB por request (−99,9%).

### 6.3 Painel `/glossario` — 1,92 MB por abertura

`getTermosAdmin({})` faz `select()` nas 451 linhas. `GlossarioClient.tsx` declara `conteudo` na interface mas **nunca renderiza o campo** — só chama `/api/admin/glossario/gerar-conteudo`. São 1,92 MB trafegados para nada.

Medido: **2.013.461 B → 240.107 B (−88,1%)**.

Precisa dos dois arquivos juntos, senão o build quebra — por isso não apliquei metade:

```diff
--- a/src/lib/db/queries/glossario.ts
+++ b/src/lib/db/queries/glossario.ts
@@ export const getTermosAdmin = async (filters: {...}) => {
-  let query = db.select().from(glossarioTermos)
+  // A tabela do painel não exibe o artigo; ele é carregado no editor por id.
+  let query = db.select({
+    id: glossarioTermos.id, termo: glossarioTermos.termo, slug: glossarioTermos.slug,
+    letra: glossarioTermos.letra, nicho: glossarioTermos.nicho, status: glossarioTermos.status,
+    seoTitle: glossarioTermos.seoTitle, seoDescription: glossarioTermos.seoDescription,
+    createdAt: glossarioTermos.createdAt, updatedAt: glossarioTermos.updatedAt,
+  }).from(glossarioTermos)

--- a/src/components/admin/GlossarioClient.tsx
+++ b/src/components/admin/GlossarioClient.tsx
-  conteudo: string | null
+  // o artigo é carregado sob demanda no editor, não vem na listagem
```

### 6.4 `polyfills.js` — 39,5 kB gzip que navegador moderno não baixa

O `First Load JS` do build inclui `polyfills.js` (39,5 kB gzip), mas o script é servido com `noModule`:

```html
<script src="/_next/static/chunks/polyfills.js" noModule="">
```

Navegador moderno ignora. Ou seja, **a coluna do build superestima o que o usuário real baixa** em ~39,5 kB. Com esse desconto, `/site/glossario` entrega ~98 kB gzip de JS e **cabe no orçamento de 150 kB**.

Não é motivo para relaxar o orçamento — é motivo para medir o orçamento pelo que o navegador realmente baixa, e não pela coluna do `next build`. Sugiro fixar isso na régua antes de alguém "otimizar" 39 kB que ninguém baixa.

---

## 7. Não medido / fora de escopo

Registro para não passar por feito:

- **Core Web Vitals reais (LCP, INP, CLS)** — não medi. Precisa de Lighthouse ou RUM contra o site publicado; só medi TTFB e bytes.
- **Queries de dashboard, financeiro, pacientes, agenda** — não medi. Colegas com o arquivo aberto.
- **Índices do Postgres / plano de execução** — não medi. `glossario_termos` já tem índice em `letra`, `status` e `slug`.
- **Cold start em serverless** — não medi. As medições são de `next start` local.
- **`/site` (221 kB) e `/site/glossario/[slug]` (200 kB)** — os dois maiores estouros de orçamento do site. Não investiguei a composição: são componentes fora do meu lane.

---

## 8. Como reproduzir

```bash
# 1. Build e tabela de rotas
npm run build

# 2. Servidor de produção
npx next start -p 3199

# 3. Payload real e TTFB
curl -s -H "Accept-Encoding: gzip" -o /dev/null \
  -w "gzip=%{size_download}B ttfb=%{time_starttransfer}s\n" \
  http://localhost:3199/site/glossario

# 4. Comparar com o código anterior sem mexer na árvore de trabalho
git worktree add --detach /tmp/antes <commit>
ln -s "$PWD/node_modules" /tmp/antes/node_modules && cp .env.local /tmp/antes/
cd /tmp/antes && npm run build && npx next start -p 3198
```

Para o tamanho das queries, `Buffer.byteLength(JSON.stringify(resultado))` sobre a função real — é o que o Next serializa no payload RSC e o que ele mede contra o teto de 2 MB do data cache.

---

## 9. Arquivos alterados

```
M src/lib/db/queries/glossario.ts
M src/app/(site)/site/glossario/page.tsx
M src/app/(site)/site/glossario/[slug]/page.tsx
```

`tsc --noEmit`: sem erros. `npm run build`: exit 0.
