#!/usr/bin/env node
// Test: dashboard-app-activity-feed — STRUCTURAL tests for the T4.5 wiring of
// the ActivityFeed (T4.2) into App.tsx via the updated MissionControlLayout
// `feed` slot (T4.3) and the new `useActivityFeed` accumulator (T4.4).
//
// This file is strictly additive to dashboard-app.test.js (T3.14) which still
// owns the regression coverage for the 12-panel grid wiring, the
// `snapshot === null` null-guard, and the headerRight slot. The two test
// files run independently.
//
// These tests read App.tsx as text and assert expected patterns via regex.
// They MUST NOT run tsc, vite, npm, or any build tooling.

const fs = require('fs');
const path = require('path');

const APP_PATH = path.join(
  __dirname,
  '..',
  '..',
  'dashboard',
  'src',
  'App.tsx'
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
// Test 1: App.tsx exists
// ============================================================
console.log('Test 1: App.tsx exists');
assert(fs.existsSync(APP_PATH), 'plugins/bee/dashboard/src/App.tsx exists');

const app = fs.existsSync(APP_PATH) ? fs.readFileSync(APP_PATH, 'utf8') : '';

// ============================================================
// Test 2: Imports useActivityFeed from '@/hooks/useActivityFeed'
// ============================================================
console.log('\nTest 2: useActivityFeed import');
assert(
  /import\s*\{\s*useActivityFeed\s*\}\s*from\s*['"]@\/hooks\/useActivityFeed['"]/.test(
    app
  ),
  'imports { useActivityFeed } from "@/hooks/useActivityFeed"'
);

// ============================================================
// Test 3: Imports ActivityFeed from '@/components/ActivityFeed'
// ============================================================
console.log('\nTest 3: ActivityFeed import');
assert(
  /import\s*\{\s*ActivityFeed\s*\}\s*from\s*['"]@\/components\/ActivityFeed['"]/.test(
    app
  ),
  'imports { ActivityFeed } from "@/components/ActivityFeed"'
);

// ============================================================
// Test 4: Calls useActivityFeed(snapshot, connectionStatus)
// ============================================================
console.log('\nTest 4: useActivityFeed hook call');
assert(
  /useActivityFeed\s*\(\s*snapshot\s*,\s*connectionStatus\s*\)/.test(app),
  'calls useActivityFeed(snapshot, connectionStatus)'
);
assert(
  /const\s+events\s*=\s*useActivityFeed\s*\(\s*snapshot\s*,\s*connectionStatus\s*\)/.test(
    app
  ),
  'assigns the result to a `const events` binding'
);

// ============================================================
// Test 5: MissionControlLayout receives feed={<ActivityFeed events={events} />}
// ============================================================
console.log('\nTest 5: feed slot wiring');
assert(
  /feed\s*=\s*\{/.test(app),
  'MissionControlLayout receives a feed={ ... } prop'
);
assert(
  /<ActivityFeed\s+events=\{events\}/.test(app),
  '<ActivityFeed events={events} /> is the value passed into the feed slot'
);
assert(
  /feed\s*=\s*\{\s*<ActivityFeed\s+events=\{events\}\s*\/?>\s*\}/.test(app),
  'feed prop wraps <ActivityFeed events={events} /> directly'
);

// ============================================================
// Test 6: Existing headerRight wiring still preserved (T3.14 contract)
// ============================================================
console.log('\nTest 6: headerRight slot still preserved');
assert(
  /headerRight\s*=\s*\{\s*<ConnectionStatus\b/.test(app),
  'headerRight={<ConnectionStatus ...>} is preserved alongside the new feed prop'
);

// ============================================================
// Test 7: Null-guard on `snapshot === null` is preserved (NOT changed)
// ============================================================
console.log('\nTest 7: Null-guard preserved');
assert(
  /snapshot\s*===\s*null/.test(app),
  '`snapshot === null` null-guard is preserved'
);
assert(
  !/snapshot\s*===\s*null\s*&&\s*connectionStatus/.test(app),
  'guard does NOT combine snapshot === null with connectionStatus'
);

// ============================================================
// Test 8: All 12 existing panel imports preserved (T3.14 contract)
// ============================================================
console.log('\nTest 8: 12 existing panel imports preserved');
const PANELS = [
  'PhasesPanel',
  'HealthTrendChart',
  'VelocityChart',
  'CodeQualityChart',
  'RequirementsCoveragePanel',
  'NotesPanel',
  'SeedsPanel',
  'DiscussionsPanel',
  'ForensicsPanel',
  'DebugSessionsPanel',
  'QuickTasksPanel',
  'ConfigSummaryPanel',
];
for (const panel of PANELS) {
  const importRe = new RegExp(
    `import\\s*\\{\\s*${panel}\\s*\\}\\s*from\\s*['"]@/components/panels/${panel}['"]`
  );
  assert(importRe.test(app), `imports { ${panel} } from "@/components/panels/${panel}"`);
}

// ============================================================
// Test 9: useSnapshot destructuring preserved (T3.14 contract)
// ============================================================
console.log('\nTest 9: useSnapshot destructuring preserved');
assert(
  /const\s*\{\s*snapshot\s*,\s*connectionStatus\s*,\s*lastUpdated\s*\}\s*=\s*useSnapshot\s*\(\s*\)/.test(
    app
  ),
  'still destructures { snapshot, connectionStatus, lastUpdated } from useSnapshot()'
);

// ============================================================
// Summary
// ============================================================
const total = passed + failed;
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${total} assertions`);
process.exit(failed > 0 ? 1 : 0);
