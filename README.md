# Study Mode

> A Claude Code plugin that turns Claude into a **strict tutor instead of a chatbot** — and *enforces* it.

![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-da7756)
![License](https://img.shields.io/badge/license-MIT-blue)
![status](https://img.shields.io/badge/tests-13%2F13-brightgreen)

When you ask Claude to help you *learn* something — finetune a LoRA, pick up Go, run an
experiment to understand it — normal Claude just does it. It writes all the code, runs ahead in
auto mode, and hands you output you don't understand. You end up with a working repo and zero
new skill.

**Study Mode flips that.** Claude becomes a demanding teacher: it paces one concept at a time,
verifies you actually understand before moving on, gathers real resources, reviews **your**
code — and **refuses to write code for you, even when you ask.**

That refusal isn't a polite suggestion in a system prompt you can argue with. It's a
`PreToolUse` hook that **denies** Claude's file-writing tools while the mode is on. You can't
talk it into doing the work for you. That's the whole point.

---

## Why not just the built-in "Learning" output style?

Claude Code ships a soft *Learning* style that asks you to fill in some code. It's a persona —
insist hard enough and Claude writes the code anyway. Study Mode adds the two things that make
it actually work:

1. **Hard enforcement** — a hook blocks `Write`/`Edit`/`NotebookEdit`, not just a prompt.
2. **Checkpoint pacing** — a session state file tracks where you are so Claude *can't* run
   ahead; it must verify understanding (`/quiz`) before advancing.

---

## Install

```text
/plugin marketplace add codeprakhar25/claude-study-mode
/plugin install study-mode@study-mode      # choose "user" scope to use it everywhere
```

Restart Claude Code, then type `study on`. Requires `node` on your PATH (the hooks run on node).

<details>
<summary>Local / from-source install</summary>

```bash
git clone https://github.com/codeprakhar25/claude-study-mode
cd claude-study-mode
bash install.sh --statusline   # symlinks into ~/.claude/plugins, wires the status badge (needs jq)
```
</details>

## Usage

```text
study on            # activate study mode (strict level)
study lite          # activate, allow ≤3-line pseudocode hints
study off           # back to normal Claude

/study learn Go     # start a learning session — builds a concept path, gathers resources
/quiz               # prove you understand the current concept before moving on
```

### Levels

| Level | Claude may… |
|-------|-------------|
| **strict** (default) | give concepts, direction, and review only — **no code, no pseudocode** |
| **lite** | also sketch ≤3 lines of pseudocode/skeleton as a hint — never a working file |

In both levels, **you** write all the code; Claude reads and critiques it but never writes it.

## How it works

| Component | Role |
|-----------|------|
| `SessionStart` hook (`study-activate.js`) | Injects the strict-tutor persona when the mode is active, so it survives restarts. |
| `UserPromptSubmit` hook (`study-tracker.js`) | Parses `study on/off/strict/lite`; re-injects the tutor reminder each turn so it never drifts. |
| `PreToolUse` hook (`study-guard.js`) | **The enforcement core** — denies `Write`/`Edit`/`NotebookEdit` while active (except inside `./.study/`). |
| `/study` skill | Assesses your level, builds an ordered concept path, gathers real resources, teaches concept 0, sets a checkpoint. |
| `/quiz` skill | Grills you on the current checkpoint; advances only on a genuine pass. On the final pass, emits a visual end-of-session report. |

`Read` / `Grep` / `Glob` / `WebSearch` are never blocked — so Claude can review your code and
pull up canonical docs.

### State

- **Global toggle:** `$CLAUDE_CONFIG_DIR/.study-state.json` (`{active, level}`) plus a hardened
  `.study-active` sidecar the statusline reads.
- **Per-project session:** `./.study/session.json` — `{topic, plan, checkpoint, passed}`. This
  is the only place Claude is allowed to write while the mode is on.

## License

MIT — see [LICENSE](LICENSE).
