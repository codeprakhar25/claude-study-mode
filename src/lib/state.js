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
const crypto = require('crypto');

const VALID_LEVELS = ['strict', 'lite'];
const DEFAULT_STATE = { active: false, level: 'strict' };

function claudeDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

// Central study storage (cross-project). Lives under the global config dir so it
// is shared by every project and never dirties a repo.
//   study/history.jsonl        append-only lifetime ledger (one line per concept)
//   study/sessions/<slug>.json per-project session, keyed by cwd
function studyDir() {
  return path.join(claudeDir(), 'study');
}

function sessionsDir() {
  return path.join(studyDir(), 'sessions');
}

function historyPath() {
  return path.join(studyDir(), 'history.jsonl');
}

// Readable + collision-free filename for a project path.
function slugForCwd(cwd) {
  const dir = cwd || process.cwd();
  const base = path.basename(dir).replace(/[^a-zA-Z0-9._-]/g, '-') || 'root';
  const hash = crypto.createHash('sha1').update(dir).digest('hex').slice(0, 8);
  return base + '-' + hash;
}

function sessionPath(cwd) {
  return path.join(sessionsDir(), slugForCwd(cwd) + '.json');
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

// Legacy per-project session dir (<cwd>/.study). Kept for backward-compat reads
// and the guard's migration-window write exception.
function sessionDir(cwd) {
  return path.join(cwd || process.cwd(), '.study');
}

// Read the session for a cwd: central first, then the legacy local file so an
// in-flight v0.1 session keeps resuming (next pass rewrites it centrally).
function readSession(cwd) {
  try {
    return JSON.parse(fs.readFileSync(sessionPath(cwd), 'utf8'));
  } catch (e) {}
  // Legacy path — migrate to central on read.
  const legacyPath = path.join(sessionDir(cwd), 'session.json');
  try {
    const data = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
    try {
      writeSession(cwd, data);
      fs.unlinkSync(legacyPath);
    } catch (_) {}
    return data;
  } catch (e) {}
  return null;
}

// Atomically write the central session for a cwd (temp + rename).
function writeSession(cwd, data) {
  const target = sessionPath(cwd);
  const tmp = target + '.tmp-' + process.pid;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, target);
  return target;
}

// Append one concept-passed record to the lifetime ledger.
function appendHistory(entry) {
  fs.mkdirSync(studyDir(), { recursive: true });
  fs.appendFileSync(historyPath(), JSON.stringify(entry) + '\n');
}

// Parse the ledger into objects, skipping any malformed lines.
function readHistory() {
  let raw = '';
  try { raw = fs.readFileSync(historyPath(), 'utf8'); } catch (e) { return []; }
  return raw.split('\n').reduce((acc, line) => {
    line = line.trim();
    if (!line) return acc;
    try { acc.push(JSON.parse(line)); } catch (e) {}
    return acc;
  }, []);
}

module.exports = {
  VALID_LEVELS,
  claudeDir,
  globalStatePath,
  flagPath,
  readState,
  writeState,
  studyDir,
  sessionsDir,
  historyPath,
  slugForCwd,
  sessionPath,
  sessionDir,
  readSession,
  writeSession,
  appendHistory,
  readHistory,
};
