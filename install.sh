#!/usr/bin/env bash
# study-mode — local installer.
# Symlinks this plugin into ~/.claude/plugins and (optionally) wires the
# statusline badge into ~/.claude/settings.json.
#
#   bash install.sh              # install plugin
#   bash install.sh --statusline # also set the statusline (needs jq)

set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "study-mode: Node.js required (hooks run on node)." >&2
  exit 1
fi

SRC="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
CFG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
DEST="$CFG/plugins/local/study-mode"

mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
ln -s "$SRC" "$DEST"
echo "study-mode: linked $DEST -> $SRC"

if [ "${1:-}" = "--statusline" ]; then
  if ! command -v jq >/dev/null 2>&1; then
    echo "study-mode: --statusline needs jq. Add manually to $CFG/settings.json:" >&2
    echo "  \"statusLine\": { \"type\": \"command\", \"command\": \"bash $SRC/src/hooks/study-statusline.sh\" }" >&2
    exit 0
  fi
  SETTINGS="$CFG/settings.json"
  [ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
  TMP=$(mktemp)
  jq --arg cmd "bash $SRC/src/hooks/study-statusline.sh" \
    '.statusLine = { "type": "command", "command": $cmd }' "$SETTINGS" > "$TMP"
  mv "$TMP" "$SETTINGS"
  echo "study-mode: statusline wired in $SETTINGS"
fi

echo "study-mode: done. Restart Claude Code, then type 'study on'."
