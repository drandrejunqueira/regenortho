#!/usr/bin/env bash
# Abre um briefing de tarefa no Antigravity IDE (código e revisão).
#
#   scripts/antigravity.sh new  <slug> "<título>"   cria briefing a partir do template
#   scripts/antigravity.sh open <slug>              abre o briefing + o projeto no IDE
#   scripts/antigravity.sh list                     lista briefings
#
# O Antigravity não tem modo headless: o Claude prepara o pacote de tarefa
# (spec, arquivos, critério de pronto, regras a carregar) e o Antigravity executa
# dentro do IDE, guiado por .clauderules e .agent/.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IDE="/Applications/Antigravity IDE.app/Contents/Resources/app/bin/antigravity-ide"
DIR="$ROOT/.agent/briefings"
mkdir -p "$DIR"

case "${1:-}" in
  new)
    SLUG="${2:?uso: antigravity.sh new <slug> \"<título>\"}"
    TITLE="${3:-$SLUG}"
    F="$DIR/$SLUG.md"
    [ -f "$F" ] && { echo "já existe: $F"; exit 1; }
    sed "s/{{TITULO}}/$TITLE/g; s/{{SLUG}}/$SLUG/g; s/{{DATA}}/$(date +%Y-%m-%d)/g" \
      "$DIR/_template.md" > "$F"
    echo "📝 $F"
    ;;
  open)
    SLUG="${2:?uso: antigravity.sh open <slug>}"
    F="$DIR/$SLUG.md"
    [ -f "$F" ] || { echo "briefing não encontrado: $F"; exit 1; }
    [ -x "$IDE" ] || { echo "Antigravity IDE não encontrado em $IDE"; exit 1; }
    "$IDE" "$ROOT" "$F"
    echo "🚀 aberto no Antigravity: $SLUG"
    ;;
  list)
    ls -1 "$DIR"/*.md 2>/dev/null | grep -v '_template' | xargs -n1 basename || echo "(nenhum briefing)"
    ;;
  *)
    sed -n '2,12p' "$0"
    exit 1
    ;;
esac
