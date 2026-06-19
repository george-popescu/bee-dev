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

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
