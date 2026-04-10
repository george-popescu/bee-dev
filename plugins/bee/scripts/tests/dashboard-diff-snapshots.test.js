#!/usr/bin/env node
// Test: dashboard-diff-snapshots -- STRUCTURAL + BEHAVIORAL tests for
// `plugins/bee/dashboard/src/lib/diff-snapshots.ts` (Phase 4 T4.1).
//
// Validates the snapshot diff utility that converts two successive
// `Snapshot` payloads into a list of `ActivityEvent`s for the live feed.
//
// Strategy: this test reads the file as plain text and asserts expected
// patterns via regex / substring matching so it does not require the
// TypeScript compiler. TS type safety is enforced separately by
// `npm run typecheck` in `plugins/bee/dashboard/`.
//
// Acceptance reference: T4.1 in
//   .bee/specs/2026-04-10-bee-board-dashboard/phases/04-*/TASKS.md

const fs = require('fs');
const path = require('path');

const DIFF_FILE = path.join(
  __dirname, '..', '..', 'dashboard', 'src', 'lib', 'diff-snapshots.ts'
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
// Test 1: File exists
// ============================================================
console.log('Test 1: File exists');
assert(
  fs.existsSync(DIFF_FILE),
  'plugins/bee/dashboard/src/lib/diff-snapshots.ts exists'
);

// Stop early if the file is missing so follow-up tests do not swamp output.
if (!fs.existsSync(DIFF_FILE)) {
  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
  process.exit(1);
}

const content = fs.readFileSync(DIFF_FILE, 'utf8');

// ============================================================
// Test 2: Imports Snapshot from '@/types/snapshot'
// ============================================================
console.log('\nTest 2: Snapshot type import');
assert(
  /import\s+type\s*\{[^}]*\bSnapshot\b[^}]*\}\s*from\s*['"]@\/types\/snapshot['"]/.test(content)
    || /import\s*\{[^}]*\bSnapshot\b[^}]*\}\s*from\s*['"]@\/types\/snapshot['"]/.test(content),
  'Imports Snapshot from "@/types/snapshot"'
);

// ============================================================
// Test 3: Exports diffSnapshots function
// ============================================================
console.log('\nTest 3: diffSnapshots export');
assert(
  /export\s+function\s+diffSnapshots\s*\(/.test(content),
  'Exports `diffSnapshots` function'
);
assert(
  /diffSnapshots\s*\([^)]*prev\s*:\s*Snapshot\s*\|\s*null[^)]*next\s*:\s*Snapshot[^)]*\)\s*:\s*ActivityEvent\s*\[\s*\]/.test(content),
  'diffSnapshots signature: `(prev: Snapshot | null, next: Snapshot): ActivityEvent[]`'
);

// ============================================================
// Test 4: Exports DIFF_SNAPSHOTS_MAX_EVENTS constant
// ============================================================
console.log('\nTest 4: DIFF_SNAPSHOTS_MAX_EVENTS export');
assert(
  /export\s+const\s+DIFF_SNAPSHOTS_MAX_EVENTS\s*(?::\s*number)?\s*=\s*100\b/.test(content),
  'Exports `DIFF_SNAPSHOTS_MAX_EVENTS = 100`'
);

// ============================================================
// Test 5: Exports ActivityEvent + ActivityEventType temporary types
// ============================================================
console.log('\nTest 5: Temporary ActivityEvent + ActivityEventType exports');
assert(
  /export\s+(?:interface|type)\s+ActivityEvent\b/.test(content),
  'Exports `ActivityEvent` type/interface'
);
assert(
  /export\s+type\s+ActivityEventType\b/.test(content),
  'Exports `ActivityEventType` type alias'
);

// ============================================================
// Test 6: ActivityEventType union includes all four literals
// ============================================================
console.log('\nTest 6: ActivityEventType union literals');
const TYPE_LITERALS = [
  "'file-added'",
  "'file-removed'",
  "'status-change'",
  "'metric-change'",
];
for (const literal of TYPE_LITERALS) {
  assert(
    content.includes(literal),
    `ActivityEventType union includes ${literal}`
  );
}

// ============================================================
// Test 7: ActivityEvent shape declares required fields
// ============================================================
console.log('\nTest 7: ActivityEvent field declarations');
const activityBlockMatch = content.match(
  /export\s+(?:interface|type)\s+ActivityEvent\b[^{=]*[\{=]([\s\S]*?)\n\}/
);
const activityBody = activityBlockMatch ? activityBlockMatch[1] : '';
const REQUIRED_EVENT_FIELDS = ['id', 'timestamp', 'type', 'description', 'source'];
for (const field of REQUIRED_EVENT_FIELDS) {
  const re = new RegExp(`^\\s*${field}\\s*:`, 'm');
  assert(
    re.test(activityBody),
    `ActivityEvent.${field} is declared`
  );
}

// ============================================================
// Test 8: Baseline handling -- returns [] when prev === null
// ============================================================
console.log('\nTest 8: Baseline (prev === null) returns empty array');
assert(
  /prev\s*===\s*null/.test(content) || /prev\s*==\s*null/.test(content),
  'Function branches on `prev === null` (or == null)'
);
assert(
  /return\s*\[\s*\]/.test(content),
  'Has a `return []` statement for the baseline path'
);

// ============================================================
// Test 9: File-keyed diffs -- references filePath keying
// ============================================================
console.log('\nTest 9: File-keyed diffs use filePath');
assert(
  /filePath/.test(content),
  'Uses `filePath` as the key for file-based entries'
);

// References each file-keyed slice
const FILE_SLICES = [
  'notes',
  'seeds',
  'discussions',
  'forensics',
  'debugSessions',
  'quickTasks',
];
for (const slice of FILE_SLICES) {
  assert(
    content.includes(slice),
    `References \`${slice}\` slice`
  );
}

// ============================================================
// Test 10: Emits file-added and file-removed events
// ============================================================
console.log('\nTest 10: file-added / file-removed emission');
assert(
  content.includes("'file-added'"),
  'Emits `file-added` type literal'
);
assert(
  content.includes("'file-removed'"),
  'Emits `file-removed` type literal'
);

// ============================================================
// Test 11: Phase status transitions via state.phases
// ============================================================
console.log('\nTest 11: Phase status-change detection');
assert(
  /state\s*\?*\.?\s*phases|state\.phases|\.phases/.test(content),
  'References phase collection for status diffs'
);
assert(
  /\bnumber\b/.test(content),
  'Matches phases by `number` field'
);
assert(
  /\bstatus\b/.test(content),
  'Detects `status` field changes'
);
assert(
  content.includes("'status-change'"),
  'Emits `status-change` type literal'
);

// ============================================================
// Test 12: healthHistory metric-change detection via Set<timestamp>
// ============================================================
console.log('\nTest 12: healthHistory uses Set<timestamp>, not length');
assert(
  /healthHistory/.test(content),
  'References `healthHistory` slice'
);
assert(
  /new\s+Set\s*(?:<[^>]*>)?\s*\(/.test(content),
  'Uses `new Set(...)` for healthHistory timestamp diff'
);
assert(
  content.includes("'metric-change'"),
  'Emits `metric-change` type literal'
);

// Reject the naive length-comparison pattern explicitly.
assert(
  !/healthHistory[^;]*\.length\s*[!<>=]=?\s*[^;]*healthHistory[^;]*\.length/.test(content),
  'Does NOT use `healthHistory.length` comparison (Set-based diff required)'
);

// ============================================================
// Test 13: Granular per-entry event id format
// ============================================================
console.log('\nTest 13: Granular event id format');
// The required id format is:
//   `${type}:${source}:${filePath|number|entryTimestamp}:${snapshotTimestamp}`
// So we expect a template literal containing `${` followed by `:` segments
// and at minimum references to `type`, `source`, and a timestamp suffix.
assert(
  /`[^`]*\$\{[^`]*type[^`]*\}[^`]*:[^`]*\$\{[^`]*source[^`]*\}[^`]*:/.test(content),
  'Event id template literal starts with `${type}:${source}:`'
);
assert(
  /`[^`]*\$\{[^`]*(?:next\.timestamp|snapshotTimestamp|timestamp)[^`]*\}\s*`/.test(content),
  'Event id template literal ends with `${...timestamp}`'
);

// ============================================================
// Test 14: Event timestamp uses next.timestamp (not new Date())
// ============================================================
console.log('\nTest 14: timestamp sourced from next.timestamp');
assert(
  /next\.timestamp/.test(content),
  'Uses `next.timestamp` when constructing events'
);
assert(
  !/new\s+Date\s*\(\s*\)\s*\.toISOString/.test(content),
  'Does NOT call `new Date().toISOString()` (must be deterministic)'
);

// ============================================================
// Test 15: Human-readable descriptions
// ============================================================
console.log('\nTest 15: Human-readable descriptions');
assert(
  /New note added|New note|note added/i.test(content),
  'Description phrasing covers new notes'
);
assert(
  /Phase\s*\$\{|Phase\s+\d|phase[^:]*:[^}]*→|→|->/i.test(content),
  'Description phrasing includes phase transition arrow'
);

// ============================================================
// Test 16: Purity -- no console logs, no module-scope mutable state
// ============================================================
console.log('\nTest 16: Purity guarantees');
assert(
  !/console\.(log|info|warn|error|debug)\s*\(/.test(content),
  'No console.* calls (pure function)'
);
assert(
  !/^\s*let\s+\w+\s*(?::|=)/m.test(
    content
      // strip function bodies to only check module scope; naive but good enough:
      // remove everything between the first '{' after a function keyword and matching '}'
      .replace(/export\s+function[\s\S]*$/m, '')
  ),
  'No module-scope `let` bindings above the first exported function'
);

// ============================================================
// Test 17: Handles null/undefined slices gracefully
// ============================================================
console.log('\nTest 17: Null/undefined slice tolerance');
// Defensive access patterns: `prev?.notes ?? []`, `|| []`, `?? []`, etc.
assert(
  /\?\?\s*\[\s*\]|\|\|\s*\[\s*\]/.test(content),
  'Uses `?? []` or `|| []` to coalesce missing slices'
);

// ============================================================
// Results
// ============================================================
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
