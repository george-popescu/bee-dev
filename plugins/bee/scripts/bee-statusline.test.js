#!/usr/bin/env node
// Tests for bee-statusline.js version display feature
// Since there is no test runner, this script validates behavior directly
// by spawning the statusline script with controlled inputs and checking output.

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
  const result = execFileSync('node', [SCRIPT], {
    input,
    encoding: 'utf8',
    timeout: 5000,
  });
  return result;
}

// Strip ANSI escape codes for easier assertion
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

console.log('Testing bee-statusline.js version display...\n');

// Test 1: Version segment appears in output when plugin.json exists
console.log('Test 1: Version segment appears in output');
{
  // Read the actual version from plugin.json
  const pluginData = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8'));
  const expectedVersion = pluginData.version;

  const output = runStatusline({
    model: { display_name: 'Claude Opus 4.6' },
    workspace: { current_dir: process.cwd() },
    context_window: { remaining_percentage: 80 },
  });

  const plain = stripAnsi(output);
  assert(
    plain.includes(`v${expectedVersion}`),
    `Output contains "v${expectedVersion}"`
  );
}

// Test 2: Version is between model name and bee emoji
console.log('Test 2: Version is positioned between model and bee emoji');
{
  const pluginData = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8'));
  const expectedVersion = pluginData.version;

  const output = runStatusline({
    model: { display_name: 'Claude Opus 4.6' },
    workspace: { current_dir: process.cwd() },
    context_window: { remaining_percentage: 80 },
  });

  const plain = stripAnsi(output);
  // Expected order: Opus | vX.Y.Z | bee-emoji
  const modelIdx = plain.indexOf('Opus');
  const versionIdx = plain.indexOf(`v${expectedVersion}`);
  const beeIdx = plain.indexOf('\u{1F41D}');

  assert(modelIdx >= 0, 'Model name found in output');
  assert(versionIdx >= 0, 'Version found in output');
  assert(beeIdx >= 0, 'Bee emoji found in output');
  assert(
    modelIdx < versionIdx && versionIdx < beeIdx,
    'Order is: model < version < bee emoji'
  );
}

// Test 3: Version segment uses dim separator bars
console.log('Test 3: Version segment uses dim vertical bar separators');
{
  const output = runStatusline({
    model: { display_name: 'Claude Opus 4.6' },
    workspace: { current_dir: process.cwd() },
    context_window: { remaining_percentage: 80 },
  });

  // Check for dim bar before version: \x1b[2m\u2502\x1b[0m
  // The output should have: model \x1b[2m│\x1b[0m \x1b[2mv2.0.0\x1b[0m \x1b[2m│\x1b[0m bee
  assert(
    output.includes('\x1b[2m\u2502\x1b[0m'),
    'Dim vertical bar separator present in output'
  );
}

// Test 4: Format comment at top of file includes version
console.log('Test 4: Format comment updated to include version');
{
  const scriptContent = fs.readFileSync(SCRIPT, 'utf8');
  assert(
    scriptContent.includes('v2.0.0'),
    'Script comment mentions version format'
  );
}

// Test 5: Existing segments are preserved (bee state, git, context)
console.log('Test 5: Existing segments preserved');
{
  const output = runStatusline({
    model: { display_name: 'Claude Sonnet 4.5' },
    workspace: { current_dir: process.cwd() },
    context_window: { remaining_percentage: 60 },
  });

  const plain = stripAnsi(output);
  assert(plain.includes('Sonnet'), 'Model name is displayed');
  assert(plain.includes('\u{1F41D}'), 'Bee emoji is displayed');
  // Context percentage should be present (60% remaining = 50% used of 80% budget = 62.5%)
  assert(plain.includes('%'), 'Context percentage is displayed');
}

// Test 6: Script does not crash with missing model data
console.log('Test 6: Graceful handling with minimal input');
{
  const output = runStatusline({});
  const plain = stripAnsi(output);
  assert(plain.includes('Claude'), 'Falls back to Claude for missing model');
  assert(plain.includes('\u{1F41D}'), 'Bee emoji still shows');
}

// Test 7: Script handles missing plugin.json gracefully (no crash, no version)
console.log('Test 7: Missing plugin.json — no crash, version omitted silently');
{
  const backupPath = PLUGIN_JSON + '.bak';
  let restored = false;
  try {
    // Temporarily rename plugin.json to simulate it being missing
    fs.renameSync(PLUGIN_JSON, backupPath);

    const output = runStatusline({
      model: { display_name: 'Claude Opus 4.6' },
      workspace: { current_dir: process.cwd() },
      context_window: { remaining_percentage: 80 },
    });

    const plain = stripAnsi(output);
    assert(true, 'Script did not crash (exit code 0)');
    assert(
      !plain.match(/v\d+\.\d+\.\d+/),
      'No version string appears in output'
    );
    assert(plain.includes('Opus'), 'Model segment still renders');
    assert(plain.includes('\u{1F41D}'), 'Bee emoji still renders');
    assert(plain.includes('%'), 'Context percentage still renders');
  } catch (e) {
    if (e.status != null) {
      // execFileSync threw due to non-zero exit code
      assert(false, 'Script did not crash (exit code 0)');
    } else {
      throw e;
    }
  } finally {
    // Always restore plugin.json
    if (!restored && fs.existsSync(backupPath)) {
      fs.renameSync(backupPath, PLUGIN_JSON);
    }
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
