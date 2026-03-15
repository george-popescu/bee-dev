#!/usr/bin/env node
// Test: plan-phase.md Step 8 writes "Yes (1)" format in Plan Review column

const fs = require('fs');
const path = require('path');

const PLAN_PHASE_PATH = path.join(
  __dirname, '..', '..', 'commands', 'plan-phase.md'
);

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

// Helper: extract content between a section heading and the next heading of same or higher level
function extractSection(heading, fullContent) {
  const startIdx = fullContent.indexOf(heading);
  if (startIdx === -1) return '';
  const afterHeading = fullContent.substring(startIdx + heading.length);
  const headingLevel = heading.match(/^#+/)?.[0].length || 2;
  const nextHeadingPattern = new RegExp(`\\n#{1,${headingLevel}} `);
  const nextH = afterHeading.search(nextHeadingPattern);
  if (nextH === -1) return afterHeading;
  return afterHeading.substring(0, nextH);
}

// Read plan-phase.md
let planPhase;
try {
  planPhase = fs.readFileSync(PLAN_PHASE_PATH, 'utf8');
} catch (e) {
  console.log('FAIL: plan-phase.md does not exist');
  process.exit(1);
}

const step8 = extractSection('### Step 8:', planPhase);
const step9 = extractSection('### Step 9:', planPhase);

console.log('=== plan-phase.md Plan Review "Yes (1)" format ===\n');

// ----------------------------------------------------------
// Test 1: Step 8 item 2 sets Plan Review to "Yes (1)" for reviewed result
// ----------------------------------------------------------
console.log('Test 1: Step 8 Plan Review column uses "Yes (1)" for reviewed result');
assert(
  step8.includes('Yes (1)'),
  'Step 8 mentions "Yes (1)" for plan review column'
);
// The "reviewed" bullet should contain "Yes (1)"
const reviewedLine = step8.split('\n').find(l =>
  l.includes('reviewed') && l.includes('Plan Review') ||
  (l.includes('reviewed') && l.includes('set to'))
);
assert(
  reviewedLine && reviewedLine.includes('Yes (1)'),
  'Step 8 reviewed result line contains "Yes (1)"'
);

// ----------------------------------------------------------
// Test 2: Step 8 item 2 does NOT use bare "Yes" for reviewed result
// ----------------------------------------------------------
console.log('\nTest 2: Step 8 Plan Review column does not use bare "Yes" for reviewed');
// Find the specific line about plan review "reviewed" result
const planReviewLines = step8.split('\n').filter(l =>
  l.includes('reviewed') && (l.includes('set to') || l.includes('Plan Review'))
);
// None of the reviewed-result lines should have bare `Yes` without (1)
const hasBareYes = planReviewLines.some(l => {
  // Match `Yes` that is NOT followed by ` (`
  return /`Yes`/.test(l) && !l.includes('`Yes (1)`');
});
assert(
  !hasBareYes,
  'Step 8 reviewed result does not use bare `Yes` (uses `Yes (1)` instead)'
);

// ----------------------------------------------------------
// Test 3: Step 8 item 2 still sets "Skipped" for skipped result (unchanged)
// ----------------------------------------------------------
console.log('\nTest 3: Step 8 Plan Review column still uses "Skipped" for skipped result');
assert(
  step8.includes('Skipped'),
  'Step 8 still has "Skipped" value for skipped plan review'
);

// ----------------------------------------------------------
// Test 4: Step 9 completion summary shows "Yes (1)" for reviewed
// ----------------------------------------------------------
console.log('\nTest 4: Step 9 shows "Yes (1)" in plan review display');
assert(
  step9.includes('Yes (1)'),
  'Step 9 completion summary mentions "Yes (1)"'
);

// ----------------------------------------------------------
// Test 5: Step 8 Plan column still uses bare "Yes" (unchanged)
// ----------------------------------------------------------
console.log('\nTest 5: Step 8 Plan column still uses bare "Yes"');
const planColumnLine = step8.split('\n').find(l =>
  l.includes('**Plan**') && l.includes('Yes')
);
assert(
  planColumnLine && planColumnLine.includes('`Yes`'),
  'Step 8 Plan column still uses bare `Yes`'
);

// ----------------------------------------------------------
// Test 6: Step 8 status values are unchanged
// ----------------------------------------------------------
console.log('\nTest 6: Step 8 status values are unchanged');
assert(
  step8.includes('PLAN_REVIEWED'),
  'Step 8 still sets PLAN_REVIEWED status for reviewed result'
);
assert(
  step8.includes('PLANNED'),
  'Step 8 still sets PLANNED status for skipped result'
);

// ============================================================
// Results
// ============================================================
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
