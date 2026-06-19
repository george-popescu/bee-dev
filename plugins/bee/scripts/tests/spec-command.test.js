#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
let passed = 0, failed = 0;
function assert(cond, name) {
  if (cond) { passed++; console.log(`  PASS: ${name}`); }
  else { failed++; console.log(`  FAIL: ${name}`); }
}
const CMD = path.join(__dirname, '..', '..', 'commands', 'spec.md');
let content;
try { content = fs.readFileSync(CMD, 'utf8'); }
catch (e) { console.log('FAIL: commands/spec.md missing'); console.log('\nResults: 0 passed, 1 failed out of 1 assertions'); process.exit(1); }

assert(content.startsWith('---'), 'has YAML frontmatter');
assert(/description:/.test(content), 'frontmatter has description');
assert(/argument-hint:.*list/.test(content), 'argument-hint mentions list');
assert(content.includes('specs-cli.js list'), 'list subcommand calls specs-cli list');
assert(content.includes('specs-cli.js resolve'), 'use/status path calls specs-cli resolve');
assert(content.includes('${CLAUDE_PLUGIN_ROOT}/scripts/specs-cli.js'), 'invokes the CLI via CLAUDE_PLUGIN_ROOT');
assert(/NOT_INITIALIZED/.test(content), 'has the NOT_INITIALIZED guard like sibling commands');
assert(content.includes('specs-cli.js touch'), 'use subcommand calls specs-cli touch');

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
