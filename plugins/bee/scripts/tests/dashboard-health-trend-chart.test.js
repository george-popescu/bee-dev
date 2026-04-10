#!/usr/bin/env node
// Test: dashboard-health-trend-chart — STRUCTURAL tests only.
//
// Verifies that the HealthTrendChart panel component exists at
// plugins/bee/dashboard/src/components/panels/HealthTrendChart.tsx and
// follows the Phase 3 T3.8 contract:
//   - React 19 function component (no forwardRef)
//   - Wraps shadcn Card primitives (CardHeader, CardTitle, CardContent)
//   - Uses shadcn ChartContainer + ChartConfig (NOT raw recharts)
//   - Renders AreaChart/LineChart with XAxis, YAxis, CartesianGrid
//   - ChartConfig declares passed/warnings/failures series with
//     hive color tokens (var(--hive-gold), var(--hive-amber), #ef4444)
//   - Transforms HealthHistoryEntry[] into { date, passed, warnings, failures }
//   - Empty state message when healthHistory is null/empty
//   - Fixed 240px height
//   - Consumes HealthHistoryEntry from @/types/snapshot
//
// Tests read the file as text and assert patterns via regex.
// They MUST NOT run tsc, vite, npm, or any build tooling.

const fs = require('fs');
const path = require('path');

const COMPONENT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'dashboard',
  'src',
  'components',
  'panels',
  'HealthTrendChart.tsx'
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
console.log('Test 1: HealthTrendChart.tsx exists');
const exists = fs.existsSync(COMPONENT_PATH);
assert(
  exists,
  'plugins/bee/dashboard/src/components/panels/HealthTrendChart.tsx exists'
);

if (!exists) {
  console.log(
    `\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`
  );
  process.exit(1);
}

const src = fs.readFileSync(COMPONENT_PATH, 'utf8');

// ============================================================
// Test 2: Exports HealthTrendChart function component
// ============================================================
console.log('\nTest 2: Exports HealthTrendChart function component');
assert(
  /export\s+function\s+HealthTrendChart\b/.test(src),
  'exports function HealthTrendChart'
);
assert(
  !/forwardRef/.test(src),
  'does NOT use React.forwardRef (React 19 rule)'
);

// ============================================================
// Test 3: Imports shadcn Chart primitives (not raw recharts only)
// ============================================================
console.log('\nTest 3: Imports shadcn ChartContainer from @/components/ui/chart');
assert(
  /import\s*\{[^}]*\bChartContainer\b[^}]*\}\s*from\s*['"]@\/components\/ui\/chart['"]/.test(
    src
  ),
  'imports ChartContainer from @/components/ui/chart'
);
assert(
  /\bChartConfig\b/.test(src),
  'references ChartConfig type'
);
assert(
  /satisfies\s+ChartConfig\b/.test(src),
  'uses `satisfies ChartConfig` on the chartConfig object'
);
assert(
  /\bChartTooltip\b/.test(src),
  'references ChartTooltip'
);
assert(
  /\bChartTooltipContent\b/.test(src),
  'references ChartTooltipContent'
);

// ============================================================
// Test 4: Imports recharts AreaChart (or LineChart) + axes + grid
// ============================================================
console.log('\nTest 4: Imports recharts chart primitives');
assert(
  /import\s*\{[^}]*\b(?:AreaChart|LineChart)\b[^}]*\}\s*from\s*['"]recharts['"]/.test(
    src
  ),
  'imports AreaChart or LineChart from recharts'
);
assert(
  /\b(?:Area|Line)\b/.test(src),
  'references Area or Line series component'
);
assert(
  /\bXAxis\b/.test(src),
  'references XAxis'
);
assert(
  /\bYAxis\b/.test(src),
  'references YAxis'
);
assert(
  /\bCartesianGrid\b/.test(src),
  'references CartesianGrid'
);

// ============================================================
// Test 5: Imports Card primitives from shadcn
// ============================================================
console.log('\nTest 5: Imports Card primitives from @/components/ui/card');
assert(
  /import\s*\{[^}]*\bCard\b[^}]*\}\s*from\s*['"]@\/components\/ui\/card['"]/.test(
    src
  ),
  'imports Card from @/components/ui/card'
);
assert(
  /\bCardHeader\b/.test(src),
  'references CardHeader'
);
assert(
  /\bCardTitle\b/.test(src),
  'references CardTitle'
);
assert(
  /\bCardContent\b/.test(src),
  'references CardContent'
);
assert(
  /Health Trend/.test(src),
  'CardTitle uses "Health Trend" label'
);

// ============================================================
// Test 6: Imports HealthHistoryEntry type
// ============================================================
console.log('\nTest 6: Imports HealthHistoryEntry type');
assert(
  /import\s+type\s*\{[^}]*\bHealthHistoryEntry\b[^}]*\}\s*from\s*['"]@\/types\/snapshot['"]/.test(
    src
  ) ||
    /import\s*\{[^}]*\btype\s+HealthHistoryEntry\b[^}]*\}\s*from\s*['"]@\/types\/snapshot['"]/.test(
      src
    ),
  'imports type HealthHistoryEntry from @/types/snapshot'
);

// ============================================================
// Test 7: ChartConfig declares passed/warnings/failures series
// ============================================================
console.log('\nTest 7: ChartConfig shape');
assert(
  /passed\s*:\s*\{[^}]*label\s*:\s*['"]Passed['"]/.test(src),
  'chartConfig declares passed series with label "Passed"'
);
assert(
  /warnings\s*:\s*\{[^}]*label\s*:\s*['"]Warnings['"]/.test(src),
  'chartConfig declares warnings series with label "Warnings"'
);
assert(
  /failures\s*:\s*\{[^}]*label\s*:\s*['"]Failures['"]/.test(src),
  'chartConfig declares failures series with label "Failures"'
);
assert(
  /var\(--hive-gold\)/.test(src),
  'chartConfig references var(--hive-gold) for passed series'
);
assert(
  /var\(--hive-amber\)/.test(src),
  'chartConfig references var(--hive-amber) for warnings series'
);
assert(
  /#ef4444/.test(src),
  'chartConfig references #ef4444 for failures series'
);

// ============================================================
// Test 8: Data transform mapping
// ============================================================
console.log('\nTest 8: Data transform uses summary.passed/warnings/failures');
assert(
  /summary\.passed/.test(src),
  'data transform reads summary.passed'
);
assert(
  /summary\.warnings/.test(src),
  'data transform reads summary.warnings'
);
assert(
  /summary\.failures/.test(src),
  'data transform reads summary.failures'
);
assert(
  /timestamp/.test(src),
  'data transform references timestamp field'
);
assert(
  /slice\(0,\s*10\)/.test(src),
  'timestamp is truncated to YYYY-MM-DD via slice(0, 10)'
);

// ============================================================
// Test 9: Fill attributes reference --color-<key> CSS variables
// ============================================================
console.log('\nTest 9: Area/Line fill uses --color-<key> CSS variables');
assert(
  /var\(--color-passed\)/.test(src),
  'series fill/stroke references var(--color-passed)'
);
assert(
  /var\(--color-warnings\)/.test(src),
  'series fill/stroke references var(--color-warnings)'
);
assert(
  /var\(--color-failures\)/.test(src),
  'series fill/stroke references var(--color-failures)'
);
assert(
  /dataKey\s*=\s*['"]passed['"]/.test(src),
  'Area/Line uses dataKey="passed"'
);
assert(
  /dataKey\s*=\s*['"]warnings['"]/.test(src),
  'Area/Line uses dataKey="warnings"'
);
assert(
  /dataKey\s*=\s*['"]failures['"]/.test(src),
  'Area/Line uses dataKey="failures"'
);

// ============================================================
// Test 10: Empty state message
// ============================================================
console.log('\nTest 10: Empty state message');
assert(
  /No health history yet/.test(src),
  'renders "No health history yet" empty state'
);
assert(
  /hive-muted/.test(src),
  'empty state uses hive-muted token'
);

// ============================================================
// Test 11: Fixed 240px chart height
// ============================================================
console.log('\nTest 11: Fixed 240px chart height');
assert(
  /240px|h-\[240px\]/.test(src),
  'chart container is fixed at 240px height'
);

// ============================================================
// Test 12: Props shape accepts null/undefined
// ============================================================
console.log('\nTest 12: Props accept HealthHistoryEntry[] | null | undefined');
assert(
  /healthHistory\s*:\s*HealthHistoryEntry\[\]\s*\|\s*null\s*\|\s*undefined|healthHistory\?\s*:\s*HealthHistoryEntry\[\]\s*\|\s*null/.test(
    src
  ),
  'props type accepts HealthHistoryEntry[] | null | undefined'
);

// ============================================================
// Results
// ============================================================
console.log(
  `\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`
);
process.exit(failed > 0 ? 1 : 0);
