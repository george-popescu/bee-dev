#!/usr/bin/env node
// Test: dashboard-activity-feed — STRUCTURAL tests only.
//
// Verifies that:
//   1. plugins/bee/dashboard/src/types/activity.ts exists and exports
//      `ActivityEvent` interface and `ActivityEventType` union with the
//      four required type literals.
//   2. plugins/bee/dashboard/src/components/ActivityFeed.tsx exists and
//      implements the contract described by T4.2:
//        - exports `ActivityFeed` function component (no forwardRef)
//        - imports Card/CardHeader/CardTitle/CardContent, ScrollArea,
//          Badge, and ActivityEvent from the expected modules
//        - wraps content in <Card> with <CardTitle>Activity</CardTitle>
//        - uses ScrollArea with fixed `h-96` height
//        - sorts events reverse-chronological via b.timestamp.localeCompare(a.timestamp)
//        - contains the "No recent activity" empty-state literal
//        - references all 4 badge variants for the type-to-variant map
//        - uses key={event.id} for list rendering
//
// Acceptance reference: T4.2 in
//   .bee/specs/2026-04-10-bee-board-dashboard/phases/04-activity-feed/TASKS.md
//
// This test reads files as text and asserts expected patterns via regex.
// It MUST NOT run tsc, vite, npm, or any build tooling.

const fs = require('fs');
const path = require('path');

const TYPE_FILE = path.join(
  __dirname,
  '..',
  '..',
  'dashboard',
  'src',
  'types',
  'activity.ts'
);

const COMPONENT_FILE = path.join(
  __dirname,
  '..',
  '..',
  'dashboard',
  'src',
  'components',
  'ActivityFeed.tsx'
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
// Test 1: types/activity.ts exists
// ============================================================
console.log('Test 1: types/activity.ts exists');
assert(
  fs.existsSync(TYPE_FILE),
  'plugins/bee/dashboard/src/types/activity.ts exists'
);

const typeContent = fs.existsSync(TYPE_FILE)
  ? fs.readFileSync(TYPE_FILE, 'utf8')
  : '';

// ============================================================
// Test 2: Exports ActivityEventType union with 4 literals
// ============================================================
console.log('\nTest 2: Exports ActivityEventType union with 4 literals');
assert(
  /export\s+type\s+ActivityEventType\b/.test(typeContent),
  'activity.ts exports type `ActivityEventType`'
);
assert(
  /['"]file-added['"]/.test(typeContent),
  'activity.ts references `file-added` literal'
);
assert(
  /['"]file-removed['"]/.test(typeContent),
  'activity.ts references `file-removed` literal'
);
assert(
  /['"]status-change['"]/.test(typeContent),
  'activity.ts references `status-change` literal'
);
assert(
  /['"]metric-change['"]/.test(typeContent),
  'activity.ts references `metric-change` literal'
);

// ============================================================
// Test 3: Exports ActivityEvent interface with 5 fields
// ============================================================
console.log('\nTest 3: Exports ActivityEvent interface with 5 fields');
assert(
  /export\s+interface\s+ActivityEvent\b/.test(typeContent),
  'activity.ts exports interface `ActivityEvent`'
);
assert(
  /\bid\s*:\s*string\b/.test(typeContent),
  'ActivityEvent has `id: string`'
);
assert(
  /\btimestamp\s*:\s*string\b/.test(typeContent),
  'ActivityEvent has `timestamp: string`'
);
assert(
  /\btype\s*:\s*ActivityEventType\b/.test(typeContent),
  'ActivityEvent has `type: ActivityEventType`'
);
assert(
  /\bdescription\s*:\s*string\b/.test(typeContent),
  'ActivityEvent has `description: string`'
);
assert(
  /\bsource\s*:\s*string\b/.test(typeContent),
  'ActivityEvent has `source: string`'
);

// ============================================================
// Test 4: components/ActivityFeed.tsx exists
// ============================================================
console.log('\nTest 4: components/ActivityFeed.tsx exists');
assert(
  fs.existsSync(COMPONENT_FILE),
  'plugins/bee/dashboard/src/components/ActivityFeed.tsx exists'
);

const content = fs.existsSync(COMPONENT_FILE)
  ? fs.readFileSync(COMPONENT_FILE, 'utf8')
  : '';

// ============================================================
// Test 5: Exports ActivityFeed function component
// ============================================================
console.log('\nTest 5: Exports ActivityFeed function component');
assert(
  /export\s+function\s+ActivityFeed\s*\(/.test(content),
  'Exports `ActivityFeed` as function component'
);

// ============================================================
// Test 6: No forwardRef (React 19 rule)
// ============================================================
console.log('\nTest 6: Does NOT use React.forwardRef');
assert(
  !/forwardRef/.test(content),
  'ActivityFeed.tsx does NOT use forwardRef'
);

// ============================================================
// Test 7: Imports Card primitives from @/components/ui/card
// ============================================================
console.log('\nTest 7: Imports Card primitives from @/components/ui/card');
assert(
  /import\s*\{[^}]*\bCard\b[^}]*\}\s*from\s*['"]@\/components\/ui\/card['"]/.test(
    content
  ),
  'Imports `Card` from `@/components/ui/card`'
);
assert(
  /import\s*\{[^}]*\bCardHeader\b[^}]*\}\s*from\s*['"]@\/components\/ui\/card['"]/.test(
    content
  ),
  'Imports `CardHeader` from `@/components/ui/card`'
);
assert(
  /import\s*\{[^}]*\bCardTitle\b[^}]*\}\s*from\s*['"]@\/components\/ui\/card['"]/.test(
    content
  ),
  'Imports `CardTitle` from `@/components/ui/card`'
);
assert(
  /import\s*\{[^}]*\bCardContent\b[^}]*\}\s*from\s*['"]@\/components\/ui\/card['"]/.test(
    content
  ),
  'Imports `CardContent` from `@/components/ui/card`'
);

// ============================================================
// Test 8: Imports ScrollArea from @/components/ui/scroll-area
// ============================================================
console.log('\nTest 8: Imports ScrollArea from @/components/ui/scroll-area');
assert(
  /import\s*\{[^}]*\bScrollArea\b[^}]*\}\s*from\s*['"]@\/components\/ui\/scroll-area['"]/.test(
    content
  ),
  'Imports `ScrollArea` from `@/components/ui/scroll-area`'
);

// ============================================================
// Test 9: Imports Badge from @/components/ui/badge
// ============================================================
console.log('\nTest 9: Imports Badge from @/components/ui/badge');
assert(
  /import\s*\{[^}]*\bBadge\b[^}]*\}\s*from\s*['"]@\/components\/ui\/badge['"]/.test(
    content
  ),
  'Imports `Badge` from `@/components/ui/badge`'
);

// ============================================================
// Test 10: Imports ActivityEvent from @/types/activity
// ============================================================
console.log('\nTest 10: Imports ActivityEvent from @/types/activity');
assert(
  /import\s+(?:type\s+)?\{[^}]*\bActivityEvent\b[^}]*\}\s*from\s*['"]@\/types\/activity['"]/.test(
    content
  ),
  'Imports `ActivityEvent` from `@/types/activity`'
);

// ============================================================
// Test 11: Renders Card with CardTitle "Activity"
// ============================================================
console.log('\nTest 11: Renders Card with CardTitle "Activity"');
assert(/<Card\b/.test(content), 'Renders a `<Card>` wrapper');
assert(
  /<CardTitle[^>]*>\s*Activity\s*<\/CardTitle>/.test(content),
  'Renders `<CardTitle>Activity</CardTitle>`'
);

// ============================================================
// Test 12: ScrollArea uses fixed h-96 height
// ============================================================
console.log('\nTest 12: ScrollArea uses fixed h-96 height');
assert(
  /<ScrollArea\b[^>]*className\s*=\s*["'`][^"'`]*\bh-96\b/.test(content),
  'ScrollArea uses `h-96` fixed height'
);

// ============================================================
// Test 13: Reverse-chronological sort (localeCompare w/ b before a)
// ============================================================
console.log('\nTest 13: Reverse-chronological sort via localeCompare');
assert(/\.sort\s*\(/.test(content), 'ActivityFeed.tsx calls `.sort()`');
assert(
  /b\.timestamp\.localeCompare\s*\(\s*a\.timestamp\s*\)/.test(content),
  'Sort uses `b.timestamp.localeCompare(a.timestamp)` (reverse-chronological)'
);
assert(
  /\.slice\s*\(\s*\)\s*\.sort\s*\(/.test(content),
  'Uses `.slice().sort(...)` to avoid mutating the input array'
);

// ============================================================
// Test 14: "No recent activity" empty state literal
// ============================================================
console.log('\nTest 14: Contains "No recent activity" empty-state literal');
assert(
  /No recent activity/.test(content),
  'Contains `No recent activity` empty-state literal'
);

// ============================================================
// Test 15: References all 4 type variants in mapping
// ============================================================
console.log('\nTest 15: References all 4 event type variants');
assert(
  /['"]file-added['"]/.test(content),
  'References `file-added` variant'
);
assert(
  /['"]file-removed['"]/.test(content),
  'References `file-removed` variant'
);
assert(
  /['"]status-change['"]/.test(content),
  'References `status-change` variant'
);
assert(
  /['"]metric-change['"]/.test(content),
  'References `metric-change` variant'
);

// ============================================================
// Test 16: References all 4 badge variants in the mapping
// ============================================================
console.log('\nTest 16: References all 4 Badge variants in mapping');
assert(
  /['"]success['"]/.test(content),
  'References `success` badge variant (file-added)'
);
assert(
  /['"]muted['"]/.test(content),
  'References `muted` badge variant (file-removed)'
);
assert(
  /['"]warning['"]/.test(content),
  'References `warning` badge variant (status-change)'
);
assert(
  /['"]default['"]/.test(content),
  'References `default` badge variant (metric-change)'
);

// ============================================================
// Test 17: Renders <Badge ...> element
// ============================================================
console.log('\nTest 17: Renders Badge element');
assert(/<Badge\b/.test(content), 'Renders a `<Badge ... />` element');

// ============================================================
// Test 18: Uses key={event.id} for list rendering
// ============================================================
console.log('\nTest 18: Uses key={event.id} for list rendering');
assert(
  /key\s*=\s*\{\s*[a-zA-Z_$][\w$]*\.id\s*\}/.test(content),
  'Uses `key={event.id}` (or equivalent) for list rendering'
);

// ============================================================
// Test 19: Props type includes `events: ActivityEvent[]`
// ============================================================
console.log('\nTest 19: Props include `events: ActivityEvent[]`');
assert(
  /events\s*:\s*ActivityEvent\[\]/.test(content),
  'Declares `events: ActivityEvent[]` in props'
);

// ============================================================
// Test 20: Relative timestamp formatting ("ago" suffix)
// ============================================================
console.log('\nTest 20: Relative timestamp formatting');
assert(
  /ago/.test(content),
  'Contains "ago" literal for relative timestamp rendering'
);

// ============================================================
// Results
// ============================================================
console.log(
  `\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`
);
process.exit(failed > 0 ? 1 : 0);
