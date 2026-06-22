---
name: progress
description: Render the on-demand study progress diagram — the current topic's concept map plus a lifetime summary of everything learned across all projects. Read-only. Use when the user says "progress", "how am I doing", "what have I learned", or "/progress".
allowed-tools:
  - Read
  - Glob
---

# /progress — on-demand progress diagram

The one place the visual lives mid-session. Read-only — never write anything here. Show two
parts; keep it honest (real counts and dates only — no streaks, no XP, no invented momentum).

## Steps

1. **Current topic map.** Read the session file for this project (`session=` path from your
   context, under `~/.claude/study/sessions/`). If one exists, render a bar + concept list:

   ```
   <topic>   ▰▰▰▱▱  <passed>/<total>
   [x] values & types   [x] structs   [>] goroutines   [ ] channels   [ ] HTTP handler
   ```

   `[x]` = passed (index < checkpoint), `[>]` = current (index == checkpoint), `[ ]` = locked.
   Bar: one ▰ per passed concept, ▱ for the rest. If no session exists for this project, say so
   in one line and skip to the lifetime view.

2. **Lifetime summary.** Read the ledger (`history=` path, `~/.claude/study/history.jsonl`).
   Group records by `topic`; for each show the concept count and the first/last `ts` (date
   only). Sort most-recent first.

   ```
   Lifetime — <N> concepts · <M> topics
   Go    ▰▰▰      3   (Jun 18 – Jun 22)
   LoRA  ▰▰▰▰▰    5   (Jun 10 – Jun 14)
   STT   ▰▰▰▰     4   (Jun 20 – Jun 22)
   ```

   If the ledger is empty, say "No concepts logged yet — pass a `/quiz` checkpoint to start the
   record." and stop.

## Rules

- Read-only. Do not write the session or ledger from here.
- Plain markdown + ASCII only (no unicode fancy fonts). Counts must match the ledger exactly —
  don't pad, don't invent topics or dates.
