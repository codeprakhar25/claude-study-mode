// study-mode — shared state helpers
//
// Two state files:
//   Global toggle:  $CLAUDE_CONFIG_DIR/.study-state.json  {active, level}
//   Per-project:    <cwd>/.study/session.json             {topic, plan, checkpoint, passed, created}
//
// Global state is symlink-safe written (write temp + rename) so a symlinked
// config dir is not clobbered.

const fs = require('fs');
const path = require('path');
const os = require('os');

const VALID_LEVELS = ['strict', 'lite'];
const DEFAULT_STATE = { active: false, level: 'strict' };

function claudeDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function globalStatePath() {
  return path.join(claudeDir(), '.study-state.json');
}

// Plain sidecar the statusline reads (avoids JSON-parsing in bash). Contains
// the active level (e.g. "strict") when on, removed when off.
function flagPath() {
  return path.join(claudeDir(), '.study-active');
}

function readState() {
  try {
    const raw = fs.readFileSync(globalStatePath(), 'utf8');
    const data = JSON.parse(raw);
    return {
      active: Boolean(data.active),
      level: VALID_LEVELS.includes(data.level) ? data.level : 'strict',
    };
  } catch (e) {
    return { ...DEFAULT_STATE };
  }
}

function writeState(next) {
  const merged = { ...readState(), ...next };
  if (!VALID_LEVELS.includes(merged.level)) merged.level = 'strict';
  const target = globalStatePath();
  const tmp = target + '.tmp-' + process.pid;
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(merged, null, 2));
    fs.renameSync(tmp, target);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
  // Sync the statusline sidecar flag.
  try {
    if (merged.active) {
      const ftmp = flagPath() + '.tmp-' + process.pid;
      fs.writeFileSync(ftmp, merged.level);
      fs.renameSync(ftmp, flagPath());
    } else {
      fs.unlinkSync(flagPath());
    }
  } catch (_) {}
  return merged;
}

// Per-project session — read-only helper used by hooks for the persona reminder.
function sessionDir(cwd) {
  return path.join(cwd || process.cwd(), '.study');
}

function readSession(cwd) {
  try {
    const raw = fs.readFileSync(path.join(sessionDir(cwd), 'session.json'), 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

module.exports = {
  VALID_LEVELS,
  claudeDir,
  globalStatePath,
  flagPath,
  readState,
  writeState,
  sessionDir,
  readSession,
};
