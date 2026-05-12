#!/usr/bin/env node
// Test: hooks.json rewire contract (REQ-14, REQ-02, REQ-03, REQ-05).
//
// This test runs in Wave 4 — BEFORE T1.11 rewires the live hooks.json from
// `type: "prompt"` SubagentStop entries to `type: "command"` entries pointing
// at the 25 Node validators (24 from REQ-03 retention + finding-validator
// added for the review-pipeline `## Classification` schema). The PROPOSED
// rewire is captured here as the inline `MATCHER_TO_FILENAME` table.
// Assertions 1-4 check the proposal against the validators on disk;
// assertions 5a-5g activate after T1.11 commits and check the live
// hooks.json matches the proposal byte-for-byte (via the matcher-set hash
// + filename mapping + catch-all position).
//
// Contracts:
//   - Exactly 26 type:"command" entries under SubagentStop after rewire
//     (25 per-agent matchers + 1 terminal emit-event.js catch-all).
//   - Every retained matcher regex is preserved verbatim from the original
//     hooks.json, including negative-lookbehinds (`(?<!quick-)implementer$`,
//     `(?<!audit-)bug-detector$`) and non-anchored patterns
//     (`pattern-reviewer$`, `stack-reviewer$`).
//   - The 3 removed matchers (`spec-reviewer`, `discuss-partner`,
//     `ui-auditor`) have no entry in MATCHER_TO_FILENAME and no entry in
//     the rewired hooks.json SubagentStop block.
//   - For every retained matcher, the corresponding validator file exists
//     at plugins/bee/scripts/hooks/validators/<agent>.js.
//   - The terminal `emit-event.js subagent_stop` entry is the last
//     type:"command" entry in the SubagentStop block (catch-all, no matcher).
//   - Deterministic matcher-set hash: sha256(JSON.stringify(sortedMatchers))
//     matches EXPECTED_MATCHER_SET_HASH below. Drift in either the proposal
//     table OR the live hooks.json is caught at hash level.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { VALIDATOR_ROSTER } = require('../hooks/validators/validators-lib');

const PLUGIN_DIR = path.join(__dirname, '..', '..');
const HOOKS_JSON_PATH = path.join(PLUGIN_DIR, 'hooks', 'hooks.json');
const HOOKS_JSON_TMP_PATH = path.join(PLUGIN_DIR, 'hooks', 'hooks.json.tmp');
const VALIDATORS_DIR = path.join(PLUGIN_DIR, 'scripts', 'hooks', 'validators');

// ---------------------------------------------------------------------------
// MATCHER_TO_FILENAME — the PROPOSED rewire contract. 25 retained matchers
// from the original hooks.json:87-354, mapped to their target validator
// filename. T1.11 implementer MUST produce a hooks.json whose SubagentStop
// per-agent entries match this table 1:1 (matcher regex verbatim, command
// references the named filename).
//
// Removed per REQ-03 (not present below): spec-reviewer, discuss-partner,
// ui-auditor. Added in F-BUG-001 fix: ^finding-validator$ →
// finding-validator.js (review-pipeline `## Classification` schema, distinct
// from audit-finding-validator.js for the audit `### Validation: F-` schema).
// ---------------------------------------------------------------------------
const MATCHER_TO_FILENAME = {
  '(?<!quick-)implementer$':    'implementer.js',
  '^fixer$':                    'fixer.js',
  '^researcher$':               'researcher.js',
  '^assumptions-analyzer$':     'assumptions-analyzer.js',
  '^dependency-auditor$':       'dependency-auditor.js',
  '(?<!audit-)bug-detector$':   'bug-detector.js',
  'pattern-reviewer$':          'pattern-reviewer.js',
  '^plan-compliance-reviewer$': 'plan-compliance-reviewer.js',
  'stack-reviewer$':            'stack-reviewer.js',
  '^quick-implementer$':        'quick-implementer.js',
  '^security-auditor$':         'security-auditor.js',
  '^error-handling-auditor$':   'error-handling-auditor.js',
  '^database-auditor$':         'database-auditor.js',
  '^architecture-auditor$':     'architecture-auditor.js',
  '^api-auditor$':              'api-auditor.js',
  '^frontend-auditor$':         'frontend-auditor.js',
  '^performance-auditor$':      'performance-auditor.js',
  '^testing-auditor$':          'testing-auditor.js',
  '^audit-bug-detector$':       'audit-bug-detector.js',
  '^audit-finding-validator$':  'audit-finding-validator.js',
  '^finding-validator$':        'finding-validator.js',
  '^audit-report-generator$':   'audit-report-generator.js',
  '^debug-investigator$':       'debug-investigator.js',
  '^integration-checker$':      'integration-checker.js',
  '^swarm-consolidator$':       'swarm-consolidator.js',
};

// Deterministic hash of sorted matcher strings — computed once during
// T1.12 design. Any drift in MATCHER_TO_FILENAME keys OR in the live
// hooks.json matcher set fails the hash check. T1.11 implementer MUST
// keep this hash in sync if the matcher table ever changes (single
// source of truth: this file).
const EXPECTED_MATCHER_SET_HASH =
  'b392a92b5729b4b83343aa55ac69d15d9ae784057e932807c73299ccfec6e332';

// Deterministic hash of sorted VALIDATOR_ROSTER (25 filenames) — pinned
// so an accidental edit to validators-lib.js that adds/removes a file
// without updating this test trips the assertion.
const VALIDATOR_ROSTER_HASH =
  '1235b542e56fcd5a78cfca1770efa36badb6e57ec4aa91adc33f592412ebce6b';

const REMOVED_MATCHER_AGENTS = ['spec-reviewer', 'discuss-partner', 'ui-auditor'];

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

function sha256OfSortedJson(arr) {
  const sorted = [...arr].sort();
  return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

// ---------------------------------------------------------------------------
// Pre-rewire assertions (1-4) — always run. Validate the PROPOSED rewire
// against validators on disk and the VALIDATOR_ROSTER source of truth.
// ---------------------------------------------------------------------------

console.log('=== hooks.json rewire contract (pre-rewire assertions) ===');

// Assertion 1: every filename in MATCHER_TO_FILENAME exists on disk.
const filenames = Object.values(MATCHER_TO_FILENAME);
const allFilesExist = filenames.every(fn =>
  fs.existsSync(path.join(VALIDATORS_DIR, fn))
);
assert(
  allFilesExist,
  `every filename in MATCHER_TO_FILENAME exists under ${path.relative(PLUGIN_DIR, VALIDATORS_DIR)}/`
);

if (!allFilesExist) {
  const missing = filenames.filter(fn => !fs.existsSync(path.join(VALIDATORS_DIR, fn)));
  console.log(`    missing: ${missing.join(', ')}`);
}

// Assertion 1b: each entry in MATCHER_TO_FILENAME is also in VALIDATOR_ROSTER.
const matcherFilesInRoster = filenames.every(fn => VALIDATOR_ROSTER.includes(fn));
assert(
  matcherFilesInRoster,
  'every MATCHER_TO_FILENAME target is also in VALIDATOR_ROSTER'
);

// Assertion 1c: count of mapped matchers is exactly 25.
assert(
  Object.keys(MATCHER_TO_FILENAME).length === 25,
  'MATCHER_TO_FILENAME has exactly 25 per-agent entries'
);

// Assertion 2: disk listing matches VALIDATOR_ROSTER exactly.
// Phase 2 added batch-lib.js as a sibling helper and a batch/ subdirectory of batch validators —
// neither is a per-agent validator, so both are filtered from the per-agent roster scan.
const dirContents = fs.readdirSync(VALIDATORS_DIR)
  .filter(f => f.endsWith('.js') && f !== 'validators-lib.js' && f !== 'batch-lib.js')
  .sort();
const rosterSorted = [...VALIDATOR_ROSTER].sort();
assert(
  JSON.stringify(dirContents) === JSON.stringify(rosterSorted),
  'validator directory listing equals VALIDATOR_ROSTER (no extras, no missing)'
);

if (JSON.stringify(dirContents) !== JSON.stringify(rosterSorted)) {
  const extra = dirContents.filter(f => !rosterSorted.includes(f));
  const missing = rosterSorted.filter(f => !dirContents.includes(f));
  if (extra.length)   console.log(`    extra on disk:        ${extra.join(', ')}`);
  if (missing.length) console.log(`    missing from disk:    ${missing.join(', ')}`);
}

// Assertion 2b: VALIDATOR_ROSTER hash matches pinned value.
const actualRosterHash = sha256OfSortedJson(VALIDATOR_ROSTER);
assert(
  actualRosterHash === VALIDATOR_ROSTER_HASH,
  'VALIDATOR_ROSTER sha256 hash matches pinned VALIDATOR_ROSTER_HASH'
);
if (actualRosterHash !== VALIDATOR_ROSTER_HASH) {
  console.log(`    expected: ${VALIDATOR_ROSTER_HASH}`);
  console.log(`    actual:   ${actualRosterHash}`);
}

// Assertion 3: removed matchers have NO entry in MATCHER_TO_FILENAME.
REMOVED_MATCHER_AGENTS.forEach(agent => {
  const inTable = Object.keys(MATCHER_TO_FILENAME).some(m => m.includes(agent));
  assert(
    !inTable,
    `${agent} has no entry in MATCHER_TO_FILENAME (REQ-03 removal confirmed)`
  );

  // Also: no validator file authored.
  assert(
    !fs.existsSync(path.join(VALIDATORS_DIR, `${agent}.js`)),
    `${agent}.js does not exist on disk (REQ-03 removal confirmed)`
  );
});

// Assertion 4: proposed matcher set hashes to EXPECTED_MATCHER_SET_HASH.
const proposedMatchers = Object.keys(MATCHER_TO_FILENAME);
const proposedHash = sha256OfSortedJson(proposedMatchers);
assert(
  proposedHash === EXPECTED_MATCHER_SET_HASH,
  'MATCHER_TO_FILENAME keys hash to pinned EXPECTED_MATCHER_SET_HASH'
);
if (proposedHash !== EXPECTED_MATCHER_SET_HASH) {
  console.log(`    expected: ${EXPECTED_MATCHER_SET_HASH}`);
  console.log(`    actual:   ${proposedHash}`);
}

// ---------------------------------------------------------------------------
// Post-rewire assertions (5a-5g) — gated on isRewired. Skip with a clear
// message until T1.11 commits the actual rewire to hooks.json.
// ---------------------------------------------------------------------------

console.log('');
console.log('=== hooks.json rewire contract (post-rewire assertions) ===');

const hooksRaw = fs.readFileSync(HOOKS_JSON_PATH, 'utf8');
const hooks = JSON.parse(hooksRaw);
const subStop = hooks.hooks.SubagentStop;

const promptEntries = subStop.filter(e =>
  e.hooks && e.hooks[0] && e.hooks[0].type === 'prompt'
);
const commandEntries = subStop.filter(e =>
  e.hooks && e.hooks[0] && e.hooks[0].type === 'command'
);

// "Rewired" = no type:"prompt" entries remain in SubagentStop AND at least
// one type:"command" entry exists. This is intentionally strict: T1.11's
// success criterion is full prompt-to-command conversion.
const isRewired = promptEntries.length === 0 && commandEntries.length > 0;

if (!isRewired) {
  console.log('  SKIP (pre-rewire): post-rewire assertions deferred until T1.11 commits');
  console.log(`    type:"prompt" entries: ${promptEntries.length} (expected 0 post-rewire)`);
  console.log(`    type:"command" entries: ${commandEntries.length} (expected 26 post-rewire)`);
} else {
  // 5a: exactly 26 type:"command" entries (25 per-agent + 1 catch-all).
  assert(
    commandEntries.length === 26,
    'SubagentStop has exactly 26 type:"command" entries (25 per-agent + 1 catch-all)'
  );

  // 5b: zero type:"prompt" entries remain.
  assert(
    promptEntries.length === 0,
    'SubagentStop has zero type:"prompt" entries post-rewire'
  );

  // 5c: terminal entry is the catch-all emit-event.js subagent_stop, no matcher.
  const terminal = subStop[subStop.length - 1];
  const terminalHook = terminal && terminal.hooks && terminal.hooks[0];
  assert(
    terminal && !('matcher' in terminal),
    'terminal SubagentStop entry has no matcher key (catch-all position)'
  );
  assert(
    terminalHook
      && terminalHook.type === 'command'
      && typeof terminalHook.command === 'string'
      && terminalHook.command.includes('emit-event.js')
      && terminalHook.command.includes('subagent_stop'),
    'terminal SubagentStop entry is `emit-event.js subagent_stop` (catch-all command)'
  );

  // 5d: for every per-agent matcher, the corresponding validator file exists.
  const liveMatcherEntries = subStop.filter(e =>
    e.matcher && e.hooks && e.hooks[0] && e.hooks[0].type === 'command'
  );
  let allLiveFilesExist = true;
  liveMatcherEntries.forEach(e => {
    const expectedFilename = MATCHER_TO_FILENAME[e.matcher];
    if (!expectedFilename) {
      allLiveFilesExist = false;
      console.log(`    unknown matcher in live hooks.json: ${e.matcher}`);
      return;
    }
    const exists = fs.existsSync(path.join(VALIDATORS_DIR, expectedFilename));
    if (!exists) {
      allLiveFilesExist = false;
      console.log(`    missing validator file for matcher ${e.matcher}: ${expectedFilename}`);
    }
  });
  assert(
    allLiveFilesExist && liveMatcherEntries.length === 25,
    'every per-agent matcher in live hooks.json maps to an existing validator file (25 entries)'
  );

  // 5e: live matcher set hashes to EXPECTED_MATCHER_SET_HASH (verbatim
  // preservation enforcement — catches any regex drift).
  const liveMatchers = liveMatcherEntries.map(e => e.matcher);
  const liveHash = sha256OfSortedJson(liveMatchers);
  assert(
    liveHash === EXPECTED_MATCHER_SET_HASH,
    'live hooks.json matcher set hashes to EXPECTED_MATCHER_SET_HASH (verbatim preservation)'
  );
  if (liveHash !== EXPECTED_MATCHER_SET_HASH) {
    console.log(`    expected: ${EXPECTED_MATCHER_SET_HASH}`);
    console.log(`    actual:   ${liveHash}`);
  }

  // 5f: removed matchers are not present in live hooks.json.
  REMOVED_MATCHER_AGENTS.forEach(agent => {
    const present = liveMatchers.some(m => m.includes(agent));
    assert(
      !present,
      `${agent} matcher is NOT present in live hooks.json (REQ-03)`
    );
  });

  // 5g: no residual hooks.json.tmp from T1.11's atomic rename.
  assert(
    !fs.existsSync(HOOKS_JSON_TMP_PATH),
    'no residual hooks.json.tmp from T1.11 atomic-write (clean rename)'
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('');
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
