#!/usr/bin/env node
// Test: AC8 -- All 12 /clear occurrences across 10 command files demoted from
// standalone first-line to parenthetical hint.

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

// All 10 files that contain /clear references
const FILES_WITH_CLEAR = [
  'review.md',
  'plan-phase.md',
  'execute-phase.md',
  'test.md',
  'commit.md',
  'add-phase.md',
  'archive-spec.md',
  'init.md',
  'new-spec.md',
  'review-implementation.md',
];

console.log('=== AC8: /clear demoted from standalone to parenthetical hint ===\n');

// ----------------------------------------------------------
// Test: No file has "/clear" as a standalone line (first line of "Next step")
// The old pattern was:
//   Next step:
//     /clear
//     /bee:command
//
// The new pattern should be something like:
//   Next step: /bee:command (run /clear first if context is long)
// or:
//   Next step:
//     /bee:command (/clear first if needed)
// ----------------------------------------------------------

for (const filename of FILES_WITH_CLEAR) {
  const filepath = path.join(COMMANDS_DIR, filename);
  let content;
  try {
    content = fs.readFileSync(filepath, 'utf8');
  } catch (e) {
    console.log(`FAIL: ${filename} does not exist`);
    failed++;
    continue;
  }

  // Check that /clear does NOT appear as a standalone indented line
  // Pattern: a line that is just whitespace + /clear (nothing else on the line)
  const standalonePattern = /^\s+\/clear\s*$/m;
  const hasStandaloneClear = standalonePattern.test(content);

  assert(
    !hasStandaloneClear,
    `${filename}: /clear is NOT a standalone line`
  );
}

// ----------------------------------------------------------
// Test: /clear still appears in each file (as a hint, not removed entirely)
// ----------------------------------------------------------
console.log('\n--- /clear still referenced in each file ---\n');

for (const filename of FILES_WITH_CLEAR) {
  const filepath = path.join(COMMANDS_DIR, filename);
  let content;
  try {
    content = fs.readFileSync(filepath, 'utf8');
  } catch (e) {
    continue; // Already reported above
  }

  assert(
    content.includes('/clear'),
    `${filename}: /clear is still referenced (as hint)`
  );
}

// ----------------------------------------------------------
// Test: Each file still has a "Next step" section
// ----------------------------------------------------------
console.log('\n--- Each file still has Next step section ---\n');

for (const filename of FILES_WITH_CLEAR) {
  const filepath = path.join(COMMANDS_DIR, filename);
  let content;
  try {
    content = fs.readFileSync(filepath, 'utf8');
  } catch (e) {
    continue;
  }

  assert(
    content.includes('Next step'),
    `${filename}: has "Next step" section`
  );
}

// ----------------------------------------------------------
// Test: Total /clear count -- should be exactly 12 across all files
// (Some files have 2: new-spec.md and review-implementation.md)
// ----------------------------------------------------------
console.log('\n--- Total /clear count across all files ---\n');

let totalClearCount = 0;
for (const filename of FILES_WITH_CLEAR) {
  const filepath = path.join(COMMANDS_DIR, filename);
  let content;
  try {
    content = fs.readFileSync(filepath, 'utf8');
  } catch (e) {
    continue;
  }
  const matches = content.match(/\/clear/g);
  totalClearCount += matches ? matches.length : 0;
}

// The plan says 12 occurrences. After demotion they should still exist (as hints).
// Allow >= 12 in case design notes also reference /clear.
assert(
  totalClearCount >= 12,
  `Total /clear references across all files is >= 12 (found ${totalClearCount})`
);

// ============================================================
// Results
// ============================================================
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
