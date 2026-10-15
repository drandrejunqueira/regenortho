# Auditoria visual e responsiva — RegenOrtho

Data: 06/09/2026. Responsável: Retina. Rodada somente de relatório; nenhum código alterado.

## Evidência medida primeiro

O [manifest](../../tests/visual/gallery/manifest.json), gerado em `2026-09-06T16:17:54.187Z`, registra **70 capturas, 10 rotas, 7 viewports, 0 ocorrências de overflow horizontal e 0 erros de console**. Não há falha acusada por esses dois indicadores nesse material. Escopo `public`, `authenticated: false`.

Foram examinadas as 70 capturas em pranchas por rota; os achados de detalhe abaixo foram conferidos em ampliações de agendamento, login e glossário. A triagem em prancha não equivale à leitura de cada texto das páginas longas. A prioridade de interação foi `/site/agendar`.

O servidor atual diverge da galeria: `/_next/static/css/app/layout.css` responde **HTTP 500, HTML**, deixando a folha com zero regras; `main-app.js`, `app-pages-internals.js`, `app/(site)/site/agendar/page.js` e `app/(site)/layout.js` também respondem **500**. As falhas de rede foram verificadas por leitura das respostas no próprio portal. Os buffers de logs consultados de Captacao Mobile e Vitrine estavam vazios; isso não elimina os HTTP 500.

| Viewport solicitado | Viewport retornado na medição | Overflow ao vivo (scrollWidth − innerWidth) |
|---|---|---:|
| 320×720 | 319×719 | 109px |
| 375×812 | 375×813 | 126px |
| 414×896 | 415×896 | 139px |
| 768×1024 | 767×1024 | 250px |
| 1024×768 | 1025×767 | 331px |
| 1440×900 | 1440×900 | 462px |
| 1920×1080 | 1919×1080 | 614px |

O resize do Maestri variou ±1px na sequência; uma leitura posterior confirmou 320×720 e 109px de overflow. Não apresentar esses tamanhos aproximados como sete medições exatas. O manifest usa `scrollWidth − clientWidth`, portanto a métrica ao vivo não é uma comparação pixel a pixel com a galeria.

Evidências preservadas: [sete estados ao vivo](evidencias-visual/live-all.jpg), [medições](evidencias-visual/live-measurements.json), [formulário após interação](evidencias-visual/live-form.png), [login na recaptura, em branco](evidencias-visual/live-login.png).

## Achados

### 01 — [CRITICO] /site/agendar @ 320, 375, 414, 768, 1024, 1440, 1920 (ao vivo; dimensões efetivas acima)

**O que:** CSS e scripts essenciais retornam HTTP 500, deixando texto preto sobre azul escuro, overflow horizontal e formulário sem reação à seleção de procedimento.

**Por que:** o paciente não consegue ler as instruções nem concluir a solicitação que alimenta a captação.

**Conserto:** recuperar a entrega dos artefatos `/_next/static/css/app/layout.css` e `/_next/static/chunks/app/(site)/site/agendar/page.js` no processo que atende a porta 3000; conferir o carregamento de `src/app/globals.css` pelo layout e o erro de compilação antes de mudar estilos. Não há evidência suficiente para atribuir a causa a um arquivo-fonte específico. Revalidar hidratação, seleção, envio e responsividade após os assets responderem 200. Evidência: arquivos ao vivo acima. O login também apresentou ausência de estilos na primeira inspeção; sua imagem temporária expirou. Na recaptura preservada, o portal estava em branco. Esse estado posterior não foi contado como outro achado nem usado para medir contraste.

### 02 — [CRITICO] /site/agendar @ 320, 375, 414, 768, 1024, 1440, 1920 (galeria)

**O que:** instruções, rótulos, placeholders, procedimentos e consentimento usam combinações abaixo de 4,5:1.

**Por que:** pacientes idosos precisam identificar campos obrigatórios, a opção desejada e o prazo de retorno sem depender de texto quase apagado.

**Conserto:** em `src/app/(site)/site/agendar/page.tsx`, substituir `text-white/40` do hero, `text-[#021541]/50` dos labels, `/40` da orientação, `/30` do consentimento e `placeholder:text-[#021541]/25` por cores sólidas adequadas ao fundo. Escurecer também `#718096` dos procedimentos. Razões calculadas a partir das cores declaradas, com composição alfa: hero **3,71:1**; labels **3,46:1**; orientação **2,58:1**; consentimento **1,97:1**; placeholder sobre `#f5f6f8` **1,73:1**; procedimento **3,71:1**. São cálculos dos tokens que explicam o problema visto, não medições de CSS computado no portal sem estilos. Evidência: [320px](../../tests/visual/gallery/site-agendar__mobile-320.png), demais `site-agendar__*.png`.

### 03 — [CRITICO] /site/agendar @ 320 (galeria)

**O que:** a palavra “ARTHRITIS” aparece no lugar do ícone e empurra “Artroscopia” para fora do botão, até o corte na lateral do cartão.

**Por que:** o paciente perde parte da identificação de um procedimento obrigatório e pode não reconhecer a opção.

**Conserto:** em `src/app/(site)/site/agendar/page.tsx`, substituir `PROCEDURES.icon: 'arthritis'` por um ícone que de fato exista na fonte carregada ou por SVG local, reservar caixa fixa para o ícone e permitir quebra do rótulo com `min-w-0`. O fallback textual também aparece em outros tamanhos, mas o corte foi confirmado em 320px. Evidência: [captura 320px](../../tests/visual/gallery/site-agendar__mobile-320.png). Overflow global zero no manifest não detecta esse extravasamento interno.

### 04 — [ALTO] /site/agendar @ 320 e 375 (galeria)

**O que:** o botão flutuante do WhatsApp sobrepõe a região do campo de nome em 320px e do telefone em 375px.

**Por que:** o paciente pode acionar outro canal ao tentar preencher o formulário; a sobreposição também esconde parte da área disponível para digitação.

**Conserto:** tratar `.whatsapp-fab` de `src/app/globals.css` especificamente na página de agendamento: posicionar a alternativa WhatsApp no fluxo em telas estreitas ou reservar área que não dispute os campos, inclusive com teclado aberto. Evidência: [320px](../../tests/visual/gallery/site-agendar__mobile-320.png), [375px](../../tests/visual/gallery/site-agendar__mobile-375.png). Teclado virtual não foi emulado.

### 05 — [ALTO] /site/agendar @ 320, 375 e 414 (galeria)

**O que:** os rótulos têm 10px, as opções 12px e os campos 14px, com pouco espaço interno útil em 320px.

**Por que:** nomes longos de procedimentos e informações de contato exigem esforço de leitura e precisão de toque incompatíveis com o público prioritário.

**Conserto:** em `src/app/(site)/site/agendar/page.tsx`, substituir `text-[10px]` dos labels por pelo menos 14px e `text-xs` das opções e `text-sm` dos campos por 16px; reduzir `px-8` para `px-4 sm:px-8` no cartão, mantendo os textos completos. Evidência: [320px](../../tests/visual/gallery/site-agendar__mobile-320.png), capturas 375/414. Tamanhos conferidos no código após inspeção visual.

### 06 — [ALTO] /site/agendar @ 320, 375 e 414 (galeria)

**O que:** as opções curtas de procedimento têm aproximadamente 42px de altura e o acionador do menu aproximadamente 36×34px, abaixo do alvo de 44px adotado para esta auditoria.

**Por que:** tremor ou limitação de mobilidade aumentam a chance de selecionar a opção errada ou falhar ao abrir a navegação.

**Conserto:** em `src/app/(site)/site/agendar/page.tsx`, adicionar `min-h-11` aos botões de procedimento; em `src/components/site/SiteNav.tsx`, usar caixa mínima de 44×44px no botão `md:hidden`. As dimensões são derivadas das classes e conferidas visualmente na captura, sem misturar com os alvos ainda menores do runtime sem CSS. Evidência: [320px](../../tests/visual/gallery/site-agendar__mobile-320.png).

### 07 — [CRITICO] /login @ 320, 375, 414, 768, 1024, 1440, 1920 (galeria)

**O que:** os labels, placeholders e instrução de recuperação de acesso têm baixo contraste; o título ciano também fica abaixo de 3:1 sobre o fundo claro.

**Por que:** a recepção e o médico têm dificuldade para conferir credenciais e localizar ajuda quando o acesso falha.

**Conserto:** em `src/app/(auth)/login/page.tsx`, substituir `text-[#021541]/50`, `placeholder:text-[#021541]/25` e `text-[#021541]/30` por cores sólidas legíveis; escurecer `text-[#00BCE4]` do título “plataforma”. Cálculos dos tokens: labels **3,46:1**, placeholders **1,73:1**, ajuda **1,97:1**, ciano sobre `#f5f6f8` **2,09:1**. Evidência: [320px](../../tests/visual/gallery/login__mobile-320.png), demais `login__*.png`.

### 08 — [ALTO] /login @ 320, 375 e 414 (galeria)

**O que:** o controle “Mostrar senha” fica restrito ao ícone, sem caixa de toque de 44×44px.

**Por que:** o médico usando o celular entre consultas precisa conseguir conferir a senha sem tocar repetidamente numa área pequena.

**Conserto:** no botão absoluto de `src/app/(auth)/login/page.tsx`, definir `size-11`, centralizar o ícone e conservar espaço no `pr-12` do input. Evidência: [320px](../../tests/visual/gallery/login__mobile-320.png); ausência de padding/altura mínima confirmada no botão do código.

### 09 — [CRITICO] /site/glossario @ 320 (detalhe da galeria)

**O que:** o texto de ação “Significado completo” aparece em ciano sobre branco, com contraste calculado de 2,25:1.

**Por que:** o paciente idoso pode não perceber como acessar a explicação completa do termo médico.

**Conserto:** em `src/components/site/GlossarioPublicClient.tsx`, escurecer `text-[#00BCE4]` do texto da ação; manter ciano apenas onde não comprometa a leitura. Evidência: [captura 320px](../../tests/visual/gallery/site-glossario__mobile-320.png), início da página ampliado na auditoria. O padrão existe no componente compartilhado, mas não se afirma inspeção de cada ocorrência da lista.

### 10 — [ALTO] /site/glossario @ 320 (detalhe da galeria)

**O que:** as letras da navegação alfabética usam botões de 36×36px próximos entre si.

**Por que:** pacientes com dificuldade motora podem filtrar uma letra adjacente ao procurar um termo.

**Conserto:** em `src/components/site/GlossarioPublicClient.tsx`, trocar `size-9` por `min-w-11 min-h-11` e permitir a redistribuição das letras no `flex-wrap`. Evidência: [captura 320px](../../tests/visual/gallery/site-glossario__mobile-320.png); dimensão derivada da classe após inspeção visual.

## Teste do formulário e limites de cobertura

Em 320×720, preenchi nome sintético `QA Visual`, telefone inválido `1` e cliquei em “Outro / Não sei ainda”, repetindo com referência atualizada do snapshot. Os valores ficaram no DOM, a seleção não ganhou estado visual e “Solicitar Agendamento” continuou desabilitado. Os scripts 500 explicam a falta de hidratação; esse cenário não comprova erro da validação de negócio. **Não foi possível executar envio, erro de servidor ou sucesso pelo formulário.** Nenhum lead foi criado pelo teste e nenhuma mensagem foi enviada. A rota `src/app/api/site/agendar/route.ts` contém notificação por WhatsApp após inserção, portanto a rodada não fez submissão válida a esse destino.

`maestri list` confirmou Vitrine, Painel, Captacao Mobile e Galeria; a nota compartilhada foi lida. Vitrine foi inspecionada por snapshot/logs, Painel por captura e Captacao Mobile por interação, sete tamanhos, capturas e rede. A galeria foi lida diretamente nos PNGs locais, sem depender do portal Galeria. Não foram acessados dashboard, recepção autenticada, agenda, prontuário, financeiro ou tabelas internas; não há achados inventados sobre essas áreas. A captura de entrada de `/portal` foi examinada, sem testar acesso com código.

As pranchas de `/site`, `/site/a-clinica`, `/site/especialidades` e `/site/tratamentos` contêm grandes regiões vazias; algumas capturas de hero também estão vazias. **Não foram contadas como desaparecimento confirmado no produto.** `tests/visual/capture.spec.ts` aguarda 600ms e captura a página inteira sem percorrer o scroll, enquanto `src/components/site/GSAPAnimations.tsx` revela conteúdo via ScrollTrigger e possui entrada de 1,1s mais atraso/stagger. Corrigir a coleta para percorrer a página e aguardar animações antes de usar essas regiões como prova visual. O runtime atual impede confirmar esse comportamento com CSS normal.

As sete capturas do glossário foram triadas, mas sua extensão (até 245.646 pixels de altura no PNG de 320px com DPR 2) impede tratar a prancha reduzida como auditoria de cada verbete. Os achados se limitam ao topo ampliado. Nenhuma conformidade global de contraste, zoom 200%, teclado, leitor de tela ou dispositivo físico foi certificada.

## Placar

Contagem por problema distinto, sem multiplicar pelos viewports: **CRITICO 5 / ALTO 5 / MEDIO 0 / BAIXO 0**. O item 01 é falha do ambiente ao vivo; os outros nove são sustentados pela galeria. Limitações da coleta não entram nesse placar.

## Três prioridades

1. **Restabelecer CSS/JavaScript e comprovar a captação em 320px:** recursos 200, seleção reativa, validação compreensível e sucesso em ambiente de teste sem notificações reais.
2. **Corrigir leitura e corte no agendamento:** contraste dos textos, tamanhos para idosos e substituição do ícone `arthritis`.
3. **Eliminar conflitos de toque:** WhatsApp fora dos campos e alvos mínimos de 44px no formulário, menu, mostrar senha e alfabeto do glossário.
