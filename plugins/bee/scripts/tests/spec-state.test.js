#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const S = require('../spec-state');
const { parseStateMd } = require('../hive-state-parser');

let passed = 0, failed = 0;
function assert(cond, name) {
  if (cond) { passed++; console.log(`  PASS: ${name}`); }
  else { failed++; console.log(`  FAIL: ${name}`); }
}
function tmpBee() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-state-'));
  return path.join(d, '.bee');
}

const bee = tmpBee();

// init creates a per-spec STATE.md the existing parser can read
const p = S.initSpecState(bee, 'my-feature', { name: 'My Feature', status: 'SPEC_CREATED' });
assert(fs.existsSync(p), 'initSpecState writes the file');
const parsedSpec = parseStateMd(p);
assert(parsedSpec.currentSpec.name === 'My Feature', 'per-spec STATE.md parses Name');
assert(parsedSpec.currentSpec.path === 'my-feature', 'per-spec STATE.md parses Path slug');
assert(parsedSpec.currentSpec.status === 'SPEC_CREATED', 'per-spec STATE.md parses Status');

// init is idempotent (does not clobber an edited per-spec STATE.md)
fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('SPEC_CREATED', 'IN_PROGRESS'));
S.initSpecState(bee, 'my-feature', { name: 'My Feature', status: 'SPEC_CREATED' });
assert(parseStateMd(p).currentSpec.status === 'IN_PROGRESS', 'initSpecState does not overwrite existing');

// renderSpecState includes ## Quick Tasks and ## Decisions Log
{
  const rendered = S.renderSpecState({ name: 'Test Spec', slug: 'test-spec', status: 'SPEC_CREATED' });
  assert(rendered.includes('## Quick Tasks'), 'renderSpecState emits ## Quick Tasks section');
  assert(rendered.includes('## Decisions Log'), 'renderSpecState emits ## Decisions Log section');
}

// restoreToGlobal preserves project-global sections from the live global
{
  const beeR = tmpBee(); fs.mkdirSync(beeR, { recursive: true });
  // existing rich global (has quick tasks + decisions, plus an OLD current spec)
  fs.writeFileSync(S.globalStatePath(beeR),
    '# State\n\n## Current Spec\n- Name: Old\n- Path: .bee/specs/old/\n- Status: IN_PROGRESS\n\n## Phases\n| 1 | OldPhase | DONE |\n\n## Quick Tasks\n| 1 | Hotfix login | 2026-05 | abc |\n\n## Decisions Log\n**[Adopted pnpm]**: yes\n\n## Last Action\n- Command: /bee:quick\n- Timestamp: t\n- Result: r\n');
  // a per-spec snapshot for a NEW spec (skeleton, no quick tasks/decisions)
  S.initSpecState(beeR, 'newspec', { name: 'New Spec', status: 'SPEC_CREATED' });
  assert(S.restoreToGlobal(beeR, 'newspec') === true, 'restoreToGlobal succeeds');
  const g = fs.readFileSync(S.globalStatePath(beeR), 'utf8');
  assert(g.includes('Hotfix login'), 'restoreToGlobal preserves the global Quick Tasks section');
  assert(g.includes('Adopted pnpm'), 'restoreToGlobal preserves the global Decisions Log section');
  const parsed = parseStateMd(S.globalStatePath(beeR));
  assert(parsed.currentSpec.name === 'New Spec', 'restoreToGlobal applies the per-spec Current Spec');
  assert(parsed.quickTasks.length === 1, 'parser still sees the preserved quick task');
}

// mirror copies per-spec state to global .bee/STATE.md (same parse result)
assert(S.mirrorToGlobal(bee, 'my-feature') === true, 'mirror reports success');
const g = parseStateMd(S.globalStatePath(bee));
assert(g.currentSpec.name === 'My Feature', 'global mirror has the spec name');

// mirror is a no-op when the per-spec file is absent (legacy repos)
assert(S.mirrorToGlobal(bee, 'no-such-spec') === false, 'mirror no-ops on missing per-spec state');

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
