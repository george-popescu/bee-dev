#!/usr/bin/env node
// Test: hooks.json and inject-memory.sh include quick-implementer agent

const fs = require('fs');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '..', 'inject-memory.sh');
const HOOKS_PATH = path.join(__dirname, '..', '..', 'hooks', 'hooks.json');

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
// Test 1: hooks.json SubagentStop has quick-implementer entry
// ============================================================
console.log('Test 1: hooks.json SubagentStop has quick-implementer entry');

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

const subagentStopEntries = hooks.hooks.SubagentStop;
assert(
  Array.isArray(subagentStopEntries) && subagentStopEntries.length > 0,
  'SubagentStop array exists and is non-empty'
);

const quickImplStop = subagentStopEntries.find(
  (entry) => entry.matcher === '^quick-implementer$'
);
assert(
  quickImplStop !== undefined,
  'SubagentStop has entry with matcher "^quick-implementer$"'
);

// ============================================================
// Test 2: SubagentStop quick-implementer validates TDD + tests + task notes + signal
// ============================================================
console.log('\nTest 2: SubagentStop quick-implementer prompt validates required criteria');

if (quickImplStop) {
  const stopHooks = quickImplStop.hooks;
  assert(
    Array.isArray(stopHooks) && stopHooks.length > 0,
    'quick-implementer SubagentStop has hooks array'
  );

  const promptHook = stopHooks.find((h) => h.type === 'prompt');
  assert(promptHook !== undefined, 'quick-implementer SubagentStop has a prompt hook');

  if (promptHook) {
    const prompt = promptHook.prompt;
    assert(
      prompt.includes('TDD'),
      'Prompt validates TDD compliance'
    );
    assert(
      prompt.toLowerCase().includes('test') && prompt.toLowerCase().includes('pass'),
      'Prompt validates tests passing'
    );
    assert(
      prompt.includes('Task Notes') || prompt.includes('task notes'),
      'Prompt validates Task Notes heading'
    );
    assert(
      prompt.includes("Task complete. [X] tests passing."),
      'Prompt validates task completion signal with exact format'
    );
  }
}

// ============================================================
// Test 3: hooks.json SubagentStart matcher includes quick-implementer
// ============================================================
console.log('\nTest 3: hooks.json SubagentStart includes quick-implementer');

const subagentStartEntries = hooks.hooks.SubagentStart;
assert(
  Array.isArray(subagentStartEntries) && subagentStartEntries.length > 0,
  'SubagentStart array exists'
);

const startMatcher = subagentStartEntries[0].matcher;
const startMatcherRegex = new RegExp(startMatcher);
assert(
  startMatcherRegex.test('quick-implementer'),
  'SubagentStart matcher matches "quick-implementer"'
);

// ============================================================
// Test 4: inject-memory.sh includes quick-implementer in case statement
// ============================================================
console.log('\nTest 4: inject-memory.sh includes quick-implementer');

let scriptContent;
try {
  scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf8');
} catch (e) {
  console.log(`  FAIL: inject-memory.sh not found at ${SCRIPT_PATH}`);
  console.log(`\nResults: ${passed} passed, 1 failed out of ${passed + 1} assertions`);
  process.exit(1);
}

const caseMatch = scriptContent.match(/case\s+"\$(?:AGENT_TYPE|1)"\s+in\s*\n([\s\S]*?)\nesac/);
assert(caseMatch !== null, 'case statement for AGENT_TYPE exists');

if (caseMatch) {
  const caseBlock = caseMatch[1];
  assert(
    caseBlock.includes('quick-implementer'),
    'Case statement includes quick-implementer'
  );
}

// ============================================================
// Test 5: inject-memory.sh remains syntactically valid
// ============================================================
console.log('\nTest 5: inject-memory.sh structural validity');
assert(
  scriptContent.startsWith('#!/bin/bash'),
  'Script starts with #!/bin/bash shebang'
);
assert(
  scriptContent.includes('esac'),
  'Case statement is properly closed with esac'
);
assert(
  scriptContent.trimEnd().endsWith('exit 0'),
  'Script ends with exit 0'
);

// ============================================================
// Test 6: hooks.json structural integrity (no other lines broken)
// ============================================================
console.log('\nTest 6: hooks.json structural integrity');
assert(hooks.hooks.SessionStart !== undefined, 'hooks.json SessionStart preserved');
assert(hooks.hooks.PostToolUse !== undefined, 'hooks.json PostToolUse preserved');
assert(hooks.hooks.PreCompact !== undefined, 'hooks.json PreCompact preserved');
assert(hooks.hooks.SubagentStop !== undefined, 'hooks.json SubagentStop preserved');
assert(hooks.hooks.SubagentStart !== undefined, 'hooks.json SubagentStart preserved');
assert(hooks.hooks.Stop !== undefined, 'hooks.json Stop preserved');
assert(hooks.hooks.PreToolUse !== undefined, 'hooks.json PreToolUse preserved');
assert(hooks.hooks.SessionEnd !== undefined, 'hooks.json SessionEnd preserved');

// Verify existing SubagentStop entries still exist
const requiredAgentsCoverage = [
  'implementer', 'fixer', 'researcher',
  'bug-detector', 'pattern-reviewer',
  'plan-compliance-reviewer', 'stack-reviewer',
];
for (const agent of requiredAgentsCoverage) {
  const found = subagentStopEntries.some((e) => {
    try { return new RegExp(e.matcher).test(agent); } catch { return false; }
  });
  assert(
    found,
    `SubagentStop has matcher covering agent "${agent}"`
  );
}

// ============================================================
// Test 7: Existing agents preserved in inject-memory.sh
// ============================================================
console.log('\nTest 7: Existing agents preserved in inject-memory.sh');
if (caseMatch) {
  const caseBlock = caseMatch[1];
  const existingAgents = [
    'implementer', 'fixer', 'researcher',
    'spec-writer', 'phase-planner', 'plan-reviewer', 'spec-shaper',
    'context-builder', 'quick-implementer',
  ];
  for (const agent of existingAgents) {
    assert(
      caseBlock.includes(agent),
      `inject-memory.sh case still includes "${agent}"`
    );
  }
}

// ============================================================
// Results
// ============================================================
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
