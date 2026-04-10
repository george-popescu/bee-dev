#!/usr/bin/env node
// Test: dashboard-ui-primitives — STRUCTURAL tests only.
// Verifies that the shadcn-style primitive components under
// plugins/bee/dashboard/src/components/ui/ exist and follow the hive
// theme conventions, React 19 ref-as-prop rule, and correct Radix imports.
//
// These tests read the files as text and assert expected patterns via
// regex. They MUST NOT run tsc, vite, npm, or any build tooling.

const fs = require('fs');
const path = require('path');

const UI_DIR = path.join(
  __dirname,
  '..',
  '..',
  'dashboard',
  'src',
  'components',
  'ui'
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

function readFile(relPath) {
  const full = path.join(UI_DIR, relPath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

// ============================================================
// Test 1: ui/ directory exists
// ============================================================
console.log('Test 1: ui/ directory exists');
assert(
  fs.existsSync(UI_DIR),
  'plugins/bee/dashboard/src/components/ui/ exists'
);

// ============================================================
// Test 2: card.tsx — all six shadcn pieces + React 19 ref-as-prop
// ============================================================
console.log('\nTest 2: card.tsx shape');
const card = readFile('card.tsx');
assert(card !== null, 'card.tsx exists');

if (card) {
  assert(
    /export\s+function\s+Card\b/.test(card),
    'card.tsx exports function Card'
  );
  assert(
    /export\s+function\s+CardHeader\b/.test(card),
    'card.tsx exports function CardHeader'
  );
  assert(
    /export\s+function\s+CardTitle\b/.test(card),
    'card.tsx exports function CardTitle'
  );
  assert(
    /export\s+function\s+CardDescription\b/.test(card),
    'card.tsx exports function CardDescription (shadcn npx add compat)'
  );
  assert(
    /export\s+function\s+CardContent\b/.test(card),
    'card.tsx exports function CardContent'
  );
  assert(
    /export\s+function\s+CardFooter\b/.test(card),
    'card.tsx exports function CardFooter'
  );
  assert(
    !/forwardRef/.test(card),
    'card.tsx does NOT use React.forwardRef (React 19 ref-as-prop rule)'
  );
  assert(
    /ref\?\s*:\s*React\.Ref/.test(card),
    'card.tsx uses React 19 ref-as-prop (ref?: React.Ref<...>)'
  );
  assert(
    /bg-hive-surface/.test(card),
    'card.tsx references hive-surface background token'
  );
  assert(
    /border-hive-border/.test(card),
    'card.tsx references hive-border token'
  );
  assert(
    /text-hive-text/.test(card),
    'card.tsx references hive-text token'
  );
  assert(
    /from\s+['"]@\/lib\/utils['"]/.test(card),
    'card.tsx imports cn from @/lib/utils'
  );
  assert(
    /\bcn\s*\(/.test(card),
    'card.tsx uses cn() helper'
  );
}

// ============================================================
// Test 3: badge.tsx — cva variants including hive theme colors
// ============================================================
console.log('\nTest 3: badge.tsx shape');
const badge = readFile('badge.tsx');
assert(badge !== null, 'badge.tsx exists');

if (badge) {
  assert(
    /export\s+function\s+Badge\b/.test(badge),
    'badge.tsx exports function Badge'
  );
  assert(
    /export\s+(?:const|function)\s+badgeVariants\b|export\s*\{[^}]*\bbadgeVariants\b/.test(
      badge
    ),
    'badge.tsx exports badgeVariants'
  );
  assert(
    /class-variance-authority/.test(badge),
    'badge.tsx imports from class-variance-authority'
  );
  assert(
    /\bcva\s*\(/.test(badge),
    'badge.tsx uses cva()'
  );
  assert(
    /default\s*:/.test(badge),
    'badge.tsx declares default variant'
  );
  assert(
    /success\s*:/.test(badge),
    'badge.tsx declares success variant'
  );
  assert(
    /warning\s*:/.test(badge),
    'badge.tsx declares warning variant'
  );
  assert(
    /danger\s*:/.test(badge),
    'badge.tsx declares danger variant'
  );
  assert(
    /muted\s*:/.test(badge),
    'badge.tsx declares muted variant'
  );
  assert(
    /hive-gold/.test(badge),
    'badge.tsx references hive-gold token (success)'
  );
  assert(
    /hive-amber/.test(badge),
    'badge.tsx references hive-amber token (warning)'
  );
  assert(
    /hive-muted/.test(badge),
    'badge.tsx references hive-muted token (muted)'
  );
  assert(
    !/forwardRef/.test(badge),
    'badge.tsx does NOT use React.forwardRef'
  );
}

// ============================================================
// Test 4: progress.tsx — Radix progress primitive, hive-gold indicator
// ============================================================
console.log('\nTest 4: progress.tsx shape');
const progress = readFile('progress.tsx');
assert(progress !== null, 'progress.tsx exists');

if (progress) {
  assert(
    /export\s+function\s+Progress\b/.test(progress),
    'progress.tsx exports function Progress'
  );
  assert(
    /@radix-ui\/react-progress/.test(progress),
    'progress.tsx imports @radix-ui/react-progress'
  );
  assert(
    /ProgressPrimitive\.Root/.test(progress),
    'progress.tsx uses ProgressPrimitive.Root'
  );
  assert(
    /ProgressPrimitive\.Indicator/.test(progress),
    'progress.tsx uses ProgressPrimitive.Indicator'
  );
  assert(
    /translateX\(-\$\{\s*100\s*-\s*\(value\s*\|\|\s*0\)\s*\}%\)/.test(
      progress
    ),
    'progress.tsx applies transform translateX(-${100 - (value || 0)}%)'
  );
  assert(
    /bg-hive-gold/.test(progress),
    'progress.tsx indicator uses hive-gold background'
  );
  assert(
    !/forwardRef/.test(progress),
    'progress.tsx does NOT use React.forwardRef'
  );
  assert(
    /ref\?\s*:\s*React\.Ref/.test(progress),
    'progress.tsx uses React 19 ref-as-prop'
  );
}

// ============================================================
// Test 5: scroll-area.tsx — Radix scroll area with ScrollBar
// ============================================================
console.log('\nTest 5: scroll-area.tsx shape');
const scroll = readFile('scroll-area.tsx');
assert(scroll !== null, 'scroll-area.tsx exists');

if (scroll) {
  assert(
    /export\s+function\s+ScrollArea\b/.test(scroll),
    'scroll-area.tsx exports function ScrollArea'
  );
  assert(
    /export\s+function\s+ScrollBar\b/.test(scroll),
    'scroll-area.tsx exports function ScrollBar'
  );
  assert(
    /@radix-ui\/react-scroll-area/.test(scroll),
    'scroll-area.tsx imports @radix-ui/react-scroll-area'
  );
  assert(
    /ScrollAreaPrimitive\.Root/.test(scroll),
    'scroll-area.tsx uses ScrollAreaPrimitive.Root'
  );
  assert(
    /ScrollAreaPrimitive\.Viewport/.test(scroll),
    'scroll-area.tsx uses ScrollAreaPrimitive.Viewport'
  );
  assert(
    /ScrollAreaPrimitive\.Scrollbar/.test(scroll),
    'scroll-area.tsx uses ScrollAreaPrimitive.Scrollbar'
  );
  assert(
    /ScrollAreaPrimitive\.Thumb/.test(scroll),
    'scroll-area.tsx uses ScrollAreaPrimitive.Thumb'
  );
  assert(
    /hive-(border|muted|surface)/.test(scroll),
    'scroll-area.tsx references hive theme tokens'
  );
  assert(
    !/forwardRef/.test(scroll),
    'scroll-area.tsx does NOT use React.forwardRef'
  );
}

// ============================================================
// Test 6: skeleton.tsx — animate-pulse placeholder
// ============================================================
console.log('\nTest 6: skeleton.tsx shape');
const skeleton = readFile('skeleton.tsx');
assert(skeleton !== null, 'skeleton.tsx exists');

if (skeleton) {
  assert(
    /export\s+function\s+Skeleton\b/.test(skeleton),
    'skeleton.tsx exports function Skeleton'
  );
  assert(
    /animate-pulse/.test(skeleton),
    'skeleton.tsx uses animate-pulse utility'
  );
  assert(
    /bg-hive-muted/.test(skeleton),
    'skeleton.tsx uses hive-muted background token'
  );
  assert(
    /rounded-md/.test(skeleton),
    'skeleton.tsx uses rounded-md'
  );
  assert(
    !/forwardRef/.test(skeleton),
    'skeleton.tsx does NOT use React.forwardRef'
  );
  assert(
    /from\s+['"]@\/lib\/utils['"]/.test(skeleton),
    'skeleton.tsx imports cn from @/lib/utils'
  );
}

// ============================================================
// Test 7: chart.tsx — shadcn chart primitive wrapping recharts
// ============================================================
console.log('\nTest 7: chart.tsx shape');
const chart = readFile('chart.tsx');
assert(chart !== null, 'chart.tsx exists');

if (chart) {
  assert(
    /export\s+function\s+ChartContainer\b/.test(chart),
    'chart.tsx exports function ChartContainer'
  );
  assert(
    /export\s+type\s+ChartConfig\b|export\s*\{[^}]*\btype\s+ChartConfig\b|export\s*\{[^}]*\bChartConfig\b/.test(
      chart
    ),
    'chart.tsx exports ChartConfig type'
  );
  assert(
    /ChartTooltip\b/.test(chart),
    'chart.tsx defines ChartTooltip'
  );
  assert(
    /ChartTooltipContent\b/.test(chart),
    'chart.tsx defines ChartTooltipContent'
  );
  assert(
    /ChartLegend\b/.test(chart),
    'chart.tsx defines ChartLegend'
  );
  assert(
    /ChartLegendContent\b/.test(chart),
    'chart.tsx defines ChartLegendContent'
  );
  assert(
    /from\s+['"]recharts['"]/.test(chart),
    'chart.tsx imports from recharts'
  );
  assert(
    /ResponsiveContainer/.test(chart),
    'chart.tsx uses ResponsiveContainer from recharts'
  );
  assert(
    !/forwardRef/.test(chart),
    'chart.tsx does NOT use React.forwardRef'
  );
  assert(
    /ChartContainer/.test(chart) && /ChartConfig/.test(chart),
    'chart.tsx references both ChartContainer and ChartConfig'
  );
  // Chart color wiring — must reference CSS variables
  assert(
    /--color-/.test(chart) || /var\(--color-/.test(chart),
    'chart.tsx wires --color-<key> CSS variables from config'
  );
}

// ============================================================
// Results
// ============================================================
console.log(
  `\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`
);
process.exit(failed > 0 ? 1 : 0);
