#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

let passed = 0, failed = 0;
function assert(cond, name) {
  if (cond) { passed++; console.log(`  PASS: ${name}`); }
  else { failed++; console.log(`  FAIL: ${name}`); }
}
const CLI = path.join(__dirname, '..', 'specs-cli.js');
function run(args) { return spawnSync('node', [CLI, ...args], { encoding: 'utf8' }); }
function tmpBee() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-cli-'));
  return path.join(d, '.bee');
}

const bee = tmpBee();

// register creates the registry row, the per-spec STATE.md, and the mirror
let res = run(['register', '--bee', bee, '--slug', 'alpha', '--title', 'Alpha', '--stage', 'planning']);
assert(res.status === 0, 'register exits 0');
assert(fs.existsSync(path.join(bee, 'specs.json')), 'register writes specs.json');
assert(fs.existsSync(path.join(bee, 'specs', 'alpha', 'STATE.md')), 'register writes per-spec STATE.md');
assert(fs.existsSync(path.join(bee, 'STATE.md')), 'register writes the global mirror');

// resolve with one active -> auto
res = run(['resolve', '--bee', bee]);
assert(JSON.parse(res.stdout).mode === 'auto', 'resolve auto with one active spec');

// second register -> resolve becomes pick, alpha+beta both listed
run(['register', '--bee', bee, '--slug', 'beta', '--title', 'Beta', '--stage', 'shaping']);
res = run(['resolve', '--bee', bee]);
const parsed = JSON.parse(res.stdout);
assert(parsed.mode === 'pick', 'resolve pick with two active specs');
assert(parsed.candidates.length === 2, 'resolve lists both active specs');

// list --active --json returns both
res = run(['list', '--bee', bee, '--active', '--json']);
assert(JSON.parse(res.stdout).length === 2, 'list --active --json returns active specs');

// worktree override
res = run(['resolve', '--bee', bee, '--worktree-spec', 'beta']);
assert(JSON.parse(res.stdout).slug === 'beta', 'resolve honors --worktree-spec');

// backward compat: empty registry + legacy global STATE.md -> auto that spec
const legacyBee = tmpBee();
fs.mkdirSync(legacyBee, { recursive: true });
fs.writeFileSync(path.join(legacyBee, 'STATE.md'),
  '# State\n\n## Current Spec\n- Name: Legacy\n- Path: .bee/specs/2026-01-01-legacy/\n- Status: IN_PROGRESS\n');
res = run(['resolve', '--bee', legacyBee]);
const lg = JSON.parse(res.stdout);
assert(lg.mode === 'auto' && lg.slug === '2026-01-01-legacy', 'resolve falls back to legacy STATE.md spec');
assert(lg.legacy === true, 'legacy fallback flagged');

// slug-less register exits non-zero and writes no registry row
const beeNoSlug = tmpBee();
let res2 = run(['register', '--bee', beeNoSlug, '--title', 'NoSlug']);
assert(res2.status !== 0, 'register without --slug exits non-zero');
assert(!fs.existsSync(path.join(beeNoSlug, 'specs.json')), 'register without --slug writes no registry row');

// legacy back-registration: repo with a legacy global STATE.md (no specs.json) registers a NEW spec
// -> both specs must end up active, and legacy per-spec STATE.md must be seeded
const up = tmpBee();
fs.mkdirSync(up, { recursive: true });
fs.writeFileSync(path.join(up, 'STATE.md'),
  '# State\n\n## Current Spec\n- Name: Alpha Legacy\n- Path: .bee/specs/2026-01-01-alpha/\n- Status: IN_PROGRESS\n\n## Phases\n| 1 | Foo | DONE |\n\n## Last Action\n- Command: /bee:execute-phase\n- Timestamp: x\n- Result: y\n');
run(['register', '--bee', up, '--slug', '2026-06-19-beta', '--title', 'Beta', '--stage', 'shaping']);
const act = JSON.parse(run(['list', '--bee', up, '--active', '--json']).stdout);
assert(act.length === 2, 'registering new spec back-registers the legacy spec (2 active)');
assert(fs.existsSync(path.join(up, 'specs', '2026-01-01-alpha', 'STATE.md')), 'legacy spec per-spec STATE.md is seeded');
assert(fs.readFileSync(path.join(up, 'specs', '2026-01-01-alpha', 'STATE.md'), 'utf8').includes('Foo'),
  'back-registered legacy spec preserves its phase content');

// slug-less register with a legacy STATE.md present must NOT backfill before failing
const legacyNoSlug = tmpBee();
fs.mkdirSync(legacyNoSlug, { recursive: true });
fs.writeFileSync(path.join(legacyNoSlug, 'STATE.md'), '# S\n\n## Current Spec\n- Name: L\n- Path: .bee/specs/2026-01-01-leg/\n- Status: IN_PROGRESS\n');
const r3 = run(['register', '--bee', legacyNoSlug, '--title', 'X']);
assert(r3.status !== 0, 'slug-less register exits non-zero even with a legacy spec present');
assert(!fs.existsSync(path.join(legacyNoSlug, 'specs.json')), 'slug-less register does not back-register before failing');

// Finding #1 regression: single-spec phases survive a touch
{
  const sp = tmpBee(); fs.mkdirSync(sp, { recursive: true });
  run(['register', '--bee', sp, '--slug', 's1', '--title', 'S1', '--stage', 'planning']);
  // simulate a command (new-spec Step 11) writing the phases table into the GLOBAL state:
  const gPath = path.join(sp, 'STATE.md');
  fs.writeFileSync(gPath, fs.readFileSync(gPath, 'utf8').replace('## Phases', '## Phases\n| 1 | Build | PENDING |'));
  run(['touch', '--bee', sp, '--slug', 's1']);     // resolver auto path
  assert(fs.readFileSync(gPath, 'utf8').includes('| 1 | Build | PENDING |'),
    'touch on the same single spec does not clobber phases written to global');
  assert(fs.readFileSync(path.join(sp, 'specs', 's1', 'STATE.md'), 'utf8').includes('| 1 | Build | PENDING |'),
    'touch captures global into the per-spec snapshot');
}

// Switch restores the other spec's state
{
  const sw = tmpBee(); fs.mkdirSync(sw, { recursive: true });
  run(['register', '--bee', sw, '--slug', 'a', '--title', 'A', '--stage', 'planning']);
  const gp = path.join(sw, 'STATE.md');
  fs.writeFileSync(gp, fs.readFileSync(gp, 'utf8').replace('## Phases', '## Phases\n| 1 | AephA | DONE |'));
  run(['touch', '--bee', sw, '--slug', 'a']);       // capture A
  run(['register', '--bee', sw, '--slug', 'b', '--title', 'B', '--stage', 'shaping']); // switch to B (saves A)
  run(['touch', '--bee', sw, '--slug', 'a']);       // switch back to A -> restore
  assert(fs.readFileSync(gp, 'utf8').includes('| 1 | AephA | DONE |'),
    'switching back to a spec restores its saved state into global');
}

// re-register same slug preserves global phases table
const rr = tmpBee(); fs.mkdirSync(rr, { recursive: true });
run(['register', '--bee', rr, '--slug', 'dup', '--title', 'Dup', '--stage', 'planning']);
const gpath = path.join(rr, 'STATE.md');
fs.writeFileSync(gpath, fs.readFileSync(gpath, 'utf8').replace('## Phases', '## Phases\n| 1 | Keep | PENDING |'));
run(['register', '--bee', rr, '--slug', 'dup', '--title', 'Dup', '--stage', 'planning']); // re-register SAME slug
assert(fs.readFileSync(gpath, 'utf8').includes('| 1 | Keep | PENDING |'),
  're-registering the live spec slug preserves the global phases table');

// register preserves global Quick Tasks + Decisions Log on first-spec creation
{
  const richBee = tmpBee(); fs.mkdirSync(richBee, { recursive: true });
  fs.writeFileSync(path.join(richBee, 'STATE.md'),
    '# State\n\n## Current Spec\n- Name: (none)\n- Path: (none)\n- Status: NO_SPEC\n\n## Phases\n\n## Quick Tasks\n| 1 | Bump deps | 2026-06 | def |\n\n## Decisions Log\n**[Use Vitest]**: ok\n\n## Last Action\n- Command: /bee:quick\n- Timestamp: t\n- Result: r\n');
  run(['register', '--bee', richBee, '--slug', '2026-06-19-first', '--title', 'First', '--stage', 'shaping']);
  const rg = fs.readFileSync(path.join(richBee, 'STATE.md'), 'utf8');
  assert(rg.includes('Bump deps'), 'register preserves global Quick Tasks on first-spec creation');
  assert(rg.includes('Use Vitest'), 'register preserves global Decisions Log on first-spec creation');
}

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
