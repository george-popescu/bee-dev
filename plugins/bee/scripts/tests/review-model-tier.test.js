#!/usr/bin/env node
// Test: review.md and review-implementation.md Step 4.2 implement implementation_mode model-tier branching
// Verifies T8.9 acceptance criteria:
// - review.md Step 4.2: quality mode (default) -> omit model param (inherit); economy mode -> model: "sonnet"
// - review-implementation.md Step 4.2: same change
// - Economy sequential-per-stack spawning unchanged
// - Single-stack fast path unchanged
// - No other steps modified

const fs = require('fs');
const path = require('path');

const REVIEW_PATH = path.join(__dirname, '..', '..', 'commands', 'review.md');
const REVIEW_IMPL_PATH = path.join(__dirname, '..', '..', 'commands', 'review-implementation.md');

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

// Helper: extract content from a heading pattern to the next heading of same or higher level
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

// Read both files
let review, reviewImpl;
try {
  review = fs.readFileSync(REVIEW_PATH, 'utf8');
} catch (e) {
  console.log('FAIL: review.md does not exist');
  process.exit(1);
}
try {
  reviewImpl = fs.readFileSync(REVIEW_IMPL_PATH, 'utf8');
} catch (e) {
  console.log('FAIL: review-implementation.md does not exist');
  process.exit(1);
}

// ============================================================
// review.md Tests
// ============================================================

console.log('=== review.md ===\n');

const rvStep4_2 = extractSection('#### 4.2:', review);

// ----------------------------------------------------------
// Test 1: review.md Step 4.2 quality mode omits model (inherit parent)
// ----------------------------------------------------------
console.log('Test 1: review.md Step 4.2 quality mode omits model (inherit)');
assert(
  rvStep4_2.toLowerCase().includes('quality') &&
    (rvStep4_2.includes('omit') || rvStep4_2.includes('Omit') || rvStep4_2.includes('inherit')),
  'Step 4.2 quality mode omits model parameter (inherits parent)'
);

// ----------------------------------------------------------
// Test 2: review.md Step 4.2 quality mode does NOT say model: "sonnet" for quality
// ----------------------------------------------------------
console.log('\nTest 2: review.md Step 4.2 quality mode no longer hardcodes sonnet');
// The Quality mode paragraph should NOT instruct to use model: "sonnet"
// Extract just the Quality mode paragraph
const qualityParaRv = rvStep4_2.split('**Economy mode**')[0];
assert(
  qualityParaRv.includes('Quality mode') &&
    !qualityParaRv.includes('model: "sonnet"') &&
    !qualityParaRv.includes('Use `model: "sonnet"`'),
  'Step 4.2 quality mode paragraph does not contain model: "sonnet"'
);

// ----------------------------------------------------------
// Test 3: review.md Step 4.2 economy mode uses model: "sonnet"
// ----------------------------------------------------------
console.log('\nTest 3: review.md Step 4.2 economy mode uses model: "sonnet"');
assert(
  rvStep4_2.toLowerCase().includes('economy') && rvStep4_2.includes('sonnet'),
  'Step 4.2 economy mode specifies sonnet'
);

// ----------------------------------------------------------
// Test 4: review.md economy sequential-per-stack spawning unchanged
// ----------------------------------------------------------
console.log('\nTest 4: review.md economy mode still spawns sequentially per stack');
const economyParaRv = rvStep4_2.substring(rvStep4_2.indexOf('**Economy mode**'));
assert(
  economyParaRv.includes('sequentially per stack') || economyParaRv.includes('sequential'),
  'Economy mode still describes sequential per-stack spawning'
);

// ----------------------------------------------------------
// Test 5: review.md single-stack fast path unchanged
// ----------------------------------------------------------
console.log('\nTest 5: review.md single-stack fast path unchanged');
assert(
  rvStep4_2.includes('single-stack') || rvStep4_2.includes('single stack'),
  'Step 4.2 still references single-stack behavior'
);

// ----------------------------------------------------------
// Test 6: review.md no other steps modified (key sections intact)
// ----------------------------------------------------------
console.log('\nTest 6: review.md no other steps modified');
assert(
  review.includes('### Step 1: Validation Guards'),
  'review.md Step 1 unchanged'
);
assert(
  review.includes('### Step 2: Load Phase Context'),
  'review.md Step 2 unchanged'
);
assert(
  review.includes('### Step 3: Archive Previous Review'),
  'review.md Step 3 unchanged'
);
assert(
  review.includes('### Step 3.5: Build & Test Gate'),
  'review.md Step 3.5 unchanged'
);
assert(
  review.includes('### Step 3.9: Extract False Positives'),
  'review.md Step 3.9 unchanged'
);
assert(
  review.includes('#### 4.1: Determine stacks'),
  'review.md Step 4.1 unchanged'
);
assert(
  review.includes('#### 4.3: Parse findings'),
  'review.md Step 4.3 unchanged'
);
assert(
  review.includes('### Step 5:'),
  'review.md Step 5 unchanged'
);
assert(
  review.includes('### Step 6:'),
  'review.md Step 6 unchanged'
);

// ----------------------------------------------------------
// Test 7: review.md Step 4.2 explains rationale for mode-based selection
// ----------------------------------------------------------
console.log('\nTest 7: review.md Step 4.2 explains rationale');
assert(
  rvStep4_2.toLowerCase().includes('deep') ||
    rvStep4_2.toLowerCase().includes('inherit') ||
    rvStep4_2.toLowerCase().includes('reasoning') ||
    rvStep4_2.toLowerCase().includes('stronger'),
  'Step 4.2 explains rationale for quality mode (deeper analysis / inherit / reasoning)'
);

// ============================================================
// review-implementation.md Tests
// ============================================================

console.log('\n=== review-implementation.md ===\n');

const riStep4_2 = extractSection('#### 4.2:', reviewImpl);

// ----------------------------------------------------------
// Test 8: review-implementation.md Step 4.2 quality mode omits model (inherit)
// ----------------------------------------------------------
console.log('Test 8: review-implementation.md Step 4.2 quality mode omits model (inherit)');
assert(
  riStep4_2.toLowerCase().includes('quality') &&
    (riStep4_2.includes('omit') || riStep4_2.includes('Omit') || riStep4_2.includes('inherit')),
  'Step 4.2 quality mode omits model parameter (inherits parent)'
);

// ----------------------------------------------------------
// Test 9: review-implementation.md Step 4.2 quality mode no longer hardcodes sonnet
// ----------------------------------------------------------
console.log('\nTest 9: review-implementation.md Step 4.2 quality mode no longer hardcodes sonnet');
const qualityParaRi = riStep4_2.split('**Economy mode**')[0];
assert(
  qualityParaRi.includes('Quality mode') &&
    !qualityParaRi.includes('model: "sonnet"') &&
    !qualityParaRi.includes('Use `model: "sonnet"`'),
  'Step 4.2 quality mode paragraph does not contain model: "sonnet"'
);

// ----------------------------------------------------------
// Test 10: review-implementation.md Step 4.2 economy mode uses model: "sonnet"
// ----------------------------------------------------------
console.log('\nTest 10: review-implementation.md Step 4.2 economy mode uses model: "sonnet"');
assert(
  riStep4_2.toLowerCase().includes('economy') && riStep4_2.includes('sonnet'),
  'Step 4.2 economy mode specifies sonnet'
);

// ----------------------------------------------------------
// Test 11: review-implementation.md economy sequential-per-stack spawning unchanged
// ----------------------------------------------------------
console.log('\nTest 11: review-implementation.md economy mode still spawns sequentially per stack');
const economyParaRi = riStep4_2.substring(riStep4_2.indexOf('**Economy mode**'));
assert(
  economyParaRi.includes('sequentially per stack') || economyParaRi.includes('sequential'),
  'Economy mode still describes sequential per-stack spawning'
);

// ----------------------------------------------------------
// Test 12: review-implementation.md single-stack fast path unchanged
// ----------------------------------------------------------
console.log('\nTest 12: review-implementation.md single-stack reference intact');
assert(
  riStep4_2.includes('single-stack') || riStep4_2.includes('single stack'),
  'Step 4.2 still references single-stack behavior'
);

// ----------------------------------------------------------
// Test 13: review-implementation.md no other steps modified
// ----------------------------------------------------------
console.log('\nTest 13: review-implementation.md no other steps modified');
assert(
  reviewImpl.includes('### Step 1: Validation Guards'),
  'review-implementation.md Step 1 unchanged'
);
assert(
  reviewImpl.includes('### Step 2: Context Detection'),
  'review-implementation.md Step 2 unchanged'
);
assert(
  reviewImpl.includes('### Step 3: Build & Test Gate'),
  'review-implementation.md Step 3 unchanged'
);
assert(
  reviewImpl.includes('### Step 3.5: Extract False Positives'),
  'review-implementation.md Step 3.5 unchanged'
);
assert(
  reviewImpl.includes('#### 4.1: Determine stacks'),
  'review-implementation.md Step 4.1 unchanged'
);
assert(
  reviewImpl.includes('#### 4.3: Parse findings'),
  'review-implementation.md Step 4.3 unchanged'
);
assert(
  reviewImpl.includes('### Step 6: Validate-Fix Pipeline'),
  'review-implementation.md Step 6 unchanged'
);
assert(
  reviewImpl.includes('### Step 7: Summary and STATE.md Update'),
  'review-implementation.md Step 7 unchanged'
);

// ----------------------------------------------------------
// Test 14: review.md design notes updated for mode distinction
// ----------------------------------------------------------
console.log('\nTest 14: review.md design notes reflect quality/economy model distinction');
const rvDesignNotes = review.substring(review.lastIndexOf('**Design Notes'));
assert(
  rvDesignNotes.includes('quality') || rvDesignNotes.includes('inherit') ||
    rvDesignNotes.includes('omit'),
  'review.md design notes reflect quality mode model handling'
);

// ============================================================
// Results
// ============================================================
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
