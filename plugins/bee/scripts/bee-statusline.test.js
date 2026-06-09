#!/usr/bin/env node
// Tests for bee-statusline.js — Honeycomb design
// 🐝 4.0 ┊ ⬢⬢⬢⬡⬡ P3/5 EXEC ┊ █████░░░░░ 48% ┊ Δ7

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCRIPT = path.join(__dirname, 'bee-statusline.js');
const PLUGIN_JSON = path.join(__dirname, '..', '.claude-plugin', 'plugin.json');

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

function runStatusline(inputData) {
  const input = JSON.stringify(inputData);
  return execFileSync('node', [SCRIPT], {
    input,
    encoding: 'utf8',
    timeout: 5000,
  });
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

const baseInput = {
  model: { display_name: 'Claude Opus 4.6' },
  workspace: { current_dir: process.cwd() },
  context_window: { remaining_percentage: 80 },
};

console.log('Testing bee-statusline.js — Honeycomb design\n');

// ============================================================
// Test Group 1: Core elements present
// ============================================================
console.log('Test Group 1: Core elements');
{
  const output = runStatusline(baseInput);
  const plain = stripAnsi(output);

  assert(plain.includes('\u{1F41D}'), 'Bee emoji (🐝) present');
  assert(plain.includes('Opus'), 'Model name present');
  assert(plain.includes('%'), 'Context percentage present');
  assert(plain.includes('\u250A') || output.includes('\u250A'), 'Thin dotted separator (┊) present');
}

// ============================================================
// Test Group 2: Version display
// ============================================================
console.log('\nTest Group 2: Version display');
{
  const pluginData = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8'));
  const fullVersion = pluginData.version;
  const parts = fullVersion.split('.');
  const shortVersion = `${parts[0]}.${parts[1]}`;

  const output = runStatusline(baseInput);
  const plain = stripAnsi(output);

  assert(plain.includes(shortVersion), `Short version "${shortVersion}" present (trimmed from ${fullVersion})`);

  // Version after bee emoji (design: 🐝 4.0 ┊ ...)
  const versionIdx = plain.indexOf(shortVersion);
  const beeIdx = plain.indexOf('\u{1F41D}');
  assert(beeIdx >= 0 && versionIdx > beeIdx, 'Version appears after bee emoji (🐝 4.0 ┊ ...)');
}

// ============================================================
// Test Group 3: Honeycomb progress bar
// ============================================================
console.log('\nTest Group 3: Honeycomb progress');
{
  const scriptContent = fs.readFileSync(SCRIPT, 'utf8');
  assert(scriptContent.includes('\u2B22'), 'Uses ⬢ (filled hexagon) for completed phases');
  assert(scriptContent.includes('\u2B21'), 'Uses ⬡ (empty hexagon) for pending phases');
  assert(scriptContent.includes('honeycombBar'), 'Has honeycombBar function');
  assert(!scriptContent.includes('segments = 5'), 'Honeycomb is one-hex-per-phase (no hardcoded 5-segment bar)');
}

// ============================================================
// Test Group 4: Context gauge style
// ============================================================
console.log('\nTest Group 4: Context gauge');
{
  const scriptContent = fs.readFileSync(SCRIPT, 'utf8');
  assert(scriptContent.includes('\u2588'), 'Uses █ (full block) for filled context');
  assert(scriptContent.includes('\u2591'), 'Uses ░ (light shade) for empty context');

  // Test color thresholds
  const output25 = stripAnsi(runStatusline({ ...baseInput, context_window: { remaining_percentage: 80 } }));
  assert(output25.includes('%'), 'Low usage shows percentage');

  const output90 = stripAnsi(runStatusline({ ...baseInput, context_window: { remaining_percentage: 10 } }));
  assert(output90.includes('%'), 'High usage shows percentage');
}

// ============================================================
// Test Group 5: Git dirty display
// ============================================================
console.log('\nTest Group 5: Git dirty');
{
  const scriptContent = fs.readFileSync(SCRIPT, 'utf8');
  assert(scriptContent.includes('\u0394'), 'Uses Δ (delta) for dirty count');
  assert(scriptContent.includes('gitDirtyCount'), 'Has gitDirtyCount function');
}

// ============================================================
// Test Group 6: Model name shortening
// ============================================================
console.log('\nTest Group 6: Model names');
{
  const opusPlain = stripAnsi(runStatusline({ ...baseInput, model: { display_name: 'Claude Opus 4.6' } }));
  assert(opusPlain.includes('Opus'), 'Claude Opus 4.6 → Opus');

  const sonnetPlain = stripAnsi(runStatusline({ ...baseInput, model: { display_name: 'Claude Sonnet 4.6' } }));
  assert(sonnetPlain.includes('Sonnet'), 'Claude Sonnet 4.6 → Sonnet');

  const haikuPlain = stripAnsi(runStatusline({ ...baseInput, model: { display_name: 'Claude Haiku 4.5' } }));
  assert(haikuPlain.includes('Haiku'), 'Claude Haiku 4.5 → Haiku');

  // Model VERSION is shown next to the tier (disambiguates from the plugin version)
  assert(opusPlain.includes('Opus 4.6'), 'Claude Opus 4.6 → "Opus 4.6" (model version shown)');
  assert(sonnetPlain.includes('Sonnet 4.6'), 'Claude Sonnet 4.6 → "Sonnet 4.6" (model version shown)');
  assert(haikuPlain.includes('Haiku 4.5'), 'Claude Haiku 4.5 → "Haiku 4.5" (model version shown)');
  const suffixed = stripAnsi(runStatusline({ ...baseInput, model: { display_name: 'Claude Opus 4.8 (1M context)' } }));
  assert(suffixed.includes('Opus 4.8'), 'Opus 4.8 (1M context) → "Opus 4.8" (version parsed, suffix ignored)');
}

// ============================================================
// Test Group 7: Graceful handling
// ============================================================
console.log('\nTest Group 7: Graceful handling');
{
  // Empty input
  const emptyOutput = runStatusline({});
  assert(emptyOutput.length > 0, 'Empty input produces output (no crash)');

  // Missing model
  const noModelPlain = stripAnsi(runStatusline({ context_window: { remaining_percentage: 50 } }));
  assert(noModelPlain.includes('\u{1F41D}'), 'Bee emoji shows without model');

  // Missing plugin.json
  const backupPath = PLUGIN_JSON + '.bak';
  try {
    fs.renameSync(PLUGIN_JSON, backupPath);
    const output = runStatusline(baseInput);
    assert(true, 'No crash when plugin.json missing');
    const plain = stripAnsi(output);
    assert(plain.includes('\u{1F41D}'), 'Bee emoji still renders without plugin.json');
  } finally {
    if (fs.existsSync(backupPath)) {
      fs.renameSync(backupPath, PLUGIN_JSON);
    }
  }
}

// ============================================================
// Test Group 8: Script comment matches design
// ============================================================
console.log('\nTest Group 8: Design alignment');
{
  const scriptContent = fs.readFileSync(SCRIPT, 'utf8');
  assert(scriptContent.includes('Honeycomb'), 'Script comment mentions Honeycomb design');
  assert(scriptContent.includes('\u{1F41D}'), 'Script includes bee emoji in comment/code');
  assert(!scriptContent.includes('\u25B0'), 'Old ▰ progress char removed');
  assert(!scriptContent.includes('\u25B1'), 'Old ▱ progress char removed');
}

// ============================================================
// Test Group 9: Honeycomb count == number of phases (not a fixed 5)
// ============================================================
console.log('\nTest Group 9: Honeycomb per-phase count');
{
  const os = require('os');
  const FILLED = '⬢'; // ⬢
  const EMPTY = '⬡';  // ⬡
  const countHex = s => [...s].filter(c => c === FILLED || c === EMPTY).length;
  const countFilled = s => [...s].filter(c => c === FILLED).length;

  function renderWithPhases(statuses) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-sl-'));
    fs.mkdirSync(path.join(tmp, '.bee'), { recursive: true });
    const body = statuses.map((s, i) => `| ${i + 1} | p${i + 1} | ${s} |`).join('\n');
    const state = `# State\n## Current Spec\n- Path: .bee/specs/x/\n- Status: IN_PROGRESS\n## Phases\n| # | Name | Status |\n|---|---|---|\n${body}\n## Quick Tasks\n`;
    fs.writeFileSync(path.join(tmp, '.bee', 'STATE.md'), state);
    try {
      return stripAnsi(runStatusline({ ...baseInput, workspace: { current_dir: tmp } }));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  const five = renderWithPhases(['REVIEWED', 'REVIEWED', 'EXECUTING', 'PLANNED', 'PLANNED']);
  assert(countHex(five) === 5, `5-phase spec renders 5 hexagons (got ${countHex(five)})`);
  assert(countFilled(five) === 2, `5-phase spec with 2 done renders 2 filled hexagons (got ${countFilled(five)})`);

  const three = renderWithPhases(['REVIEWED', 'PLANNED', 'PLANNED']);
  assert(countHex(three) === 3, `3-phase spec renders 3 hexagons, not a fixed 5 (got ${countHex(three)})`);

  const allDone = renderWithPhases(['REVIEWED', 'REVIEWED']);
  assert(countHex(allDone) === 2 && countFilled(allDone) === 2, '2-phase all-done renders 2 filled hexagons');
}

// ============================================================
// Results
// ============================================================
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
