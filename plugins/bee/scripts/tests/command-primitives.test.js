#!/usr/bin/env node
// Test: Command primitives skill exists and commands reference it instead of
// inlining the duplicated boilerplate text.
//
// Contract:
//   - skills/command-primitives/SKILL.md defines named, parameterized
//     building blocks: validation guards, build/test gates (interactive +
//     autonomous), context cache + dependency scan, stack/linter/test-runner
//     resolution, model selection (reasoning + scanning), per-stack agent
//     resolution, auto-fix loop (autonomous), re-review loop (interactive).
//   - Each modified command replaces the inline boilerplate with a short
//     `See skills/command-primitives/SKILL.md <Section>.` reference plus any
//     required parameters (no HTML-comment anchors -- those were removed as
//     unnecessary noise).
//   - Distinctive duplicated literal phrases (e.g. `"NOT_INITIALIZED guard:"`,
//     `"Build check (automatic, per-stack)"`) live ONLY in the skill -- they
//     must NOT appear in the modified commands.

const fs = require('fs');
const path = require('path');

const PLUGIN_DIR = path.join(__dirname, '..', '..');
const SKILLS_DIR = path.join(PLUGIN_DIR, 'skills');
const COMMANDS_DIR = path.join(PLUGIN_DIR, 'commands');
const SKILL_PATH = path.join(SKILLS_DIR, 'command-primitives', 'SKILL.md');
const SKILL_REL_PATH = 'skills/command-primitives/SKILL.md';
const REFERENCE_RE = /skills\/command-primitives\/SKILL\.md/;
const REFERENCE_RE_G = /skills\/command-primitives\/SKILL\.md/g;

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

function readFile(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    return null;
  }
}

function countMatches(content, needle) {
  if (typeof needle === 'string') {
    return content.split(needle).length - 1;
  }
  const m = content.match(needle);
  return m ? m.length : 0;
}

// ---------------------------------------------------------------------------
// Skill section presence
// ---------------------------------------------------------------------------

console.log('=== Skill: command-primitives/SKILL.md ===');

const skillContent = readFile(SKILL_PATH);
assert(skillContent !== null, `SKILL.md exists at ${SKILL_REL_PATH}`);

if (skillContent !== null) {
  // Frontmatter sanity
  const fmMatch = skillContent.match(/^---\n([\s\S]*?)\n---/);
  assert(fmMatch !== null, 'SKILL.md has YAML frontmatter');
  if (fmMatch) {
    assert(/name:\s*command-primitives/.test(fmMatch[1]), 'frontmatter declares name: command-primitives');
    assert(/description:/.test(fmMatch[1]), 'frontmatter declares description');
  }

  const REQUIRED_SECTIONS = [
    'Validation Guards',
    'Build & Test Gate (Interactive)',
    'Build & Test Gate (Autonomous)',
    'Context Cache + Dependency Scan',
    'Stack/Linter/Test-Runner Resolution',
    'Model Selection (Reasoning)',
    'Model Selection (Scanning)',
    'Per-Stack Agent Resolution',
    'Auto-Fix Loop (Autonomous)',
    'Re-Review Loop (Interactive)',
  ];

  for (const section of REQUIRED_SECTIONS) {
    const re = new RegExp('^##\\s+' + section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'm');
    assert(re.test(skillContent), `SKILL.md contains heading: ## ${section}`);
  }

  // The skill is the only owner of these distinctive literal phrases.
  assert(
    skillContent.includes('NOT_INITIALIZED guard'),
    'SKILL.md contains the "NOT_INITIALIZED guard" literal (single source of truth)'
  );
  assert(
    skillContent.includes('Build check (automatic, per-stack)'),
    'SKILL.md contains the "Build check (automatic, per-stack)" literal'
  );
  assert(
    skillContent.includes('Context Cache (read once, pass to all agents)'),
    'SKILL.md contains the "Context Cache (read once, pass to all agents)" literal'
  );
}

// ---------------------------------------------------------------------------
// Inventory: which commands use which primitives
// ---------------------------------------------------------------------------

const VG_COMMANDS = [
  'ship.md',
  'review.md',
  'plan-all.md',
  'plan-phase.md',
  'quick.md',
  'complete-spec.md',
  'archive-spec.md',
  'review-implementation.md',
];

const BTG_INTERACTIVE = ['review.md', 'review-implementation.md', 'quick.md'];
const BTG_AUTONOMOUS = ['ship.md'];

const CC_COMMANDS = ['ship.md', 'review.md', 'review-implementation.md', 'quick.md'];

const SLR_COMMANDS = ['ship.md', 'review.md', 'review-implementation.md', 'quick.md'];

const MSI_REASONING = [
  'ship.md',
  'review.md',
  'plan-all.md',
  'plan-phase.md',
  'review-implementation.md',
  'quick.md',
];

const MSI_SCANNING = ['quick.md'];

const PSAR_COMMANDS = ['ship.md', 'review.md', 'review-implementation.md'];

const AFL_AUTONOMOUS = ['ship.md', 'plan-all.md'];

// Expected minimum number of skill references per command (one per primitive
// applied). Some commands reference the skill more than once for the same
// primitive (e.g. ship.md mentions Model Selection from multiple gate steps);
// the assertion is a LOWER BOUND. If a future cleanup consolidates multiple
// references to the same primitive into one, lower the corresponding number
// here -- failure means the count dropped below this floor, NOT a regression
// in primitive coverage. (T-003: documented the lower-bound semantics.)
const MIN_REFERENCES = {
  'ship.md': 7,                   // VG, BTG-A, CC, SLR (via BTG), MSI, PSAR, AFL
  'review.md': 5,                 // VG, BTG-I, CC, MSI, PSAR
  'plan-all.md': 3,               // VG, MSI, AFL
  'plan-phase.md': 2,             // VG, MSI
  'quick.md': 5,                  // VG, BTG-I, CC, MSI (reasoning), MSI (scanning)
  'complete-spec.md': 1,          // VG
  'archive-spec.md': 1,           // VG
  'review-implementation.md': 5,  // VG, BTG-I, CC, MSI, PSAR
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureCmdReadable(rel, content) {
  assert(content !== null, `${rel} exists and is readable`);
}

function assertNoAnchors(rel, content) {
  // Anchors were removed in cleanup; commands must NOT contain HTML-comment
  // anchor markers anymore.
  const anchorRe = /<!--\s*(VALIDATION-GUARDS|BUILD-TEST-GATE|CONTEXT-CACHE|MODEL-SELECTION|MODEL-SELECTION-SCANNING|AGENT-RESOLUTION|AUTO-FIX-LOOP)-(START|END)\s*-->/;
  assert(
    !anchorRe.test(content),
    `${rel} contains no HTML-comment primitive anchors (cleanup applied)`
  );
}

function assertSkillReferenced(rel, content) {
  assert(
    REFERENCE_RE.test(content),
    `${rel} references ${SKILL_REL_PATH}`
  );
}

// ---------------------------------------------------------------------------
// Per-command primitive assertions (negative literal + reference)
// ---------------------------------------------------------------------------

console.log('\n\n=== Validation Guards (VG) ===');

for (const rel of VG_COMMANDS) {
  const p = path.join(COMMANDS_DIR, rel);
  const content = readFile(p);
  console.log(`\nCommand: ${rel}`);
  ensureCmdReadable(rel, content);
  if (content === null) continue;

  assertNoAnchors(rel, content);
  assertSkillReferenced(rel, content);

  assert(
    !content.includes('NOT_INITIALIZED guard:'),
    `${rel} does NOT inline "NOT_INITIALIZED guard:" (lives only in SKILL.md)`
  );
  assert(
    !content.includes('do NOT exist in the Phases table'),
    `${rel} does NOT inline "do NOT exist in the Phases table" prose`
  );
}

console.log('\n\n=== Build & Test Gate -- Interactive (BTG) ===');

for (const rel of BTG_INTERACTIVE) {
  const p = path.join(COMMANDS_DIR, rel);
  const content = readFile(p);
  console.log(`\nCommand: ${rel}`);
  ensureCmdReadable(rel, content);
  if (content === null) continue;

  assertNoAnchors(rel, content);
  assert(
    !content.includes('Build check (automatic, per-stack)'),
    `${rel} does NOT inline "Build check (automatic, per-stack)" (lives only in SKILL.md)`
  );
  // Each interactive gate command must mention the Interactive variant in its
  // reference line.
  assert(
    /Build & Test Gate \(Interactive\)/.test(content),
    `${rel} names the Build & Test Gate (Interactive) variant by reference`
  );
}

console.log('\n\n=== Build & Test Gate -- Autonomous (BTG) ===');

for (const rel of BTG_AUTONOMOUS) {
  const p = path.join(COMMANDS_DIR, rel);
  const content = readFile(p);
  console.log(`\nCommand: ${rel}`);
  ensureCmdReadable(rel, content);
  if (content === null) continue;

  assertNoAnchors(rel, content);
  assert(
    !content.includes('automatically log [Optimistic-continuation] decision'),
    `${rel} does NOT inline the autonomous gate phrasing (lives only in SKILL.md)`
  );
  assert(
    /Build & Test Gate \(Autonomous\)/.test(content),
    `${rel} names the Build & Test Gate (Autonomous) variant by reference`
  );
}

console.log('\n\n=== Context Cache + Dependency Scan (CC) ===');

for (const rel of CC_COMMANDS) {
  const p = path.join(COMMANDS_DIR, rel);
  const content = readFile(p);
  console.log(`\nCommand: ${rel}`);
  ensureCmdReadable(rel, content);
  if (content === null) continue;

  assertNoAnchors(rel, content);
  assert(
    !content.includes('Context Cache (read once, pass to all agents)'),
    `${rel} does NOT inline "Context Cache (read once, pass to all agents)" prose`
  );
  assert(
    /Context Cache \+ Dependency Scan/.test(content),
    `${rel} names the Context Cache + Dependency Scan primitive by reference`
  );
}

console.log('\n\n=== Stack/Linter/Test-Runner Resolution (SLR) ===');

for (const rel of SLR_COMMANDS) {
  const p = path.join(COMMANDS_DIR, rel);
  const content = readFile(p);
  console.log(`\nCommand: ${rel}`);
  ensureCmdReadable(rel, content);
  if (content === null) continue;

  assertNoAnchors(rel, content);
  // The distinctive testRunner fallback-chain literal appears <= 1 times
  // (originally duplicated across multiple commands; collapsed to a reference).
  const fallbackPhrase = countMatches(
    content,
    /stacks\[i\]\.testRunner \?\? config\.testRunner \?\? "none"/g
  );
  assert(
    fallbackPhrase <= 1,
    `${rel} testRunner fallback-chain literal occurs <= 1 times (got ${fallbackPhrase})`
  );
  assertSkillReferenced(rel, content);
}

console.log('\n\n=== Model Selection -- Reasoning (MSI) ===');

for (const rel of MSI_REASONING) {
  const p = path.join(COMMANDS_DIR, rel);
  const content = readFile(p);
  console.log(`\nCommand: ${rel}`);
  ensureCmdReadable(rel, content);
  if (content === null) continue;

  assertNoAnchors(rel, content);

  // Single-line variant must not appear (lives in SKILL.md).
  const singleLine = countMatches(
    content,
    /economy[^\n]*sonnet[^\n]*quality[^\n]*premium/gi
  );
  assert(
    singleLine === 0,
    `${rel} full economy/quality/premium model rule (single-line) absent (got ${singleLine})`
  );

  // Multi-line prose form must not appear either (the F-002 form: a paragraph
  // spelling out "Economy mode (...): Pass model: \"sonnet\" ..." followed by
  // "Quality or Premium mode (default): Omit ..."). Case-insensitive (T-002)
  // to also catch lowercase variants like `**economy mode**`.
  const multiLine = countMatches(
    content,
    /Economy mode[\s\S]{0,300}Quality or Premium mode/gi
  );
  assert(
    multiLine === 0,
    `${rel} multi-line "Economy mode ... Quality or Premium mode" prose absent (got ${multiLine})`
  );

  // Each command must reference the Model Selection (Reasoning) primitive.
  assert(
    /Model Selection \(Reasoning\)/.test(content),
    `${rel} names the Model Selection (Reasoning) primitive by reference`
  );
}

console.log('\n\n=== Model Selection -- Scanning (MSI) ===');

for (const rel of MSI_SCANNING) {
  const p = path.join(COMMANDS_DIR, rel);
  const content = readFile(p);
  console.log(`\nCommand: ${rel}`);
  ensureCmdReadable(rel, content);
  if (content === null) continue;

  assertNoAnchors(rel, content);
  assert(
    /Model Selection \(Scanning\)/.test(content),
    `${rel} names the Model Selection (Scanning) variant by reference`
  );
  assertSkillReferenced(rel, content);
}

console.log('\n\n=== Per-Stack Agent Resolution (PSAR) ===');

for (const rel of PSAR_COMMANDS) {
  const p = path.join(COMMANDS_DIR, rel);
  const content = readFile(p);
  console.log(`\nCommand: ${rel}`);
  ensureCmdReadable(rel, content);
  if (content === null) continue;

  assertNoAnchors(rel, content);

  // The duplicated 4-line resolution rule prose was the long form that
  // listed bug-detector / pattern-reviewer / stack-reviewer fallbacks per
  // stack. After refactor this exact phrase appears <= 1 time.
  const phrase = countMatches(
    content,
    /Agent resolution \(stack-specific fallback\):/g
  );
  assert(
    phrase <= 1,
    `${rel} "Agent resolution (stack-specific fallback):" literal occurs <= 1 times (got ${phrase})`
  );

  // The distinctive `agents/stacks/{stack.name}/` literal is allowed at most
  // once (in an explanatory/reference line) -- the rule prose itself lives in
  // SKILL.md.
  const psarPath = countMatches(content, /agents\/stacks\/\{stack\.name\}\//g);
  assert(
    psarPath <= 1,
    `${rel} \`agents/stacks/{stack.name}/\` literal occurs <= 1 times (got ${psarPath})`
  );
}

console.log('\n\n=== Auto-Fix Loop -- Autonomous (AFL) ===');

for (const rel of AFL_AUTONOMOUS) {
  const p = path.join(COMMANDS_DIR, rel);
  const content = readFile(p);
  console.log(`\nCommand: ${rel}`);
  ensureCmdReadable(rel, content);
  if (content === null) continue;

  assertNoAnchors(rel, content);

  // Inline loop initializers must be gone; loop lives in SKILL.md.
  assert(
    !content.includes('Initialize: $REVIEW_ITERATION = 1'),
    `${rel} does NOT inline "Initialize: $REVIEW_ITERATION = 1" (loop in SKILL.md)`
  );
  assert(
    !content.includes('Initialize: $CROSS_PLAN_ITERATION = 1'),
    `${rel} does NOT inline "Initialize: $CROSS_PLAN_ITERATION = 1" (loop in SKILL.md)`
  );

  assert(
    /Auto-Fix Loop \(Autonomous\)/.test(content),
    `${rel} names the Auto-Fix Loop (Autonomous) primitive by reference`
  );
}

// ---------------------------------------------------------------------------
// Re-Review Loop (Interactive) negative literal -- review.md / quick.md may
// still describe their post-fix menu, but the canonical "No iteration limit
// -- repeat until user selects Accept" rule prose lives in SKILL.md.
// ---------------------------------------------------------------------------

console.log('\n\n=== Re-Review Loop -- Interactive (negative literal) ===');

for (const rel of ['review.md', 'quick.md']) {
  const p = path.join(COMMANDS_DIR, rel);
  const content = readFile(p);
  console.log(`\nCommand: ${rel}`);
  if (content === null) continue;
  assert(
    !content.includes('No iteration limit -- repeat until user selects Accept'),
    `${rel} does NOT inline the canonical Re-Review Loop literal (lives in SKILL.md)`
  );
}

// ---------------------------------------------------------------------------
// Positive: minimum reference count per command
// ---------------------------------------------------------------------------

console.log('\n\n=== Positive reference counts ===');

for (const [rel, minRefs] of Object.entries(MIN_REFERENCES)) {
  const p = path.join(COMMANDS_DIR, rel);
  const content = readFile(p);
  if (content === null) {
    assert(false, `${rel} exists and is readable (for reference count)`);
    continue;
  }
  const refCount = countMatches(content, REFERENCE_RE_G);
  assert(
    refCount >= minRefs,
    `${rel} mentions ${SKILL_REL_PATH} >= ${minRefs} times (got ${refCount})`
  );
}

// ---------------------------------------------------------------------------
// Final results
// ---------------------------------------------------------------------------

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
