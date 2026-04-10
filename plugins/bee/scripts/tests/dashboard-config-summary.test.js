#!/usr/bin/env node
// Test: dashboard-config-summary -- STRUCTURAL tests for T3.13
// ConfigSummaryPanel.
//
// Verifies that ConfigSummaryPanel.tsx exists at the expected panels
// directory, exports a React 19 function component named
// ConfigSummaryPanel, imports Card + Badge primitives and the BeeConfig
// type, renders the "Config" title, references all the required config
// keys (stacks / implementation_mode / ci / context7 / review / ship),
// shows the "No config loaded" empty-state literal when config is null
// or undefined, and uses the hive-muted token for key labels.
//
// These tests read the file as text and assert expected patterns via
// regex. They MUST NOT run tsc, vite, npm, or any other build tooling.

const fs = require('fs');
const path = require('path');

const PANEL_PATH = path.join(
  __dirname,
  '..',
  '..',
  'dashboard',
  'src',
  'components',
  'panels',
  'ConfigSummaryPanel.tsx'
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
// Test 1: file exists at the expected location
// ============================================================
console.log('Test 1: ConfigSummaryPanel.tsx exists');
assert(
  fs.existsSync(PANEL_PATH),
  'plugins/bee/dashboard/src/components/panels/ConfigSummaryPanel.tsx exists'
);

const source = fs.existsSync(PANEL_PATH)
  ? fs.readFileSync(PANEL_PATH, 'utf8')
  : '';

// ============================================================
// Test 2: exports ConfigSummaryPanel as a function component (React 19)
// ============================================================
console.log('\nTest 2: function component export (React 19)');
assert(
  /export\s+function\s+ConfigSummaryPanel\b/.test(source),
  'exports function ConfigSummaryPanel (React 19 -- no forwardRef)'
);
assert(
  !/forwardRef/.test(source),
  'does NOT use React.forwardRef (React 19 rule)'
);

// ============================================================
// Test 3: destructures the config prop
// ============================================================
console.log('\nTest 3: destructures config prop');
assert(
  /\{\s*config\s*[},:]/.test(source),
  'destructures { config } in signature'
);

// ============================================================
// Test 4: imports Card primitives (Card, CardHeader, CardTitle,
// CardContent) from @/components/ui/card
// ============================================================
console.log('\nTest 4: Card primitive imports');
assert(
  /import\s*\{[^}]*\bCard\b[^}]*\}\s*from\s*['"]@\/components\/ui\/card['"]/.test(
    source
  ),
  'imports Card from @/components/ui/card'
);
assert(
  /import\s*\{[^}]*\bCardHeader\b[^}]*\}\s*from\s*['"]@\/components\/ui\/card['"]/.test(
    source
  ),
  'imports CardHeader from @/components/ui/card'
);
assert(
  /import\s*\{[^}]*\bCardTitle\b[^}]*\}\s*from\s*['"]@\/components\/ui\/card['"]/.test(
    source
  ),
  'imports CardTitle from @/components/ui/card'
);
assert(
  /import\s*\{[^}]*\bCardContent\b[^}]*\}\s*from\s*['"]@\/components\/ui\/card['"]/.test(
    source
  ),
  'imports CardContent from @/components/ui/card'
);

// ============================================================
// Test 5: imports Badge from @/components/ui/badge
// ============================================================
console.log('\nTest 5: Badge primitive import');
assert(
  /import\s*\{[^}]*\bBadge\b[^}]*\}\s*from\s*['"]@\/components\/ui\/badge['"]/.test(
    source
  ),
  'imports Badge from @/components/ui/badge'
);

// ============================================================
// Test 6: imports BeeConfig type from @/types/snapshot
// ============================================================
console.log('\nTest 6: BeeConfig type import');
assert(
  /import\s+type\s*\{[^}]*\bBeeConfig\b[^}]*\}\s*from\s*['"]@\/types\/snapshot['"]/.test(
    source
  ) ||
    /import\s*\{[^}]*\btype\s+BeeConfig\b[^}]*\}\s*from\s*['"]@\/types\/snapshot['"]/.test(
      source
    ),
  'imports BeeConfig type from @/types/snapshot'
);

// ============================================================
// Test 7: Card shell with "Config" title
// ============================================================
console.log('\nTest 7: Card shell with "Config" title');
assert(/<Card\b/.test(source), 'renders <Card>');
assert(/<CardHeader\b/.test(source), 'renders <CardHeader>');
assert(
  /<CardTitle\b[^>]*>\s*Config\s*</.test(source),
  'CardTitle reads "Config"'
);
assert(/<CardContent\b/.test(source), 'renders <CardContent>');

// ============================================================
// Test 8: empty state literal "No config loaded"
// ============================================================
console.log('\nTest 8: empty state literal');
assert(
  /No config loaded/.test(source),
  'contains literal "No config loaded" empty-state message'
);
assert(
  /!config\b|config\s*===\s*null|config\s*==\s*null|config\s*\?/.test(source),
  'guards against null/undefined config (null/undefined check)'
);

// ============================================================
// Test 9: references all required config keys
// ============================================================
console.log('\nTest 9: references required config keys');
assert(
  /config\.stacks\b|\bstacks\b/.test(source),
  'references stacks key'
);
assert(
  /implementation_mode/.test(source),
  'references implementation_mode key'
);
assert(
  /\bci\b/.test(source),
  'references ci key'
);
assert(
  /context7/.test(source),
  'references context7 key'
);
assert(
  /\breview\b/.test(source),
  'references review settings block'
);
assert(
  /against_spec/.test(source),
  'references review.against_spec'
);
assert(
  /against_standards/.test(source),
  'references review.against_standards'
);
assert(
  /dead_code/.test(source),
  'references review.dead_code'
);
assert(
  /\bship\b/.test(source),
  'references ship settings block'
);
assert(
  /max_review_iterations/.test(source),
  'references ship.max_review_iterations'
);
assert(
  /final_review/.test(source),
  'references ship.final_review'
);

// ============================================================
// Test 10: Uses Badge for boolean flags and implementation_mode
// ============================================================
console.log('\nTest 10: uses Badge for booleans and mode');
assert(/<Badge\b/.test(source), 'renders at least one <Badge>');

// ============================================================
// Test 11: key labels use the hive-muted token, values use hive-text
// ============================================================
console.log('\nTest 11: muted key labels / hive-text values');
assert(
  /text-hive-muted/.test(source),
  'uses text-hive-muted token for key labels'
);
assert(
  /text-hive-text/.test(source),
  'uses text-hive-text token for values'
);

// ============================================================
// Results
// ============================================================
console.log(
  `\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`
);
process.exit(failed > 0 ? 1 : 0);
