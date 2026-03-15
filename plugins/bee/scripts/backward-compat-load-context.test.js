#!/usr/bin/env node
// Test: load-context.sh backward compatibility with v2 STATE.md
// Verifies that STATE.md files without the HTML comment block (v2)
// and with it (v3) both produce valid context output without errors.
// Since there is no test runner, this script validates behavior directly.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const LOAD_CONTEXT_SCRIPT = path.join(__dirname, 'load-context.sh');

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

// v2 STATE.md -- no HTML comment block
const V2_STATE = `# Bee Project State

## Current Spec
- Name: user-auth
- Path: .bee/specs/user-auth/spec.md
- Status: IN_PROGRESS

## Phases
| # | Name | Status | Plan | Plan Review | Executed | Reviewed | Tested | Committed |
|---|------|--------|------|-------------|----------|----------|--------|-----------|
| 1 | Foundation | COMMITTED | Yes | Yes | Yes | Yes | Yes | Yes |
| 2 | Core Logic | EXECUTING | Yes | Yes | - | - | - | - |

## Quick Tasks

| # | Description | Date | Commit |
|---|-------------|------|--------|

## Decisions Log

## Last Action
- Command: /bee:execute-phase
- Timestamp: 2026-03-14T11:00:00
- Result: Phase 2 executing
`;

// v3 STATE.md -- with HTML comment block
const V3_STATE = `# Bee Project State

## Current Spec
- Name: user-auth
- Path: .bee/specs/user-auth/spec.md
- Status: IN_PROGRESS

<!-- Valid Status values:
  NO_SPEC       — No active spec; project is idle or between features.
  SPEC_CREATED  — Spec document exists but no phases have been executed yet.
  IN_PROGRESS   — At least one phase has moved past the planned stage.
  COMPLETED     — All phases committed and review-implementation is done.
  ARCHIVED      — Developer ran archive-spec; spec is stored in history.
-->

## Phases
| # | Name | Status | Plan | Plan Review | Executed | Reviewed | Tested | Committed |
|---|------|--------|------|-------------|----------|----------|--------|-----------|
| 1 | Foundation | COMMITTED | Yes | Yes | Yes | Yes | Yes | Yes |
| 2 | Core Logic | EXECUTING | Yes | Yes | - | - | - | - |

## Quick Tasks

| # | Description | Date | Commit |
|---|-------------|------|--------|

## Decisions Log

## Last Action
- Command: /bee:execute-phase
- Timestamp: 2026-03-14T11:00:00
- Result: Phase 2 executing
`;

// v2 STATE.md with NO_SPEC
const V2_STATE_NO_SPEC = `# Bee Project State

## Current Spec
- Name: (none)
- Path: (none)
- Status: NO_SPEC

## Phases
| # | Name | Status | Plan | Plan Review | Executed | Reviewed | Tested | Committed |
|---|------|--------|------|-------------|----------|----------|--------|-----------|

## Decisions Log

## Last Action
- Command: /bee:init
- Timestamp: 2026-03-14T10:00:00
- Result: Project initialized
`;

// Helper: run load-context.sh with a prepared .bee directory
function runLoadContext(stateContent, configContent) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-compat-lc-'));
  const beeDir = path.join(tmpDir, '.bee');
  fs.mkdirSync(beeDir, { recursive: true });

  if (stateContent) {
    fs.writeFileSync(path.join(beeDir, 'STATE.md'), stateContent, 'utf8');
  }
  if (configContent) {
    fs.writeFileSync(path.join(beeDir, 'config.json'), configContent, 'utf8');
  }

  try {
    const output = execFileSync('bash', [LOAD_CONTEXT_SCRIPT], {
      encoding: 'utf8',
      timeout: 5000,
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: tmpDir,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { output, exitCode: 0, stderr: '' };
  } catch (err) {
    return {
      output: err.stdout || '',
      exitCode: err.status,
      stderr: err.stderr || '',
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

console.log('Testing load-context.sh backward compatibility...\n');

// Test 1: v2 STATE.md (no HTML comment) loads without errors
console.log('Test 1: v2 STATE.md (no HTML comment) loads without errors');
{
  const result = runLoadContext(V2_STATE);
  assert(result.exitCode === 0, `Should exit with 0, got ${result.exitCode}`);
  assert(result.stderr === '', 'Should produce no stderr');
  assert(result.output.includes('## Bee Project State'), 'Should include state header');
  assert(result.output.includes('- Status: IN_PROGRESS'), 'Should include status line');
}

// Test 2: v3 STATE.md (with HTML comment) loads without errors
console.log('Test 2: v3 STATE.md (with HTML comment) loads without errors');
{
  const result = runLoadContext(V3_STATE);
  assert(result.exitCode === 0, 'Should exit cleanly');
  assert(result.stderr === '', 'Should produce no stderr');
  assert(result.output.includes('## Bee Project State'), 'Should include state header');
  assert(result.output.includes('- Status: IN_PROGRESS'), 'Should include status line');
}

// Test 3: v2 STATE.md outputs all content faithfully
console.log('Test 3: v2 STATE.md outputs all content faithfully');
{
  const result = runLoadContext(V2_STATE);
  assert(result.exitCode === 0, 'Should exit cleanly');
  assert(result.output.includes('| 1 | Foundation | COMMITTED'), 'Should include phase 1 row');
  assert(result.output.includes('| 2 | Core Logic | EXECUTING'), 'Should include phase 2 row');
}

// Test 4: v3 STATE.md outputs all content including HTML comment
console.log('Test 4: v3 STATE.md outputs all content including HTML comment');
{
  const result = runLoadContext(V3_STATE);
  assert(result.exitCode === 0, 'Should exit cleanly');
  assert(result.output.includes('<!-- Valid Status values:'), 'Should include HTML comment');
  assert(result.output.includes('| 1 | Foundation | COMMITTED'), 'Should include phase 1 row');
}

// Test 5: v2 STATE.md with NO_SPEC loads without errors
console.log('Test 5: v2 STATE.md with NO_SPEC loads without errors');
{
  const result = runLoadContext(V2_STATE_NO_SPEC);
  assert(result.exitCode === 0, 'Should exit cleanly');
  assert(result.stderr === '', 'Should produce no stderr');
  assert(result.output.includes('- Status: NO_SPEC'), 'Should include NO_SPEC status');
}

// Test 6: load-context.sh exits cleanly when .bee dir does not exist
console.log('Test 6: load-context.sh exits cleanly when .bee dir does not exist');
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-compat-nodir-'));
  try {
    const output = execFileSync('bash', [LOAD_CONTEXT_SCRIPT], {
      encoding: 'utf8',
      timeout: 5000,
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: tmpDir,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    assert(output === '', 'Should produce no output when .bee missing');
  } catch (err) {
    assert(false, `Should not throw when .bee dir missing: ${err.message}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Test 7: load-context.sh handles STATE.md without phases table
console.log('Test 7: load-context.sh handles STATE.md without phases table');
{
  const minimalState = `# Bee Project State

## Current Spec
- Name: (none)
- Path: (none)
- Status: NO_SPEC

## Last Action
- Command: /bee:init
- Timestamp: 2026-03-14T10:00:00
- Result: Project initialized
`;
  const result = runLoadContext(minimalState);
  assert(result.exitCode === 0, 'Should exit cleanly');
  assert(result.stderr === '', 'Should produce no stderr');
  assert(result.output.includes('- Status: NO_SPEC'), 'Should include status');
}

// Test 8: v2 config.json with "stack" field outputs stack name
console.log('Test 8: v2 config.json with "stack" field outputs stack name');
{
  const config = JSON.stringify({ stack: 'laravel-inertia-vue' });
  const result = runLoadContext(V2_STATE, config);
  assert(result.exitCode === 0, 'Should exit with 0');
  assert(result.stderr === '', 'Should produce no stderr');
  assert(result.output.includes('## Bee Config'), 'Should include config header');
  assert(result.output.includes('Stack: laravel-inertia-vue'), 'Should output v2 stack name');
}

// Test 9: v3 config.json with "stacks" array outputs first stack name
console.log('Test 9: v3 config.json with "stacks" array outputs first stack name');
{
  const config = JSON.stringify({ stacks: [{ name: 'nextjs' }] });
  const result = runLoadContext(V2_STATE, config);
  assert(result.exitCode === 0, 'Should exit with 0');
  assert(result.stderr === '', 'Should produce no stderr');
  assert(result.output.includes('## Bee Config'), 'Should include config header');
  assert(result.output.includes('Stack: nextjs'), 'Should output v3 stacks[0].name');
}

// Test 10: missing config.json does not output Bee Config section
console.log('Test 10: missing config.json does not output Bee Config section');
{
  const result = runLoadContext(V2_STATE);
  assert(result.exitCode === 0, 'Should exit with 0');
  assert(!result.output.includes('## Bee Config'), 'Should not include config header when config.json is missing');
}

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
