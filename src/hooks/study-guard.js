#!/usr/bin/env node
// study-mode — PreToolUse hook (matcher: Write|Edit|NotebookEdit)
// The enforcement core: while study mode is active, Claude may not write code.
// Denies all file-writing tools EXCEPT writes inside <cwd>/.study/ (session state
// and the learner's notes). Read/Grep/Glob/WebSearch are never matched, so the
// tutor can still review the learner's code and gather resources.

const path = require('path');
const { readState, studyDir } = require('../lib/state');

function denyReason(level) {
  const base =
    "STUDY MODE: I won't write or edit code for you — that's the whole point. You write it, " +
    'I review it. Here is what to do instead: explain the concept, give the next small step, ' +
    'and point you at the right resource. Then you implement it and bring it back for review.';
  if (level === 'lite') {
    return base + ' (lite level: I may sketch ≤3 lines of pseudocode as a hint, never a working file.)';
  }
  return base + ' (strict level: concept and direction only — no code, no pseudocode.)';
}

function emitDeny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
}

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  let data = {};
  try { data = JSON.parse(input); } catch (e) {}

  const state = readState();
  if (!state.active) {
    process.stdout.write('OK'); // allow — normal behavior
    process.exit(0);
  }

  const cwd = data.cwd || process.cwd();
  const ti = data.tool_input || {};
  const target = ti.file_path || ti.notebook_path || ti.path || '';

  // Allow writes only to central study storage (~/.claude/study/). Legacy
  // <cwd>/.study/ is read-only now — auto-migrated by readSession() on first read.
  if (target) {
    const abs = path.resolve(cwd, target);
    const allowedDirs = [path.resolve(studyDir())];
    const ok = allowedDirs.some((d) => abs === d || abs.startsWith(d + path.sep));
    if (ok) {
      process.stdout.write('OK');
      process.exit(0);
    }
  }

  emitDeny(denyReason(state.level));
  process.exit(0);
});
