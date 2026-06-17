#!/bin/bash
# study-mode — statusline badge. Reads the .study-active flag and renders a badge.
#
# Usage in ~/.claude/settings.json:
#   "statusLine": { "type": "command", "command": "bash /path/to/study-statusline.sh" }

FLAG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.study-active"

# Refuse symlinks — a local attacker could point the flag at a sensitive file
# and have its bytes (incl. ANSI escapes) rendered to the terminal each keystroke.
[ -L "$FLAG" ] && exit 0
[ ! -f "$FLAG" ] && exit 0

# Cap read and strip anything outside [a-z] — blocks terminal-escape injection.
LEVEL=$(head -c 16 "$FLAG" 2>/dev/null | tr -d '\n\r' | tr '[:upper:]' '[:lower:]')
LEVEL=$(printf '%s' "$LEVEL" | tr -cd 'a-z')

# Whitelist. Anything else → render nothing rather than echo attacker bytes.
case "$LEVEL" in
  strict|lite) ;;
  *) exit 0 ;;
esac

# Green badge. STUDY:STRICT / STUDY:LITE
printf '\033[38;5;35m[STUDY:%s]\033[0m' "$(printf '%s' "$LEVEL" | tr '[:lower:]' '[:upper:]')"
