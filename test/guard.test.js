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

// 3. guard: allows writes inside ./.study/
r = run('study-guard.js', { tool_name: 'Write', tool_input: { file_path: path.join(proj, '.study', 'session.json') }, cwd: proj });
check('guard allows write inside .study/', r.raw.trim() === 'OK');

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

fs.rmSync(tmp, { recursive: true, force: true });
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
