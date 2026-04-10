#!/usr/bin/env node
// Test: dashboard-app — STRUCTURAL tests only.
// Verifies that plugins/bee/dashboard/src/App.tsx wires together:
//   - the useSnapshot hook (T3.4)
//   - the MissionControlLayout shell (T3.6)
//   - the ConnectionStatus badge (T3.5) into the headerRight slot
//   - all 12 panels (T3.7-T3.13)
//   - the Skeleton primitive (T3.3) for the loading grid
//   - a `snapshot === null` null-guard (NOT gated on connection status, so a
//     failed initial fetch still renders the skeleton grid instead of
//     crashing trying to read `snapshot.state?.phases`).
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
// Test 2: Imports useSnapshot and calls it destructuring the full
// triple (snapshot, connectionStatus, lastUpdated).
// ============================================================
console.log('\nTest 2: useSnapshot wiring');
assert(
  /import\s*\{\s*useSnapshot\s*\}\s*from\s*['"]@\/hooks\/useSnapshot['"]/.test(app),
  'imports { useSnapshot } from "@/hooks/useSnapshot"'
);
assert(
  /const\s*\{\s*snapshot\s*,\s*connectionStatus\s*,\s*lastUpdated\s*\}\s*=\s*useSnapshot\s*\(\s*\)/.test(
    app
  ),
  'destructures { snapshot, connectionStatus, lastUpdated } from useSnapshot()'
);

// ============================================================
// Test 3: Imports MissionControlLayout and ConnectionStatus
// ============================================================
console.log('\nTest 3: Layout and ConnectionStatus imports');
assert(
  /import\s*\{\s*MissionControlLayout\s*\}\s*from\s*['"]@\/components\/MissionControlLayout['"]/.test(
    app
  ),
  'imports { MissionControlLayout } from "@/components/MissionControlLayout"'
);
assert(
  /import\s*\{\s*ConnectionStatus\s*\}\s*from\s*['"]@\/components\/ConnectionStatus['"]/.test(
    app
  ),
  'imports { ConnectionStatus } from "@/components/ConnectionStatus"'
);
assert(
  /import\s*\{\s*Skeleton\s*\}\s*from\s*['"]@\/components\/ui\/skeleton['"]/.test(
    app
  ),
  'imports { Skeleton } from "@/components/ui/skeleton"'
);

// ============================================================
// Test 4: Imports all 12 panels from @/components/panels/*
// ============================================================
console.log('\nTest 4: Panel imports (12 total)');
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
// Test 5: Null-guard uses `snapshot === null` ALONE (not gated on
// connectionStatus). A failed initial fetch leaves snapshot=null and
// connectionStatus='disconnected' — if we guarded on connectionStatus
// we'd crash trying to render panels against a null snapshot.
// ============================================================
console.log('\nTest 5: Null-guard correctness');
assert(
  /snapshot\s*===\s*null/.test(app),
  'uses `snapshot === null` guard'
);
assert(
  !/snapshot\s*===\s*null\s*&&\s*connectionStatus/.test(app),
  'guard does NOT combine snapshot === null with connectionStatus (would crash on failed initial fetch)'
);

// ============================================================
// Test 6: MissionControlLayout receives headerRight={<ConnectionStatus
// ============================================================
console.log('\nTest 6: headerRight slot wiring');
assert(
  /<MissionControlLayout[\s\S]*?headerRight\s*=\s*\{\s*<ConnectionStatus\b/.test(
    app
  ),
  'MissionControlLayout receives headerRight={<ConnectionStatus ... />}'
);
assert(
  /<ConnectionStatus\s+status=\{connectionStatus\}\s+lastUpdated=\{lastUpdated\}/.test(
    app
  ),
  'ConnectionStatus receives status and lastUpdated props from the hook'
);

// ============================================================
// Test 7: Skeleton loading state uses Skeleton primitives
// ============================================================
console.log('\nTest 7: Loading state uses Skeleton');
assert(
  /<Skeleton\s+className="h-64 w-full"/.test(app),
  'renders Skeleton className="h-64 w-full" placeholders for the loading grid'
);
// Loading state should have at least 6 Skeleton instances (6-8 placeholders).
const skeletonMatches = app.match(/<Skeleton\s+className="h-64 w-full"/g) || [];
assert(
  skeletonMatches.length >= 6,
  `renders at least 6 Skeleton placeholders (found ${skeletonMatches.length})`
);

// ============================================================
// Test 8: Panel prop wiring references every snapshot field
// ============================================================
console.log('\nTest 8: Panel prop wiring references snapshot fields');
assert(
  /phases=\{snapshot\.state\?\.phases\s*\?\?\s*null\}/.test(app),
  'PhasesPanel uses phases={snapshot.state?.phases ?? null}'
);
assert(
  /healthHistory=\{snapshot\.healthHistory\}/.test(app),
  'HealthTrendChart uses healthHistory={snapshot.healthHistory}'
);
// Accept either a direct `snapshot.phaseMetrics?.flatMap(` or a `(snapshot.phaseMetrics as ...)?.flatMap(`
// cast wrapper. The cast is required to bridge the Phase 1 type drift between
// the flat `PhaseMetric[]` interface and the runtime grouped shape returned by
// hive-json-readers.js `readPhaseMetrics`.
assert(
  /snapshot\.phaseMetrics[\s\S]*?\?\.flatMap\(/.test(app),
  'VelocityChart/CodeQualityChart flatten snapshot.phaseMetrics via flatMap'
);
assert(
  /requirements=\{snapshot\.requirements\}/.test(app),
  'RequirementsCoveragePanel uses requirements={snapshot.requirements}'
);
assert(
  /notes=\{snapshot\.notes\}/.test(app),
  'NotesPanel uses notes={snapshot.notes}'
);
assert(
  /seeds=\{snapshot\.seeds\}/.test(app),
  'SeedsPanel uses seeds={snapshot.seeds}'
);
assert(
  /discussions=\{snapshot\.discussions\}/.test(app),
  'DiscussionsPanel uses discussions={snapshot.discussions}'
);
assert(
  /forensics=\{snapshot\.forensics\}/.test(app),
  'ForensicsPanel uses forensics={snapshot.forensics}'
);
assert(
  /debugSessions=\{snapshot\.debugSessions\}/.test(app),
  'DebugSessionsPanel uses debugSessions={snapshot.debugSessions}'
);
assert(
  /quickTasks=\{snapshot\.quickTasks\}/.test(app),
  'QuickTasksPanel uses quickTasks={snapshot.quickTasks}'
);
assert(
  /config=\{snapshot\.config\}/.test(app),
  'ConfigSummaryPanel uses config={snapshot.config}'
);

// ============================================================
// Test 9: Default export present
// ============================================================
console.log('\nTest 9: Default export');
assert(
  /export\s+default\s+function\s+App/.test(app) ||
    /export\s+default\s+App/.test(app),
  'App.tsx exports default App component'
);

// ============================================================
// Summary
// ============================================================
const total = passed + failed;
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${total} assertions`);
process.exit(failed > 0 ? 1 : 0);
