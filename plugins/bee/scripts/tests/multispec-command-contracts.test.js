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
console.log('\nTest Group 2: next.md — resolver front-door');
{
  const content = readCmd('next.md');

  // next.md must now route through the resolver (not just a passive list call)
  assert(
    content.includes('specs-cli.js resolve --bee .bee'),
    'next.md calls specs-cli.js resolve --bee .bee (resolver front-door)'
  );
  // Must handle mode:create → suggest /bee:new-spec
  assert(
    content.includes('mode:create'),
    'next.md handles mode:create (no active spec → suggest new-spec)'
  );
  // Must handle mode:auto → single-spec, no noise
  assert(
    content.includes('mode:auto'),
    'next.md handles mode:auto (single active spec, no picker)'
  );
  // Must handle mode:pick → AskUserQuestion picker with candidates
  assert(
    content.includes('mode:pick'),
    'next.md handles mode:pick (multiple active specs → picker)'
  );
  // mode:pick must produce an AskUserQuestion picker (not just a note)
  assert(
    content.includes('AskUserQuestion') && content.includes('mode:pick'),
    'next.md mode:pick branch uses AskUserQuestion picker'
  );
  // After pick, must call touch --slug to sync STATE.md
  assert(
    content.includes('specs-cli.js touch --bee .bee --slug'),
    'next.md calls specs-cli.js touch after pick to sync global STATE.md'
  );
  // Must instruct re-reading STATE.md after touch
  assert(
    content.includes('re-read') || content.includes('Re-read'),
    'next.md instructs re-reading .bee/STATE.md after touch'
  );
  // The old bare "Others:" visibility note must NOT be the sole multi-spec mechanism
  assert(
    !(/Others:\s*\{other-slugs\}/.test(content)),
    'next.md does not rely solely on bare "Others: {other-slugs}" note (replaced by picker)'
  );
  // Single-spec silence: when one (or zero) active specs, no extra noise
  assert(
    content.includes('no extra noise') || content.includes('no picker') || content.includes('no additional note') ||
    content.includes('only one') || content.includes('one (or zero)'),
    'next.md suppresses picker/noise when ≤1 active spec'
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
// FIX 2: re-read STATE.md after resolver/touch
// ============================================================
console.log('\nTest Group 5: re-read STATE.md after touch (FIX 2)');
{
  for (const cmd of ['resume.md', 'plan-phase.md', 'execute-phase.md', 'ship.md', 'complete-spec.md', 'archive-spec.md']) {
    const content = readCmd(cmd);
    assert(
      content.includes('Re-read `.bee/STATE.md`') || content.includes('re-read `.bee/STATE.md`'),
      `${cmd} contains a "re-read .bee/STATE.md" instruction after the resolver/touch`
    );
    // The re-read instruction must appear AFTER the touch call
    const touchIdx = content.indexOf('specs-cli.js touch --bee .bee --slug');
    const rereadIdx = content.search(/[Rr]e-read `\.bee\/STATE\.md`/);
    assert(
      touchIdx > -1 && rereadIdx > -1 && rereadIdx > touchIdx,
      `${cmd} re-read instruction appears AFTER the touch call`
    );
  }
}

// ============================================================
// FIX 3: lifecycle commands sync registry stage with guard
// ============================================================
console.log('\nTest Group 6: lifecycle set-stage calls with regression guard (FIX 3)');
{
  const stageTests = [
    { cmd: 'discuss.md', stage: 'discussing' },
    { cmd: 'plan-phase.md', stage: 'planning' },
    { cmd: 'execute-phase.md', stage: 'executing' },
  ];
  for (const { cmd, stage } of stageTests) {
    const content = readCmd(cmd);
    // Must contain a set-stage call for the correct stage
    assert(
      content.includes(`specs-cli.js set-stage`) && content.includes(`--stage ${stage}`),
      `${cmd} calls specs-cli.js set-stage --stage ${stage}`
    );
    // Must contain a guard that reads current stage before calling set-stage
    assert(
      content.includes('specs-cli.js list --bee .bee --active --json') ||
      content.includes('list --bee .bee --active --json'),
      `${cmd} reads current registry stage (list --active --json) before calling set-stage`
    );
    // Must mention skipping or guarding to avoid regression
    assert(
      content.includes('skip the set-stage') || content.includes('skip') && content.includes('set-stage'),
      `${cmd} contains guard to skip set-stage if stage already at or beyond target`
    );
    // Must tolerate "unknown spec" (legacy repos)
    assert(
      content.includes('unknown spec') || content.includes('tolerate'),
      `${cmd} tolerates "unknown spec" output from set-stage (legacy repos)`
    );
    // The set-stage call must appear AFTER the touch call (so it targets the resolved spec)
    const touchIdx = content.indexOf('specs-cli.js touch --bee .bee --slug');
    const setStageIdx = content.indexOf(`specs-cli.js set-stage`);
    assert(
      touchIdx > -1 && setStageIdx > -1 && setStageIdx > touchIdx,
      `${cmd} set-stage call appears AFTER the touch call`
    );
  }
}

// ============================================================
// Test Group 7: Picker prose consistency — all resolver front-doors must present
// candidates as "{title} ({stage})" with a slug as selection value, most-recently-touched
// first, Custom last, and handle the optional `more` field.
// ============================================================
console.log('\nTest Group 7: Picker prose consistency across resolver front-doors');
{
  // All 8 resolver-bearing command files
  const RESOLVER_CMDS = [
    'plan-phase.md',
    'discuss.md',
    'execute-phase.md',
    'ship.md',
    'resume.md',
    'complete-spec.md',
    'archive-spec.md',
    'next.md',
  ];

  for (const cmd of RESOLVER_CMDS) {
    const content = readCmd(cmd);

    // Must mention stage in the pick branch
    assert(
      content.includes('stage'),
      `${cmd}: pick branch mentions "stage" (candidate format includes stage)`
    );

    // Must mention the `more` field or an equivalent "+N more" pattern
    assert(
      content.includes('more'),
      `${cmd}: pick branch handles the "more" field (+N more — run /bee:spec list)`
    );

    // Must use "Custom" as last option
    assert(
      content.includes('Custom'),
      `${cmd}: pick branch includes "Custom" as last option`
    );

    // Must present candidates last-touched first
    assert(
      content.includes('last-touched first') || content.includes('most-recently-touched first'),
      `${cmd}: pick branch presents candidates most-recently-touched first`
    );
  }
}

// ============================================================
// Results
// ============================================================
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
