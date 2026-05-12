#!/usr/bin/env node
// Test: STYLISTIC-DECLINED strictness + cross-command parity (REQ-12).
//
// Verifies the three review-emitting commands (review.md,
// review-implementation.md, swarm-review.md) each document:
//   - The strict class-matching filter rule (REAL BUG candidates are NOT
//     suppressed by stylistic-declined entries).
//   - The canonical producer phrase persisting STYLISTIC-DECLINED entries to
//     .bee/false-positives.md.
//   - The canonical extractor block header ("EXCLUDE these stylistic-declined
//     findings").
// Also verifies review.md Step 7.2 references Step 3.9 dual-mode parsing on
// re-extraction.

const fs = require('fs');
const path = require('path');

const COMMANDS_DIR = path.join(__dirname, '..', '..', 'commands');

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    console.log(`  FAIL: ${name}`);
  }
}

function readFile(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (_e) {
    return null;
  }
}

// Named-constant inventory pattern: iterating a single list lets every command
// be checked uniformly, and adding/removing a command requires editing only
// this constant.
const STYLISTIC_DECLINE_COMMANDS = [
  'review.md',
  'review-implementation.md',
  'swarm-review.md',
];

console.log('=== D6 STYLISTIC-decline strictness + cross-command parity ===');

// Strictness assertions (3 -- one per command, iterating named constant).
for (const cmd of STYLISTIC_DECLINE_COMMANDS) {
  const content = readFile(path.join(COMMANDS_DIR, cmd));

  // Each command must document that REAL BUG candidates are NOT suppressed by
  // stylistic-declined entries. The wording is allowed to vary slightly across
  // commands so the assertion accepts multiple canonical orderings.
  assert(
    /STYLISTIC-DECLINED[\s\S]{0,500}(STYLISTIC|REAL BUG)[\s\S]{0,500}(not suppressed|NOT suppressed)/i.test(
      content
    ) ||
      /REAL BUG[\s\S]{0,500}(not suppressed|NOT suppressed)[\s\S]{0,500}STYLISTIC-DECLINED/i.test(
        content
      ) ||
      /REAL BUG[\s\S]{0,200}(not|NOT)[\s\S]{0,200}suppressed/i.test(content),
    `${cmd}: documents strict class-matching filter rule (REAL BUG never suppressed)`
  );
}

console.log(
  '\n=== Per-site assertions (6 -- producer + extractor per command) ==='
);

const reviewMd = readFile(path.join(COMMANDS_DIR, 'review.md'));
const reviewImplMd = readFile(path.join(COMMANDS_DIR, 'review-implementation.md'));
const swarmReviewMd = readFile(path.join(COMMANDS_DIR, 'swarm-review.md'));

const CANONICAL_PERSISTENCE =
  'Also append the finding to .bee/false-positives.md with Class: STYLISTIC-DECLINED';
const CANONICAL_BLOCK_HEADER = 'EXCLUDE these stylistic-declined findings';

// review.md producer site
assert(
  reviewMd.includes('Class: STYLISTIC-DECLINED') &&
    reviewMd.includes(CANONICAL_PERSISTENCE),
  'review.md producer: Class field + canonical persistence phrase'
);

// review.md extractor site
assert(
  reviewMd.includes(CANONICAL_BLOCK_HEADER),
  'review.md extractor: canonical "EXCLUDE these stylistic-declined findings" block header'
);

// review-implementation.md producer site
assert(
  reviewImplMd.includes('Class: STYLISTIC-DECLINED') &&
    reviewImplMd.includes(CANONICAL_PERSISTENCE),
  'review-implementation.md producer: Class field + canonical persistence phrase'
);

// review-implementation.md extractor site
assert(
  reviewImplMd.includes(CANONICAL_BLOCK_HEADER),
  'review-implementation.md extractor: canonical block header'
);

// swarm-review.md producer site (expanded from legacy single line).
assert(
  swarmReviewMd.includes('Class: STYLISTIC-DECLINED') &&
    swarmReviewMd.includes(CANONICAL_PERSISTENCE),
  'swarm-review.md producer: Class field + canonical persistence phrase (expanded from legacy single line)'
);

// swarm-review.md extractor site (expanded from legacy single line).
assert(
  swarmReviewMd.includes(CANONICAL_BLOCK_HEADER),
  'swarm-review.md extractor: canonical block header (expanded from legacy single line)'
);

console.log('\n=== Re-extraction site assertion (1) ===');

// Re-extraction site: review.md Step 7.2 references Step 3.9 dual-mode parse.
// Scope to the Step 7.2 section so prose mentioning "Step 7.2" elsewhere
// (e.g., Step 7.3's "refreshed false-positives list from Step 7.2") cannot
// satisfy the assertion. Anchor on the actual subsection heading shape
// (`#### 7.2:` or `### Step 7.2`).
const step72Match = reviewMd.match(
  /(?:^|\n)#{3,4}\s*(?:Step\s*)?7\.2[\s\S]*?(?=\n#{3,4}\s)/i
);
const step72Content = step72Match ? step72Match[0] : '';

assert(
  /Step 3\.9|dual-mode|stylistic-decline/i.test(step72Content),
  'review.md Step 7.2 re-extraction references Step 3.9 dual-mode parsing'
);

console.log(`\nResults: passed=${passed} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
