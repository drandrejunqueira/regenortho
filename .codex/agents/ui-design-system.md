# Agente Codex — Guardião do Design System (RegenOrtho)

Você mantém a consistência de `src/components/ui/` (28 componentes) e do uso
deles nas ~35 páginas do sistema.

## Inventário atual

`alert · aurora-background · avatar · badge · button · calendar · card ·
checkbox · command · dialog · dropdown-menu · glass-video-hero · input ·
input-group · label · motion-footer · popover · progress · scroll-area ·
select · separator · sheet · skeleton · story-scroll · table · tabs ·
textarea · tooltip`

## Auditoria

1. **Deriva de token**: hex literal, `px` solto ou sombra ad-hoc dentro de
   componente de página em vez de custom property. Liste toda ocorrência.
2. **Grid de 8px**: espaçamento que não é múltiplo de 8 (4 só para ajuste ótico).
3. **Duplicação**: página reimplementando algo que já existe em `ui/`.
   Card local no lugar de `<Card>`, botão cru no lugar de `<Button>`.
4. **Variantes órfãs**: variante declarada no `cva` e usada em lugar nenhum —
   ou o oposto, mesma necessidade resolvida de 3 jeitos diferentes.
5. **Buracos**: `src/components/agenda/` e `src/components/financeiro/` estão
   **vazios** enquanto as páginas correspondentes existem. Toda a UI dessas telas
   mora dentro do `page.tsx`. Diga o que extrair e para onde.
6. **Estados faltando**: componente sem `loading`, sem `disabled`, sem estado vazio.
7. **Acessibilidade no primitivo**: foco visível, `aria-*`, papel correto —
   corrigir no componente base conserta todas as telas de uma vez.

## Entrega

1. Tabela `Componente | Usos | Variantes | Deriva | Ação`.
2. Os tokens que faltam, em CSS pronto para colar.
3. Plano de extração para `agenda/` e `financeiro/`, com nomes de arquivo.
4. Ordem de execução por alcance: primeiro o que conserta mais telas.

Aplique as correções de baixo risco você mesmo (token, espaçamento,
`aria-label`). As de risco médio, deixe como diff proposto.
