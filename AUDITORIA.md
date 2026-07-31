# Auditoria do Sistema — Regen Orto

7 auditores + 7 verificadores adversariais. 75 defeitos confirmados, undefined descartados como falso positivo.

| Severidade | Qtd |
|---|---|
| CRÍTICO | 4 |
| ALTO | 29 |
| MÉDIO | 29 |
| BAIXO | 13 |

---

## CRÍTICO (4)

### C1. Qualquer edição de agendamento apaga TODAS as transações vinculadas (parcelas de tratamento e taxa de consulta)

**Arquivo:** `src/app/api/agenda/[id]/route.ts:99` — módulo *financeiro*

**Defeito:** No PATCH da agenda, quando `updated.isPaidConsultation` é false (default da coluna, schema.ts:347 `.notNull().default(false)`), o else executa um DELETE em transactions filtrando somente por appointmentId. O DELETE do agendamento faz o mesmo (linha 232). Isso atinge (a) o lançamento de consulta criado pelo fluxo de atendimento — agenda/page.tsx:1414-1428 faz POST /api/financeiro com `appointmentId: appointment.id` — e (b) as parcelas geradas na conclusão do tratamento, que herdam o appointmentId (tratamentos/[id]/route.ts:193 `appointmentId: existing.appointmentId`), já que o tratamento rápido é criado com o appointmentId (agenda/page.tsx:1455). Gatilhos comuns: `updateStatus` (agenda/page.tsx:276) envia só {status} e o drag-and-drop (linha 166) envia só startAt/endAt — ambos caem no else. O saldo bancário já creditado na conclusão não é estornado, então some o contas a receber e o saldo continua inflado. Adicionalmente, a linha 75 (`const [existingTx] = await db.select().from(transactions).where(eq(transactions.appointmentId, updated.id))`) pega UMA transação qualquer do agendamento e a sobrescreve com os dados da consulta, podendo converter uma parcela de tratamento em lançamento de consulta.

**Como reproduzir:** 1) Na agenda, finalize um atendimento marcando 'gerar financeiro' (cria transação de consulta com appointmentId) e/ou crie o tratamento rápido e conclua-o em 6x (6 parcelas com o mesmo appointmentId). 2) Depois, na agenda, mude o status do agendamento para 'confirmado' ou arraste o card para outro horário — o PATCH envia apenas {status} ou {startAt,endAt}. 3) Como isPaidConsultation é false, o handler executa `db.delete(transactions).where(eq(transactions.appointmentId, updated.id))` e apaga a taxa de consulta e as 6 parcelas. 4) O contas a receber desaparece sem aviso e o saldo da conta bancária continua creditado com a 1ª parcela.

**Correção proposta:**

```
Restringir o DELETE/UPDATE ao lançamento da própria consulta: `and(eq(transactions.appointmentId, id), isNull(transactions.treatmentId), eq(transactions.category, 'consultation_fee'))`. Melhor ainda: guardar o id da transação da consulta no agendamento (coluna consultationTransactionId) e operar somente por ele, tanto no PATCH (linhas 75/93/99) quanto no DELETE (linha 232).
```

### C2. Portal do paciente bloqueado pelo middleware (redireciona para /login)

**Arquivo:** `middleware.ts:24` — módulo *agenda-pacientes*

**Defeito:** A lista `isPublic` (middleware.ts:24-33) não contém nenhuma entrada para `/portal` nem para `/api/portal/me`, e o `matcher` (linha 47) cobre todas as rotas exceto assets estáticos. Verifiquei que a página existe em src/app/(portal)/portal/page.tsx e que ela consome a API pública em src/app/(portal)/portal/page.tsx:87 (`fetch(`/api/portal/me?token=${currentToken}`)`) e :119 (`fetch(`/api/portal/me?code=${inputCode.trim()}`)`). A rota /api/portal/me não usa `auth()` — ela valida token/código e tem rate limit próprio (src/app/api/portal/me/route.ts:7-37) — ou seja, foi escrita para ser pública, mas o middleware a intercepta antes. Resultado: nenhum paciente anônimo consegue usar o portal.

**Como reproduzir:** Um funcionário gera o link/código do portal e envia ao paciente. O paciente, sem sessão next-auth, abre https://<dominio>/portal?token=abc. O middleware avalia isPublic=false, isLoggedIn=false e devolve NextResponse.redirect('/login') (middleware.ts:35-37). O paciente cai na tela de login do CRM. Se tentar o código de 6 dígitos, o fetch de /api/portal/me também é redirecionado para /login (HTML), o r.json() falha e o formulário nunca funciona.

**Correção proposta:**

```
Liberar as rotas do portal no middleware, junto com as demais públicas:

const isPortalPage = pathname.startsWith('/portal')
const isPortalApi = pathname.startsWith('/api/portal/me')

e incluir `isPortalPage || isPortalApi` no `isPublic`. Liberar SOMENTE /api/portal/me — /api/portal/token exige sessão + permissão portal:manage e deve continuar protegido.
```

### C3. Editar agendamento apaga todas as parcelas financeiras do tratamento

**Arquivo:** `src/app/api/agenda/[id]/route.ts:99` — módulo *agenda-pacientes*

**Defeito:** No PATCH, o `else` da linha 97 executa `db.delete(transactions).where(eq(transactions.appointmentId, updated.id))` — sem filtrar categoria nem treatmentId. Confirmei que as parcelas de tratamento gravam esse mesmo vínculo: src/app/api/tratamentos/[id]/route.ts:193 insere cada parcela com `appointmentId: existing.appointmentId`, e o fluxo 'Finalizar Consulta' cria o tratamento já amarrado ao agendamento (src/app/(dashboard)/agenda/page.tsx:1455 `appointmentId: appointment.id`). Como `isPaidConsultation` é falso na maioria dos agendamentos, qualquer PATCH posterior (arrastar na grade envia só startAt/endAt — page.tsx:1166-1172, mudar status, redimensionar) cai no else e apaga TODAS as transações do agendamento, inclusive as parcelas do tratamento e a cobrança lançada em Finalizar Consulta.

**Como reproduzir:** 1) Finalizar Consulta com 'gerar cobrança' e 'tratamento rápido' em 12x: o financeiro fica com a taxa de consulta (appointmentId=X) mais 12 parcelas (appointmentId=X). 2) Dias depois a recepcionista arrasta o card desse agendamento para outro horário — o front dispara PATCH apenas com startAt/endAt. 3) `updated.isPaidConsultation` é false (o campo nunca foi marcado nesse fluxo), o else roda e apaga as 13 linhas de transactions. 4) Nenhum aviso é exibido, o PATCH devolve 200 e não há recuperação.

**Correção proposta:**

```
Restringir o delete somente à taxa de consulta e só executá-lo quando o PATCH realmente mexeu em faturamento:

if (parsed.data.isPaidConsultation !== undefined && !updated.isPaidConsultation) {
  await db.delete(transactions).where(and(
    eq(transactions.appointmentId, updated.id),
    eq(transactions.category, 'consultation_fee'),
    isNull(transactions.treatmentId),
  ))
}
```

### C4. PATCH de agendamento apaga todos os lançamentos financeiros vinculados

**Arquivo:** `src/app/api/agenda/[id]/route.ts:99` — módulo *erros-silenciosos*

**Defeito:** Confirmado. O PATCH atualiza o agendamento e, no ramo `else` (linha 97-100), apaga TODAS as transações com aquele `appointmentId`, sem filtrar categoria nem `treatmentId`. O ramo é atingido em QUALQUER PATCH (arrastar card, mudar status) sempre que `updated.isPaidConsultation` for falso ou `patientId` nulo — e `updated` é a linha já persistida, não o corpo enviado, então nem é preciso mandar `isPaidConsultation` na requisição. As transações apagadas incluem: (a) a cobrança criada no fluxo 'Finalizar consulta', que envia `appointmentId: appointment.id` (src/app/(dashboard)/agenda/page.tsx:1425); (b) todas as parcelas de tratamento, porque src/app/api/tratamentos/[id]/route.ts:193 grava `appointmentId: existing.appointmentId` em cada parcela (e o tratamento rápido criado na finalização recebe `appointmentId`, src/app/(dashboard)/agenda/page.tsx:1459). A exclusão ignora as duas proteções do DELETE de /api/financeiro/[id]: o bloqueio 'só admin altera recebimento de tratamento' (linha 120) e o estorno do saldo bancário (linhas 126-131). Nenhum aviso é dado ao usuário.

**Como reproduzir:** Recepção finaliza a consulta e gera cobrança de R$ 350 (tx com appointmentId). O tratamento do mesmo paciente é concluído em 12x — as 12 parcelas nascem com o mesmo appointmentId. Dias depois alguém arrasta o card na Agenda para corrigir o horário: handleDrop faz PATCH {startAt, endAt} (src/app/(dashboard)/agenda/page.tsx:166-175). Como o agendamento não é 'consulta paga', o ramo else roda e apaga a taxa de R$ 350 e as 12 parcelas. O toast diz 'Agendamento movido!' e o Financeiro perde os recebíveis, sem log, sem estorno de saldo e sem mensagem.

**Correção proposta:**

```
Escopar a limpeza ao lançamento que a própria rota cria, por exemplo `db.delete(transactions).where(and(eq(transactions.appointmentId, updated.id), eq(transactions.category, 'consultation_fee'), isNull(transactions.treatmentId)))`, e só executá-la quando o PATCH realmente enviou `parsed.data.isPaidConsultation === false` — não a cada edição de horário/status. Melhor ainda: guardar o id da transação da consulta em `appointments.transactionId` (como já se faz em `purchaseOrders.transactionId`) e apagar só por esse id, estornando o saldo da conta quando `isPaid && bankAccountId`.
```

## ALTO (29)

### A1. Portal do paciente inacessivel: /portal e /api/portal/me exigem sessao da clinica

**Arquivo:** `middleware.ts:24` — módulo *rotas-auth*

**Defeito:** A lista isPublic (linhas 24-34) nao inclui /portal nem /api/portal, e o matcher da linha 48 ('/((?!_next/static|_next/image|favicon.ico).*)') captura ambos. O portal foi construido para acesso anonimo por token/codigo: src/app/api/portal/me/route.ts nao chama auth() em nenhum ponto (valida patientAccessTokens + rateLimit por IP) e src/app/(portal)/portal/page.tsx:87 faz fetch('/api/portal/me?token=...') sem sessao. Com isso todo acesso anonimo cai no redirect da linha 37.

**Como reproduzir:** A recepcionista gera o link em /api/portal/token e envia por WhatsApp (https://.../portal?token=abc). O paciente abre no celular sem sessao da clinica e o middleware devolve 307 para /login. Mesmo que a pagina carregue (usuario da clinica logado), o fetch de /api/portal/me tambem seria redirecionado e o r.json() da linha 88 quebraria. O portal esta inoperante para o publico a que se destina.

**Correção proposta:**

```
Incluir no allowlist: const isPortal = pathname.startsWith('/portal') || pathname.startsWith('/api/portal/me'); e somar isPortal a expressao isPublic (linhas 24-34). Manter /api/portal/token fora (continua exigindo sessao + portal:manage).
```

### A2. Desativar ou rebaixar usuario nao revoga a sessao ativa (isActive e role congelados no JWT)

**Arquivo:** `src/lib/auth/config.ts:53` — módulo *rotas-auth*

**Defeito:** A sessao usa strategy 'jwt' (linha 75) e o callback jwt so grava token.id/token.role dentro de `if (user)` (linhas 54-57), ou seja, apenas no login. users.isActive so e consultado em authorize() (linha 31). Nem o middleware.ts nem nenhuma rota reconsultam o banco para revalidar isActive/role — a busca por 'isActive' em src/app/api/ so retorna colunas de outras tabelas (patientAccessTokens, materials, users em filtro de agenda). Portanto o token permanece valido com o papel antigo ate expirar (maxAge padrao do next-auth: 30 dias).

**Como reproduzir:** Uma recepcionista e demitida e o admin clica em 'Desativar' em Configuracoes > Usuarios (PATCH /api/usuarios/[id] com isActive:false). A ex-funcionaria, com o cookie de sessao ainda no navegador, continua acessando /pacientes, /agenda e /leads e chamando as APIs por semanas. Igualmente, ao rebaixar um admin para 'financial', ele mantem acesso administrativo total ate fazer logout.

**Correção proposta:**

```
No callback jwt, no ramo sem `user`, buscar o registro por token.id e (a) invalidar o token quando !isActive e (b) sobrescrever token.role com o valor atual do banco. Alternativa: coluna sessionVersion em users, incrementada em toda alteracao de role/isActive/senha, comparada com o valor gravado no token.
```

### A3. customPermissions nunca chega ao servidor: permissoes personalizadas nao restringem nada

**Arquivo:** `src/lib/auth/config.ts:43` — módulo *rotas-auth*

**Defeito:** A coluna users.custom_permissions existe (src/lib/db/schema.ts:172) e e gravada por PATCH /api/usuarios/[id] (schema na linha 17, retorno na linha 61); a tela Configuracoes > Usuarios monta e envia o array (page.tsx:168). Mas o valor nunca sai do banco: authorize() (linhas 43-48) retorna apenas id/name/email/role, o callback jwt (linhas 54-57) grava so token.id e token.role e o callback session (linhas 67-68) expoe so id e role. Um grep por 'customPermissions' em src/ nao encontra nenhuma ocorrencia em src/app/api/ alem de usuarios/[id] — nenhuma rota passa o 3o parametro de hasPermission. Como getEffectivePermissions (src/lib/permissions.ts:256) so usa customPermissions quando o array e nao-vazio, todas as checagens caem no ROLE_PRESETS do papel.

**Como reproduzir:** O admin edita um segundo administrador e desmarca o modulo 'Configuracoes' e o modulo 'Financeiro'. A UI salva role='admin' + customPermissions=[lista reduzida] e o toast confirma. Esse usuario faz login e continua com todas as permissoes do preset admin: chama PATCH /api/configuracoes/sistema, POST /api/usuarios e DELETE /api/financeiro/[id] normalmente. O inverso tambem falha: permissoes concedidas alem do preset sao ignoradas.

**Correção proposta:**

```
Retornar customPermissions em authorize(), grava-lo em token.customPermissions no callback jwt e expo-lo em session.user.customPermissions; depois passar session.user.customPermissions como 3o argumento em todas as chamadas de hasPermission (de preferencia via um helper unico, ex.: requirePermission(session, 'x')). Ajustar tambem o Sidebar (src/components/layout/Sidebar.tsx).
```

### A4. Rotas do glossario admin so checam sessao, sem hasPermission

**Arquivo:** `src/app/api/admin/glossario/route.ts:9` — módulo *rotas-auth*

**Defeito:** As quatro operacoes de /api/admin/glossario (GET linha 8-9, POST linha 26-27, PUT linha 56-57, DELETE linha 85-86) validam apenas `if (!session)`, sem nenhuma chamada a hasPermission — o import de hasPermission nem existe no arquivo. O mesmo padrao aparece em /api/admin/glossario/gerar-termos/route.ts (POST) e /api/admin/glossario/gerar-conteudo/route.ts (POST). Essas rotas publicam e apagam conteudo indexado do site institucional (revalidatePath('/sitemap.xml')) e disparam chamadas pagas de IA usando a API key da clinica lida de configuracoes.

**Como reproduzir:** Um usuario com papel 'financial' (ou 'doctor'/'receptionist'), que nao tem settings:edit nem qualquer permissao de conteudo, faz DELETE /api/admin/glossario com {"id":"<id do verbete>"} e remove paginas indexadas do site publico. Em seguida chama POST /api/admin/glossario/gerar-termos repetidas vezes e queima os creditos da API key de IA da clinica, alem de publicar textos arbitrarios em /site/glossario/<slug>.

**Correção proposta:**

```
Adicionar a checagem de permissao nas seis rotas: settings:view no GET e settings:edit no POST/PUT/DELETE e nas rotas gerar-termos/gerar-conteudo — ou criar uma permissao dedicada de conteudo/SEO no MODULES de src/lib/permissions.ts.
```

### A5. Concluir tratamento lanca receitas e credita saldo bancario exigindo apenas treatments:edit

**Arquivo:** `src/app/api/tratamentos/[id]/route.ts:63` — módulo *rotas-auth*

**Defeito:** O PATCH so exige treatments:edit (linha 63). Quando d.status === 'completed', o bloco a partir da linha ~118 insere N parcelas em transactions e, se bankAccountId vier no corpo (updateSchema linha 33), soma o total ja pago ao current_balance da conta bancaria. Nenhuma permissao financial:* ou payments:* e verificada. A rota irma /api/compras/[id]/route.ts:115 faz exatamente o contrario e ate documenta o motivo em comentario — logo o padrao correto do projeto ja existe e nao foi aplicado aqui. O preset 'doctor' (src/lib/permissions.ts:193-200) tem treatments:edit e nenhuma permissao financeira.

**Como reproduzir:** Um usuario com papel 'doctor' envia PATCH /api/tratamentos/<id> com {"status":"completed","installments":1,"paymentStatus":"all_paid","bankAccountId":"<uuid da conta principal>"}. O sistema cria a receita e soma o valor ao current_balance da conta. Esse mesmo medico recebe 403 em GET /api/financeiro — ele movimenta o caixa da clinica sem poder sequer ver o modulo financeiro.

**Correção proposta:**

```
Dentro do bloco `if (d.status === 'completed' && existing.status !== 'completed')`, exigir hasPermission(role, 'financial:create') antes de inserir as transactions, e hasPermission(role, 'payments:edit') quando bankAccountId vier preenchido (parte que altera saldo de conta bancaria) — replicando o guard de src/app/api/compras/[id]/route.ts:115.
```

### A6. Novo Lead sem e-mail sempre falha: front envia null e o zod da rota nao aceita null

**Arquivo:** `src/components/leads/NewLeadDialog.tsx:56` — módulo *contratos-api*

**Defeito:** O dialog envia `email: data.email || null`. Como o input e registrado no react-hook-form, quando o campo fica em branco `data.email` e string vazia, entao `'' || null` => `null`. O schema de criacao (src/app/api/leads/route.ts:16) e `z.string().email().optional().or(z.literal(''))`, que aceita e-mail valido, string vazia ou ausencia da chave, mas nao aceita `null`. Executei o schema com o zod 4.3.6 do proprio projeto: null => success false, '' => true, ausente => true. O POST retorna 400 'Dados invalidos', o `if (!res.ok) throw new Error()` cai no catch e mostra o toast generico. Note que a propria rota ja normaliza com `email: parsed.data.email || null` na linha 78, ou seja, a intencao era aceitar vazio — falta apenas o `.nullable()` (a rota PATCH em src/app/api/leads/[id]/route.ts:14 ja usa `.nullable()`).

**Como reproduzir:** Em /leads, clicar em 'Novo Lead', preencher apenas Nome, Telefone e Origem (e-mail nao e obrigatorio na tela) e clicar em 'Criar Lead'. O POST /api/leads retorna 400 e aparece o toast 'Erro ao criar lead'; o lead nao e gravado. Como a maioria dos leads de recepcao nao tem e-mail, o cadastro manual fica inviavel.

**Correção proposta:**

```
Enviar `email: data.email || undefined` (ou omitir a chave quando vazio) em NewLeadDialog.tsx:56, ou alinhar o schema da rota para `email: z.string().email().nullable().optional().or(z.literal(''))`, como ja feito em src/app/api/leads/[id]/route.ts:14.
```

### A7. Novo Tratamento falha com 400: selects vazios enviam string vazia onde o zod exige uuid

**Arquivo:** `src/app/(dashboard)/tratamentos/page.tsx:212` — módulo *contratos-api*

**Defeito:** Em DrawerCreateTreatment o estado inicial e `{ patientId: '', paymentMethodId: '', templateId: '', ... }` (linhas 116-125) e o save envia `JSON.stringify({ ...form, items })` sem normalizar. Os selects de 'Modelo do Catalogo' (linha 258, opcao `<option value="">Comecar do zero...</option>`) e 'Forma de Pagamento' (linha 276, `<option value="">Selecione...</option>`) permitem valor vazio e nao ha validacao client-side para eles (o `save()` so bloqueia patientId, name e descricao dos itens). Em src/app/api/tratamentos/route.ts:31-32 ambos sao `z.string().uuid().optional().nullable()`, e string vazia nao passa em uuid. Rodei o schema com o zod do projeto: retorna `Invalid UUID` para paymentMethodId e templateId.

**Como reproduzir:** Em /tratamentos, clicar em 'Novo Tratamento', escolher paciente, digitar o nome (ex: PRP Joelho), preencher um item e clicar em 'Criar Tratamento' sem selecionar 'Modelo do Catalogo' nem 'Forma de Pagamento'. O POST /api/tratamentos devolve 400 e o toast mostra 'Erro ao criar tratamento'. Como ambos os campos sao opcionais por definicao, o fluxo padrao de criacao nunca conclui.

**Correção proposta:**

```
Normalizar no save (linhas 209-213): `paymentMethodId: form.paymentMethodId || null, templateId: form.templateId || null`. Alternativamente aceitar string vazia no schema com `z.union([z.string().uuid(), z.literal('')]).transform(v => v || null)`.
```

### A8. Cobranca da consulta finalizada nunca entra no financeiro (amount vai como number, schema exige string)

**Arquivo:** `src/app/(dashboard)/agenda/page.tsx:1420` — módulo *contratos-api*

**Defeito:** FinalizarConsultaDialog envia `amount: Number(feeAmount)` (numero JavaScript), mas o createSchema em src/app/api/financeiro/route.ts:19 exige `amount: z.string().regex(/^\d+(\.\d{1,2})?$/)`. Testei com o zod do projeto: `{amount: 350}` => parse falha. Alem disso, `paidAt` (linha 1423) e `paymentMethodId` (linha 1426) nao existem no createSchema e seriam removidos pelo strip do z.object mesmo que o amount fosse corrigido — apesar de as colunas `paid_at` e `payment_method_id` existirem em `transactions` (src/lib/db/schema.ts:377 e 382). O PATCH do agendamento e o prontuario sao gravados antes, entao o efeito e parcial: a consulta e finalizada mas a receita nao entra.

**Como reproduzir:** Na /agenda, abrir um agendamento de consulta, clicar em 'Compareceu', manter marcado 'Cobranca da Consulta', informar o valor (ex: 350.00), escolher a forma de pagamento e salvar. O agendamento vira 'attended' e a evolucao e gravada, mas o POST /api/financeiro retorna 400 e so aparece o toast 'Falha ao registrar cobranca no financeiro'. A receita da consulta nunca aparece em /financeiro nem no DRE.

**Correção proposta:**

```
Enviar `amount: Number(feeAmount).toFixed(2)` (string com 2 casas) na linha 1420 e acrescentar `paidAt` e `paymentMethodId` (e idealmente `bankAccountId`) ao createSchema de src/app/api/financeiro/route.ts, gravando-os no insert.
```

### A9. Lead nunca e vinculado ao paciente: patientId e convertedAt sao descartados pelo zod

**Arquivo:** `src/components/leads/ScheduleLeadDialog.tsx:159` — módulo *contratos-api*

**Defeito:** Ao agendar um lead sem paciente vinculado, o dialog cria o paciente e faz PATCH /api/leads/{id} com `{ patientId, convertedAt, status: 'scheduled' }` (linhas 156-164). O updateLeadSchema em src/app/api/leads/[id]/route.ts:11-23 nao declara `patientId` nem `convertedAt`; como z.object faz strip por padrao, os dois campos sao removidos e o update aplica apenas `status`. A resposta e 200, entao o front acha que deu certo. As colunas existem no banco (src/lib/db/schema.ts:301-302: `convertedAt: timestamp('converted_at')`, `patientId: uuid('patient_id')`) e `convertedAt` nao e escrito em nenhum outro ponto do codigo (grep em src/ so encontra esta linha do dialog).

**Como reproduzir:** Agendar um lead pelo dialog 'Agendar Consulta'. Um paciente e criado e a consulta agendada, mas `leads.patient_id` continua NULL. Ao agendar o MESMO lead de novo (remarcacao/novo procedimento), a condicao `if (!patientId)` na linha 140 volta a ser verdadeira e um paciente DUPLICADO e criado com o mesmo nome e telefone. `converted_at` fica sempre nulo, inviabilizando qualquer metrica de conversao lead->paciente.

**Correção proposta:**

```
Adicionar ao updateLeadSchema: `patientId: z.string().uuid().nullable().optional()` e `convertedAt: z.string().datetime().nullable().optional()`, convertendo convertedAt para Date antes do update (a coluna e timestamp).
```

### A10. Editar tratamento zera silenciosamente a forma de pagamento salva

**Arquivo:** `src/app/(dashboard)/tratamentos/page.tsx:440` — módulo *contratos-api*

**Defeito:** DrawerEditTreatment carrega o tratamento por GET /api/tratamentos/{id}, que em src/app/api/tratamentos/[id]/route.ts:52 devolve a linha crua da tabela `treatments` (tem a coluna `paymentMethodId`, mas nao o objeto aninhado `paymentMethod` — o join so existe no GET da lista, src/app/api/tratamentos/route.ts:69-74). O front le `t.paymentMethod?.id ?? ''` (linha 440), entao o select de Forma de Pagamento sempre abre vazio. Ao salvar, a linha 497 envia `paymentMethodId: form.paymentMethodId || null` e o PATCH faz `if (d.paymentMethodId !== undefined) updates.paymentMethodId = d.paymentMethodId` (linha 79), gravando NULL. O dado perdido e usado na conclusao do tratamento para carimbar as parcelas do financeiro (`const paymentMethodId = d.paymentMethodId ?? existing.paymentMethodId ?? null`, linha 171). Pelo mesmo motivo `loadedTreatment?.patient` (linha 550) e sempre undefined e o nome do paciente nunca aparece no cabecalho do drawer.

**Como reproduzir:** Criar um tratamento com forma de pagamento PIX. Depois abrir o card em /tratamentos (status draft/approved/in_progress), apenas corrigir o nome e clicar em 'Salvar Alteracoes'. `treatments.payment_method_id` e zerado no banco sem nenhum aviso; ao concluir o tratamento depois, as parcelas lancadas no financeiro ficam sem forma de pagamento.

**Correção proposta:**

```
Fazer o GET /api/tratamentos/[id] devolver os relacionamentos (join com paymentMethods e patients, como o GET da lista) ou ler o campo cru no front: `paymentMethodId: t.paymentMethodId ?? t.paymentMethod?.id ?? ''`. Aplicar o mesmo para `patient`.
```

### A11. Ficha do paciente lista consultas de TODA a clinica (patientId ignorado pela API de agenda)

**Arquivo:** `src/app/(dashboard)/pacientes/[id]/page.tsx:551` — módulo *contratos-api*

**Defeito:** A pagina busca `/api/agenda?patientId=${id}`, mas o GET em src/app/api/agenda/route.ts:41-52 le apenas `start`, `end` e `doctorId`. Sem nenhum deles, `conditions` fica vazio, o `where` vira undefined e o findMany roda sem filtro e sem `limit`, retornando todos os agendamentos do banco. Nao ha filtro client-side: o array `appointments` alimenta direto a Timeline (linha 609), o KPI 'Consultas' (linha 675) e a listagem da aba Consultas (linhas 763-768).

**Como reproduzir:** Abrir /pacientes/{id} de qualquer paciente. A aba 'Consultas' e a Timeline mostram agendamentos de outros pacientes (com nomes e horarios de terceiros) e o contador 'Consultas' exibe o total da clinica. Em base com centenas de agendamentos a pagina ainda carrega tudo sem limite.

**Correção proposta:**

```
Aceitar patientId no GET de /api/agenda: `const patientId = searchParams.get('patientId'); if (patientId) conditions.push(eq(appointments.patientId, patientId))` e adicionar um limit de seguranca ao findMany.
```

### A12. Aba Financeiro do paciente mostra lancamentos de outros pacientes

**Arquivo:** `src/app/(dashboard)/pacientes/[id]/page.tsx:555` — módulo *contratos-api*

**Defeito:** A pagina busca `/api/financeiro?patientId=${id}`, mas o GET em src/app/api/financeiro/route.ts:35-52 le apenas `type`, `isPaid`, `start` e `end`. O parametro `patientId` e ignorado e a rota devolve os 100 lancamentos mais recentes de todos os pacientes. A tela nao filtra no cliente: usa `transactions` direto na listagem (linha 911) e no calculo dos cards Pago/Pendente (linhas 896-897).

**Como reproduzir:** Abrir /pacientes/{id} e ir na aba 'Financeiro'. Aparecem cobrancas de outros pacientes (com descricao contendo o nome de terceiros, valores e vencimentos) e os totais Pago/Pendente somam a clinica inteira, dando a impressao de que aquele paciente deve valores que nao sao dele.

**Correção proposta:**

```
Aceitar patientId no GET de /api/financeiro: `const patientId = searchParams.get('patientId'); if (patientId) conditions.push(eq(transactions.patientId, patientId))`.
```

### A13. /trafego e /glossario nao checam permissao no servidor (vazam dados de leads)

**Arquivo:** `src/app/(dashboard)/trafego/page.tsx:7` — módulo *telas-botoes*

**Defeito:** Li o arquivo inteiro: TrafegoPage nao chama auth() nem hasPermission em ponto algum — a primeira linha executavel ja e a consulta ao Google e ao banco. O unico guarda no caminho e o middleware.ts (`const isLoggedIn = !!req.auth`, sem papel) e o (dashboard)/layout.tsx (`const session = await auth(); if (!session) redirect('/login')`, tambem sem papel). Em dashboard/page.tsx:12 a checagem correta existe (`if (!hasPermission(role, 'dashboard:view')) redirect('/login')`), so nao foi aplicada aqui. Nos ROLE_PRESETS, 'traffic:view' pertence apenas a admin e financial. GlossarioPage tem o mesmo padrao (nenhuma checagem), mas o dado exposto la (termos do glossario, conteudo publico do site) e bem menos sensivel. Rebaixei de critical para high: o vazamento e para usuarios ja autenticados da clinica, nao para o publico.

**Como reproduzir:** Logar como 'receptionist' ou 'doctor' (papeis sem traffic:view) e digitar /trafego na URL. A pagina renderiza os ate 100 leads de trafego pago dos ultimos 30 dias com nome, telefone e e-mail, alem das metricas de Search Console e GA4, sem nenhum redirect.

**Correção proposta:**

```
Adicionar no inicio de TrafegoPage o mesmo guarda de dashboard/page.tsx: const session = await auth(); if (!session) redirect('/login'); if (!hasPermission(session.user.role as UserRole, 'traffic:view')) redirect('/dashboard'). Idem em glossario/page.tsx com 'settings:view'. Idealmente extrair um helper requirePermission() usado por todas as paginas de servidor.
```

### A14. Adicionar a 2a tag no lead apaga a 1a (estado obsoleto no drawer)

**Arquivo:** `src/components/leads/LeadDrawer.tsx:141` — módulo *telas-botoes*

**Defeito:** Segui o caminho completo. addTag (linha 138) e removeTag (linha 166) montam a lista nova a partir de `lead.tags`, e `lead` e a prop vinda de `selectedLead` no KanbanBoard. Apos o PATCH o drawer chama onUpdate() -> handleDrawerUpdate (KanbanBoard.tsx:141), que faz onRefresh() e `if (selectedLead) handleLeadClick(selectedLead)` — passando o MESMO objeto obsoleto. handleLeadClick (linha 129) faz setSelectedLead(lead) com esse objeto e, do GET /api/leads/{id}, so aproveita `data.interactions`. O lead exibido nunca e substituido pela versao do servidor.

**Como reproduzir:** Abrir o drawer de um lead, adicionar a tag 'urgente' (toast de sucesso, mas a tag nao aparece na lista), depois adicionar 'joelho'. O segundo PATCH envia tags: ['joelho'], sobrescrevendo a primeira tag no banco — perda de dado permanente. O mesmo vale para remocao de tags.

**Correção proposta:**

```
Em KanbanBoard.handleLeadClick, aproveitar a resposta do GET tambem para o lead: setSelectedLead(data) alem de setInteractions(data.interactions ?? []). Ou derivar o lead exibido do array recarregado: const current = leads.find(l => l.id === selectedLead?.id) ?? selectedLead.
```

### A15. Botao X do card cancela tratamento sem confirmacao/motivo e ainda abre o drawer

**Arquivo:** `src/app/(dashboard)/tratamentos/page.tsx:1506` — módulo *telas-botoes*

**Defeito:** Confirmado no contexto completo do card. O botao de hover chama updateStatus(t.id, 'cancelled') diretamente — updateStatus (linha 1297) e um PATCH puro, sem confirm() e sem cancelReason. O onClick nao chama e.stopPropagation() e o container do card na linha 1462 tem onClick={() => setEditingTreatmentId(t.id)}, entao o clique borbulha e abre o drawer de edicao. O fluxo legitimo de cancelamento exige motivo: o botao 'Confirmar Cancelamento' tem disabled={cancelling || !cancelReason.trim()} — regra de negocio contornada pelo atalho, gravando cancelReason nulo. Depois de cancelado o card nem pode ser arrastado de volta (canDrag = t.status !== 'completed' && t.status !== 'cancelled').

**Como reproduzir:** Na aba Tratamentos, passar o mouse sobre um card em Rascunho/Aprovado/Em andamento e clicar no X do canto superior direito: o tratamento e cancelado na hora, sem confirmacao e sem motivo registrado, e o drawer de edicao abre por cima, dando a impressao de que nada aconteceu.

**Correção proposta:**

```
Adicionar e.stopPropagation() no onClick e trocar a chamada direta por abertura do fluxo com motivo (setEditingTreatmentId(t.id) + setShowCancelSection(true)) ou, no minimo, um confirm() antes de updateStatus(t.id, 'cancelled').
```

### A16. Campo 'Medico responsavel *' fica vazio para recepcao/medico (403 em /api/usuarios)

**Arquivo:** `src/components/leads/ScheduleLeadDialog.tsx:68` — módulo *telas-botoes*

**Defeito:** Confirmado ponta a ponta. O dialogo carrega medicos com fetch('/api/usuarios') e .catch(() => {}); GET /api/usuarios (route.ts:23) exige hasPermission(role, 'users:view'), presente somente no preset admin. Para receptionist — quem opera o funil de leads — a resposta e 403, res.data e undefined, doctors fica [] e o bloco {doctors.map(...)} nao renderiza nada, apesar do rotulo 'Medico responsavel *' (linha 224). selectedDoctor so e preenchido dentro do if (docs.length > 0), entao o POST /api/agenda vai com doctorId: selectedDoctor || null e o schema aceita (doctorId: z.string().uuid().nullable().optional()): a consulta e criada sem medico e sem sincronizacao de calendario. O mesmo fetch sem permissao existe em agenda/page.tsx:70 e no loadAll de pacientes/[id]/page.tsx.

**Como reproduzir:** Logar como 'receptionist', arrastar um lead para a coluna 'Agendado'. No dialogo 'Agendar Consulta do Paciente' o campo obrigatorio 'Medico responsavel *' aparece sem nenhum botao. Ao confirmar, o agendamento e gravado com doctorId null.

**Correção proposta:**

```
Expor listagem de medicos ativos liberada a quem tem 'agenda:view' — ex.: GET /api/usuarios?role=doctor retornando id/name/googleCalendarId com hasPermission(role,'agenda:view') || hasPermission(role,'users:view'). Apontar ScheduleLeadDialog, agenda/page.tsx e pacientes/[id] para ele e, enquanto isso, exibir mensagem em vez de campo obrigatorio vazio.
```

### A17. Medico nao consegue concluir/faturar tratamento (403 em /api/configuracoes/pagamentos)

**Arquivo:** `src/app/(dashboard)/tratamentos/page.tsx:1021` — módulo *telas-botoes*

**Defeito:** Confirmado. ConcluirTratamentoDialog carrega formas de pagamento com fetch('/api/configuracoes/pagamentos') e .catch(() => {}); o GET dessa rota (route.ts:24) exige 'payments:view', que so admin e financial possuem. O papel 'doctor' tem treatments:create/edit (portanto arrasta o card para 'Concluido' e handleDropTreatment abre o dialogo), mas nao payments:view: paymentMethods fica [] e handleConfirm aborta em `if (!paymentMethodId) { toast.error('Selecione uma forma de pagamento'); return }` sem que exista opcao selecionavel. Bloqueio equivalente em ScheduleLeadDialog para a recepcionista que marca a consulta como paga (`if (isPaid && !paymentMethodId)`).

**Como reproduzir:** Logar como 'doctor', arrastar um tratamento para a coluna 'Concluido'. No dialogo 'Concluir e Faturar Tratamento' o select de forma de pagamento fica so com 'Selecione...'. Clicar em 'Concluir e Faturar' mostra o toast 'Selecione uma forma de pagamento' e o tratamento nunca pode ser concluido por esse papel.

**Correção proposta:**

```
Liberar a leitura de formas de pagamento/contas para quem tem 'treatments:edit' ou 'agenda:create' (ex.: if (!hasPermission(role,'payments:view') && !hasPermission(role,'treatments:edit')) return 403), ou detectar lista vazia e exibir 'Sem permissao para faturar — peca ao financeiro' em vez de um botao que nunca funciona.
```

### A18. Abas Geral/Leads/Financeiro dos Relatorios mostram dados ficticios

**Arquivo:** `src/app/(dashboard)/relatorios/page.tsx:12` — módulo *telas-botoes*

**Defeito:** Confirmado: LEADS_MENSAL (linha 12), FATURAMENTO_MENSAL (linha 21) e ORIGEM_LEADS (linha 30) sao constantes literais no topo do arquivo, e os 'Insights do Mes' sao textos fixos num array inline. Nenhum desses blocos faz fetch — o unico fetch da pagina esta no DRETab (fetch('/api/relatorios/dre')). Nao ha rotulo de 'dados de demonstracao', e a pagina ainda oferece 'Exportar PDF' via window.print(), materializando os numeros falsos num documento.

**Como reproduzir:** Abrir Relatorios com qualquer papel: as abas 'Geral', 'Leads' e 'Financeiro' mostram sempre Nov-Abr com faturamento de R$ 18.500 a R$ 28.000 e afirmacoes como 'CPL do Google Ads subiu 12% este mes', independentemente do banco da clinica. Decisao de gestao (ou PDF impresso) baseada em numeros que nao sao da clinica.

**Correção proposta:**

```
Substituir as constantes por consultas reais (serie mensal de /api/relatorios/dre, agregacao de leads por mes e por leads.source) e derivar os insights desses dados. Se ficar para depois, marcar as abas como indisponiveis em vez de renderizar numeros falsos.
```

### A19. KPIs do Financeiro somam só os 100 lançamentos mais recentes

**Arquivo:** `src/app/api/financeiro/route.ts:51` — módulo *financeiro*

**Defeito:** O GET aplica `limit: 100` fixo e sem paginação, e a tela /financeiro calcula 'Receita total', 'Despesas' e 'Resultado líquido' somando o array recebido no cliente (page.tsx:74-76). A tela não envia nenhum filtro de período (fetchTransactions, page.tsx:57-70, só envia `type`), então a partir do 101º lançamento os três KPIs ficam silenciosamente errados. Como cada tratamento parcelado insere N linhas de uma vez (tratamentos/[id]/route.ts:203), o teto é atingido rápido.

**Como reproduzir:** 1) Conclua 12 tratamentos em 10x — 120 parcelas inseridas. 2) Abra /financeiro: a API devolve só 100 linhas (ordenadas por date desc) e o card 'Receita total' soma apenas essas 100; 'Resultado líquido' fica errado. 3) Cadastre uma despesa nova com data de hoje: ela entra no topo da ordenação, empurra uma receita antiga para fora da janela e o total de receita diminui sozinho.

**Correção proposta:**

```
Calcular os totais no servidor com SUM() agregado (sem limit), devolvê-los em um campo `totals` da resposta e usar esse campo nos KPIs, mantendo o limit apenas para a listagem. Adicionar também paginação/filtro de período (mês) na tela.
```

### A20. Botão "Pagar" nunca credita o saldo da conta bancária

**Arquivo:** `src/app/(dashboard)/financeiro/page.tsx:83` — módulo *financeiro*

**Defeito:** markPaid envia apenas `{ isPaid: true }`. As parcelas 2..N nascem com bankAccountId null (tratamentos/[id]/route.ts:197 — `bankAccountId: isPaid ? bankAccountId : null`), e o reconcileBalance (financeiro/[id]/route.ts:34-43) só mexe no saldo quando existe bankAccountId no estado anterior ou no novo. Como nenhum dos dois tem conta, a baixa pelo botão 'Pagar' marca a parcela como recebida no financeiro mas nunca chega ao saldo da conta em Configurações > Contas. O diálogo de edição afirma o contrário ao usuário (page.tsx:353-355: 'Alterar o valor, a conta ou o status de pagamento ajusta automaticamente o saldo da conta bancária vinculada').

**Como reproduzir:** 1) Conclua um tratamento de R$ 6.000 em 6x com '1ª Paga' na conta Itaú — o saldo sobe R$ 1.000 (tratamentos/[id]/route.ts:206-211). 2) No mês seguinte, clique em 'Pagar' na parcela 2/6. 3) A parcela vira 'Pago' no financeiro, mas o saldo do Itaú continua R$ 1.000: as outras cinco parcelas jamais entram no saldo, que fica permanentemente defasado em relação ao caixa real.

**Correção proposta:**

```
No botão 'Pagar', abrir o seletor de conta (ou usar a conta padrão de /api/configuracoes/contas) e enviar bankAccountId junto com isPaid. Alternativamente, no servidor, quando isPaid passa de false para true e bankAccountId vier nulo, herdar a conta da 1ª parcela do mesmo treatmentId (ou a conta padrão) antes de chamar reconcileBalance.
```

### A21. GET /api/agenda ignora patientId e devolve a agenda inteira da clinica

**Arquivo:** `src/app/api/agenda/route.ts:46` — módulo *agenda-pacientes*

**Defeito:** O GET lê apenas `start`, `end` e `doctorId` (linhas 42-44) e monta `conditions` só com esses três (linhas 46-49). Não existe nenhuma leitura de `patientId` no arquivo. A ficha do paciente chama a rota exatamente com esse parâmetro e sem start/end (src/app/(dashboard)/pacientes/[id]/page.tsx:551), então `conditions.length` é 0, o `where` vira `undefined` (linha 52) e a query retorna a tabela inteira de appointments com paciente/lead/médico/sala carregados. O resultado é jogado direto em `setAppointments(appts.data)` (page.tsx:560), populando a aba Agenda e a Timeline do paciente com compromissos de terceiros.

**Como reproduzir:** Abrir Pacientes > qualquer paciente. A aba 'Agenda' e a Timeline listam os agendamentos de todos os pacientes da clínica como se fossem daquele paciente, expondo nomes de terceiros. Além disso, cada abertura de ficha serializa a tabela inteira de appointments, sem limit, degradando o tempo de resposta conforme a base cresce.

**Correção proposta:**

```
Adicionar o filtro em src/app/api/agenda/route.ts, junto dos demais:

const patientId = searchParams.get('patientId')
if (patientId) conditions.push(eq(appointments.patientId, patientId))

E aplicar um limit padrão quando nenhum filtro for informado, evitando varredura completa da tabela.
```

### A22. Grade da semana esconde agendamentos de segunda anteriores a hora atual

**Arquivo:** `src/app/(dashboard)/agenda/page.tsx:123` — módulo *agenda-pacientes*

**Defeito:** `getWeekDays` cria `const monday = new Date(baseDate)` e só ajusta o dia com `setDate` (linhas 26-34), preservando hora/minuto/segundo de `baseDate`, que nasce como `new Date()` (linha 40) e é propagado por prevWeek/nextWeek, que também só mexem no dia (linhas 327-328). Na linha 123 `weekStart.toISOString()` vira segunda-feira COM a hora do relógio, e a API aplica `gte(appointments.startAt, new Date(start))` (src/app/api/agenda/route.ts:47). O `end` (linha 124) é normalizado para 23:59, então só o início é afetado — todo agendamento de segunda anterior à hora atual some da grade.

**Como reproduzir:** Abrir /agenda numa segunda-feira às 10h30: weekStart = segunda 10h30 e todos os agendamentos daquela manhã (07h–10h30) desaparecem da grade. O mesmo acontece ao navegar para qualquer semana em outro dia: a segunda-feira sempre perde os horários anteriores à hora do relógio. A recepcionista, vendo o slot vazio, remarca outro paciente no mesmo horário.

**Correção proposta:**

```
Zerar a hora ao montar a semana, em getWeekDays:

const monday = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())
monday.setDate(monday.getDate() + diff)

ou normalizar no ponto de uso (linha 123): const start = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()).toISOString()
```

### A23. Excluir paciente apaga o prontuario em cascata, ao contrario do que a mensagem diz

**Arquivo:** `src/app/api/pacientes/[id]/route.ts:129` — módulo *agenda-pacientes*

**Defeito:** O DELETE apenas tenta `db.delete(patients)` dentro de try/catch e, se a FK bloquear, devolve 409 dizendo que o paciente 'possui histórico (agendamentos, tratamentos, prontuários ou lançamentos)'. Confirmei na migração que `clinical_records.patient_id` está com `ON DELETE cascade` (0000_past_nehzno.sql:349) — igual em src/lib/db/schema.ts — assim como `patient_access_tokens.patient_id` (linha 359). Portanto prontuário NÃO bloqueia nada: é apagado silenciosamente. Só appointments (linha 345), treatments (367), transactions (362) e exam_orders (352), que estão como `no action`, impedem a exclusão. Um paciente com apenas evoluções clínicas é excluído com sucesso e o prontuário inteiro some.

**Como reproduzir:** 1) Paciente atendido sem agendamento formal, tratamento nem lançamento financeiro, mas com evoluções registradas em Pacientes > Prontuário. 2) Clicar em excluir na lista de Pacientes. 3) O delete passa, o Postgres cascateia e remove todas as linhas de clinical_records e os tokens de portal. 4) A rota devolve 200 { success: true } — a mensagem de proteção nunca aparece e o dado clínico é perdido em definitivo.

**Correção proposta:**

```
Checar explicitamente os vínculos antes do delete, incluindo prontuário:

const [{ n }] = await db.select({ n: count() }).from(clinicalRecords).where(eq(clinicalRecords.patientId, id))
if (n > 0) return NextResponse.json({ error: 'Paciente possui prontuário e não pode ser excluído. Inative-o.' }, { status: 409 })

Ou trocar o ON DELETE cascade de clinical_records.patient_id por no action via migração, para a FK proteger de fato o dado clínico.
```

### A24. Codigo de 6 digitos do portal sem unicidade: paciente pode ver prontuario de outro

**Arquivo:** `src/app/api/portal/token/route.ts:62` — módulo *agenda-pacientes*

**Defeito:** O código é gerado com `Math.floor(100000 + Math.random() * 900000)` sem checagem de colisão. Confirmei que não existe constraint UNIQUE em `code`: a tabela original só tem `patient_access_tokens_token_unique` (0000_past_nehzno.sql:208) e a coluna foi acrescentada depois sem índice — `ALTER TABLE "patient_access_tokens" ADD COLUMN "code" varchar(6);` (0002_overconfident_echo.sql:81); no schema, src/lib/db/schema.ts:593 declara `code: varchar('code', { length: 6 })` sem `.unique()`. Em src/app/api/portal/me/route.ts:34-35 a consulta por código filtra apenas isActive + não expirado + code e desestrutura `[tokenRow]` sem orderBy — pega uma linha arbitrária. Havendo dois tokens ativos com o mesmo código, um paciente recebe os dados do outro, incluindo o `token` permanente devolvido na linha 99.

**Como reproduzir:** A clínica mantém dezenas/centenas de tokens ativos ao mesmo tempo (cada um vale 7 dias — linha 63). Dois pacientes sorteiam o mesmo código de 6 dígitos. O paciente João digita o código em /portal, a query devolve a linha da Maria e ele passa a ver nome, telefone, data de nascimento, convênio, agendamentos, tratamentos, exames e financeiro dela; o token permanente da Maria é retornado e salvo no localStorage do celular do João, dando acesso contínuo por 7 dias. Vazamento de dado clínico (LGPD).

**Correção proposta:**

```
1) Gerar com `crypto.randomInt(100000, 1000000)` (o módulo crypto já está importado na linha 9). 2) Regerar em laço enquanto existir código ativo igual. 3) Criar índice único parcial: CREATE UNIQUE INDEX patient_access_tokens_code_active_uniq ON patient_access_tokens (code) WHERE is_active. 4) Em /api/portal/me, tratar retorno com mais de uma linha como acesso inválido em vez de pegar a primeira.
```

### A25. PATCH de lead descarta patientId: cada agendamento cria um paciente novo

**Arquivo:** `src/app/api/leads/[id]/route.ts:22` — módulo *leads-estoque*

**Defeito:** CONFIRMADO. O `updateLeadSchema` (linhas 11-23) não declara `patientId` nem `convertedAt`, embora as colunas existam (src/lib/db/schema.ts:301-302). O zod usa modo strip por padrão, então esses campos são removidos silenciosamente e o `set({ ...parsed.data })` da linha 67 grava só o `status`. Verifiquei que `db.update(leads)` só existe nesta rota em todo o `src/` — nenhuma outra rota grava `leads.patient_id`. O ScheduleLeadDialog envia exatamente esses campos (linhas 156-164) e depende do vínculo para o `if (!patientId)` da linha 140. Confirmei também que POST /api/pacientes (src/app/api/pacientes/route.ts:129) faz `db.insert(patients)` direto, sem checagem de duplicidade, e a tabela `patients` não tem índice único em phone/cpf (schema.ts:269-288) — nada impede a duplicata. RESSALVA: a parte de "inutiliza métricas de conversão" não se sustenta — `convertedAt` não é lido em lugar nenhum do app (só aparece no seed e nos snapshots de migração).

**Como reproduzir:** 1) Lead "João Silva" é arrastado para Agendado; o diálogo cria o paciente e agenda. O PATCH grava apenas status='scheduled' — patient_id continua NULL. 2) Depois, clicando em "Agendar" no card do mesmo lead (LeadCard/onSchedule, disponível em qualquer status via KanbanBoard.tsx:147-151), `lead.patientId` continua null. 3) Um SEGUNDO paciente "João Silva" é criado, com prontuário, agenda e financeiro separados. Repetindo N vezes, N fichas duplicadas do mesmo paciente.

**Correção proposta:**

```
Aceitar os campos no schema (`patientId: z.string().uuid().nullable().optional()` e `convertedAt` convertido para Date antes do update) ou, melhor, criar `POST /api/leads/[id]/converter` que numa única chamada verifica se já existe patientId, cria o paciente só se não houver, e grava patientId/convertedAt/status — eliminando a janela de duplicação do lado do cliente.
```

### A26. Recebimento nao e idempotente: duplo clique credita estoque e despesa duas vezes

**Arquivo:** `src/app/api/compras/[id]/route.ts:124` — módulo *leads-estoque*

**Defeito:** CONFIRMADO. A ação `receive` lê o pedido na linha 65-68, valida o status na linha 118, credita o estoque de todos os itens no loop 124-142, insere a despesa em 144-154 e só marca `received` em 156-161. Não há transação nem guarda de idempotência, e a checagem de status acontece antes de qualquer escrita. Verifiquei o botão que dispara a ação em src/app/(dashboard)/materiais/page.tsx:797-802 — ele NÃO tem `disabled`/estado de loading (diferente do MovimentacaoDialog, que usa `disabled={loading}` na linha 941). Ou seja, o duplo clique real do usuário dispara duas requisições concorrentes que ambas passam pela validação da linha 118.

**Como reproduzir:** Pedido de 100 ampolas em status 'ordered'. O usuário clica duas vezes em "Confirmar Recebimento" (o botão não desabilita). As duas requisições leem status='ordered', ambas creditam +100 no estoque (total +200) e ambas inserem uma despesa paga do valor total no financeiro. Mesmo efeito se a inserção da despesa falhar ou a função serverless estourar tempo após o loop: o estoque já subiu, o pedido continua 'ordered' e o botão Receber segue ativo.

**Correção proposta:**

```
Reivindicar o pedido antes de qualquer escrita: `const [claimed] = await db.update(purchaseOrders).set({ status: 'received', receivedDate }).where(and(eq(purchaseOrders.id, id), inArray(purchaseOrders.status, ['draft','ordered']))).returning()`; se `claimed` for undefined, responder 409 sem creditar nada. Só depois creditar estoque e lançar a despesa (vinculando transactionId ao final). Adicionar também estado de loading/disabled no botão de confirmação.
```

### A27. Baixa de material por tratamento nao recalcula materials.status

**Arquivo:** `src/app/api/tratamentos/[id]/route.ts:128` — módulo *leads-estoque*

**Defeito:** CONFIRMADO. Ao concluir um tratamento, o decremento (linhas 128-136) atualiza somente `currentStock` com `GREATEST(0, current_stock - qty)` — não grava `status` nem `updatedAt`. Comparei com os outros fluxos: POST /api/materiais grava `status: computeStockStatus(...)` e a rota de movimentação também (movement/route.ts:44,55). Confirmei que GET /api/materiais devolve o `status` armazenado no banco (src/app/api/materiais/route.ts:41-49, sem recálculo), e que toda a tela lê `status`, não o saldo: contadores em materiais/page.tsx:117-122, `StatusBadge value={mat.status}` na linha 404, aviso de reposição na linha 122 e o filtro `m.status !== 'ok'` do SuggestedPurchaseListDrawer.tsx:32. RESSALVA no exemplo do auditor: com estoque 6 e mínimo 5, computeStockStatus já devolve 'low' (utils.ts:78-83); o caso real é o material que estava 'ok'.

**Como reproduzir:** Material "Kit PRP" com estoque 20 e mínimo 5 → status 'ok'. Um tratamento consome 18 kits e é concluído. O saldo vai para 2, mas a coluna `status` continua 'ok': o contador "Críticos" mostra 0, o badge continua verde e o item NÃO entra na Lista de Compras Sugerida (filtra por status !== 'ok'). A clínica descobre a falta no dia do procedimento.

**Correção proposta:**

```
Recalcular o status junto com a baixa, usando o saldo já retornado pelo `.returning()`: `await db.update(materials).set({ status: computeStockStatus(material.currentStock, material.minimumStock), updatedAt: new Date() }).where(eq(materials.id, item.materialId))`, importando `computeStockStatus` de '@/lib/utils'.
```

### A28. Recalculo por lotes desfaz baixas de tratamento e entradas de compra

**Arquivo:** `src/lib/materials-stock.ts:19` — módulo *leads-estoque*

**Defeito:** CONFIRMADO. `recomputeStockFromBatches` sobrescreve `currentStock` (e `status`) com a soma das quantidades dos lotes (linhas 19-31). Verifiquei os três fluxos que mexem no saldo e nenhum toca em `material_batches`: baixa de tratamento (tratamentos/[id]/route.ts:128-136), recebimento de compra (compras/[id]/route.ts:135-140) e movimentação manual (materiais/[id]/movement/route.ts:54-57). A função é chamada em toda criação, edição e exclusão de lote (batches/route.ts:63, batches/[batchId]/route.ts:46 e 65). Confirmei também que materiais criados com número de lote/validade já nascem com um lote espelhando o estoque inicial (materiais/route.ts, insert em material_batches), então a situação é comum, não excepcional. A incoerência já aparece na UI: EditMaterialDialog exibe `hasBatches ? batchTotal : currentStock` (linha ~280), mostrando o total dos lotes mesmo quando difere do saldo real.

**Como reproduzir:** 1) "Ácido Hialurônico" com lote L1 de 20 unidades → currentStock 20. 2) Tratamentos concluídos consomem 15 → currentStock 5, mas L1 continua com quantity 20. 3) Alguém abre Editar Material e corrige a validade de L1 (ou cadastra o lote L2 da nova compra). 4) O recompute soma os lotes e devolve currentStock para 20 (ou 20+L2): as 15 unidades consumidas ressuscitam e o status volta a 'ok', sumindo dos alertas de reposição.

**Correção proposta:**

```
Fazer as baixas e entradas incidirem sobre os lotes (consumo FEFO no tratamento, criação de lote no recebimento de compra) e só então derivar `currentStock` da soma. Enquanto isso não existir, não sobrescrever `currentStock` no recompute quando houver movimentações posteriores ao último ajuste de lote — ou tratar o saldo como derivado apenas para materiais em que todas as saídas debitam lote.
```

### A29. PATCH de agendamento reverte pagamento já baixado no Financeiro

**Arquivo:** `src/app/api/agenda/[id]/route.ts:84` — módulo *erros-silenciosos*

**Defeito:** Confirmado. Quando `updated.isPaidConsultation && updated.patientId`, a rota monta `txData` derivando `isPaid` e `paidAt` de `updated.paymentStatus` (linhas 84-85) e, existindo transação vinculada, sobrescreve o registro inteiro com `db.update(transactions).set(txData)` (linha 93) — em toda e qualquer edição do agendamento, mesmo quando o corpo do PATCH só trouxe `{status}` ou `{startAt,endAt}`. O Financeiro dá baixa alterando apenas `transactions.isPaid` (src/app/(dashboard)/financeiro/page.tsx:78-83 envia `{isPaid:true}`) e nunca toca em `appointments.paymentStatus`, então o recebimento volta para 'a receber'. O mesmo `set` também reescreve `amount`, `description` e `date` (para hoje), e não há reconciliação de saldo bancário — só /api/financeiro/[id] chama `reconcileBalance`. Agravante: `const [existingTx] = await db.select().from(transactions).where(eq(transactions.appointmentId, updated.id))` pega a PRIMEIRA transação do agendamento, que pode ser uma parcela de tratamento, e a converte em lançamento de consulta.

**Como reproduzir:** Consulta com 'consulta paga' e paymentTiming = no_ato: transação nasce com isPaid=false. O paciente paga no balcão e o financeiro clica em 'Marcar como pago' (PATCH /api/financeiro/{id} {isPaid:true}). Depois, na Agenda, alguém marca 'Compareceu' (updateStatus faz PATCH {status}, src/app/(dashboard)/agenda/page.tsx:274-282). A rota entra em `if (existingTx)` e regrava isPaid=false, paidAt=null, descrição '(A receber)' e date=hoje. Toast: 'Status atualizado'. A cobrança quitada reaparece como pendente e o paciente é cobrado de novo.

**Correção proposta:**

```
Não recalcular `isPaid`/`paidAt` a partir de `appointment.paymentStatus` em toda edição: preservar `existingTx.isPaid`/`existingTx.paidAt` e só alterá-los quando `parsed.data.paymentStatus !== undefined`. Idem para `amount`/`description`, que só devem mudar quando `consultationPrice` vier no corpo. Filtrar o `select` de `existingTx` por `category = 'consultation_fee'` para não capturar parcela de tratamento, e reconciliar o saldo da conta quando o status de pagamento realmente mudar.
```

## MÉDIO (29)

### M1. Feed de notificacoes entrega PII de todos os modulos a qualquer usuario logado

**Arquivo:** `src/app/api/notifications/route.ts:29` — módulo *rotas-auth*

**Defeito:** O GET so verifica `if (!session)` (linhas 10-11) e devolve as 30 notificacoes mais recentes de qualquer tipo, sem filtro por permissao — nao ha import de hasPermission no arquivo. O corpo gravado por notify() carrega PII e valores: /api/public/leads/route.ts:49-55 grava titulo 'Novo lead: <nome>' e body '<especialidade> • <telefone> • <origem>'; /api/site/agendar/route.ts:41-47 idem; a conclusao de tratamento grava 'R$ <totalSale>'. O sino (src/components/layout/NotificationBell.tsx:55) e renderizado incondicionalmente no Topbar (src/components/layout/Topbar.tsx:81), para todos os papeis.

**Como reproduzir:** Um usuario com papel 'doctor' — cujo preset nao inclui leads:view nem financial:view — abre o sino no topo e le nome, especialidade e telefone de todos os leads captados pelo site, alem dos valores em reais dos tratamentos. As mesmas informacoes retornariam 403 em GET /api/leads ou GET /api/financeiro.

**Correção proposta:**

```
Mapear cada tipo de notificacao para a permissao correspondente (lead_new -> leads:view, appointment_* -> agenda:view, treatment_* -> treatments:view, stock_low -> materials:view) e filtrar com inArray(notifications.type, tiposPermitidos) na consulta e tambem na contagem de nao lidas.
```

### M2. Middleware bloqueia /api/og-image, /api/favicon e /robots.txt para visitantes anonimos

**Arquivo:** `middleware.ts:24` — módulo *rotas-auth*

**Defeito:** A lista isPublic (linhas 24-34) libera /site e /sitemap.xml mas nao libera /api/og-image, /api/favicon nem /robots.txt (gerado por src/app/robots.ts). O matcher da linha 48 exclui apenas _next/static, _next/image e favicon.ico — as tres URLs sao capturadas e caem no redirect da linha 37. Elas sao consumidas justamente por anonimos e robos: src/app/(site)/layout.tsx:42 aponta openGraph.images para /api/og-image, a linha 44 e src/app/layout.tsx:22 apontam o icone para /api/favicon.

**Como reproduzir:** Ao colar o link do site no WhatsApp/Facebook/LinkedIn, o crawler busca /api/og-image, recebe 307 para /login e a previa aparece sem imagem. O Googlebot busca /robots.txt, recebe o mesmo redirect e nao encontra a diretiva de sitemap declarada no final de src/app/robots.ts, prejudicando a indexacao. O favicon tambem nao carrega para quem nao esta logado.

**Correção proposta:**

```
Somar ao allowlist: const isPublicAssets = pathname.startsWith('/api/og-image') || pathname.startsWith('/api/favicon') || pathname === '/robots.txt'; e incluir isPublicAssets na expressao isPublic das linhas 24-34.
```

### M3. Endpoints publicos de captacao de lead sem rate limit

**Arquivo:** `src/app/api/public/leads/route.ts:20` — módulo *rotas-auth*

**Defeito:** POST /api/public/leads (linha 20) e POST /api/site/agendar (src/app/api/site/agendar/route.ts:20) sao liberados no middleware (isPublicLeadsApi e isApiSite, linhas 14-16) e nao aplicam nenhum limite por IP — nenhum dos dois importa rateLimit/getClientIp. O utilitario ja existe e e usado em src/app/api/portal/me/route.ts:10-17. Cada requisicao aceita insere uma linha em leads, grava uma notificacao e, em /api/site/agendar, dispara um envio de WhatsApp para o numero da clinica via sendAndLog.

**Como reproduzir:** Um script envia milhares de POST /api/site/agendar com nomes e telefones aleatorios. O CRM enche de leads falsos, o sino de notificacoes fica inutilizavel e o numero da clinica recebe uma enxurrada de mensagens pela Evolution API (com risco de bloqueio por spam), afogando os leads reais.

**Correção proposta:**

```
Aplicar o rateLimit existente nas duas rotas, no mesmo formato de src/app/api/portal/me/route.ts: const ip = getClientIp(req); const rl = rateLimit(`lead:${ip}`, 5, 10 * 60 * 1000); if (!rl.ok) return 429 com Retry-After.
```

### M4. Recebimento de compra atualiza o estoque mas nao recalcula o status do material

**Arquivo:** `src/app/api/compras/[id]/route.ts:135` — módulo *contratos-api*

**Defeito:** Na acao 'receive' o update em `materials` grava currentStock, unitCost, supplier e updatedAt, mas nao recalcula a coluna `status`. A rota de movimentacao manual faz o oposto (src/app/api/materiais/[id]/movement/route.ts:43 e 54: `const newStatus = computeStockStatus(newStock, material.minimumStock)` seguido de `.set({ currentStock: newStock, status: newStatus, ... })`), e `recomputeStockFromBatches` (src/lib/materials-stock.ts:29) tambem grava o status. A tela /materiais le a coluna `status` diretamente para badges e KPIs (page.tsx:118-122, 289, 367, 404), entao o status fica congelado no valor anterior ao recebimento.

**Como reproduzir:** Um material esta com status 'critical' (ex: 2 un, minimo 10). Em /materiais > Compras, registrar o recebimento de 50 unidades. O estoque passa a 52, mas a linha na aba Estoque continua com o selo vermelho 'Critico', o alerta do topo continua contando o item como critico e os KPIs 'Criticos'/'Estoque baixo' ficam errados.

**Correção proposta:**

```
Incluir o status no update do recebimento: `status: computeStockStatus(mat.currentStock + item.quantity, mat.minimumStock)` (importando computeStockStatus de '@/lib/utils'), como ja e feito na rota de movimentacao.
```

### M5. Recebimento de compra nao cria lote; o estoque recebido some ao editar qualquer lote depois

**Arquivo:** `src/app/api/compras/[id]/route.ts:124` — módulo *contratos-api*

**Defeito:** A acao 'receive' soma a quantidade direto em `materials.current_stock` e nao insere nada em `material_batches`. Porem o cadastro de material ja cria um lote inicial com quantidade igual ao estoque inicial (src/app/api/materiais/route.ts:100-107) e `recomputeStockFromBatches` (src/lib/materials-stock.ts:19-30) SOBRESCREVE `currentStock` com a soma dos lotes; ela e chamada em toda criacao, edicao e exclusao de lote (src/app/api/materiais/[id]/batches/route.ts:63 e src/app/api/materiais/[id]/batches/[batchId]/route.ts:46 e 65). As duas fontes de verdade divergem apos o recebimento.

**Como reproduzir:** Cadastrar um material com numero de lote e estoque inicial 10 (cria 1 lote com quantidade 10). Registrar o recebimento de uma compra de 50 unidades — currentStock vai para 60, mas o lote continua com 10. Depois abrir o material em /materiais e editar/salvar qualquer lote: recomputeStockFromBatches recalcula e o estoque volta para 10, apagando as 50 unidades recebidas.

**Correção proposta:**

```
No recebimento, inserir uma linha em material_batches com a quantidade recebida (materialId, quantity: item.quantity, batchNumber/expiresAt opcionais) e chamar recomputeStockFromBatches(item.materialId), caindo no incremento direto apenas quando o material nao possui lotes.
```

### M6. Botoes de criar/movimentar material aparecem para quem so tem materials:view

**Arquivo:** `src/app/(dashboard)/materiais/page.tsx:225` — módulo *telas-botoes*

**Defeito:** Confirmado: a pagina calcula apenas canDelete (linha 62) e usa essa flag so na exclusao da tabela. 'Nova Compra' (linha 222), 'Novo Material' (linha 235), entrada/saida de estoque (linhas 415 e 424) e o toggle de inativar (linha 442) sao renderizados sem qualquer condicao de permissao. As APIs exigem materials:create e materials:edit, e o preset de 'receptionist' contem apenas 'materials:view'.

**Como reproduzir:** Logar como 'receptionist', abrir Materiais (item visivel no menu), clicar em 'Novo Material', preencher o formulario inteiro e clicar em 'Cadastrar' — 403 e toast de erro. Idem nas setas de entrada/saida em qualquer linha da tabela.

**Correção proposta:**

```
Derivar canCreate = hasPermission(role,'materials:create') e canEdit = hasPermission(role,'materials:edit') junto de canDelete (linha 62) e condicionar 'Novo Material', 'Nova Compra', entrada/saida, editar e inativar a essas flags, como ja e feito com canDelete.
```

### M7. Botao 'Novo Paciente' visivel para papeis sem patients:create

**Arquivo:** `src/app/(dashboard)/pacientes/page.tsx:354` — módulo *telas-botoes*

**Defeito:** Confirmado: a pagina ja deriva canEdit/canDelete nas linhas 288-289 a partir de useSession + hasPermission, mas o botao do PageHeader (linha 354) e o do estado vazio 'Cadastrar primeiro paciente' (linha 418) chamam setNewDialog(true) sem nenhuma condicao. POST /api/pacientes exige 'patients:create', ausente nos presets de 'doctor' e 'financial' — que tem 'patients:view' e veem o item Pacientes no menu.

**Como reproduzir:** Logar como 'doctor', abrir Pacientes, clicar em 'Novo Paciente', preencher nome e telefone e clicar em 'Cadastrar Paciente'. A API responde 403 e o erro so aparece depois do formulario inteiro preenchido.

**Correção proposta:**

```
Adicionar const canCreate = role ? hasPermission(role, 'patients:create') : false e envolver os dois botoes (linhas 354 e 418) com {canCreate && ...}, seguindo o padrao ja usado para canEdit/canDelete.
```

### M8. Acoes de tratamento visiveis para papeis que so tem treatments:view

**Arquivo:** `src/app/(dashboard)/tratamentos/page.tsx:1357` — módulo *telas-botoes*

**Defeito:** Confirmado por busca no arquivo inteiro: 'hasPermission' e 'useSession' nao aparecem nenhuma vez em tratamentos/page.tsx (0 ocorrencias). 'Novo Tratamento' (linha 1362), 'Novo Modelo' do catalogo (linha 936), edicao de modelos e inativacao sao exibidos a todos, e os cards ficam draggable sempre que canDrag e verdadeiro, acionando handleDropTreatment -> updateStatus. As APIs exigem treatments:create/edit/delete; os presets de 'receptionist' e 'financial' contem somente 'treatments:view'.

**Como reproduzir:** Logar como 'receptionist', abrir Tratamentos, clicar em 'Novo Tratamento', selecionar paciente e itens e clicar em 'Criar Tratamento' — 403 com toast de erro. Arrastar qualquer card entre colunas tambem falha com 'Erro ao atualizar status'.

**Correção proposta:**

```
Ler a sessao com useSession, calcular canCreate/canEdit/canDelete via hasPermission e condicionar os botoes de criacao/edicao/inativacao, alem de desabilitar draggable nos cards quando o usuario nao tiver treatments:edit.
```

### M9. Aba Prontuario mostra 'nenhum registro' quando o acesso na verdade foi negado

**Arquivo:** `src/app/(dashboard)/pacientes/[id]/page.tsx:731` — módulo *telas-botoes*

**Defeito:** Confirmado. loadAll faz fetch('/api/prontuario?patientId=...') e fetch('/api/financeiro?patientId=...') com .catch(() => ({ data: [] })), e depois so aplica o estado com `if (recs.data) setRecords(recs.data)`. Um 403 nao rejeita a promise: a resposta e { error: 'Acesso negado' }, entao recs.data e undefined, records continua [] e a aba renderiza 'Nenhum registro clinico' — afirmando que nao ha dados quando houve negativa de acesso. GET /api/prontuario exige 'patients:view_clinical' e GET /api/financeiro exige 'financial:view'; 'receptionist' nao tem nenhuma das duas. O botao 'Novo Registro' (linha 734) e o atalho do cabecalho (linha 660) tambem ficam visiveis e falham no POST. O arquivo nao usa hasPermission/useSession em ponto algum.

**Como reproduzir:** Logar como 'receptionist', abrir a ficha de um paciente que tem evolucoes registradas e clicar na aba 'Prontuario': a tela informa 'Nenhum registro clinico' (falso). Ao clicar em 'Novo Registro' e salvar, aparece erro.

**Correção proposta:**

```
Distinguir 403 de lista vazia: checar res.status, guardar um flag de acesso negado e exibir 'Voce nao tem permissao para ver o prontuario'. Condicionar as abas Prontuario/Financeiro e o botao 'Novo Registro' a hasPermission(role,'patients:view_clinical') / 'patients:create_clinical' / 'financial:view'.
```

### M10. KPIs de Faturamento e Resultado liquido ignoram financial:view

**Arquivo:** `src/components/dashboard/DashboardView.tsx:101` — módulo *telas-botoes*

**Defeito:** Confirmado: o card 'Financeiro do Mes' esta corretamente atras de {hasFinancialPermission && (...)} (linha 167), mas os KpiCard 'Faturamento' (linha 101) e 'Resultado liquido' (linhas 103-108) usam exatamente os mesmos income/netResult sem nenhuma checagem. Em dashboard/page.tsx (linhas 124-130) os valores sao calculados e passados ao DashboardView para todos os papeis. O grafico 'Receita — 7 dias' segue o mesmo padrao. Os presets de 'doctor' e 'receptionist' nao contem 'financial:view' e o ROLE_META descreve ambos como 'Sem acesso financeiro'.

**Como reproduzir:** Logar como 'doctor' ou 'receptionist' e abrir o Dashboard: a linha de KPIs mostra o faturamento do mes e o resultado liquido da clinica, embora o card 'Financeiro do Mes' logo abaixo esteja corretamente oculto.

**Correção proposta:**

```
Condicionar os dois KpiCard (e o grafico de receita) a hasFinancialPermission, e em dashboard/page.tsx so calcular/enviar income, expenses e netResult quando hasPermission(role,'financial:view') for verdadeiro.
```

### M11. Excluir lote de material nao pede confirmacao e recalcula o estoque para baixo

**Arquivo:** `src/components/materiais/EditMaterialDialog.tsx:185` — módulo *telas-botoes*

**Defeito:** Confirmado. removeBatch (linha 185) dispara DELETE direto, sem confirm(), e o botao de lixeira (linha 341) fica colado ao de editar na mesma linha do lote. A rota DELETE /api/materiais/[id]/batches/[batchId] apaga o registro e chama recomputeStockFromBatches(id), derrubando o estoque atual do material na hora. Nao ha undo nem toast de sucesso. A inconsistencia e evidente no mesmo arquivo: deleteMaterial (linha 147) usa confirm(). Rebaixei de high para medium — acao destrutiva sem confirmacao, mas restrita a quem ja tem materials:edit e reversivel recadastrando o lote.

**Como reproduzir:** Abrir Materiais, clicar numa linha da tabela, e na secao 'Lotes e Validades' clicar na lixeira ao lado de um lote (icone colado ao de editar). O lote e apagado na hora e o estoque do material e recalculado para baixo, sem aviso e sem feedback visivel.

**Correção proposta:**

```
Envolver removeBatch numa confirmacao no padrao de deleteMaterial: if (!confirm(`Excluir o lote ${b.batchNumber || 'sem número'}? O estoque será recalculado.`)) return. Adicionar toast.success apos o sucesso.
```

### M12. Excluir pedido de compra em rascunho sem confirmacao

**Arquivo:** `src/app/(dashboard)/materiais/page.tsx:647` — módulo *telas-botoes*

**Defeito:** Confirmado: o botao 'Excluir' (linha 647) chama handleDelete(order) (linha 189), que faz DELETE /api/compras/{id} imediatamente, sem confirm() e sem dialogo, enquanto a acao 'Cancelar' de um pedido ja enviado abre um dialogo dedicado (setCancelDialog(order)). Correcao ao relato do auditor: 'Excluir' e 'Cancelar' NAO ficam lado a lado — pertencem a blocos de status diferentes ('draft' vs 'ordered'); 'Excluir' fica ao lado de 'Editar' e 'Enviar Pedido'. Rebaixei para medium: e um rascunho, sem impacto em estoque, mas apaga itens e valores sem qualquer pergunta.

**Como reproduzir:** Na aba Compras, num pedido com status 'Rascunho', clicar em 'Excluir' (vizinho de 'Enviar Pedido'). O pedido e apagado do banco na hora, com todos os itens e valores, sem confirmacao e sem desfazer.

**Correção proposta:**

```
Reaproveitar o padrao existente: criar um estado deleteDialog (como cancelDialog) com Dialog de confirmacao, ou no minimo adicionar if (!confirm(`Excluir o rascunho de compra de "${order.supplier}"? Esta ação não pode ser desfeita.`)) return no inicio de handleDelete.
```

### M13. Conclusão do tratamento sem transação: falha ou clique duplo duplica parcelas e crédito no saldo

**Arquivo:** `src/app/api/tratamentos/[id]/route.ts:203` — módulo *financeiro*

**Defeito:** O bloco de conclusão executa sem db.transaction(): baixa de estoque (linhas 124-157), insert das parcelas (linha 203), crédito no saldo bancário (206-211) e só depois o UPDATE que grava status='completed' (linha 224). A guarda de idempotência é `d.status === 'completed' && existing.status !== 'completed'` (linha 118), que só passa a valer depois do UPDATE final. Com o driver serverless cada chamada é um round-trip separado: se a função expirar ou o UPDATE falhar, o tratamento continua não-concluído mas as parcelas já existem e o saldo já foi creditado; o usuário vê 'Erro ao concluir tratamento' (tratamentos/page.tsx:1071) e reenvia, duplicando tudo. Não há índice único em (treatment_id, installment_number) para barrar a duplicidade.

**Como reproduzir:** 1) Conclua um tratamento de R$ 8.000 em 4x com '1ª Paga'. 2) A requisição falha após o insert das parcelas (timeout da função, erro de rede do Neon no UPDATE final). 3) O usuário vê 'Erro ao concluir tratamento' e clica de novo em 'Concluir e Faturar'. 4) Passam a existir 8 parcelas (R$ 16.000 a receber), o estoque foi baixado duas vezes e o saldo da conta recebeu duas vezes o valor da 1ª parcela.

**Correção proposta:**

```
Envolver todo o bloco de conclusão em db.transaction(async (tx) => { ... }) incluindo o UPDATE de status, ou gravar status='completed' condicionalmente no início (UPDATE ... WHERE status <> 'completed' RETURNING) e só prosseguir se retornou linha. Complementar com índice único em transactions(treatment_id, installment_number).
```

### M14. DRE subtrai o custo do material duas vezes (compra + consumo)

**Arquivo:** `src/app/api/relatorios/dre/route.ts:88` — módulo *financeiro*

**Defeito:** O resultado operacional é receitaBruta - custoMateriais - despesasTotal. `custoMateriais` (linha 88) soma treatments.totalCost dos tratamentos concluídos — o custo dos materiais consumidos. `despesasTotal` (linha 91) soma todas as despesas pagas agrupadas por categoria, incluindo a categoria 'materials', que é exatamente a despesa lançada automaticamente ao receber um pedido de compra (compras/[id]/route.ts, action 'receive': `type: 'expense', category: 'materials', amount: order.totalAmount, isPaid: true`). O mesmo material é abatido duas vezes do resultado.

**Como reproduzir:** 1) Receba um pedido de compra de R$ 10.000 em materiais no mês — gera despesa paga de categoria 'materials'. 2) Use esses materiais em tratamentos concluídos no mesmo mês, cujo totalCost soma R$ 10.000. 3) Abra Relatórios > DRE do mês: os R$ 10.000 aparecem em '(-) Custo de Materiais' (margemBruta) E dentro de despesasTotal. O Resultado Operacional sai R$ 10.000 menor que o real.

**Correção proposta:**

```
Escolher um regime: ou excluir a categoria 'materials' do agrupamento de despesas do DRE (competência — custo reconhecido no consumo, via `ne(transactions.category, 'materials')` na query das despesas), ou zerar custoMateriais e manter só a despesa de compra (caixa). Deixar explícito na tela qual regime foi adotado.
```

### M15. Dashboard conta parcelas não recebidas como faturamento e resultado do mês

**Arquivo:** `src/app/(dashboard)/dashboard/page.tsx:58` — módulo *financeiro*

**Defeito:** As somas de receita (linhas 56-61) e de despesa (63-68) filtram só por type e período, sem `eq(transactions.isPaid, true)`. Como todas as parcelas de um tratamento são criadas com `date` = data da conclusão (tratamentos/[id]/route.ts:188 `date: fmt(today)`, variando apenas dueDate), o valor integral do tratamento entra em 'Faturamento' e em 'Resultado líquido' no mês da conclusão mesmo sem nada recebido, e a barra de progresso da meta (revenueGoal, linha 126) é batida com dinheiro que não entrou. O mesmo vale para o gráfico 'Receita — 7 dias' (linhas 84-94) e para src/app/api/dashboard/route.ts:61-75. Note a incoerência: o DRE filtra isPaid=true (dre/route.ts:62 e 77) e o dashboard não.

**Como reproduzir:** 1) Conclua um tratamento de R$ 20.000 em 10x com status de pagamento 'Todas Pendentes'. 2) Abra o Dashboard: 'Faturamento' do mês mostra +R$ 20.000 e 'Resultado líquido' idem, embora o caixa não tenha recebido nada. 3) Com meta de R$ 25.000, a barra aparece 80% cumprida.

**Correção proposta:**

```
Adicionar `eq(transactions.isPaid, true)` às somas de receita e despesa do dashboard (page.tsx:56-68 e api/dashboard/route.ts) e, se o valor futuro for desejado, exibi-lo em um card separado 'A receber'. Alternativamente usar dueDate como competência em vez de date.
```

### M16. Vencimento das parcelas pula mês quando a conclusão cai no dia 29-31

**Arquivo:** `src/app/api/tratamentos/[id]/route.ts:178` — módulo *financeiro*

**Defeito:** O vencimento é `new Date(today.getFullYear(), today.getMonth() + i, today.getDate())`. Em JavaScript o dia 31 somado a um mês de 30 dias (ou a fevereiro) transborda para o mês seguinte. Conclusões nos dias 29, 30 e 31 geram parcelas com vencimento fora do mês esperado — um mês fica sem parcela e outro com duas. O mesmo cálculo está no preview mostrado ao usuário (tratamentos/page.tsx:1091), então a tela confirma a data errada antes de gravar.

**Como reproduzir:** 1) Em 31/01, conclua um tratamento em 3x. 2) Parcela 1 vence 31/01; parcela 2 vira new Date(2026, 1, 31) = 03/03; parcela 3 vira new Date(2026, 2, 31) = 31/03. 3) Fevereiro fica sem parcela e março recebe duas — o fluxo de caixa projetado e a cobrança do paciente saem errados.

**Correção proposta:**

```
Fixar o dia no último dia válido do mês alvo: `const last = new Date(ano, mes + i + 1, 0).getDate(); const due = new Date(ano, mes + i, Math.min(diaOriginal, last))`. Extrair para um utilitário compartilhado e usar o mesmo no preview do cliente (tratamentos/page.tsx:1091) para não divergir.
```

### M17. KPIs de Tratamentos somam apenas os 50 registros carregados

**Arquivo:** `src/app/(dashboard)/tratamentos/page.tsx:1319` — módulo *financeiro*

**Defeito:** A tela busca /api/tratamentos sem parâmetro de limite (page.tsx:1287) e a rota aplica default 50 com teto de 100 (tratamentos/route.ts:51 `Math.min(Number(url.searchParams.get('limit') ?? '50'), 100)`), ordenando por createdAt desc. Os KPIs 'Total', 'Em andamento', 'Concluídos' e 'Receita total' são calculados no cliente sobre esse array (linhas 1315-1320). A partir do 51º tratamento os números ficam errados sem nenhum indicativo na tela.

**Como reproduzir:** 1) Cadastre 60 tratamentos, sendo 30 concluídos somando R$ 300.000. 2) Abra /tratamentos: só os 50 mais recentes vêm, parte dos concluídos fica de fora e 'Receita total' mostra menos que os R$ 300.000 reais. 3) Cadastrar um tratamento novo empurra um concluído antigo para fora da janela e a 'Receita total' cai sozinha.

**Correção proposta:**

```
Devolver contadores/somatórios agregados pelo servidor (COUNT/SUM por status, sem limit) em um campo `stats` da resposta de /api/tratamentos e usar esse campo nos KPIs, mantendo o limit apenas para os cards do kanban.
```

### M18. API aceita endAt anterior ao startAt (agendamento com duracao negativa)

**Arquivo:** `src/app/api/agenda/route.ts:20` — módulo *agenda-pacientes*

**Defeito:** O `createSchema` valida apenas `startAt: z.string().datetime()` e `endAt: z.string().datetime()` (linhas 20-21), sem `.refine()` comparando os dois; o `updateSchema` do PATCH tem o mesmo problema (src/app/api/agenda/[id]/route.ts:17-18). O único guard está no front e só no caminho de redimensionar por arrasto (page.tsx:187-190). No formulário, o campo 'Fim' é um input livre (page.tsx:1272) e o useEffect que recalcula o término só dispara quando `startAt` ou `duration` mudam (page.tsx:978-988) — editar só o campo de término envia o valor invertido. O `submit` (page.tsx:991) só verifica se os campos estão preenchidos.

**Como reproduzir:** 1) Abrir 'Novo Agendamento', escolher início 14h00 (fim preenchido automaticamente como 15h00). 2) Alterar apenas o campo 'Fim' para 13h00 e salvar. 3) A API grava startAt 14h e endAt 13h. 4) Em `calculateAptPosition` (page.tsx:245-247) o durationMins fica negativo e o card é renderizado com a altura mínima de 35px, no lugar errado, e passa a 'sobrepor' outros cards no cálculo de largura. 5) O evento é rejeitado pelo Google Agenda (end antes de start) e `syncAppointment` engole o erro, então nunca aparece na agenda do médico.

**Correção proposta:**

```
Adicionar refine no createSchema: `.refine(d => new Date(d.endAt) > new Date(d.startAt), { message: 'O término deve ser posterior ao início', path: ['endAt'] })`. No PATCH, como os campos são opcionais, carregar o registro atual e comparar o startAt/endAt resultantes (mesclando body + banco) antes de aplicar o update.
```

### M19. DELETE de agendamento apaga o financeiro antes de falhar por FK e deixa dado inconsistente

**Arquivo:** `src/app/api/agenda/[id]/route.ts:232` — módulo *agenda-pacientes*

**Defeito:** O DELETE apaga as transações (linha 232) e só depois tenta `db.delete(appointments)` (linha 235), fora de transação de banco e sem try/catch. Confirmei na migração que `clinical_records.appointment_id` (0000_past_nehzno.sql:350), `exam_orders.appointment_id` (353) e `treatments.appointment_id` (368) referenciam appointments com `ON DELETE no action`. E o fluxo 'Finalizar Consulta' cria justamente esses vínculos: prontuário com `appointmentId: appointment.id` (page.tsx:1439) e tratamento com `appointmentId: appointment.id` (page.tsx:1455). Logo o delete final lança violação de FK sem tratamento (500 genérico), mas as transações já foram removidas, o evento do Google já foi apagado (linha 228) e o log de auditoria de exclusão já foi gravado (linhas 208-224).

**Como reproduzir:** 1) Finalizar uma consulta gravando evolução no prontuário e gerando cobrança. 2) Tentar excluir esse agendamento pela Agenda, informando o motivo. 3) O backend grava o log de exclusão, remove o evento do Google Agenda, apaga a cobrança do financeiro e então estoura a FK de clinical_records. 4) A tela mostra erro; o agendamento continua existindo, mas o lançamento financeiro sumiu e o evento no Google também.

**Correção proposta:**

```
Checar os vínculos (clinicalRecords, examOrders, treatments) antes e devolver 409 com mensagem clara, no mesmo padrão do DELETE de pacientes. Envolver o delete das transações e do agendamento em `db.transaction(async (tx) => { ... })` e mover `removeAppointment` e `logActivity` para depois do commit.
```

### M20. Sincronizacao com Google Agenda falha em silencio e o agendamento fica preso a um googleEventId inexistente

**Arquivo:** `src/lib/google/calendar.ts:214` — módulo *agenda-pacientes*

**Defeito:** `syncAppointment` (linha 205) envolve tudo em try/catch e devolve `null` em qualquer erro (linhas 219-222). Os chamadores só agem quando o retorno é truthy: src/app/api/agenda/route.ts:167 (`if (eventId && eventId !== apt.googleEventId)`) e src/app/api/agenda/[id]/route.ts:120. Em caso de falha nada é gravado e nada é comunicado — o POST devolve 201 e o PATCH 200 normalmente. No ramo de update (linha 214), se o evento foi apagado direto no Google, a API responde 404, o erro é engolido e o `googleEventId` obsoleto permanece no registro; toda sincronização futura vai tentar dar update no mesmo id inexistente e falhar de novo, sem nunca recriar o evento.

**Como reproduzir:** 1) Criar agendamento para o Dr. Silva; o evento é criado e o googleEventId salvo. 2) O médico apaga o evento pelo app do Google Agenda. 3) A recepcionista reagenda o horário na grade (PATCH). 4) events.update responde 404, syncAppointment devolve null, o googleEventId antigo continua no banco e a tela mostra 'Agendamento movido!' com sucesso. 5) O compromisso nunca mais aparece no celular do médico e nenhuma edição posterior recria o evento.

**Correção proposta:**

```
Tratar 404/410 no ramo de update, recriando o evento: capturar o status do erro e, se for 404 ou 410, chamar `calendar.events.insert` e retornar o novo id. Além disso, devolver um resultado tipado (ex.: `{ eventId, erro }`) para que a rota possa incluir um aviso na resposta ('agendamento salvo, mas não sincronizou com o Google Agenda').
```

### M21. Recebimento de compra credita estoque mas nao recalcula o status

**Arquivo:** `src/app/api/compras/[id]/route.ts:135` — módulo *leads-estoque*

**Defeito:** CONFIRMADO. O update do material no recebimento (linhas 135-140) grava `currentStock`, `unitCost`, `supplier` e `updatedAt`, mas não recalcula `materials.status` — ao contrário de POST /api/materiais e da rota de movimentação (movement/route.ts:44,55). Como GET /api/materiais devolve o status persistido (materiais/route.ts:41-49) e a tela inteira lê status (page.tsx:117-122 nos KPIs, linha 404 no badge, linha 122 no aviso de reposição, SuggestedPurchaseListDrawer.tsx:32 no filtro), o material recebido continua sinalizado como faltando. Severidade rebaixada de high para medium: gera alarme falso e recompra desnecessária, mas o saldo numérico exibido na coluna "Estoque" fica correto.

**Como reproduzir:** 1) Material zera → status 'out_of_stock'. 2) Pedido de compra de 50 unidades é recebido. 3) O saldo passa para 50 e a despesa é lançada, mas o KPI "Críticos" continua contando o item, o badge vermelho permanece e ele segue na Lista de Compras Sugerida — a equipe compra de novo um item que já chegou.

**Correção proposta:**

```
Recalcular o status no mesmo update: `const novoSaldo = mat.currentStock + item.quantity; await db.update(materials).set({ currentStock: novoSaldo, status: computeStockStatus(novoSaldo, mat.minimumStock), unitCost: item.unitCost, supplier: order.supplier, updatedAt: new Date() })`, importando `computeStockStatus` de '@/lib/utils'.
```

### M22. Kanban devolve o card para a coluna antiga apos mover com sucesso

**Arquivo:** `src/components/leads/KanbanBoard.tsx:38` — módulo *leads-estoque*

**Defeito:** CONFIRMADO. O efeito das linhas 37-39 ressincroniza o estado local sempre que a identidade de `initialLeads` muda. Confirmei em src/app/(dashboard)/leads/page.tsx:38-41 que `filteredLeads` é recalculado com `.filter()` no corpo do componente (sem useMemo), portanto é um array NOVO a cada render do pai, e é ele que vai em `initialLeads` (linha 97). O `handleDragEnd` faz update otimista e, no sucesso, só exibe o toast (linha 100) — não chama `onRefresh()`, então o estado `leads` do pai continua com o status antigo. Severidade rebaixada de high para medium: o PATCH grava corretamente, o dano é de UI/confiança, sem perda de dado.

**Como reproduzir:** 1) Arraste um lead de "Novo" para "Em Atendimento": o card muda de coluna e aparece "Etapa atualizada!". 2) Sem recarregar, clique em "Novo Lead" (setNewDialogOpen re-renderiza o pai sem refetch) ou troque o filtro "Todas as Tags". 3) `filteredLeads` vira um array novo, o efeito dispara e o board é reconstruído com o status antigo — o card pula de volta para "Novo". O usuário acha que o arraste falhou e move de novo.

**Correção proposta:**

```
Chamar `onRefresh()` após o PATCH bem-sucedido em `handleDragEnd` e/ou memoizar a lista no pai: `const filteredLeads = useMemo(() => leads.filter(...), [leads, selectedTag])`, para que a identidade da prop só mude quando os dados mudarem de fato.
```

### M23. Conclusão de tratamento sem transação de banco permite baixa dupla de estoque

**Arquivo:** `src/app/api/tratamentos/[id]/route.ts:128` — módulo *erros-silenciosos*

**Defeito:** Confirmado. Todo o bloco de conclusão (linhas 118-221) roda fora de `db.transaction` e sem try/catch: baixa atômica de estoque (linha 128-130), inserção dos `stockMovements` (linha 149), inserção das parcelas em `transactions` (linha 203), crédito no `bankAccounts` (linha 208) e só então, na linha 224, o `db.update(treatments)` que grava `status='completed'`. Se qualquer passo posterior à baixa falhar, a rota devolve 500 com o tratamento ainda no status antigo, e a guarda `existing.status !== 'completed'` (linha 118) volta a ser verdadeira. O diálogo do front só fecha em caso de sucesso (`onClose()` dentro do try, src/app/(dashboard)/tratamentos/page.tsx:1071-1073), então o usuário fica na mesma tela pronto para clicar de novo.

**Como reproduzir:** Usuário conclui um tratamento com 3 seringas e escolhe a conta de recebimento. O estoque cai 3 e os stockMovements são gravados. O `db.insert(transactions)` falha (bankAccountId desativada/removida em outra aba, violação de FK, ou queda de conexão do Neon). A rota retorna 500, o diálogo mostra 'Erro ao concluir tratamento' e permanece aberto. O usuário clica em concluir novamente: o estoque cai mais 3 unidades e um segundo conjunto de stockMovements é gravado. O saldo de material fica errado e o alerta de estoque baixo dispara indevidamente.

**Correção proposta:**

```
Envolver o bloco de conclusão em `await db.transaction(async (tx) => { ... })`, usando `tx` para materials, stockMovements, transactions, bankAccounts e o update de treatments, deixando notify/WhatsApp fora da transação. Alternativamente, gravar `status='completed'` como primeiro passo para tornar a operação idempotente.
```

### M24. Recebimento de compra sem transação pode creditar o estoque duas vezes

**Arquivo:** `src/app/api/compras/[id]/route.ts:144` — módulo *erros-silenciosos*

**Defeito:** Confirmado. Na ação `receive` o loop credita `materials.currentStock` e grava os `stockMovements` (linhas 124-141) ANTES do `db.insert(transactions)` (linha 144) e do `db.update(purchaseOrders)` que grava `status:'received'` (linhas 156-161). Nada disso roda em `db.transaction` e a rota não tem try/catch. Se a inserção da despesa falhar, o pedido continua com `status='ordered'`, o que satisfaz de novo a guarda da linha 118 (`order.status !== 'ordered' && order.status !== 'draft'`), liberando a repetição da operação e um segundo crédito de estoque.

**Como reproduzir:** O responsável registra o recebimento de um pedido com 50 seringas. O estoque sobe +50 e os movimentos de entrada são gravados. O `db.insert(transactions)` falha (por exemplo, indisponibilidade momentânea do banco ou `order.totalAmount` fora do formato numérico aceito) e a rota devolve 500. A tela mostra 'Erro ao registrar recebimento' e o pedido segue como 'enviado'. O usuário clica em receber de novo: o estoque sobe mais 50 unidades, ficando com 100 seringas que nunca chegaram, e o relatório de consumo/compra sugerida passa a mentir.

**Correção proposta:**

```
Envolver todo o bloco `receive` em `await db.transaction(async (tx) => { ... })`, usando `tx` para stockMovements, materials, transactions e o update de purchaseOrders. Como reforço de idempotência, retornar 409 logo no início quando `order.transactionId` já estiver preenchido.
```

### M25. Catch vazio faz o drawer exibir as interações do lead anterior

**Arquivo:** `src/components/leads/KanbanBoard.tsx:138` — módulo *erros-silenciosos*

**Defeito:** Confirmado. `handleLeadClick` (linhas 129-139) abre o drawer antes de buscar os dados, aplica `setInteractions` só dentro do `if (res.ok)` e engole qualquer erro no `catch {}` da linha 138. O estado `interactions` (linha 28) nunca é reinicializado ao trocar de lead, e é passado direto para o `LeadDrawer` (linha ~168), que renderiza a timeline a partir dele (LeadDrawer.tsx:409-425). Numa resposta não-2xx (401 de sessão expirada, 403, 500) ou falha de rede, o drawer segue mostrando o histórico do lead aberto anteriormente sob o nome do lead novo, sem qualquer indicação de erro. Severidade rebaixada de high para medium: depende de uma requisição falhar e não corrompe dados no banco.

**Como reproduzir:** Usuário abre o lead 'Maria Silva' e vê as 4 anotações dela. Fecha e clica no lead 'João Souza'. O GET /api/leads/{id} falha (rede, 500 ou 401 por sessão expirada). O catch vazio engole o erro e `interactions` permanece com o conteúdo de Maria. O drawer mostra nome, telefone e status de João com o histórico de contatos de Maria, e a equipe toma decisões comerciais sobre o lead errado.

**Correção proposta:**

```
Chamar `setInteractions([])` logo após `setSelectedLead(lead)`, tratar o caminho `!res.ok` e o `catch` com `toast.error('Não foi possível carregar o histórico deste lead')`, e comparar o id do lead da resposta com o `selectedLead` atual antes de aplicar o `setInteractions` (guard de corrida).
```

### M26. Remoção e definição de conta bancária mostram sucesso sem checar a resposta

**Arquivo:** `src/app/(dashboard)/configuracoes/contas/page.tsx:77` — módulo *erros-silenciosos*

**Defeito:** Confirmado. `setDefault` (linhas 67-75) e `remove` (linhas 77-85) fazem `await fetch(...)` descartando o retorno, sem `res.ok` e sem try/catch, e em seguida já mutam o estado local e disparam `toast.success('Conta padrão definida')` / `toast.success('Conta removida')`. Qualquer 401 (sessão expirada), 403 (sem permissão), 400 ou 500 é apresentado como sucesso. O contraste está na mesma tela: `save()` (linha 58) faz `if (!res.ok) throw new Error()`. Severidade rebaixada de high para medium: a divergência é corrigida ao recarregar a página e não há perda de dados.

**Como reproduzir:** O usuário deixa a tela de Contas aberta e a sessão expira (ou o perfil não tem permissão financeira). Ele clica em remover uma conta bancária. A API responde 401/403 e nada muda no banco. A linha some da lista e aparece 'Conta removida'. Ao recarregar a página — ou em outro computador — a conta continua lá, ainda somando no 'Saldo Total' e ainda selecionável nas telas de recebimento.

**Correção proposta:**

```
Replicar o padrão de `save()`: `const res = await fetch(...); if (!res.ok) { toast.error('Não foi possível remover a conta'); return }` antes de mexer no estado, idem em `setDefault`. Envolver ambas em try/catch para falha de rede e, no erro, recarregar a lista do servidor.
```

### M27. Webhook: exclusão e ativação confirmam sucesso sem verificar res.ok

**Arquivo:** `src/app/(dashboard)/configuracoes/webhooks/page.tsx:86` — módulo *erros-silenciosos*

**Defeito:** Confirmado. `toggleActive` (linhas 86-89) e `remove` (linhas 91-95) descartam o retorno do fetch, não checam `res.ok` e não têm try/catch, mas já atualizam a lista local — e `remove` ainda exibe `toast.success('Webhook removido')`. Falhas de permissão, validação ou rede passam como sucesso, ao contrário de `create()` (linha 78), que faz `if (!res.ok) throw new Error()`.

**Como reproduzir:** O administrador desativa um webhook que está disparando notificações indevidas para um sistema externo. O PATCH falha (500 ou 401 por sessão expirada). O switch muda visualmente para 'inativo' e nenhuma mensagem de erro aparece. O webhook continua ativo no servidor e segue enviando eventos de leads/agenda para o endpoint de terceiros enquanto a tela mostra que está desligado.

**Correção proposta:**

```
Capturar o retorno e validar antes de tocar no estado: `const res = await fetch(...); if (!res.ok) { toast.error('Erro ao atualizar o webhook'); return }` em `toggleActive` e `remove`. Envolver em try/catch para falha de rede e, no caminho de erro, refazer o GET de /api/configuracoes/webhooks para ressincronizar a lista.
```

### M28. Falha em qualquer aba do prontuário faz a tela dizer 'Paciente não encontrado'

**Arquivo:** `src/app/(dashboard)/pacientes/[id]/page.tsx:565` — módulo *erros-silenciosos*

**Defeito:** Confirmado. `loadAll` (linhas 547-566) roda um `Promise.all` com sete requisições; as quatro primeiras (/api/pacientes/{id}, /api/agenda, /api/tratamentos, /api/exames) não têm `.catch` individual — só as três últimas têm `.catch(() => ({ data: [] }))` — e o `Promise.all` inteiro termina em `.catch(() => {})` na linha 565. Basta uma delas rejeitar (erro de rede, ou 500 sem corpo JSON fazendo `r.json()` estourar) para que nenhum `setState` do bloco `.then` execute: `patient` continua `null` e a linha 600 renderiza 'Paciente não encontrado', mesmo com o GET do paciente tendo respondido corretamente.

**Como reproduzir:** A médica abre a ficha de um paciente antes do atendimento. A rota /api/exames?patientId=... falha (erro de banco, 500 sem corpo JSON) enquanto todas as outras respondem normalmente. O Promise.all rejeita, o `.catch(() => {})` engole o erro e o `finally` só desliga o loading. A tela exibe 'Paciente não encontrado'. A equipe conclui que o cadastro foi apagado, abre chamado ou recadastra o paciente em duplicidade.

**Correção proposta:**

```
Isolar cada requisição com seu próprio fallback, como já é feito nas linhas 554-556, ou usar `Promise.allSettled` aplicando cada resultado bem-sucedido individualmente. Quando só o GET /api/pacientes/{id} falhar, mostrar mensagem distinta ('Erro ao carregar o paciente. Tente novamente.') com botão de recarregar, reservando 'Paciente não encontrado' para o 404 real.
```

### M29. Finalizar consulta grava 'sucesso' mesmo com cobrança ou prontuário perdidos

**Arquivo:** `src/app/(dashboard)/agenda/page.tsx:1476` — módulo *erros-silenciosos*

**Defeito:** Confirmado. No `submit()` do diálogo de finalização, as falhas dos passos 3, 4 e 5 só exibem toast de erro e o fluxo continua: `if (!transRes.ok) toast.error('Falha ao registrar cobrança no financeiro')` (linha 1429), `if (!recordRes.ok) toast.error('Falha ao registrar anotação no prontuário')` (linha 1445) e `if (!treatRes.ok) toast.error('Falha ao registrar plano de tratamento')` (linha 1473). Logo depois, a linha 1476 dispara `toast.success('Consulta finalizada com sucesso!')`, fecha o diálogo com `onOpenChange(false)` e chama `onCompleted()`. Como o passo 2 já marcou o agendamento como 'attended', os dados digitados (valor da cobrança, evolução clínica, plano de tratamento) somem junto com o diálogo, sem caminho de nova tentativa.

**Como reproduzir:** A médica finaliza a consulta preenchendo a evolução clínica e marcando 'gerar cobrança' de R$ 400. O POST /api/prontuario falha (500 ou 403). Aparece o toast 'Falha ao registrar anotação no prontuário', seguido do toast verde 'Consulta finalizada com sucesso!'. O diálogo fecha e a agenda recarrega. O agendamento consta como 'Compareceu', mas a evolução clínica digitada foi perdida definitivamente e não há como repetir a operação pelo mesmo diálogo.

**Correção proposta:**

```
Acumular as falhas (`const falhas: string[] = []`) e só exibir o toast de sucesso e fechar o diálogo se `falhas.length === 0`; havendo falhas, manter o diálogo aberto com os campos preenchidos e um resumo do que não foi gravado, permitindo reenviar só as etapas que falharam. Alternativa mais robusta: um único endpoint transacional POST /api/agenda/{id}/finalizar.
```

## BAIXO (13)

### B1. POST de prontuario checa patients:view_clinical em vez de patients:create_clinical

**Arquivo:** `src/app/api/prontuario/route.ts:53` — módulo *rotas-auth*

**Defeito:** O POST que grava evolucao clinica valida hasPermission(role, 'patients:view_clinical') na linha 53 — exatamente a mesma permissao de leitura usada no GET (linha 21). A permissao de escrita patients:create_clinical esta declarada em src/lib/permissions.ts:77 ('Editar prontuario clinico', sensitive) e nao e verificada em nenhum ponto do codigo. Severidade rebaixada de medium para low porque hoje o cenario ainda nao e alcancavel: nos ROLE_PRESETS nenhum papel tem view_clinical sem create_clinical, e o unico caminho para essa combinacao (customPermissions) esta quebrado — este defeito passa a valer assim que o achado de customPermissions for corrigido.

**Como reproduzir:** Depois de corrigido o defeito de customPermissions, um perfil configurado apenas para consultar prontuario (patients:view_clinical marcado, patients:create_clinical desmarcado) faz POST /api/prontuario com {patientId, type:'evolucao', content:'...'} e grava registro clinico no historico do paciente mesmo assim — a permissao de escrita que o admin deixou desmarcada nunca e consultada.

**Correção proposta:**

```
Trocar a verificacao do POST (linha 53) para hasPermission(session.user.role as UserRole, 'patients:create_clinical').
```

### B2. Open redirect via parametro redirect em /api/admin/google/connect

**Arquivo:** `src/app/api/admin/google/connect/route.ts:17` — módulo *rotas-auth*

**Defeito:** O parametro redirect e lido da query (linha 13) e interpolado direto em new URL(`${errorRedirect}?google=sem_credenciais`, origin) na linha 16-18, sem validar que e caminho interno. Como new URL() com string absoluta ignora a base, um valor como https://site-falso.com produz redirecionamento externo. A rota irma src/app/admin/google/callback aplica a protecao correta (/^\/(?!\/)/.test(rawState)) com comentario explicando exatamente esse risco; a mesma protecao nao foi aplicada aqui. Impacto limitado porque a rota exige sessao (linhas 9-12) e o ramo so e alcancado quando googleConfigurado() e false.

**Como reproduzir:** Enquanto as credenciais do Google nao estao configuradas, um atacante envia a um funcionario logado o link https://<sistema>/api/admin/google/connect?redirect=https://portal-falso.com. O funcionario clica, o sistema responde com redirect e o navegador abre o site falso a partir de um dominio confiavel — phishing de credenciais com origem legitima.

**Correção proposta:**

```
Reaplicar a validacao do callback antes de montar o destino: const safeRedirect = redirectParam && /^\/(?!\/)/.test(redirectParam) ? redirectParam : '/trafego'; usar safeRedirect no ramo de erro (linha 17) e tambem na chamada a gerarUrlConsentimento (linha 20).
```

### B3. Aba DRE/Balancete aberta para quem nao tem reports:balancete quebra com 'Erro ao carregar'

**Arquivo:** `src/app/(dashboard)/relatorios/page.tsx:247` — módulo *telas-botoes*

**Defeito:** Confirmado: a aba 'DRE / Balancete' esta no array de TabsTrigger renderizado incondicionalmente e o conteudo monta <DRETab /> (linha 358). O DRETab faz fetch('/api/relatorios/dre?...') com .catch(() => {}) e `if (d) setData(d)`; com 403 o corpo e { error: 'Acesso negado' }, data continua null e a UI cai no `if (!data) return <p ...>Erro ao carregar</p>`. GET /api/relatorios/dre (route.ts:12) exige 'reports:balancete', que so admin e financial tem, enquanto 'receptionist' tem 'reports:view' e acessa a pagina. Rebaixei de medium para low: nao ha perda de dado nem vazamento, apenas mensagem de erro enganosa.

**Como reproduzir:** Logar como 'receptionist', abrir Relatorios e clicar na aba 'DRE / Balancete': aparece 'Carregando DRE...' e depois 'Erro ao carregar' em vermelho, parecendo falha do sistema em vez de falta de permissao.

**Correção proposta:**

```
Esconder a aba quando !hasPermission(role,'reports:balancete') e, se ainda assim for aberta, tratar res.status === 403 exibindo 'Voce nao tem permissao para acessar o DRE/Balancete'.
```

### B4. Botao 'Cancelar' do agendamento nao pede confirmacao

**Arquivo:** `src/app/(dashboard)/agenda/page.tsx:704` — módulo *telas-botoes*

**Defeito:** Confirmado: no grid de 4 botoes do modal de detalhe, o item { label: 'Cancelar', status: 'cancelled' } cai no ramo else do onClick e chama updateStatus(selectedApt.id, btn.status) direto; updateStatus (linha 274) e um PATCH puro, sem confirmacao. E o unico botao destrutivo do grid, visualmente identico e vizinho de 'Faltou'. Em contraste, a exclusao logo abaixo abre dialogo dedicado com motivo. Severidade low mantida: o status pode ser corrigido depois pelos outros botoes do mesmo grid.

**Como reproduzir:** Abrir a Agenda, clicar num agendamento e, no grid de 4 botoes, clicar em 'Cancelar' (canto inferior direito, vizinho de 'Faltou'). O agendamento e cancelado imediatamente, sem 'tem certeza?', e o modal fecha.

**Correção proposta:**

```
Pedir confirmacao antes de aplicar o status 'cancelled' — reutilizar o dialogo existente pedindo o motivo, ou no minimo um confirm('Cancelar o agendamento de X?') antes de chamar updateStatus.
```

### B5. Falha ao carregar leads deixa o quadro vazio sem nenhuma mensagem

**Arquivo:** `src/app/(dashboard)/leads/page.tsx:16` — módulo *telas-botoes*

**Defeito:** Confirmado: fetchLeads usa try/finally sem catch e so aplica o estado dentro de `if (res.ok)`. Com 403 (papel sem leads:view, ex.: 'financial') ou 500, leads continua [] e loading vira false, e o KanbanBoard renderiza as 6 colunas zeradas como se a clinica nao tivesse leads. Em erro de rede a promise rejeitada fica sem tratamento. Nao ha estado de erro nem botao de tentar novamente.

**Como reproduzir:** Logar com um papel sem 'leads:view' (ex.: 'financial') e acessar /leads pela URL, ou perder a conexao durante o carregamento: aparece o quadro Kanban completo, todas as colunas zeradas, sem nenhum aviso de erro ou de falta de permissao.

**Correção proposta:**

```
Adicionar estado de erro: capturar !res.ok e um catch, diferenciando 403 de falha de rede, e renderizar um bloco de erro com botao 'Tentar novamente' no lugar do quadro.
```

### B6. DRE usa fronteira de mês em UTC para completedAt e perde o fim do último dia

**Arquivo:** `src/app/api/relatorios/dre/route.ts:23` — módulo *financeiro*

**Defeito:** startDate/endDate são construídos com `new Date(year, month - 1, 1)` / `new Date(year, month, 0, 23, 59, 59)`, ou seja, no fuso do servidor (UTC na Vercel), e comparados diretamente com treatments.completedAt (linhas 38-39), gravado com `new Date()` na conclusão. O restante do sistema calcula datas explicitamente em America/Sao_Paulo (clinicReport.ts:24-31, `const TZ = 'America/Sao_Paulo'` e `brDay`). Na janela das 21h às 24h (BRT) do último dia do mês, a conclusão já é dia 1º em UTC e cai no mês seguinte do DRE, enquanto as despesas são filtradas pela coluna `date` (linhas 63-64), preenchida com a data escolhida pelo usuário — receita e despesa ficam desalinhadas na virada do mês.

**Como reproduzir:** 1) Conclua um tratamento de R$ 12.000 em 31/01 às 21h30 (horário de Brasília) — completedAt fica 01/02 00:30 UTC. 2) Abra Relatórios > DRE com mês = Janeiro: a receita não aparece e o contador de tratamentos concluídos não conta esse tratamento. 3) Em Fevereiro os R$ 12.000 aparecem, inflando o mês errado.

**Correção proposta:**

```
Calcular os limites do período no fuso da clínica, como já é feito em clinicReport.ts, e converter para UTC antes de comparar com completedAt (gte/lte com os limites zonados), usando a mesma base de data para o filtro de despesas.
```

### B7. Data do lancamento financeiro sai um dia adiantada para lancamentos apos as 21h (UTC x America/Sao_Paulo)

**Arquivo:** `src/app/api/agenda/route.ts:154` — módulo *agenda-pacientes*

**Defeito:** `date: new Date().toISOString().split('T')[0]` (linha 153) e `dueDate: apt.startAt.toISOString().split('T')[0]` (linha 154) — repetidos no PATCH em src/app/api/agenda/[id]/route.ts:82-83 — convertem o instante para UTC antes de recortar a data. Com o servidor em UTC (padrão da Vercel) e a clínica em America/Sao_Paulo (UTC-3), qualquer instante a partir das 21h locais cai no dia seguinte em UTC. A coluna é `date` (sem hora), então o desvio fica gravado. Rebaixei a severidade porque a grade da agenda cobre 07h–19h (page.tsx:11), então o `dueDate` raramente é afetado; o impacto real é o campo `date` quando o lançamento é criado no fim do expediente, e o bug é invisível em desenvolvimento (máquina em BRT).

**Como reproduzir:** Uma consulta paga é registrada às 21h15 do horário de Brasília. A API grava `date` com a data do dia seguinte. No Financeiro e nos relatórios por data o lançamento aparece no dia errado, desalinhado com a agenda, e não há como corrigir na leitura porque a hora não foi preservada.

**Correção proposta:**

```
Formatar a data no fuso da clínica em vez de UTC. Criar um helper em src/lib/utils.ts — `export const toDateBR = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)` (devolve YYYY-MM-DD) — e usá-lo em todos os pontos que hoje fazem `toISOString().split('T')[0]` sobre um instante com hora.
```

### B8. Excluir o ultimo lote deixa estoque fantasma no material

**Arquivo:** `src/lib/materials-stock.ts:17` — módulo *leads-estoque*

**Defeito:** CONFIRMADO. `recomputeStockFromBatches` retorna cedo quando não há lotes (linha 17), preservando `currentStock` e `status` antigos. Isso protege materiais sem controle por lote, mas na rota DELETE de lote (materiais/[id]/batches/[batchId]/route.ts, `await recomputeStockFromBatches(id)` após o delete) o efeito é deixar no saldo a quantidade do lote apagado. Confirmei o comportamento da UI: em EditMaterialDialog o campo "Estoque atual" é `hasBatches ? batchTotal : currentStock` com `disabled={hasBatches}`, então ao sumir o último lote o campo volta a ficar editável já preenchido com o valor fantasma. Severidade rebaixada de medium para low: caso de borda (excluir o único lote) e corrigível manualmente pelo próprio diálogo.

**Como reproduzir:** 1) "Agulha 21G" com um único lote de 30 unidades → estoque 30. 2) No Editar Material, o usuário exclui o lote (vencido). 3) A lista de lotes fica vazia, mas banco e tela continuam mostrando 30 unidades e o status calculado sobre 30 — unidades que fisicamente não existem.

**Correção proposta:**

```
Diferenciar "nunca teve lotes" de "perdeu o último lote": na rota DELETE, se não restar nenhum lote, zerar explicitamente (`currentStock: 0`, `status: computeStockStatus(0, min)`), ou passar um parâmetro `forceZero` para `recomputeStockFromBatches` quando a chamada vier de uma exclusão.
```

### B9. Pedido de compra fica salvo sem itens quando o insert dos itens falha

**Arquivo:** `src/app/api/compras/route.ts:69` — módulo *leads-estoque*

**Defeito:** CONFIRMADO no mecanismo. O POST insere o cabeçalho com `totalAmount` já calculado (linhas 57-67) e só depois os itens (69-78), sem transação. Confirmei que `purchase_order_items.material_id` usa `onDelete: 'restrict'` (schema.ts:467), então a exclusão de um material referenciado no payload faz o insert dos itens estourar por FK, subindo como 500 com o cabeçalho já persistido. Confirmei também que a ação `receive` não valida `order.items.length`: com zero itens, o loop não credita nada mas a despesa do `order.totalAmount` é lançada como paga. Severidade rebaixada de medium para low: o gatilho exige exclusão concorrente de material (ou falha de banco) na janela entre os dois inserts.

**Como reproduzir:** 1) Usuário A monta um pedido de R$ 1.200 com 3 materiais no drawer. 2) Usuário B exclui um desses materiais na tela Materiais. 3) A salva: o cabeçalho é gravado, o insert dos itens viola a FK e a tela mostra "Erro ao salvar". 4) Ao recarregar, o pedido de R$ 1.200 aparece na lista vazio; se alguém clicar em Receber, nenhum estoque entra mas a despesa de R$ 1.200 é lançada como paga.

**Correção proposta:**

```
Agrupar cabeçalho e itens com `db.batch([...])` do driver neon-http, ou validar antes que todos os `materialId` existem. Complementarmente, na ação `receive` de src/app/api/compras/[id]/route.ts, rejeitar com 409 quando `order.items.length === 0`.
```

### B10. Card volta para a coluna anterior apos agendamento bem-sucedido

**Arquivo:** `src/components/leads/KanbanBoard.tsx:199` — módulo *leads-estoque*

**Defeito:** CONFIRMADO. Em ScheduleLeadDialog.tsx:204-205 o diálogo chama `onScheduled()` e logo em seguida `onOpenChange(false)`, ambos no mesmo tick. No pai (linha 198-200), `onOpenChange` executa `handleCancelSchedule()`, cujo closure ainda enxerga `leadToSchedule` e `previousStatus` preenchidos (os setState de `handleScheduleSuccess` só se aplicam no próximo render). O card é revertido para o status anterior. Normalmente o `onRefresh()` já disparado corrige quando a resposta chega, mas `fetchLeads` ignora respostas não-ok (leads/page.tsx:21-24, o `if (res.ok)` sem else), então numa falha de rede o card fica na coluna errada.

**Como reproduzir:** 1) Arraste um lead de "Novo" para "Agendado" e conclua o agendamento (toast de sucesso). 2) O card pisca de volta para "Novo" antes da recarga. 3) Se a recarga falhar (rede instável, sessão expirada, resposta não-ok), o card permanece em "Novo" mesmo com o lead já em 'scheduled' no banco.

**Correção proposta:**

```
Distinguir fechamento por sucesso de fechamento por cancelamento: usar `const scheduledOk = useRef(false)` marcado em `handleScheduleSuccess` e verificado em `handleCancelSchedule`, ou remover o `onOpenChange(false)` do diálogo após o sucesso (o pai já fecha). Tratar também a resposta não-ok em `fetchLeads` exibindo erro.
```

### B11. URL base de fallback aponta para o domínio de outro projeto

**Arquivo:** `src/lib/seo/notificar.ts:20` — módulo *erros-silenciosos*

**Defeito:** Confirmado. `getBaseUrl()` usa `const base = cfg || process.env.NEXT_PUBLIC_SITE_URL || 'https://twixeventos.vercel.app'`, resíduo de outro projeto, enquanto src/app/sitemap.ts:17 usa `(siteUrl ?? 'https://regenortho.com.br')`. `NEXT_PUBLIC_SITE_URL` não consta no .env.example (que traz apenas DATABASE_URL, NEXTAUTH_SECRET e NEXTAUTH_URL) e `configuracoes.site_url` nasce vazio numa instalação nova. Nesse estado, `enviarIndexNow` calcula `host = new URL(base).host` como twixeventos.vercel.app e `submeterSitemapGoogle` envia `feedpath: ${base}/sitemap.xml` para o domínio errado. Severidade rebaixada de medium para low: só se manifesta quando site_url e a env estão ambas vazias, e afeta apenas a notificação de buscadores.

**Como reproduzir:** Deploy novo (ou banco restaurado) com configuracoes.site_url ainda vazio e NEXT_PUBLIC_SITE_URL não definida. O administrador gera um verbete do glossário pela IA e notificarBuscadores é chamado. A URL montada é https://twixeventos.vercel.app/site/glossario/{slug} e o keyLocation do IndexNow também aponta para lá. O IndexNow recusa por não achar a chave no host informado e o Search Console recebe feedpath de outro domínio; o verbete nunca é submetido e a tela mostra só 'falha parcial'.

**Correção proposta:**

```
Alinhar o fallback com o do sitemap ('https://regenortho.com.br') e, de preferência, centralizar a resolução da URL base em um helper único compartilhado por sitemap.ts, (site)/layout.tsx e lib/seo/notificar.ts, registrando NEXT_PUBLIC_SITE_URL no .env.example.
```

### B12. Cópia do código/link do portal confirma sucesso sem aguardar a área de transferência

**Arquivo:** `src/app/(dashboard)/pacientes/[id]/page.tsx:483` — módulo *erros-silenciosos*

**Defeito:** Confirmado. Nos dois botões do card de acesso ao portal, `navigator.clipboard.writeText(...)` é chamado sem `await` e sem `.catch`, e o `toast.success` roda na mesma expressão, incondicionalmente (linha 483 para o código e linha 494 para o link). Como `writeText` devolve uma Promise que rejeita quando a permissão é negada ou o documento não está em foco, a falha vira unhandled rejection silenciosa e o usuário vê 'Código copiado!' mesmo sem nada ter ido para a área de transferência.

**Como reproduzir:** A recepcionista gera o link e o código de 6 dígitos do portal. Clica em copiar o código e o navegador bloqueia a escrita na área de transferência (permissão negada ou documento sem foco). Aparece 'Código copiado!'. Ela cola no WhatsApp do paciente o conteúdo antigo da área de transferência e envia. O paciente recebe um código inválido e não consegue entrar no portal.

**Correção proposta:**

```
Tornar o handler assíncrono e tratar a falha: `onClick={async () => { try { await navigator.clipboard.writeText(code); toast.success('Código copiado!') } catch { toast.error('Não foi possível copiar. Selecione e copie manualmente.') } }}`, nos dois botões (linhas 483 e 494).
```

### B13. Ativar/desativar forma de pagamento não valida a resposta da API

**Arquivo:** `src/app/(dashboard)/configuracoes/pagamentos/page.tsx:65` — módulo *erros-silenciosos*

**Defeito:** Confirmado. `toggleActive` (linhas 65-72) dispara o PATCH e inverte imediatamente o estado local, sem ler `res.ok` e sem try/catch. Não há toast de sucesso nem de erro: a UI apenas move o item entre as listas de ativas e inativas e atualiza o contador 'N formas ativas', dando a impressão de que a mudança persistiu. Na mesma tela, `save()` (linha 47-63) valida a resposta com `if (!res.ok) throw new Error()`. Severidade rebaixada de medium para low: a divergência se desfaz no próximo carregamento e não corrompe lançamentos existentes.

**Como reproduzir:** A clínica para de aceitar uma bandeira de cartão e o usuário desativa essa forma de pagamento em Configurações → Pagamentos. O PATCH falha (403 por falta de permissão de configurações, ou 500). O item some da lista de ativas e o contador diminui, sem aviso. A forma de pagamento continua ativa no banco e permanece disponível nos seletores de Agenda, Tratamentos e Financeiro.

**Correção proposta:**

```
Validar a resposta antes de atualizar o estado: `const res = await fetch(...); if (!res.ok) { toast.error('Não foi possível alterar o status'); return }`, envolver em try/catch para erro de rede e acrescentar um `toast.success`, alinhando com o comportamento de `save()`.
```
