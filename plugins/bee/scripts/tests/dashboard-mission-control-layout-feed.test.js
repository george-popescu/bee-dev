#!/usr/bin/env node
// Test: dashboard-mission-control-layout-feed — STRUCTURAL tests for T4.3.
// Verifies that MissionControlLayout.tsx has been additively modified to
// accept an optional `feed` prop that renders as a right-side activity column
// on the `lg:` breakpoint, stacking below the panel grid on narrow viewports.
//
// Acceptance (additive modification — T3.6 criteria must STILL hold; a
// separate T3.6 test file validates those. This file only asserts the new
// T4.3 behavior and that the original grid class substrings are preserved.):
//
//   - Exports MissionControlLayout as a named export (still)
//   - Destructures { children, headerRight, feed } in the signature
//   - feed prop typed as optional React.ReactNode
//   - Main area uses lg:grid-cols-[1fr_384px] (locked: no custom tokens)
//   - Feed column uses lg:border-l + border-hive-border
//   - Original panel grid classes still present:
//       grid-cols-1, sm:grid-cols-2, lg:grid-cols-3, 3xl:grid-cols-4
//   - Does NOT contain the broken token `top-[header-height]`
//
// These tests read the file as text and assert via regex. They MUST NOT run
// vite, tsc, or any build tooling.

const fs = require('fs');
const path = require('path');

const COMPONENT_PATH = path.join(
  __dirname, '..', '..', 'dashboard', 'src', 'components', 'MissionControlLayout.tsx'
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

// Read the component file
let content;
try {
  content = fs.readFileSync(COMPONENT_PATH, 'utf8');
} catch (e) {
  console.log('FAIL: MissionControlLayout.tsx does not exist at expected path');
  console.log(`  Expected: ${COMPONENT_PATH}`);
  console.log(`\nResults: 0 passed, 1 failed out of 1 assertions`);
  process.exit(1);
}

// ============================================================
// Test 1: File exists and exports MissionControlLayout (named)
// ============================================================
console.log('Test 1: File exists and exports MissionControlLayout');
assert(
  fs.existsSync(COMPONENT_PATH),
  'MissionControlLayout.tsx exists at dashboard/src/components/'
);
assert(
  /export\s+function\s+MissionControlLayout/.test(content) ||
    /export\s*\{\s*MissionControlLayout\b[^}]*\}/.test(content) ||
    /export\s+const\s+MissionControlLayout\b/.test(content),
  'exports MissionControlLayout as a named export'
);
assert(
  !/export\s+default\s+function\s+MissionControlLayout/.test(content),
  'MissionControlLayout is NOT a default export'
);

// ============================================================
// Test 2: feed prop typed as optional React.ReactNode
// ============================================================
console.log('\nTest 2: feed prop is optional React.ReactNode');
assert(
  /feed\?\s*:\s*React\.ReactNode/.test(content),
  'feed optional prop typed as React.ReactNode'
);

// ============================================================
// Test 3: Destructures { children, headerRight, feed } in signature
// ============================================================
console.log('\nTest 3: Destructures children, headerRight, feed');
const signatureStart = content.indexOf('function MissionControlLayout');
const signatureSlice = signatureStart >= 0
  ? content.slice(signatureStart, signatureStart + 500)
  : '';
assert(
  /\bchildren\b/.test(signatureSlice),
  'destructures `children` in the function signature'
);
assert(
  /\bheaderRight\b/.test(signatureSlice),
  'destructures `headerRight` in the function signature'
);
assert(
  /\bfeed\b/.test(signatureSlice),
  'destructures `feed` in the function signature'
);

// ============================================================
// Test 4: Main area uses lg:grid-cols-[1fr_384px]
// ============================================================
console.log('\nTest 4: Main area lg two-column split (1fr + 384px)');
assert(
  /lg:grid-cols-\[1fr_384px\]/.test(content),
  'main area uses lg:grid-cols-[1fr_384px]'
);

// ============================================================
// Test 5: Feed column uses lg:border-l + border-hive-border
// ============================================================
console.log('\nTest 5: Feed column border');
assert(
  /lg:border-l/.test(content),
  'feed column uses lg:border-l'
);
assert(
  /border-hive-border/.test(content),
  'feed column (or layout) uses border-hive-border'
);

// ============================================================
// Test 6: Original panel grid classes still present
// ============================================================
console.log('\nTest 6: Original panel grid classes preserved');
assert(
  /grid-cols-1\b/.test(content),
  'grid still uses grid-cols-1 (mobile)'
);
assert(
  /sm:grid-cols-2/.test(content),
  'grid still uses sm:grid-cols-2'
);
assert(
  /lg:grid-cols-3/.test(content),
  'grid still uses lg:grid-cols-3'
);
assert(
  /3xl:grid-cols-4/.test(content),
  'grid still uses custom 3xl:grid-cols-4 breakpoint'
);

// ============================================================
// Test 7: Does NOT use the broken `top-[header-height]` token
// ============================================================
console.log('\nTest 7: No broken top-[header-height] token');
assert(
  !/top-\[header-height\]/.test(content),
  'does NOT contain the broken token top-[header-height]'
);

// ============================================================
// Test 8: {feed} is rendered somewhere in the component
// ============================================================
console.log('\nTest 8: {feed} rendered in JSX');
assert(
  /\{\s*feed\s*\}/.test(content),
  '{feed} expression rendered in the JSX tree'
);

// ============================================================
// Summary
// ============================================================
const total = passed + failed;
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${total} assertions`);
process.exit(failed > 0 ? 1 : 0);
