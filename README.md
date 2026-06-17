# Study Mode

A Claude Code plugin that turns Claude into a **strict tutor instead of a chatbot**.

When you're learning something — finetuning a LoRA, picking up Go, running an experiment to
learn from it — normal Claude writes all the code and runs ahead in auto mode, leaving you with
output you don't understand. Study Mode flips that: Claude teaches one concept at a time,
verifies you actually understand it before moving on, gathers real resources, reviews **your**
code, and **refuses to write code for you** — even when you ask.

The refusal is enforced by a hook, not just a prompt, so you can't talk Claude back into doing
the work.

## How it works

| Piece | What it does |
|-------|--------------|
| `SessionStart` hook (`study-activate.js`) | Injects the strict-tutor persona when mode is active. |
| `UserPromptSubmit` hook (`study-tracker.js`) | Parses `study on/off/strict/lite`; re-injects the tutor reminder each turn. |
| `PreToolUse` hook (`study-guard.js`) | **Denies** `Write`/`Edit`/`NotebookEdit` while active — except inside `./.study/`. |
| `/study <topic>` skill | Builds a concept path, gathers resources, teaches concept 0, sets a checkpoint. |
| `/quiz` skill | Grills you on the current checkpoint; advances only on a genuine pass. |

`Read` / `Grep` / `Glob` / `WebSearch` are never blocked, so Claude can review your code and
find real references.

## Usage

```
study on            # activate (strict level)
study lite          # activate, allow ≤3-line pseudocode hints
study off           # back to normal Claude
/study learn Go     # start a learning session on a topic
/quiz               # verify the current checkpoint before moving on
```

State:
- Global toggle: `$CLAUDE_CONFIG_DIR/.study-state.json`
- Per-project session: `./.study/session.json` (topic, concept path, checkpoint)

## Levels

- **strict** (default): no code or pseudocode from Claude — concept, direction, and review only.
- **lite**: Claude may sketch ≤3 lines of pseudocode as a hint, never a working file.

## Install

```bash
bash install.sh               # symlink into ~/.claude/plugins/local/study-mode
bash install.sh --statusline  # also wire the [STUDY:STRICT] badge (needs jq)
```

Then restart Claude Code and type `study on`. Requires `node` on PATH (hooks run on node).

The statusline badge reads `$CLAUDE_CONFIG_DIR/.study-active` (a hardened sidecar flag) so it
never JSON-parses in bash and refuses symlinks / non-whitelisted contents.
