#!/usr/bin/env node
// Test: hooks.json and inject-memory.sh include discuss-partner agent
// Verifies T7.2 acceptance criteria: dual-mode SubagentStop, SubagentStart, inject-memory, validity, preservation.

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
// Test 1: hooks.json is valid JSON and SubagentStop has discuss-partner entry
// ============================================================
console.log('Test 1: hooks.json SubagentStop has discuss-partner entry');

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

const discussPartnerStop = subagentStopEntries.find(
  (entry) => entry.matcher === 'discuss-partner'
);
assert(
  discussPartnerStop !== undefined,
  'SubagentStop has entry with matcher "discuss-partner"'
);

// ============================================================
// Test 2: SubagentStop discuss-partner validates dual-mode (write-notes + scan)
// ============================================================
console.log('\nTest 2: SubagentStop discuss-partner prompt validates dual-mode');

if (discussPartnerStop) {
  const stopHooks = discussPartnerStop.hooks;
  assert(
    Array.isArray(stopHooks) && stopHooks.length > 0,
    'discuss-partner SubagentStop has hooks array'
  );

  const promptHook = stopHooks.find((h) => h.type === 'prompt');
  assert(promptHook !== undefined, 'discuss-partner SubagentStop has a prompt hook');

  if (promptHook) {
    const prompt = promptHook.prompt;

    // Write-notes mode validation
    assert(
      prompt.includes('Discussion notes written'),
      'Prompt checks for write-notes completion signal "Discussion notes written"'
    );
    assert(
      prompt.includes('heading') || prompt.includes('Heading') || prompt.includes('required heading'),
      'Prompt validates required headings in write-notes mode'
    );
    assert(
      prompt.includes('no code') || prompt.includes('No code') || prompt.toLowerCase().includes('no code'),
      'Prompt validates no code in write-notes mode'
    );

    // Scan mode validation
    assert(
      prompt.includes('## Relevant Files'),
      'Prompt checks for scan mode "## Relevant Files" heading'
    );
    assert(
      prompt.includes('## Existing Patterns'),
      'Prompt checks for scan mode "## Existing Patterns" heading'
    );
    assert(
      prompt.includes('no files written') || prompt.includes('No files written') || prompt.toLowerCase().includes('no files written'),
      'Prompt validates no files written in scan mode'
    );

    // Dual-mode: prompt handles both by checking which signal is present
    assert(
      prompt.includes('Discussion notes written') && prompt.includes('Relevant Files'),
      'Prompt handles both modes (checks which completion signal is present)'
    );
  }
} else {
  // Force failures if entry not found
  assert(false, 'discuss-partner SubagentStop has hooks array');
  assert(false, 'discuss-partner SubagentStop has a prompt hook');
  assert(false, 'Prompt checks for write-notes completion signal');
  assert(false, 'Prompt validates required headings');
  assert(false, 'Prompt validates no code');
  assert(false, 'Prompt checks for scan mode ## Relevant Files');
  assert(false, 'Prompt checks for scan mode ## Existing Patterns');
  assert(false, 'Prompt validates no files written in scan mode');
  assert(false, 'Prompt handles both modes');
}

// ============================================================
// Test 3: hooks.json SubagentStart matcher includes discuss-partner
// ============================================================
console.log('\nTest 3: hooks.json SubagentStart includes discuss-partner');

const subagentStartEntries = hooks.hooks.SubagentStart;
assert(
  Array.isArray(subagentStartEntries) && subagentStartEntries.length > 0,
  'SubagentStart array exists'
);

const startMatcher = subagentStartEntries[0].matcher;
const startMatcherRegex = new RegExp(startMatcher);
assert(
  startMatcherRegex.test('discuss-partner'),
  'SubagentStart matcher matches "discuss-partner"'
);

// ============================================================
// Test 4: inject-memory.sh includes discuss-partner in case statement
// ============================================================
console.log('\nTest 4: inject-memory.sh includes discuss-partner');

let scriptContent;
try {
  scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf8');
} catch (e) {
  console.log(`  FAIL: inject-memory.sh not found at ${SCRIPT_PATH}`);
  console.log(`\nResults: ${passed} passed, 1 failed out of ${passed + 1} assertions`);
  process.exit(1);
}

const caseMatch = scriptContent.match(/case\s+"\$AGENT_TYPE"\s+in\s*\n([\s\S]*?)\nesac/);
assert(caseMatch !== null, 'case statement for AGENT_TYPE exists');

if (caseMatch) {
  const caseBlock = caseMatch[1];
  assert(
    caseBlock.includes('discuss-partner'),
    'Case statement includes discuss-partner'
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
// Test 6: hooks.json structural integrity (existing agents preserved)
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
const existingStopMatchers = [
  '^implementer$', 'fixer', 'researcher',
  '^bug-detector$', '^pattern-reviewer$',
  'plan-compliance-reviewer', 'stack-reviewer',
  'laravel-inertia-vue-bug-detector',
  'laravel-inertia-vue-pattern-reviewer',
  'laravel-inertia-vue-implementer',
  'quick-implementer',
];
for (const matcher of existingStopMatchers) {
  const entry = subagentStopEntries.find((e) => e.matcher === matcher);
  assert(
    entry !== undefined,
    `SubagentStop still has entry with matcher "${matcher}"`
  );
}

// ============================================================
// Test 7: Existing agents preserved in inject-memory.sh
// ============================================================
console.log('\nTest 7: Existing agents preserved in inject-memory.sh');
if (caseMatch) {
  const caseBlock = caseMatch[1];
  const existingAgents = [
    'implementer', 'fixer', 'researcher', 'reviewer',
    'spec-writer', 'phase-planner', 'plan-reviewer', 'spec-shaper',
    'context-builder', 'laravel-inertia-vue-implementer',
    'quick-implementer',
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
