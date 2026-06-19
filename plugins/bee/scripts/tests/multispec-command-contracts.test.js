#!/usr/bin/env node
// Test: multispec dispatch/visibility contracts for resume.md, next.md, progress.md, pause.md.
// Asserts that each command now references the specs-cli.js seam for multi-spec awareness.

const fs = require('fs');
const path = require('path');

const COMMANDS_DIR = path.join(__dirname, '..', '..', 'commands');

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
// resume.md
// ============================================================
console.log('Test Group 1: resume.md — resolver step');
{
  const content = readCmd('resume.md');

  assert(
    content.includes('specs-cli.js resolve --bee .bee'),
    'resume.md calls specs-cli.js resolve --bee .bee'
  );
  assert(
    content.includes('mode:create') || content.includes('mode:auto') || content.includes('mode:pick'),
    'resume.md handles resolver mode values (create/auto/pick)'
  );
  assert(
    content.includes('mode:pick'),
    'resume.md handles mode:pick (multiple active specs)'
  );
  assert(
    content.includes('mode:auto'),
    'resume.md handles mode:auto (single active spec)'
  );
  assert(
    content.includes('mode:create'),
    'resume.md handles mode:create (no active spec)'
  );
  assert(
    content.includes('specs-cli.js touch --bee .bee --slug'),
    'resume.md calls specs-cli.js touch to sync global STATE.md after pick'
  );
  // Resolver step must come BEFORE Step 0 (pause detection)
  const resolveIdx = content.indexOf('specs-cli.js resolve --bee .bee');
  const pauseIdx = content.indexOf('### Step 0: Pause Detection');
  assert(
    resolveIdx > -1 && pauseIdx > -1 && resolveIdx < pauseIdx,
    'Resolver step appears before Step 0 (Pause Detection)'
  );
}

// ============================================================
// next.md
// ============================================================
console.log('\nTest Group 2: next.md — active-spec list');
{
  const content = readCmd('next.md');

  assert(
    content.includes('specs-cli.js list --bee .bee --active'),
    'next.md calls specs-cli.js list --bee .bee --active'
  );
  // Must surface queue info when >1 spec active
  assert(
    content.includes('specs are active') || content.includes('active spec'),
    'next.md mentions active spec count for multi-spec visibility'
  );
  assert(
    content.includes('/bee:spec use'),
    'next.md mentions /bee:spec use <slug> to switch specs'
  );
  // The list call must appear in Step 1 (Gather State), before Step 4 (Present Suggestion)
  const listIdx = content.indexOf('specs-cli.js list --bee .bee --active');
  const step4Idx = content.indexOf('### Step 4: Present Suggestion');
  assert(
    listIdx > -1 && step4Idx > -1 && listIdx < step4Idx,
    'specs-cli list call appears in Step 1 before Step 4'
  );
  // Single-spec silence: the note must be conditional on >1 active spec
  assert(
    content.includes('only one') || content.includes('one (or zero)') || content.includes('≤ 1') || content.includes('no extra noise') || content.includes('omit this note'),
    'next.md explicitly suppresses the multi-spec note when ≤1 active spec'
  );
}

// ============================================================
// progress.md
// ============================================================
console.log('\nTest Group 3: progress.md — registry read + "done" gate');
{
  const content = readCmd('progress.md');

  assert(
    content.includes('specs-cli.js list --bee .bee --active'),
    'progress.md calls specs-cli.js list --bee .bee --active'
  );
  // Must not fire project-done when other active specs remain
  assert(
    content.includes('active-spec count') || content.includes('active spec') || content.includes('other active specs') || content.includes('other spec'),
    'progress.md gates "project done" messaging on active-spec count'
  );
  assert(
    content.includes('COMPLETED') &&
    (content.includes('active-spec count') || content.includes('other spec')),
    'progress.md COMPLETED state handling references the active-spec count gate'
  );
  // Registry read must appear before the status display (i.e., before "Display Project Status")
  const registryReadIdx = content.indexOf('specs-cli.js list --bee .bee --active');
  const displayIdx = content.indexOf('### Display Project Status');
  assert(
    registryReadIdx > -1 && displayIdx > -1 && registryReadIdx < displayIdx,
    'Registry read appears before Display Project Status section'
  );
}

// ============================================================
// pause.md
// ============================================================
console.log('\nTest Group 4: pause.md — spec slug in handoff');
{
  const content = readCmd('pause.md');

  assert(
    content.includes('spec_slug'),
    'pause.md includes spec_slug in handoff frontmatter'
  );
  assert(
    content.includes('Spec Slug') || content.includes('spec_slug'),
    'pause.md records the spec slug so resume can re-bind'
  );
  // The slug must appear in the written handoff structure
  const handoffStart = content.indexOf('## Current Position');
  const handoffEnd = content.indexOf('## Completed Work');
  const handoffSection = content.substring(handoffStart, handoffEnd);
  assert(
    handoffSection.includes('Spec Slug') || content.includes('spec_slug:'),
    'Spec slug appears in the handoff file body or frontmatter'
  );
}

// ============================================================
// Results
// ============================================================
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
