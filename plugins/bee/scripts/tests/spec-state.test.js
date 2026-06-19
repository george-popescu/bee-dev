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

// mirror copies per-spec state to global .bee/STATE.md (same parse result)
assert(S.mirrorToGlobal(bee, 'my-feature') === true, 'mirror reports success');
const g = parseStateMd(S.globalStatePath(bee));
assert(g.currentSpec.name === 'My Feature', 'global mirror has the spec name');

// mirror is a no-op when the per-spec file is absent (legacy repos)
assert(S.mirrorToGlobal(bee, 'no-such-spec') === false, 'mirror no-ops on missing per-spec state');

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
