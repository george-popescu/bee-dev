#!/usr/bin/env node
// Test: plan-phase.md and plan-review.md implement implementation_mode model-tier branching
// Verifies T8.2 acceptance criteria:
// - Steps 3,4,5 always use model: "sonnet" regardless of mode
// - Step 6.2 branches: economy=model: "sonnet", quality=omit model (inherit)
// - plan-review.md Step 3.2 has same branching
// - Clear inline comments

const fs = require('fs');
const path = require('path');

const PLAN_PHASE_PATH = path.join(
  __dirname, '..', '..', 'commands', 'plan-phase.md'
);
const PLAN_REVIEW_PATH = path.join(
  __dirname, '..', '..', 'commands', 'plan-review.md'
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

// Read both files
let planPhase, planReview;
try {
  planPhase = fs.readFileSync(PLAN_PHASE_PATH, 'utf8');
} catch (e) {
  console.log('FAIL: plan-phase.md does not exist');
  process.exit(1);
}
try {
  planReview = fs.readFileSync(PLAN_REVIEW_PATH, 'utf8');
} catch (e) {
  console.log('FAIL: plan-review.md does not exist');
  process.exit(1);
}

// ============================================================
// plan-phase.md Tests
// ============================================================

// Extract relevant sections
const step3 = extractSection('### Step 3:', planPhase);
const step4 = extractSection('### Step 4:', planPhase);
const step5 = extractSection('### Step 5:', planPhase);
const step6 = extractSection('### Step 6:', planPhase);
const step6_2 = extractSection('#### 6.2:', planPhase);

console.log('=== plan-phase.md ===\n');

// ----------------------------------------------------------
// Test 1: Step 3 always uses model: "sonnet" (mode-independent)
// ----------------------------------------------------------
console.log('Test 1: Step 3 (phase-planner Pass 1) always uses model: "sonnet"');
assert(
  step3.includes('model: "sonnet"'),
  'Step 3 specifies model: "sonnet" for phase-planner'
);
// Should NOT mention implementation_mode branching in step 3
assert(
  !step3.includes('implementation_mode') && !step3.includes('economy') && !step3.includes('quality'),
  'Step 3 does not branch on implementation_mode (always sonnet)'
);

// ----------------------------------------------------------
// Test 2: Step 4 always uses model: "sonnet" (mode-independent)
// ----------------------------------------------------------
console.log('\nTest 2: Step 4 (researcher) always uses model: "sonnet"');
assert(
  step4.includes('model: "sonnet"'),
  'Step 4 specifies model: "sonnet" for researcher'
);
assert(
  !step4.includes('implementation_mode') && !step4.includes('economy') && !step4.includes('quality'),
  'Step 4 does not branch on implementation_mode (always sonnet)'
);

// ----------------------------------------------------------
// Test 3: Step 5 always uses model: "sonnet" (mode-independent)
// ----------------------------------------------------------
console.log('\nTest 3: Step 5 (phase-planner Pass 2) always uses model: "sonnet"');
assert(
  step5.includes('model: "sonnet"'),
  'Step 5 specifies model: "sonnet" for phase-planner'
);
assert(
  !step5.includes('implementation_mode') && !step5.includes('economy') && !step5.includes('quality'),
  'Step 5 does not branch on implementation_mode (always sonnet)'
);

// ----------------------------------------------------------
// Test 4: Step 6 reads implementation_mode from config
// ----------------------------------------------------------
console.log('\nTest 4: Step 6 reads implementation_mode from config');
assert(
  step6.includes('implementation_mode'),
  'Step 6 references implementation_mode'
);

// ----------------------------------------------------------
// Test 5: Step 6.2 economy mode uses model: "sonnet" for review agents
// ----------------------------------------------------------
console.log('\nTest 5: Step 6.2 economy mode uses model: "sonnet"');
assert(
  step6_2.includes('economy') || step6_2.includes('Economy'),
  'Step 6.2 mentions economy mode'
);
assert(
  step6_2.toLowerCase().includes('economy') && step6_2.includes('model: "sonnet"'),
  'Step 6.2 economy mode specifies model: "sonnet"'
);

// ----------------------------------------------------------
// Test 6: Step 6.2 quality mode omits model (inherit parent)
// ----------------------------------------------------------
console.log('\nTest 6: Step 6.2 quality mode omits model (inherits parent)');
assert(
  step6_2.includes('quality') || step6_2.includes('Quality'),
  'Step 6.2 mentions quality mode'
);
assert(
  step6_2.toLowerCase().includes('quality') &&
    (step6_2.includes('omit model') || step6_2.includes('omit the model') || step6_2.includes('inherit')),
  'Step 6.2 quality mode omits model parameter (inherits parent)'
);

// ----------------------------------------------------------
// Test 7: Step 6.1 agent definitions no longer hardcode model: "sonnet"
// ----------------------------------------------------------
console.log('\nTest 7: Step 6.1 agent definitions do not hardcode model for review agents');
const step6_1 = extractSection('#### 6.1:', planPhase);
// The 4 agent definitions in 6.1 should NOT have model: "sonnet" hardcoded
// because the model is now determined by 6.2 based on implementation_mode
// Count occurrences of model: "sonnet" in agent definition lines
const agentDefLines = step6_1.split('\n').filter(l =>
  l.includes('Agent') && (l.includes('Bug Detector') || l.includes('Pattern Reviewer') ||
  l.includes('Plan Compliance Reviewer') || l.includes('Stack Reviewer'))
);
const agentDefsWithSonnet = agentDefLines.filter(l => l.includes('model: "sonnet"'));
assert(
  agentDefsWithSonnet.length === 0,
  'Agent definitions in 6.1 do not hardcode model: "sonnet" (model set in 6.2 by mode)'
);

// ----------------------------------------------------------
// Test 8: Clear inline comments in plan-phase.md
// ----------------------------------------------------------
console.log('\nTest 8: Clear inline comments in plan-phase.md');
assert(
  step6_2.includes('--') || step6_2.includes('//') || step6_2.includes('('),
  'Step 6.2 has inline comments or parenthetical explanations'
);
// Specifically check for explanatory text about why the branching exists
assert(
  step6_2.toLowerCase().includes('structured') ||
    step6_2.toLowerCase().includes('cost') ||
    step6_2.toLowerCase().includes('deep') ||
    step6_2.toLowerCase().includes('cross-reference') ||
    step6_2.toLowerCase().includes('comparison'),
  'Step 6.2 explains rationale for mode-based model selection'
);


// ============================================================
// plan-review.md Tests
// ============================================================

console.log('\n=== plan-review.md ===\n');

const prStep3 = extractSection('### Step 3:', planReview);
const prStep3_2 = extractSection('#### 3.2:', planReview);
const prStep3_1 = extractSection('#### 3.1:', planReview);

// ----------------------------------------------------------
// Test 9: plan-review.md Step 3 reads implementation_mode from config
// ----------------------------------------------------------
console.log('Test 9: plan-review.md Step 3 references implementation_mode');
assert(
  prStep3.includes('implementation_mode'),
  'Step 3 in plan-review.md references implementation_mode'
);

// ----------------------------------------------------------
// Test 10: plan-review.md Step 3.2 economy mode uses model: "sonnet"
// ----------------------------------------------------------
console.log('\nTest 10: plan-review.md Step 3.2 economy mode uses model: "sonnet"');
assert(
  prStep3_2.includes('economy') || prStep3_2.includes('Economy'),
  'Step 3.2 mentions economy mode'
);
assert(
  prStep3_2.toLowerCase().includes('economy') && prStep3_2.includes('model: "sonnet"'),
  'Step 3.2 economy mode specifies model: "sonnet"'
);

// ----------------------------------------------------------
// Test 11: plan-review.md Step 3.2 quality mode omits model (inherit)
// ----------------------------------------------------------
console.log('\nTest 11: plan-review.md Step 3.2 quality mode omits model');
assert(
  prStep3_2.includes('quality') || prStep3_2.includes('Quality'),
  'Step 3.2 mentions quality mode'
);
assert(
  prStep3_2.toLowerCase().includes('quality') &&
    (prStep3_2.includes('omit model') || prStep3_2.includes('omit the model') || prStep3_2.includes('inherit')),
  'Step 3.2 quality mode omits model parameter (inherits parent)'
);

// ----------------------------------------------------------
// Test 12: plan-review.md Step 3.1 agent definitions no longer hardcode model
// ----------------------------------------------------------
console.log('\nTest 12: plan-review.md Step 3.1 agent definitions do not hardcode model');
const prAgentDefLines = prStep3_1.split('\n').filter(l =>
  l.includes('Agent') && (l.includes('Bug Detector') || l.includes('Pattern Reviewer') ||
  l.includes('Plan Compliance Reviewer') || l.includes('Stack Reviewer'))
);
const prAgentDefsWithSonnet = prAgentDefLines.filter(l => l.includes('model: "sonnet"'));
assert(
  prAgentDefsWithSonnet.length === 0,
  'Agent definitions in 3.1 do not hardcode model: "sonnet" (model set in 3.2 by mode)'
);

// ----------------------------------------------------------
// Test 13: Clear inline comments in plan-review.md
// ----------------------------------------------------------
console.log('\nTest 13: Clear inline comments in plan-review.md');
assert(
  prStep3_2.includes('--') || prStep3_2.includes('//') || prStep3_2.includes('('),
  'Step 3.2 has inline comments or parenthetical explanations'
);
assert(
  prStep3_2.toLowerCase().includes('structured') ||
    prStep3_2.toLowerCase().includes('cost') ||
    prStep3_2.toLowerCase().includes('deep') ||
    prStep3_2.toLowerCase().includes('cross-reference') ||
    prStep3_2.toLowerCase().includes('comparison'),
  'Step 3.2 explains rationale for mode-based model selection'
);

// ----------------------------------------------------------
// Test 14: plan-review.md design notes updated for mode branching
// ----------------------------------------------------------
console.log('\nTest 14: plan-review.md design notes mention implementation_mode');
const prDesignNotes = planReview.substring(planReview.lastIndexOf('**Design Notes'));
assert(
  prDesignNotes.includes('implementation_mode') || prDesignNotes.includes('economy') || prDesignNotes.includes('quality'),
  'Design notes reference implementation_mode or economy/quality modes'
);

// ============================================================
// Results
// ============================================================
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
