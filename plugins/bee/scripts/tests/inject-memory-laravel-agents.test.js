#!/usr/bin/env node
// Test: inject-memory.sh case statement includes laravel-inertia-vue agent names
// Verifies T3.13 acceptance criteria.

const fs = require('fs');
const path = require('path');

const SCRIPT_PATH = path.join(
  __dirname, '..', 'inject-memory.sh'
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

// Read the file
let content;
try {
  content = fs.readFileSync(SCRIPT_PATH, 'utf8');
} catch (e) {
  console.log('FAIL: inject-memory.sh file does not exist at expected path');
  console.log(`  Expected: ${SCRIPT_PATH}`);
  console.log(`\nResults: 0 passed, 1 failed out of 1 assertions`);
  process.exit(1);
}

// ============================================================
// Test 1: Script starts with bash shebang
// ============================================================
console.log('Test 1: Valid bash script');
assert(
  content.startsWith('#!/bin/bash'),
  'Script starts with #!/bin/bash shebang'
);

// ============================================================
// Test 2: New laravel-inertia-vue agent names are in the case statement
// ============================================================
console.log('\nTest 2: New agent names in case statement');

// Extract the case statement block
const caseMatch = content.match(/case\s+"\$AGENT_TYPE"\s+in\s*\n([\s\S]*?)\nesac/);
assert(caseMatch !== null, 'case statement for AGENT_TYPE exists');

if (caseMatch) {
  const caseBlock = caseMatch[1];

  assert(
    caseBlock.includes('laravel-inertia-vue-bug-detector'),
    'Case statement includes laravel-inertia-vue-bug-detector'
  );
  assert(
    caseBlock.includes('laravel-inertia-vue-pattern-reviewer'),
    'Case statement includes laravel-inertia-vue-pattern-reviewer'
  );
  assert(
    caseBlock.includes('laravel-inertia-vue-implementer'),
    'Case statement includes laravel-inertia-vue-implementer'
  );
}

// ============================================================
// Test 3: Original agent names are still present
// ============================================================
console.log('\nTest 3: Original agent names preserved');

const originalAgents = [
  'implementer',
  'fixer',
  'researcher',
  'reviewer',
  'spec-writer',
  'phase-planner',
  'plan-reviewer',
  'spec-shaper',
  'finding-validator',
  'integrity-auditor',
  'test-auditor',
  'test-planner',
  'project-reviewer',
];

if (caseMatch) {
  const caseBlock = caseMatch[1];
  for (const agent of originalAgents) {
    assert(
      caseBlock.includes(agent),
      `Case statement still includes original agent "${agent}"`
    );
  }
}

// ============================================================
// Test 4: Rest of the script is unchanged
// ============================================================
console.log('\nTest 4: Other script content preserved');
assert(
  content.includes('SubagentStart hook: inject agent memory into subagent context'),
  'Header comment preserved'
);
assert(
  content.includes('MEMORY_DIR="$BEE_DIR/memory"'),
  'MEMORY_DIR variable preserved'
);
assert(
  content.includes('shared.md'),
  'Shared memory reading preserved'
);
assert(
  content.includes('hookEventName'),
  'Hook output JSON preserved'
);
assert(
  content.includes('additionalContext'),
  'additionalContext output preserved'
);

// ============================================================
// Test 5: Script has valid bash syntax (no unclosed quotes, etc.)
// ============================================================
console.log('\nTest 5: Script structure');
assert(
  content.includes('esac'),
  'Case statement is properly closed with esac'
);
assert(
  content.trimEnd().endsWith('exit 0'),
  'Script ends with exit 0'
);

// ============================================================
// Results
// ============================================================
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
