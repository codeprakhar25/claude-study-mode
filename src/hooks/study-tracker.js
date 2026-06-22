#!/usr/bin/env node
// study-mode — UserPromptSubmit hook
//   1. Parse toggle commands from the prompt: "study on|off|strict|lite"
//      (also natural language: "start study mode", "stop study mode").
//   2. While active, re-inject a short tutor reminder so the persona survives
//      long sessions / context drift.

const { readState, writeState, readSession, sessionPath, historyPath } = require('../lib/state');

const REMINDER =
  'STUDY MODE reminder: you are a strict tutor. Do NOT write code for the user (writing tools ' +
  'are blocked). Teach one concept at a time, verify understanding before advancing, review ' +
  'their code without fixing it, gather real sources, and call out hand-waving.';

function emitContext(text) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: text,
    },
  }));
}

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  let prompt = '';
  try { prompt = (JSON.parse(input).prompt || '').trim(); } catch (e) {}
  const lc = prompt.toLowerCase();

  let changed = null;

  // Explicit "study <cmd>" or "/study-mode <cmd>"
  const m = lc.match(/^\/?study(?:-mode)?\s+(on|off|strict|lite)\b/);
  if (m) {
    const cmd = m[1];
    if (cmd === 'on') changed = writeState({ active: true });
    else if (cmd === 'off') changed = writeState({ active: false });
    else changed = writeState({ active: true, level: cmd }); // strict|lite implies on
  } else if (/\b(start|enable|turn on|activate)\b.*\bstudy\b/.test(lc) && !/\b(stop|off|disable)\b/.test(lc)) {
    changed = writeState({ active: true });
  } else if (/\b(stop|disable|turn off|deactivate|exit)\b.*\bstudy\b/.test(lc) ||
             /\bstudy\b.*\b(off|stop)\b/.test(lc)) {
    changed = writeState({ active: false });
  }

  const state = changed || readState();

  if (changed) {
    if (state.active) {
      let msg = '[study-mode] Activated (level: ' + state.level + '). ' + REMINDER +
        ' Write session/ledger only here: session=' + sessionPath(process.cwd()) +
        ' ; history=' + historyPath() + '.';
      const s = readSession(process.cwd());
      if (s) {
        const cur = s.plan && s.plan[s.checkpoint];
        msg += ' Active session topic="' + (s.topic || '?') + '", checkpoint ' +
          (s.checkpoint || 0) + (cur ? ' = "' + cur + '"' : '') + '.';
      }
      emitContext(msg);
    } else {
      emitContext('[study-mode] Deactivated. Normal Claude behavior resumes; writing tools unblocked.');
    }
    process.exit(0);
  }

  if (state.active) {
    emitContext(REMINDER + ' (level: ' + state.level + ')');
  } else {
    process.stdout.write('OK');
  }
  process.exit(0);
});
