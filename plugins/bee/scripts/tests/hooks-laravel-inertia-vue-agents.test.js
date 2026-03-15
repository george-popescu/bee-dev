#!/usr/bin/env node
// Test: hooks.json has SubagentStop entries for 3 laravel-inertia-vue agents
// and SubagentStart matcher includes them.

const fs = require('fs');
const path = require('path');

const HOOKS_PATH = path.join(
  __dirname, '..', '..', 'hooks', 'hooks.json'
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

// ============================================================
// Test 0: hooks.json is valid JSON
// ============================================================
console.log('Test 0: hooks.json is valid JSON');
let hooks;
try {
  const raw = fs.readFileSync(HOOKS_PATH, 'utf8');
  hooks = JSON.parse(raw);
  assert(true, 'hooks.json parses as valid JSON');
} catch (e) {
  assert(false, `hooks.json parses as valid JSON -- Error: ${e.message}`);
  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
  process.exit(1);
}

// ============================================================
// Test 1: SubagentStart matcher matches all agents (including laravel-inertia-vue)
// ============================================================
console.log('\nTest 1: SubagentStart matcher matches new agent names');
const subagentStartEntries = hooks.hooks.SubagentStart;
assert(Array.isArray(subagentStartEntries) && subagentStartEntries.length > 0, 'SubagentStart array exists');

const startMatcher = subagentStartEntries[0].matcher;
const matcherRegex = new RegExp(startMatcher);
const newAgentNames = [
  'laravel-inertia-vue-bug-detector',
  'laravel-inertia-vue-pattern-reviewer',
  'laravel-inertia-vue-implementer',
];
for (const name of newAgentNames) {
  assert(
    matcherRegex.test(name),
    `SubagentStart matcher matches "${name}"`
  );
}

// ============================================================
// Test 2: SubagentStop has entry for laravel-inertia-vue-bug-detector
// ============================================================
console.log('\nTest 2: SubagentStop entry for laravel-inertia-vue-bug-detector');
const stopEntries = hooks.hooks.SubagentStop;
assert(Array.isArray(stopEntries), 'SubagentStop array exists');

const bugDetectorEntry = stopEntries.find(e => e.matcher === 'laravel-inertia-vue-bug-detector');
assert(bugDetectorEntry !== undefined, 'laravel-inertia-vue-bug-detector entry exists');
assert(
  bugDetectorEntry && bugDetectorEntry.hooks && bugDetectorEntry.hooks.length === 1,
  'bug-detector entry has exactly 1 hook'
);
assert(
  bugDetectorEntry && bugDetectorEntry.hooks[0].type === 'prompt',
  'bug-detector hook type is "prompt"'
);
assert(
  bugDetectorEntry && bugDetectorEntry.hooks[0].prompt.includes('Bugs Detected'),
  'bug-detector prompt mentions "Bugs Detected"'
);
assert(
  bugDetectorEntry && bugDetectorEntry.hooks[0].prompt.includes('Critical'),
  'bug-detector prompt mentions "Critical" severity'
);
assert(
  bugDetectorEntry && bugDetectorEntry.hooks[0].prompt.includes('$ARGUMENTS'),
  'bug-detector prompt includes $ARGUMENTS placeholder'
);
assert(
  bugDetectorEntry && bugDetectorEntry.hooks[0].timeout === 30,
  'bug-detector hook timeout is 30'
);

// ============================================================
// Test 3: SubagentStop has entry for laravel-inertia-vue-pattern-reviewer
// ============================================================
console.log('\nTest 3: SubagentStop entry for laravel-inertia-vue-pattern-reviewer');
const patternReviewerEntry = stopEntries.find(e => e.matcher === 'laravel-inertia-vue-pattern-reviewer');
assert(patternReviewerEntry !== undefined, 'laravel-inertia-vue-pattern-reviewer entry exists');
assert(
  patternReviewerEntry && patternReviewerEntry.hooks && patternReviewerEntry.hooks.length === 1,
  'pattern-reviewer entry has exactly 1 hook'
);
assert(
  patternReviewerEntry && patternReviewerEntry.hooks[0].type === 'prompt',
  'pattern-reviewer hook type is "prompt"'
);
assert(
  patternReviewerEntry && patternReviewerEntry.hooks[0].prompt.includes('Project Pattern Deviations'),
  'pattern-reviewer prompt mentions "Project Pattern Deviations"'
);
assert(
  patternReviewerEntry && patternReviewerEntry.hooks[0].prompt.includes('$ARGUMENTS'),
  'pattern-reviewer prompt includes $ARGUMENTS placeholder'
);
assert(
  patternReviewerEntry && patternReviewerEntry.hooks[0].timeout === 30,
  'pattern-reviewer hook timeout is 30'
);

// ============================================================
// Test 4: SubagentStop has entry for laravel-inertia-vue-implementer
// ============================================================
console.log('\nTest 4: SubagentStop entry for laravel-inertia-vue-implementer');
const implementerEntry = stopEntries.find(e => e.matcher === 'laravel-inertia-vue-implementer');
assert(implementerEntry !== undefined, 'laravel-inertia-vue-implementer entry exists');
assert(
  implementerEntry && implementerEntry.hooks && implementerEntry.hooks.length === 1,
  'implementer entry has exactly 1 hook'
);
assert(
  implementerEntry && implementerEntry.hooks[0].type === 'prompt',
  'implementer hook type is "prompt"'
);
assert(
  implementerEntry && implementerEntry.hooks[0].prompt.includes('implementer'),
  'implementer prompt mentions "implementer"'
);
assert(
  implementerEntry && implementerEntry.hooks[0].prompt.includes('TDD'),
  'implementer prompt mentions "TDD"'
);
assert(
  implementerEntry && implementerEntry.hooks[0].prompt.includes('$ARGUMENTS'),
  'implementer prompt includes $ARGUMENTS placeholder'
);
assert(
  implementerEntry && implementerEntry.hooks[0].timeout === 30,
  'implementer hook timeout is 30'
);

// ============================================================
// Test 5: Prompt structure matches generic counterparts
// ============================================================
console.log('\nTest 5: Prompts match structure of generic counterparts');
const genericBugDetector = stopEntries.find(e => e.matcher === '^bug-detector$');
const genericPatternReviewer = stopEntries.find(e => e.matcher === '^pattern-reviewer$');
const genericImplementer = stopEntries.find(e => e.matcher === '^implementer$');

assert(
  genericBugDetector && bugDetectorEntry &&
  bugDetectorEntry.hooks[0].prompt === genericBugDetector.hooks[0].prompt.replace(
    'bug-detector', 'laravel-inertia-vue-bug-detector'
  ),
  'bug-detector prompt matches generic structure with agent name replaced'
);
assert(
  genericPatternReviewer && patternReviewerEntry &&
  patternReviewerEntry.hooks[0].prompt === genericPatternReviewer.hooks[0].prompt.replace(
    'pattern-reviewer', 'laravel-inertia-vue-pattern-reviewer'
  ),
  'pattern-reviewer prompt matches generic structure with agent name replaced'
);
assert(
  genericImplementer && implementerEntry &&
  implementerEntry.hooks[0].prompt === genericImplementer.hooks[0].prompt.replace(
    'implementer', 'laravel-inertia-vue-implementer'
  ),
  'implementer prompt matches generic structure with agent name replaced'
);

// ============================================================
// Test 6: Generic entries still exist (no accidental removal)
// ============================================================
console.log('\nTest 6: Generic entries still exist');
assert(genericBugDetector !== undefined, 'Generic bug-detector entry still exists');
assert(genericPatternReviewer !== undefined, 'Generic pattern-reviewer entry still exists');
assert(genericImplementer !== undefined, 'Generic implementer entry still exists');

// ============================================================
// Results
// ============================================================
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
