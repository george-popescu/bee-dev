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
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
