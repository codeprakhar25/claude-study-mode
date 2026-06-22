// Smoke tests for study-mode hooks. Run: node test/guard.test.js
// Drives each hook the way Claude Code does — JSON on stdin, parse stdout —
// using an isolated CLAUDE_CONFIG_DIR and cwd so it never touches real state.

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HOOKS = path.join(ROOT, 'src', 'hooks');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'study-test-'));
const cfg = path.join(tmp, 'config');
const proj = path.join(tmp, 'proj');
fs.mkdirSync(cfg, { recursive: true });
fs.mkdirSync(proj, { recursive: true });

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ok  - ' + name); }
  else { fail++; console.log('  NOT ok - ' + name); }
}

function run(hook, payload) {
  const out = execFileSync(process.execPath, [path.join(HOOKS, hook)], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: cfg },
    cwd: proj,
  });
  try { return { raw: out, json: JSON.parse(out) }; } catch (e) { return { raw: out, json: null }; }
}

// 1. tracker: "study on" activates
let r = run('study-tracker.js', { prompt: 'study on' });
check('study on -> active state written', fs.existsSync(path.join(cfg, '.study-state.json')));
check('study on -> tracker reports activated', /Activated/.test(r.json && r.json.hookSpecificOutput.additionalContext));

// 2. guard: blocks a normal code write while active
r = run('study-guard.js', { tool_name: 'Write', tool_input: { file_path: path.join(proj, 'main.go') }, cwd: proj });
check('guard denies Write to main.go', r.json && r.json.hookSpecificOutput.permissionDecision === 'deny');

// 3. guard: allows writes inside legacy ./.study/
r = run('study-guard.js', { tool_name: 'Write', tool_input: { file_path: path.join(proj, '.study', 'session.json') }, cwd: proj });
check('guard allows write inside legacy .study/', r.raw.trim() === 'OK');

// 3b. guard: allows writes inside the central study dir (session + ledger)
r = run('study-guard.js', { tool_name: 'Write', tool_input: { file_path: path.join(cfg, 'study', 'sessions', 'proj-abc.json') }, cwd: proj });
check('guard allows write inside central study dir', r.raw.trim() === 'OK');
r = run('study-guard.js', { tool_name: 'Write', tool_input: { file_path: path.join(cfg, 'study', 'history.jsonl') }, cwd: proj });
check('guard allows write to central history.jsonl', r.raw.trim() === 'OK');

// 4. guard: relative path resolves against cwd and is still denied
r = run('study-guard.js', { tool_name: 'Edit', tool_input: { file_path: 'src/app.js' }, cwd: proj });
check('guard denies relative Edit', r.json && r.json.hookSpecificOutput.permissionDecision === 'deny');

// 5. lite level changes the deny reason
run('study-tracker.js', { prompt: 'study lite' });
r = run('study-guard.js', { tool_name: 'Write', tool_input: { file_path: path.join(proj, 'x.py') }, cwd: proj });
check('lite deny reason mentions pseudocode', r.json && /pseudocode/.test(r.json.hookSpecificOutput.permissionDecisionReason));

// 6. study off -> guard allows again
run('study-tracker.js', { prompt: 'study off' });
r = run('study-guard.js', { tool_name: 'Write', tool_input: { file_path: path.join(proj, 'main.go') }, cwd: proj });
check('study off -> guard allows Write', r.raw.trim() === 'OK');

// 7. activate hook injects persona when active
run('study-tracker.js', { prompt: 'study on' });
r = run('study-activate.js', {});
check('activate injects persona when active', /STUDY MODE ACTIVE/.test(r.raw));

// 8. activate hook is silent when off
run('study-tracker.js', { prompt: 'study off' });
r = run('study-activate.js', {});
check('activate silent when off', r.raw.trim() === 'OK');

// 9. flag sidecar + statusline render
run('study-tracker.js', { prompt: 'study strict' });
check('flag file written on activate', fs.readFileSync(path.join(cfg, '.study-active'), 'utf8') === 'strict');
let sl = execFileSync('bash', [path.join(HOOKS, 'study-statusline.sh')], {
  encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: cfg },
});
check('statusline renders STUDY:STRICT', /STUDY:STRICT/.test(sl));

run('study-tracker.js', { prompt: 'study off' });
check('flag file removed on deactivate', !fs.existsSync(path.join(cfg, '.study-active')));
sl = execFileSync('bash', [path.join(HOOKS, 'study-statusline.sh')], {
  encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: cfg },
});
check('statusline empty when off', sl.trim() === '');

// 10. state.js helpers — central storage round-trips
const state = require(path.join(ROOT, 'src', 'lib', 'state'));
process.env.CLAUDE_CONFIG_DIR = cfg;

// slugForCwd: stable for same path, distinct for different paths
check('slugForCwd stable', state.slugForCwd('/a/b/proj') === state.slugForCwd('/a/b/proj'));
check('slugForCwd unique', state.slugForCwd('/a/b/proj') !== state.slugForCwd('/a/b/other'));

// writeSession/readSession central round-trip
const sess = { topic: 'learn Go', plan: ['types', 'structs'], checkpoint: 1, passed: ['types'], cwd: proj };
const written = state.writeSession(proj, sess);
check('writeSession lands in central sessions dir', written.startsWith(path.join(cfg, 'study', 'sessions')));
check('readSession central round-trip', state.readSession(proj).checkpoint === 1);

// readSession legacy fallback (different cwd with only a local .study/)
const legacyProj = path.join(tmp, 'legacy');
fs.mkdirSync(path.join(legacyProj, '.study'), { recursive: true });
fs.writeFileSync(path.join(legacyProj, '.study', 'session.json'), JSON.stringify({ topic: 'old', checkpoint: 6 }));
check('readSession legacy fallback', state.readSession(legacyProj).checkpoint === 6);

// appendHistory/readHistory round-trip (append-only, skips malformed)
state.appendHistory({ ts: '2026-06-22', topic: 'Go', concept: 'types', project: proj, level: 'strict' });
state.appendHistory({ ts: '2026-06-22', topic: 'Go', concept: 'structs', project: proj, level: 'strict' });
fs.appendFileSync(state.historyPath(), 'not json\n');
const hist = state.readHistory();
check('readHistory parses both records, skips malformed', hist.length === 2 && hist[1].concept === 'structs');

fs.rmSync(tmp, { recursive: true, force: true });
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
