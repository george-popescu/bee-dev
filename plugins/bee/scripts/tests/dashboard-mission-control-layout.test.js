#!/usr/bin/env node
// Test: dashboard-mission-control-layout — STRUCTURAL tests only.
// Verifies that MissionControlLayout.tsx exists under the dashboard components
// directory and satisfies the T3.6 acceptance criteria:
//   - React 19 function component (NOT forwardRef)
//   - Props { children, headerRight? }
//   - Full-viewport dark layout with sticky header + Bee Hive branding
//   - Responsive grid 1 / 2 / 3 / 4 cols (custom 3xl breakpoint)
//   - Hexagon icon imported from lucide-react
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
// Test 1: File exists and exports MissionControlLayout
// ============================================================
console.log('Test 1: File exists and exports MissionControlLayout');
assert(
  fs.existsSync(COMPONENT_PATH),
  'MissionControlLayout.tsx exists at dashboard/src/components/'
);
assert(
  /export\s+(?:default\s+)?function\s+MissionControlLayout/.test(content) ||
    /export\s*\{\s*MissionControlLayout/.test(content) ||
    /export\s+const\s+MissionControlLayout/.test(content),
  'exports MissionControlLayout'
);

// ============================================================
// Test 2: React 19 function component (NOT forwardRef)
// ============================================================
console.log('\nTest 2: React 19 function component (no forwardRef)');
assert(
  !/forwardRef/.test(content),
  'does NOT use forwardRef (React 19 function component)'
);
assert(
  /function\s+MissionControlLayout\s*\(/.test(content),
  'defined as a function (not a class, not an arrow assigned to forwardRef)'
);

// ============================================================
// Test 3: Props interface with children and headerRight
// ============================================================
console.log('\nTest 3: Props interface');
assert(
  /children\s*:\s*React\.ReactNode/.test(content),
  'children prop typed as React.ReactNode'
);
assert(
  /headerRight\?\s*:\s*React\.ReactNode/.test(content),
  'headerRight optional prop typed as React.ReactNode'
);
assert(
  /\{[\s\S]*?\bchildren\b[\s\S]*?\bheaderRight\b[\s\S]*?\}|\{[\s\S]*?\bheaderRight\b[\s\S]*?\bchildren\b[\s\S]*?\}/.test(
    content.slice(
      content.indexOf('function MissionControlLayout'),
      content.indexOf('function MissionControlLayout') + 400
    )
  ),
  'destructures { children, headerRight } in the function signature'
);

// ============================================================
// Test 4: Bee Hive branding literal
// ============================================================
console.log('\nTest 4: Bee Hive branding');
assert(
  /Bee Hive/.test(content),
  'contains "Bee Hive" literal string'
);

// ============================================================
// Test 5: Hexagon icon imported from lucide-react
// ============================================================
console.log('\nTest 5: Hexagon icon import');
assert(
  /import\s*\{[^}]*\bHexagon\b[^}]*\}\s*from\s*['"]lucide-react['"]/.test(content),
  'imports Hexagon from lucide-react'
);
assert(
  /<Hexagon\b/.test(content),
  '<Hexagon /> rendered in the header'
);

// ============================================================
// Test 6: Full-viewport dark layout classes
// ============================================================
console.log('\nTest 6: Full-viewport dark layout');
assert(
  /min-h-screen/.test(content),
  'uses min-h-screen'
);
assert(
  /bg-hive-bg/.test(content),
  'uses bg-hive-bg'
);
assert(
  /text-hive-text/.test(content),
  'uses text-hive-text'
);
assert(
  /flex\s+flex-col/.test(content),
  'uses flex flex-col'
);

// ============================================================
// Test 7: Sticky header classes
// ============================================================
console.log('\nTest 7: Sticky header classes');
assert(
  /sticky\s+top-0/.test(content),
  'header uses sticky top-0'
);
assert(
  /z-10/.test(content),
  'header has z-10'
);
assert(
  /border-b\s+border-hive-border/.test(content),
  'header has border-b border-hive-border'
);
assert(
  /bg-hive-bg\/95/.test(content),
  'header uses bg-hive-bg/95 (translucent)'
);
assert(
  /backdrop-blur/.test(content),
  'header uses backdrop-blur'
);
assert(
  /items-center/.test(content) && /justify-between/.test(content),
  'header uses flex items-center justify-between'
);

// ============================================================
// Test 8: hive-gold branding accent
// ============================================================
console.log('\nTest 8: Gold branding accent');
assert(
  /text-hive-gold/.test(content),
  'Bee Hive text uses text-hive-gold'
);

// ============================================================
// Test 9: Main content area and responsive grid
// ============================================================
console.log('\nTest 9: Main content and responsive grid');
assert(
  /<main\b[^>]*>/.test(content),
  'renders a <main> element'
);
assert(
  /flex-1/.test(content) && /overflow-y-auto/.test(content),
  '<main> uses flex-1 overflow-y-auto'
);
assert(
  /grid-cols-1/.test(content),
  'grid uses grid-cols-1 (mobile)'
);
assert(
  /sm:grid-cols-2/.test(content),
  'grid uses sm:grid-cols-2'
);
assert(
  /lg:grid-cols-3/.test(content),
  'grid uses lg:grid-cols-3'
);
assert(
  /3xl:grid-cols-4/.test(content),
  'grid uses custom 3xl:grid-cols-4 breakpoint'
);
assert(
  /gap-6/.test(content),
  'grid uses gap-6'
);
assert(
  /auto-rows-min/.test(content),
  'grid uses auto-rows-min'
);

// ============================================================
// Test 10: children rendered inside grid, headerRight in header
// ============================================================
console.log('\nTest 10: children and headerRight slots');
assert(
  /\{\s*children\s*\}/.test(content),
  '{children} rendered inside main/grid'
);
assert(
  /\{\s*headerRight\s*\}/.test(content),
  '{headerRight} rendered in the header'
);

// ============================================================
// Test 11: Does not import UI primitives from T3.3 (parallel with T3.3)
// ============================================================
console.log('\nTest 11: No T3.3 UI primitive imports');
assert(
  !/from\s+['"]@\/components\/ui\//.test(content),
  'does not import from @/components/ui/* (parallel-safe with T3.3)'
);

// ============================================================
// Summary
// ============================================================
const total = passed + failed;
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${total} assertions`);
process.exit(failed > 0 ? 1 : 0);
