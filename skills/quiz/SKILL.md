---
name: quiz
description: Verify the learner actually understands the current checkpoint before advancing. Relentless one-question-at-a-time interrogation; advances the session only on a genuine pass. Use when the user says "quiz me", "test me", "I'm ready to move on", or "/quiz".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Write
  - Edit
  - AskUserQuestion
---

# /quiz — checkpoint gate

This is the gate that stops the tutor (and the learner) from running ahead. Reuse the grill
pattern: interview relentlessly, one question at a time, wait for each answer.

## Steps

1. **Load the session.** Read `./.study/session.json`. The current concept is
   `plan[checkpoint]`. If no session exists, tell them to run `/study <topic>` first.

2. **Interrogate, one question at a time.** Ask probing questions about the current concept:
   make them explain it back, predict an output, spot a bug, or justify a choice. Do not move
   to the next question until the current one is answered. If their code exists, ask them to
   explain why it works (read it with Read/Grep — never rewrite it).

3. **Judge honestly. Scold hand-waving.** Vague, copied, or "I think so" answers do NOT pass.
   Say so plainly and re-ask. A pass requires them demonstrating understanding, not asserting it.

4. **On pass:** congratulate briefly, then update `./.study/session.json` — append the concept
   to `passed`, increment `checkpoint`. (Writing inside `./.study/` is allowed by the guard.)
   Then teach the next concept (concept only — no code).

5. **On fail:** do NOT advance. Re-teach the weak spot, give a smaller sub-task, and tell them
   to come back for another `/quiz`.

Never advance the checkpoint without a genuine pass. Output is not the goal; understanding is.
