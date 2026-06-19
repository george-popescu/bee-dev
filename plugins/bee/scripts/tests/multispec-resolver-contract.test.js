#!/usr/bin/env node
// Test: Command-contract assertions for batch8 multispec fixes.
//
// Contracts:
//   1. complete-spec.md contains specs-cli.js resolve (FIX 2)
//   2. archive-spec.md contains specs-cli.js resolve (FIX 2)
//   3. plan-phase.md contains exactly ONE specs-cli.js resolve occurrence (FIX 3 dedup)

const fs = require('fs');
const path = require('path');

const COMMANDS_DIR = path.join(__dirname, '..', '..', 'commands');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${testName}`);
  } else {
    failed++;
    console.log(`  FAIL: ${testName}`);
  }
}

function readCmd(name) {
  try { return fs.readFileSync(path.join(COMMANDS_DIR, name), 'utf8'); }
  catch (e) { return ''; }
}

function countOccurrences(content, needle) {
  let count = 0;
  let pos = 0;
  while ((pos = content.indexOf(needle, pos)) !== -1) { count++; pos += needle.length; }
  return count;
}

const RESOLVER_NEEDLE = 'specs-cli.js resolve';

// complete-spec.md has resolver
const completeSpec = readCmd('complete-spec.md');
assert(completeSpec.length > 0, 'complete-spec.md is readable');
assert(
  completeSpec.includes(RESOLVER_NEEDLE),
  'complete-spec.md contains specs-cli.js resolve (Step 0 added by FIX 2)'
);
assert(
  completeSpec.includes('Step 0'),
  'complete-spec.md has a Step 0 section'
);
assert(
  completeSpec.includes('No active spec to complete'),
  'complete-spec.md Step 0 handles mode:create with correct stop message'
);

// archive-spec.md has resolver
const archiveSpec = readCmd('archive-spec.md');
assert(archiveSpec.length > 0, 'archive-spec.md is readable');
assert(
  archiveSpec.includes(RESOLVER_NEEDLE),
  'archive-spec.md contains specs-cli.js resolve (Step 0 added by FIX 2)'
);
assert(
  archiveSpec.includes('Step 0'),
  'archive-spec.md has a Step 0 section'
);
assert(
  archiveSpec.includes('No active spec to archive'),
  'archive-spec.md Step 0 handles mode:create with correct stop message'
);

// plan-phase.md has exactly ONE resolver (FIX 3 dedup)
const planPhase = readCmd('plan-phase.md');
assert(planPhase.length > 0, 'plan-phase.md is readable');
const planResolverCount = countOccurrences(planPhase, RESOLVER_NEEDLE);
assert(
  planResolverCount === 1,
  `plan-phase.md contains exactly 1 specs-cli.js resolve occurrence (found ${planResolverCount}) — FIX 3 dedup`
);

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
