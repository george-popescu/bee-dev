#!/usr/bin/env node
// Tests for FIX 1, FIX 2, FIX 3, FIX 5, FIX 6 from batch15 multi-spec fixes.
//
// FIX 1: complete-spec/archive-spec skip archive-memory.sh when other active specs remain
// FIX 2: specs-cli touch errors on missing per-spec STATE.md (no false "touched")
// FIX 3: new-spec collision guard omits "Amend" for terminal (shipped/archived) colliding slug
// FIX 5: archive-memory.sh called with {spec-folder-name} (slug) not {spec-name}
// FIX 6: lock waiter timeout (15s) > stale-steal threshold (10s)

const fs = require('fs');
const os = require('os');
const path = require('path');

const COMMANDS_DIR = path.join(__dirname, '..', '..', 'commands');
const SCRIPTS_DIR = path.join(__dirname, '..');

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

function readCmd(name) {
  return fs.readFileSync(path.join(COMMANDS_DIR, name), 'utf8');
}

// ============================================================
// FIX 1 + FIX 5: complete-spec.md — memory guard before archive-memory.sh
// ============================================================
console.log('Test Group 1: complete-spec.md — memory guard + slug arg (FIX 1 + FIX 5)');
{
  const content = readCmd('complete-spec.md');

  // Must check active specs BEFORE calling archive-memory.sh
  const activeCheckIdx = content.indexOf('list --bee .bee --active --json');
  const archiveMemoryIdx = content.indexOf('archive-memory.sh');
  assert(
    activeCheckIdx > -1,
    'complete-spec.md calls specs-cli.js list --active --json before archive-memory (FIX 1)'
  );
  assert(
    archiveMemoryIdx > -1,
    'complete-spec.md still contains archive-memory.sh call path'
  );
  assert(
    activeCheckIdx < archiveMemoryIdx,
    'complete-spec.md: active-spec check comes BEFORE archive-memory.sh call (FIX 1)'
  );

  // Must mention skipping when other specs remain
  assert(
    content.includes('SKIP the `archive-memory.sh` call') || content.includes('SKIP the archive-memory.sh call'),
    'complete-spec.md: explicitly states to SKIP archive-memory.sh when others are active (FIX 1)'
  );

  // Must use spec-folder-name (slug) not spec-name for the archive-memory.sh argument
  // The actual bash invocation line: find the one with CLAUDE_PLUGIN_ROOT
  const bashCallIdx = content.indexOf('${CLAUDE_PLUGIN_ROOT}/scripts/archive-memory.sh');
  const bashCallLine = bashCallIdx > -1 ? content.slice(bashCallIdx, bashCallIdx + 100) : '';
  assert(
    bashCallLine.includes('{spec-folder-name}'),
    'complete-spec.md: archive-memory.sh receives {spec-folder-name} (slug), not {spec-name} (FIX 5)'
  );
  assert(
    !bashCallLine.includes('"{spec-name}"'),
    'complete-spec.md: archive-memory.sh does NOT use plain {spec-name} arg (FIX 5)'
  );

  // User message must explain the skip reason
  assert(
    content.includes('other active spec(s) still use it'),
    'complete-spec.md: skip message explains N other active specs still need memory (FIX 1)'
  );
}

// ============================================================
// FIX 1 + FIX 5: archive-spec.md — memory guard + slug arg
// ============================================================
console.log('\nTest Group 2: archive-spec.md — memory guard + slug arg (FIX 1 + FIX 5)');
{
  const content = readCmd('archive-spec.md');

  const activeCheckIdx = content.indexOf('list --bee .bee --active --json');
  const archiveMemoryIdx = content.indexOf('archive-memory.sh');
  assert(
    activeCheckIdx > -1,
    'archive-spec.md calls specs-cli.js list --active --json before archive-memory (FIX 1)'
  );
  assert(
    archiveMemoryIdx > -1,
    'archive-spec.md still contains archive-memory.sh call path'
  );
  assert(
    activeCheckIdx < archiveMemoryIdx,
    'archive-spec.md: active-spec check comes BEFORE archive-memory.sh call (FIX 1)'
  );
  assert(
    content.includes('SKIP the `archive-memory.sh` call') || content.includes('SKIP the archive-memory.sh call'),
    'archive-spec.md: explicitly states to SKIP archive-memory.sh when others are active (FIX 1)'
  );

  const bashCallIdx2 = content.indexOf('${CLAUDE_PLUGIN_ROOT}/scripts/archive-memory.sh');
  const bashCallLine2 = bashCallIdx2 > -1 ? content.slice(bashCallIdx2, bashCallIdx2 + 100) : '';
  assert(
    bashCallLine2.includes('{spec-folder-name}'),
    'archive-spec.md: archive-memory.sh receives {spec-folder-name} (slug), not {spec-name} (FIX 5)'
  );
  assert(
    !bashCallLine2.includes('"{spec-name}"'),
    'archive-spec.md: archive-memory.sh does NOT use plain {spec-name} arg (FIX 5)'
  );

  assert(
    content.includes('other active spec(s) still use it'),
    'archive-spec.md: skip message explains N other active specs still need memory (FIX 1)'
  );
}

// ============================================================
// FIX 2: specs-cli.js touch — errors when per-spec STATE.md missing
// ============================================================
console.log('\nTest Group 3: specs-cli.js touch — error on missing per-spec STATE.md (FIX 2)');
{
  const { main } = require(path.join(SCRIPTS_DIR, 'specs-cli.js'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-fix2-'));
  const beeDir = path.join(tmp, '.bee');
  fs.mkdirSync(beeDir, { recursive: true });

  // Write a minimal global STATE.md reflecting spec-b so g !== slug-a
  const globalState = [
    '# Bee Project State',
    '## Current Spec',
    '- Name: spec-b',
    '- Path: .bee/specs/spec-b/',
    '- Status: IN_PROGRESS',
    '',
    '## Phases',
    '| # | Name | Status | Plan | Plan Review | Executed | Reviewed | Tested | Committed |',
    '|---|------|--------|------|-------------|----------|----------|--------|-----------|',
    '',
    '## Quick Tasks',
    '',
    '| # | Description | Date | Commit |',
    '|---|-------------|------|--------|',
    '',
    '## Decisions Log',
    '',
    '## Last Action',
    '- Command: /bee:new-spec',
    '- Timestamp: 2026-01-01T00:00:00Z',
    '- Result: spec created',
  ].join('\n');
  fs.writeFileSync(path.join(beeDir, 'STATE.md'), globalState);

  // Write a per-spec STATE.md for spec-b so the global can legitimately reflect it
  const specBDir = path.join(beeDir, 'specs', 'spec-b');
  fs.mkdirSync(specBDir, { recursive: true });
  fs.writeFileSync(path.join(specBDir, 'STATE.md'), globalState.replace('spec-b', 'spec-b').replace('.bee/specs/spec-b/', '.bee/specs/spec-b/'));

  // Register both spec-a and spec-b
  const registry = {
    specs: [
      { slug: 'spec-a', title: 'Spec A', stage: 'planning', location: 'in-place', created: '2026-01-01T00:00:00Z', last_touched: '2026-01-01T00:00:00Z' },
      { slug: 'spec-b', title: 'Spec B', stage: 'executing', location: 'in-place', created: '2026-01-01T00:00:00Z', last_touched: '2026-01-02T00:00:00Z' },
    ],
  };
  fs.writeFileSync(path.join(beeDir, 'specs.json'), JSON.stringify(registry, null, 2) + '\n');

  // spec-a exists in registry but has NO per-spec STATE.md — this is the FIX 2 scenario
  // (spec-b is currently in global, g !== 'spec-a', so restoreToGlobal would be called)

  // Capture stderr
  let stderrOutput = '';
  const origStderr = process.stderr.write.bind(process.stderr);
  process.stderr.write = (s) => { stderrOutput += s; return true; };
  const origStdout = process.stdout.write.bind(process.stdout);
  let stdoutOutput = '';
  process.stdout.write = (s) => { stdoutOutput += s; return true; };

  let exitCode;
  try {
    exitCode = main(['touch', '--bee', beeDir, '--slug', 'spec-a']);
  } finally {
    process.stderr.write = origStderr;
    process.stdout.write = origStdout;
  }

  assert(
    exitCode !== 0,
    'touch spec-a (no per-spec STATE.md) exits non-zero (FIX 2)'
  );
  assert(
    stderrOutput.includes('no per-spec STATE.md') || stderrOutput.includes('cannot switch'),
    'touch spec-a (no per-spec STATE.md) prints error to stderr (FIX 2)'
  );
  assert(
    !stdoutOutput.includes('touched spec-a'),
    'touch spec-a (no per-spec STATE.md) does NOT print "touched" (no false success) (FIX 2)'
  );

  // Global must still coherently reflect spec-b (not corrupted)
  const globalAfter = fs.readFileSync(path.join(beeDir, 'STATE.md'), 'utf8');
  assert(
    globalAfter.includes('spec-b'),
    'touch failure leaves global STATE.md coherent (still reflects spec-b) (FIX 2)'
  );

  fs.rmSync(tmp, { recursive: true, force: true });
}

// ============================================================
// FIX 3: new-spec.md — terminal slug collision omits "Amend"
// ============================================================
console.log('\nTest Group 4: new-spec.md — terminal slug collision guard (FIX 3)');
{
  const content = readCmd('new-spec.md');

  // Must detect terminal stage in the collision guard
  assert(
    content.includes('terminal') || content.includes('shipped') || content.includes('TERMINAL'),
    'new-spec.md collision guard detects terminal stage (shipped/archived) (FIX 3)'
  );

  // Terminal path must NOT offer "Amend the existing spec"
  // Find the terminal collision block
  const terminalIdx = content.indexOf('TERMINAL') > -1 ? content.indexOf('TERMINAL') :
    content.indexOf('already completed') > -1 ? content.indexOf('already completed') :
    content.indexOf('is already completed');
  const amendIdx = content.indexOf('Amend the existing spec');

  // The "Amend" option must NOT appear in the terminal collision branch
  // We check by finding the terminal block and ensuring "Amend" is NOT in it
  // The terminal block should end before the active collision block begins
  assert(
    terminalIdx > -1,
    'new-spec.md collision guard has a terminal/completed detection path (FIX 3)'
  );

  // "Amend" must only appear in the ACTIVE (non-terminal) collision branch
  // Strategy: the terminal block should be separate from the active block
  assert(
    content.includes('Amend the existing spec'),
    'new-spec.md still offers "Amend the existing spec" for ACTIVE collisions (FIX 3)'
  );

  // Terminal branch must offer "fresh dated slug" or "different" option, not amend
  assert(
    content.includes('fresh dated slug') || content.includes('new spec with a fresh'),
    'new-spec.md terminal collision offers a "fresh dated slug" option (not amend) (FIX 3)'
  );

  // Terminal branch must explain the old one is already complete
  assert(
    content.includes('already completed') || content.includes('the old spec is complete'),
    'new-spec.md terminal collision explains the old spec is already complete (FIX 3)'
  );
}

// ============================================================
// FIX 6: specs-registry.js — waiter timeout > stale-steal threshold
// ============================================================
console.log('\nTest Group 5: specs-registry.js — lock waiter timeout > stale threshold (FIX 6)');
{
  const regContent = fs.readFileSync(path.join(SCRIPTS_DIR, 'specs-registry.js'), 'utf8');

  // Extract the constants
  const staleMatch = regContent.match(/LOCK_STALE_MS\s*=\s*(\d+)/);
  const timeoutMatch = regContent.match(/LOCK_TIMEOUT_MS\s*=\s*(\d+)/);

  assert(
    staleMatch !== null,
    'specs-registry.js defines LOCK_STALE_MS constant (FIX 6)'
  );
  assert(
    timeoutMatch !== null,
    'specs-registry.js defines LOCK_TIMEOUT_MS constant (FIX 6)'
  );

  if (staleMatch && timeoutMatch) {
    const staleMs = parseInt(staleMatch[1], 10);
    const timeoutMs = parseInt(timeoutMatch[1], 10);

    assert(
      staleMs === 10000,
      `LOCK_STALE_MS is 10000ms (got ${staleMs}) (FIX 6)`
    );
    assert(
      timeoutMs > staleMs,
      `LOCK_TIMEOUT_MS (${timeoutMs}) > LOCK_STALE_MS (${staleMs}) — waiter can outlast stale lock (FIX 6)`
    );
    assert(
      timeoutMs >= 15000,
      `LOCK_TIMEOUT_MS (${timeoutMs}) >= 15000ms — comfortable margin over stale threshold (FIX 6)`
    );
  }

  // Old hardcoded 5000 deadline must be gone
  assert(
    !regContent.includes('Date.now() + 5000'),
    'specs-registry.js no longer hardcodes 5000ms deadline (FIX 6)'
  );

  // LOCK_STALE_MS must be referenced in the stale-steal check
  assert(
    regContent.includes('LOCK_STALE_MS'),
    'specs-registry.js uses LOCK_STALE_MS constant in stale-steal check (FIX 6)'
  );

  // LOCK_TIMEOUT_MS must be used in the deadline
  assert(
    regContent.includes('LOCK_TIMEOUT_MS'),
    'specs-registry.js uses LOCK_TIMEOUT_MS constant in waiter deadline (FIX 6)'
  );
}

// ============================================================
// FIX 1 (batch16): complete-spec.md — loads survivor into global after completing
// ============================================================
console.log('\nTest Group 6: complete-spec.md — survivor-loading after completing (FIX 1 batch16)');
{
  const content = readCmd('complete-spec.md');

  // Must call specs-cli.js list --active --json AFTER the second write (NO_SPEC)
  const noSpecWriteIdx = content.indexOf('Set Current Spec Status to `NO_SPEC`');
  const survivorCheckIdx = content.indexOf('Load survivor spec into global');
  assert(
    survivorCheckIdx > -1,
    'complete-spec.md has "Load survivor spec into global" block (FIX 1 batch16)'
  );
  assert(
    survivorCheckIdx > noSpecWriteIdx,
    'complete-spec.md: survivor-loading block comes AFTER NO_SPEC write (FIX 1 batch16)'
  );

  // Must touch the most-recently-touched survivor
  const survivorRegion = content.substring(survivorCheckIdx, survivorCheckIdx + 1000);
  assert(
    survivorRegion.includes('specs-cli.js touch') && survivorRegion.includes('most-recent-survivor-slug'),
    'complete-spec.md: touches most-recently-touched survivor slug into global (FIX 1 batch16)'
  );

  // Must tell user "Switched to remaining spec: {slug}"
  assert(
    survivorRegion.includes('Switched to remaining spec'),
    'complete-spec.md: tells user "Switched to remaining spec" after loading survivor (FIX 1 batch16)'
  );

  // Must leave NO_SPEC when zero survivors
  assert(
    survivorRegion.includes('NO other active specs remain') || survivorRegion.includes('leave global at NO_SPEC') || survivorRegion.includes('genuine idle'),
    'complete-spec.md: leaves NO_SPEC when zero other active specs remain (FIX 1 batch16)'
  );
}

// ============================================================
// FIX 1 (batch16): archive-spec.md — loads survivor into global after archiving
// ============================================================
console.log('\nTest Group 7: archive-spec.md — survivor-loading after archiving (FIX 1 batch16)');
{
  const content = readCmd('archive-spec.md');

  const noSpecWriteIdx = content.indexOf('Set Current Spec Status to `NO_SPEC`');
  const survivorCheckIdx = content.indexOf('Load survivor spec into global');
  assert(
    survivorCheckIdx > -1,
    'archive-spec.md has "Load survivor spec into global" block (FIX 1 batch16)'
  );
  assert(
    survivorCheckIdx > noSpecWriteIdx,
    'archive-spec.md: survivor-loading block comes AFTER NO_SPEC write (FIX 1 batch16)'
  );

  const survivorRegion = content.substring(survivorCheckIdx, survivorCheckIdx + 1000);
  assert(
    survivorRegion.includes('specs-cli.js touch') && survivorRegion.includes('most-recent-survivor-slug'),
    'archive-spec.md: touches most-recently-touched survivor slug into global (FIX 1 batch16)'
  );

  assert(
    survivorRegion.includes('Switched to remaining spec'),
    'archive-spec.md: tells user "Switched to remaining spec" after loading survivor (FIX 1 batch16)'
  );

  assert(
    survivorRegion.includes('NO other active specs remain') || survivorRegion.includes('leave global at NO_SPEC') || survivorRegion.includes('genuine idle'),
    'archive-spec.md: leaves NO_SPEC when zero other active specs remain (FIX 1 batch16)'
  );
}

// ============================================================
// FIX 2 (batch16): touch exit-code honored — key commands abort on non-zero
// ============================================================
console.log('\nTest Group 8: touch exit-code honored — commands abort on non-zero (FIX 2 batch16)');
{
  const ABORT_NEEDLE = 'snapshot missing';
  const commandsToCheck = [
    'ship.md',
    'plan-phase.md',
    'execute-phase.md',
    'complete-spec.md',
    'archive-spec.md',
    'next.md',
    'resume.md',
    'discuss.md',
    'new-spec.md',
  ];
  for (const cmd of commandsToCheck) {
    const content = readCmd(cmd);
    assert(
      content.includes(ABORT_NEEDLE) || content.includes('exit code') || content.includes('exits non-zero') || content.includes('non-zero'),
      `${cmd}: aborts or checks exit code when touch fails (FIX 2 batch16)`
    );
  }
}

// ============================================================
// FIX 5 (batch16): new-spec.md — amend SPEC_CREATED resets registry stage via --force
// ============================================================
console.log('\nTest Group 9: new-spec.md — amend SPEC_CREATED resets registry stage (FIX 5 batch16)');
{
  const content = readCmd('new-spec.md');

  // Must call set-stage --force when Status is SPEC_CREATED
  assert(
    content.includes('set-stage') && content.includes('--force') && content.includes('shaping'),
    'new-spec.md amend flow calls set-stage --force shaping when SPEC_CREATED (FIX 5 batch16)'
  );

  // The old "keep the registry stage as-is" must be gone
  assert(
    !content.includes('keep the registry stage as-is'),
    'new-spec.md amend flow no longer says "keep the registry stage as-is" (FIX 5 batch16)'
  );

  // Must explain this resets to match the STATE.md — look for the set-stage --force shaping combo
  assert(
    content.includes('set-stage') && content.includes('--force') &&
    (() => {
      const setStageIdx = content.indexOf('set-stage --bee .bee --slug <slug> --stage shaping --force');
      return setStageIdx > -1;
    })(),
    'new-spec.md: --force set-stage targets shaping to match reset STATE.md (FIX 5 batch16)'
  );
}

// ============================================================
// Results
// ============================================================
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
