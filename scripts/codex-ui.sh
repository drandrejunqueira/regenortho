#!/usr/bin/env bash
# Executa um agente de UI/Design em modo headless via Codex CLI.
#
#   scripts/codex-ui.sh <agente> "<tarefa>" [arquivo-de-contexto ...]
#
# Agentes disponíveis: ver .codex/agents/*.md
#   ui-designer        direção visual, design system, proposta de tela
#   ui-qa              auditoria de qualidade visual das telas capturadas
#   ui-responsivo      auditoria de breakpoints em cima da galeria
#   ui-design-system   guardião de tokens, espaçamento 8px, consistência
#
# Saída: .codex/out/<agente>-<timestamp>.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT="${1:?uso: codex-ui.sh <agente> \"<tarefa>\" [contexto...]}"
TASK="${2:?falta a descrição da tarefa}"
shift 2

PROMPT_FILE="$ROOT/.codex/agents/$AGENT.md"
[ -f "$PROMPT_FILE" ] || { echo "❌ agente '$AGENT' não existe em .codex/agents/"; ls "$ROOT/.codex/agents/"; exit 1; }

mkdir -p "$ROOT/.codex/out"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$ROOT/.codex/out/$AGENT-$STAMP.md"

{
  cat "$PROMPT_FILE"
  echo
  echo "## Tarefa desta execução"
  echo
  echo "$TASK"
  if [ "$#" -gt 0 ]; then
    echo
    echo "## Contexto anexado"
    for f in "$@"; do
      [ -f "$f" ] || { echo "(ausente: $f)"; continue; }
      echo
      echo "### $f"
      echo '```'
      cat "$f"
      echo '```'
    done
  fi
} > "$ROOT/.codex/out/.prompt-$STAMP.md"

echo "▶ codex/$AGENT — $TASK"
codex exec \
  --cd "$ROOT" \
  --sandbox workspace-write \
  --output-last-message "$OUT" \
  - < "$ROOT/.codex/out/.prompt-$STAMP.md"

rm -f "$ROOT/.codex/out/.prompt-$STAMP.md"
echo "✅ relatório: $OUT"
