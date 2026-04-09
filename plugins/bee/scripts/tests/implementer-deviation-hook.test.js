#!/usr/bin/env node
// Test: hooks.json SubagentStop includes deviation section validation for implementer agents

const fs = require('fs');
const path = require('path');

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
// Test 1: hooks.json is valid JSON
// ============================================================
console.log('Test 1: hooks.json is valid JSON');

let hooks;
try {
  const raw = fs.readFileSync(HOOKS_PATH, 'utf8');
  hooks = JSON.parse(raw);
  assert(true, 'hooks.json parses as valid JSON');
} catch (e) {
  assert(false, `hooks.json parses as valid JSON (error: ${e.message})`);
  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
  process.exit(1);
}

// ============================================================
// Test 2: ^implementer$ SubagentStop prompt contains "Deviations"
// ============================================================
console.log('\nTest 2: implementer SubagentStop checks for Deviations');

const subagentStopEntries = hooks.hooks.SubagentStop;
const implementerEntry = subagentStopEntries.find(e => {
  try { return new RegExp(e.matcher).test('implementer') && !new RegExp(e.matcher).test('quick-implementer'); } catch { return false; }
});

assert(
  implementerEntry !== undefined,
  'implementer matcher exists in SubagentStop (matches implementer but not quick-implementer)'
);

const implementerPrompt = implementerEntry ? implementerEntry.hooks[0].prompt : '';

assert(
  implementerPrompt.includes('Deviations'),
  '^implementer$ SubagentStop prompt contains "Deviations"'
);

// ============================================================
// Test 3: ^implementer$ SubagentStop prompt validates rule format
// ============================================================
console.log('\nTest 3: implementer SubagentStop validates rule format');

assert(
  implementerPrompt.includes('rule number') || implementerPrompt.includes('Rule'),
  '^implementer$ SubagentStop prompt contains "rule number" or "Rule"'
);

// ============================================================
// Test 5: All existing SubagentStop matchers still present (no deletions)
// ============================================================
console.log('\nTest 5: No existing SubagentStop matchers deleted');

assert(
  subagentStopEntries.length >= 24,
  `SubagentStop has >= 24 matchers (found ${subagentStopEntries.length})`
);

// Spot-check key matchers that must still exist
// Check required agent names are covered by matchers (using endsWith for suffix patterns)
const requiredAgents = [
  'implementer', 'fixer', 'researcher', 'bug-detector', 'pattern-reviewer',
  'plan-compliance-reviewer', 'stack-reviewer', 'quick-implementer',
  'spec-reviewer', 'discuss-partner', 'security-auditor', 'error-handling-auditor',
  'database-auditor', 'architecture-auditor', 'api-auditor', 'frontend-auditor',
  'performance-auditor', 'testing-auditor', 'audit-bug-detector',
  'audit-finding-validator', 'audit-report-generator'
];

for (const agent of requiredAgents) {
  const found = subagentStopEntries.some(e => {
    try { return new RegExp(e.matcher).test(agent); } catch { return false; }
  });
  assert(found, `Agent "${agent}" matched by a SubagentStop matcher`);
}

// ============================================================
// Results
// ============================================================
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
