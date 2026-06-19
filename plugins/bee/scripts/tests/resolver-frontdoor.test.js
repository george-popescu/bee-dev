#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
let passed = 0, failed = 0;
function assert(cond, name) {
  if (cond) { passed++; console.log(`  PASS: ${name}`); }
  else { failed++; console.log(`  FAIL: ${name}`); }
}
const dir = path.join(__dirname, '..', '..', 'commands');
for (const cmd of ['plan-phase.md', 'discuss.md', 'execute-phase.md']) {
  const c = fs.readFileSync(path.join(dir, cmd), 'utf8');
  assert(c.includes('specs-cli.js resolve'), `${cmd} consults the resolver`);
  assert(c.includes('"mode":"pick"'), `${cmd} handles the pick (2+ specs) branch`);
}

const fs2 = require('fs');
const planC = fs2.readFileSync(path.join(dir, 'plan-phase.md'), 'utf8');
const execC = fs2.readFileSync(path.join(dir, 'execute-phase.md'), 'utf8');
const discC = fs2.readFileSync(path.join(dir, 'discuss.md'), 'utf8');
// plan-phase and execute-phase STOP on create (they need a spec)
assert(/"mode":"create"[\s\S]{0,160}(Stop|stop)/.test(planC), 'plan-phase stops on create (needs a spec)');
assert(/"mode":"create"[\s\S]{0,160}(Stop|stop)/.test(execC), 'execute-phase stops on create (needs a spec)');
// discuss PROCEEDS on create (pre-spec command, must not stop)
assert(/"mode":"create"[\s\S]{0,160}proceed/i.test(discC), 'discuss proceeds on create (pre-spec)');
assert(!/"mode":"create"[\s\S]{0,160}\bStop\b/.test(discC), 'discuss does not stop on create');

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
