#!/usr/bin/env node
// study-mode — SessionStart hook
// If study mode is active, inject the full strict-tutor persona so it survives
// session restarts and context compression.

const fs = require('fs');
const path = require('path');
const { readState, readSession, sessionPath, historyPath } = require('../lib/state');

function loadPersona() {
  try {
    return fs.readFileSync(path.join(__dirname, '..', 'persona', 'strict-tutor.md'), 'utf8');
  } catch (e) {
    return 'STUDY MODE ACTIVE — strict tutor. Do not write code for the user; teach, review, and verify understanding one concept at a time.';
  }
}

const state = readState();

if (!state.active) {
  process.stdout.write('OK');
  process.exit(0);
}

let out = loadPersona();
out += '\n\nCurrent level: **' + state.level + '**.';

// Central storage paths for this project — write the session/ledger HERE (the
// guard allows writes only inside the study dir), never into the repo.
out += '\n\nStudy storage (write only here): session=' + sessionPath(process.cwd()) +
  ' ; history=' + historyPath() + '.';

const session = readSession(process.cwd());
if (session) {
  const cur = session.plan && session.plan[session.checkpoint];
  out += '\n\nActive learning session: topic="' + (session.topic || '?') + '", ' +
    'checkpoint ' + (session.checkpoint || 0) +
    (cur ? ' = "' + cur + '"' : '') +
    '. Stay here until the learner passes it. Do not run ahead.';
}

process.stdout.write(out);
process.exit(0);
