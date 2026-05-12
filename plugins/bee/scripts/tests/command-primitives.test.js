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
const AGENTS_DIR = path.join(PLUGIN_DIR, 'agents');
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

const CC_COMMANDS = ['ship.md', 'review.md', 'review-implementation.md', 'quick.md', 'audit.md', 'plan-phase.md', 'eod.md', 'execute-phase.md'];

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

// Lower bound on skill references per command (one per primitive applied).
// Some commands reference the skill multiple times for the same primitive
// (e.g. ship.md mentions Model Selection from several spawn steps). When a
// cleanup consolidates references, lower the corresponding number here.
const MIN_REFERENCES = {
  'ship.md': 7,                   // VG, BTG-A, CC, SLR (via BTG), MSI, PSAR, AFL
  'review.md': 5,                 // VG, BTG-I, CC, MSI, PSAR
  'plan-all.md': 3,               // VG, MSI, AFL
  'plan-phase.md': 3,             // VG, MSI, CC
  'quick.md': 5,                  // VG, BTG-I, CC, MSI (reasoning), MSI (scanning)
  'complete-spec.md': 1,          // VG
  'archive-spec.md': 1,           // VG
  'review-implementation.md': 5,  // VG, BTG-I, CC, MSI, PSAR
  'audit.md': 1,                  // CC
  'eod.md': 1,                    // CC
  'execute-phase.md': 1,          // CC
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

  // Multi-line prose form must not appear either: a paragraph spelling out
  // `**Economy mode** (...): Pass model: "sonnet" ...` followed by
  // `**Quality or Premium mode** (default): Omit ...`. Case-sensitive on
  // purpose -- lowercase mentions like "in economy mode" are legitimate spawn-
  // strategy prose, not the MSI rule itself.
  const multiLine = countMatches(
    content,
    /Economy mode[\s\S]{0,300}Quality or Premium mode/g
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
// Implementer-contract assertions: implementer.md and quick-implementer.md
// must document the canonical "## Stack Skill (inline)" use-verbatim-do-not-
// re-read contract that the Context Cache primitive depends on. If this
// contract is missing or contradicted, agents will re-read the stack skill
// from disk and defeat the cache.
// ---------------------------------------------------------------------------

console.log('\n\n=== Implementer-contract assertions ===');

const implementerContent = readFile(path.join(AGENTS_DIR, 'implementer.md'));
const quickImplementerContent = readFile(path.join(AGENTS_DIR, 'quick-implementer.md'));

assert(
  /## Stack Skill \(inline\)[\s\S]{0,200}verbatim[\s\S]{0,200}do (?:NOT|not) re-read/.test(implementerContent),
  'implementer.md documents the "## Stack Skill (inline)" use-verbatim-do-not-re-read contract'
);

assert(
  /## Stack Skill \(inline\)[\s\S]{0,200}verbatim[\s\S]{0,200}do (?:NOT|not) re-read/.test(quickImplementerContent),
  'quick-implementer.md documents the "## Stack Skill (inline)" use-verbatim-do-not-re-read contract'
);

assert(
  !implementerContent.toLowerCase().includes('always re-read the stack skill'),
  'implementer.md does NOT contain "always re-read the stack skill" (contradiction guard)'
);

assert(
  !quickImplementerContent.toLowerCase().includes('always re-read the stack skill'),
  'quick-implementer.md does NOT contain "always re-read the stack skill" (contradiction guard)'
);

// ---------------------------------------------------------------------------
// D4 multi-stack subsection + idempotency assertions (Phase 2 v4.4.0, F-002 fix)
// execute-phase.md Step 5a must document the per-stack subsection format,
// the idempotency claim (NFR-04), and must NOT contain the old "Read the stack
// skill at" agent-facing instruction (F-001 fix from Phase 2 review iter 1).
// ---------------------------------------------------------------------------

const executePhaseContent = readFile(path.join(COMMANDS_DIR, 'execute-phase.md'));

// Positive: idempotency claim co-located with resume/re-running/no duplication/no accumulation
assert(
  /idempotent[\s\S]{0,300}(resume|re-running|no duplication|no accumulation)/i.test(executePhaseContent),
  'execute-phase.md Step 5a documents idempotency (NFR-04 parity with D5 REQ-09)'
);

// Positive: multi-stack subsection format `### Stack:` documented
assert(
  executePhaseContent.includes('### Stack:'),
  'execute-phase.md Step 5a documents the multi-stack `### Stack: {name}` subsection format'
);

// Negative: old agent-facing "Read the stack skill at" instruction must NOT appear (F-001 fix)
assert(
  !executePhaseContent.includes('Read the stack skill at'),
  'execute-phase.md does NOT contain old "Read the stack skill at" agent-facing instruction (D4 inline contract authoritative)'
);

// ---------------------------------------------------------------------------
// D3 parallel-spawn assertions (Phase 2 v4.4.0, F-003 fix — replaces orphan
// bash test at plugins/bee/tests/plan_phase_parallelization_test.sh)
// plan-phase.md Step 2.5 must use the canonical parallel-spawn idiom at BOTH
// the "Policy: required" pipeline and the "recommended/Full analysis" pipeline.
// ---------------------------------------------------------------------------

const planPhaseContent = readFile(path.join(COMMANDS_DIR, 'plan-phase.md'));

// Positive: canonical parallel-spawn idiom appears at least twice (both pipelines)
const parallelSpawnMatches = (planPhaseContent.match(/three Task tool calls in a SINGLE message/g) || []).length;
assert(
  parallelSpawnMatches >= 2,
  `plan-phase.md Step 2.5 uses "three Task tool calls in a SINGLE message" idiom at both pipelines (got ${parallelSpawnMatches}, expected >= 2)`
);

// Positive: provenance dependency preserved (researcher → provenance stays sequential)
assert(
  /provenance validation[\s\S]{0,200}depends on/i.test(planPhaseContent) ||
    /provenance validation reads RESEARCH\.md/.test(planPhaseContent),
  'plan-phase.md Step 2.5 preserves researcher → provenance sequential gate at head of pipeline'
);

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
// v4.4.0 SOLID fixes: genuine FP producer File: field roster (F-BUG-008)
// + Section 2.6 4th-bullet mirror (F-003) + $PRE_PLAN_STATUS snapshot
// (F-BUG-004). Named-constant roster pattern matches STYLISTIC_DECLINE_COMMANDS
// in stylistic-decline-strictness.test.js.
// ---------------------------------------------------------------------------

console.log('\n\n=== v4.4.0 SOLID — Genuine FP producer File: field (F-BUG-008) ===');

const GENUINE_FP_PRODUCER_COMMANDS = [
  'review.md',
  'review-implementation.md',
  'quick.md',
];

for (const cmd of GENUINE_FP_PRODUCER_COMMANDS) {
  const cmdContent = readFile(path.join(COMMANDS_DIR, cmd));
  // Canonical schema (review.md:354-362 source of truth): genuine FP producer
  // block has the sequence Finding -> Reason -> File -> Phase -> Date.
  const hasFileFieldInGenuineSchema =
    /## FP-\{NNN\}[\s\S]{0,500}\*\*Reason:\*\*[^\n]+\n[\s\S]{0,80}\*\*File:\*\* \{file_path of the finding\}[\s\S]{0,200}\*\*Phase:\*\*/.test(
      cmdContent
    );
  assert(
    hasFileFieldInGenuineSchema,
    `${cmd}: genuine FP producer template includes "- **File:** {file_path of the finding}" between Reason and Phase`
  );
}

console.log('\n=== v4.4.0 SOLID — Section 2.6 4th-bullet mirror (F-003) ===');

const SECTION_2_6_AGENTS = ['implementer.md', 'quick-implementer.md'];

for (const agent of SECTION_2_6_AGENTS) {
  const agentContent = readFile(path.join(AGENTS_DIR, agent));
  const section26Match = agentContent.match(/## 2\.6[\s\S]*?(?=\n## )/);
  const section26 = section26Match ? section26Match[0] : '';
  assert(
    /Prose-only tasks on markdown[\s\S]{0,500}SKIP authored test files/i.test(section26),
    `${agent} Section 2.6 contains 4th bullet for prose-only markdown tasks (SKIP authored test files)`
  );
}

// $PRE_PLAN_STATUS snapshot assertion lives only in
// plan-phase-plan-review-format.test.js (canonical surface-specific test for
// plan-phase.md Steps 8/9) -- single-canonical-site-per-literal policy.

// ---------------------------------------------------------------------------
// v4.4.0 Ship/CHANGELOG Surface Contracts (Quick 018) -- paired-contract
// pinning for the ship.md / plan-all.md / CHANGELOG.md edits that ship under
// the v4.4.0 SOLID series. Absorbed from the deleted standalone test file so
// every owned literal has exactly one canonical site.
// ---------------------------------------------------------------------------

console.log('\n=== v4.4.0 Surface Contracts — plan-all canonical marker + ship table-cell-aware detection ===');

const REPO_ROOT = path.join(PLUGIN_DIR, '..', '..');
const shipMd = readFile(path.join(COMMANDS_DIR, 'ship.md'));
const planAllMd = readFile(path.join(COMMANDS_DIR, 'plan-all.md'));
const changelogMd = readFile(path.join(REPO_ROOT, 'CHANGELOG.md'));

// S1-a: plan-all.md unconditionally writes the canonical [Cross-plan consistency review] marker
assert(
  planAllMd.includes('[Cross-plan consistency review]'),
  'plan-all.md emits the canonical [Cross-plan consistency review] marker (unconditional)'
);

// S1-b: marker documented as written on EVERY cross-plan completion (clean OR fixed)
assert(
  /\[Cross-plan consistency review\][^\n]{0,200}(clean|fixed|completed|every|always|unconditional)/i.test(planAllMd),
  'plan-all.md documents [Cross-plan consistency review] marker as unconditional (clean OR fixed)'
);

// S1-c: ship.md inherit-mode detection uses table-cell-aware regex (or explicit column phrasing)
assert(
  /Yes\\s\*\\\(\\d\+\\\)|Yes\\s\*\\\(\\\d\+\\\)|Yes\s*\\\(\\d\+\\\)|Yes\\s\*\(\\d\+\)|table-cell-aware|Plan Review column/i.test(shipMd) ||
    shipMd.includes('Yes\\s*\\(\\d+\\)') ||
    (shipMd.includes('Yes (N)') && /table[- ]cell/i.test(shipMd)),
  'ship.md Step 3a.0 documents table-cell-aware Plan Review detection (regex or explicit column phrasing)'
);

// S1-d: ship.md inherit-mode detects the new canonical marker
assert(
  shipMd.includes('[Cross-plan consistency review]'),
  'ship.md Step 3a.0 detects [Cross-plan consistency review] marker'
);

console.log('\n=== v4.4.0 Surface Contracts — test-coverage-based predicate + variant writer ===');

// S2-a: Step 3b.5.5 markdown-only predicate enumerates .md + test-file allowlist
assert(
  /\.md[^\n]{0,200}\.test\.js[^\n]{0,200}\.test\.ts[^\n]{0,200}\.spec\.js/.test(shipMd) ||
    /\{[\s\S]{0,200}\.md[\s\S]{0,200}\.test\.js[\s\S]{0,200}\.test\.ts[\s\S]{0,200}\.spec\.js[\s\S]{0,200}\}/.test(shipMd),
  'ship.md Step 3b.5.5 enumerates {.md, *.test.js, *.test.ts, *.spec.js} extension allowlist'
);

// S2-b: Step 3c writes variant in REVIEWED column
const step3cRegion = shipMd.split('**3c.')[1] ? '**3c.' + shipMd.split('**3c.')[1].split('**3d.')[0] : '';
assert(
  /Yes\s*\(test-coverage-based\)/.test(step3cRegion) ||
    shipMd.includes('Yes (test-coverage-based)'),
  'ship.md Step 3c writes "Yes (test-coverage-based)" in Reviewed column when invoked via 3b.5.5'
);

// S2-c: Status field stays plain `REVIEWED` (work-list guard depends on this)
assert(
  /Status[\s\S]{0,300}plain[\s\S]{0,100}REVIEWED|Status[\s\S]{0,100}stays[\s\S]{0,100}REVIEWED|Status[\s\S]{0,200}work-list/i.test(shipMd),
  'ship.md documents that Status field stays plain REVIEWED (work-list guard preserves)'
);

console.log('\n=== v4.4.0 Surface Contracts — lean default + opt-in flag wiring ===');

// S3-a: Step 4b spawn block conditional on resolved mode
assert(
  /\$FINAL_REVIEW_MODE\s*==?\s*"?full"?|if.*\$FINAL_REVIEW_MODE|when.*\$FINAL_REVIEW_MODE/i.test(shipMd),
  'ship.md Step 4b spawn block is conditional on $FINAL_REVIEW_MODE'
);

// S3-b: Lean mode = 2 agents, full mode = (3 x N) + 2 (ASCII x, NOT Unicode)
assert(
  /Total agents in lean mode:\s*2[\s\S]{0,300}Total agents in full mode:\s*\(3\s*x\s*N\)\s*\+\s*2/i.test(shipMd) ||
    /lean mode[\s\S]{0,100}2 agents[\s\S]{0,300}full mode[\s\S]{0,100}\(3\s*x\s*N\)\s*\+\s*2/i.test(shipMd),
  'ship.md Step 4b documents "lean mode: 2 agents" + "full mode: (3 x N) + 2" with ASCII x'
);

// S3-c: section header renamed to (mode-conditional)
assert(
  /Spawn review agents \(mode-conditional\)|Spawn agents \(mode-conditional\)/.test(shipMd),
  'ship.md Step 4b spawn section header renamed to "(mode-conditional)" (removing always-full assumption)'
);

console.log('\n=== v4.4.0 Surface Contracts — ship.md Step 3b.8 MEDIUM escalation batched-10 (F-BUG-006) ===');

// F-BUG-006: ship.md Step 3b.8 MEDIUM escalation block contains "Batch up to 10 validators"
const step3b8Region = shipMd.split('**3b.8')[1] ? shipMd.split('**3b.8')[1].split('**3b.9')[0] : '';
assert(
  /Batch up to 10 validators at a time/.test(step3b8Region),
  'ship.md Step 3b.8 MEDIUM escalation contains "Batch up to 10 validators at a time"'
);

console.log('\n=== v4.4.0 Surface Contracts — exact-token regex for --full-final-review + --skip-discuss (F-004) ===');

// F-004: ship.md uses boundary-anchored regex for --full-final-review
assert(
  shipMd.includes('(^|\\s)--full-final-review(\\s|$)') ||
    shipMd.includes('(^|\\\\s)--full-final-review(\\\\s|$)') ||
    /boundary[- ]anchored[\s\S]{0,100}--full-final-review/i.test(shipMd) ||
    /exact[- ]token[\s\S]{0,100}--full-final-review/i.test(shipMd),
  'ship.md uses exact-token / boundary-anchored regex for --full-final-review detection'
);

// F-004: same fix applied to --skip-discuss
assert(
  shipMd.includes('(^|\\s)--skip-discuss(\\s|$)') ||
    shipMd.includes('(^|\\\\s)--skip-discuss(\\\\s|$)') ||
    /boundary[- ]anchored[\s\S]{0,200}--skip-discuss/i.test(shipMd) ||
    /exact[- ]token[\s\S]{0,200}--skip-discuss/i.test(shipMd),
  'ship.md uses exact-token / boundary-anchored regex for --skip-discuss detection (systemic consistency)'
);

// F-004: argument-hint at top of ship.md documents --full-final-review
const shipFrontmatter = shipMd.split('---\n')[1] || '';
assert(
  /argument-hint[\s\S]{0,200}--full-final-review/.test(shipFrontmatter),
  'ship.md argument-hint frontmatter documents --full-final-review flag'
);

console.log('\n=== v4.4.0 Surface Contracts — Step 4b 4th lean-trigger condition (F-009) ===');

// F-009: Step 4b "Use full mode when..." trigger list includes 4th condition
assert(
  /REVIEWED \(test-coverage-based\)[\s\S]{0,300}Step 3b\.5\.5|test-coverage-based[\s\S]{0,200}per-stack reviewers skipped/i.test(shipMd),
  'ship.md Step 4b includes 4th full-mode trigger: phase marked REVIEWED (test-coverage-based)'
);

console.log('\n=== v4.4.0 Surface Contracts — F-007: 8 setpoints + semantic naming ===');

// F-007: CHANGELOG D8 entry uses "8 setpoints" or semantic naming (NOT "7 setpoints")
assert(
  /8 setpoints introduced|semantic naming/.test(changelogMd) ||
    /(?:^|\s)8 setpoints/.test(changelogMd),
  'CHANGELOG.md D8 entry uses "8 setpoints" (or semantic naming) — NOT the stale "7 setpoints"'
);

// F-007 corollary: plan-phase.md no longer references "7th setpoint" prose
assert(
  !/this is the 7th setpoint/i.test(planPhaseContent),
  'plan-phase.md Accept-fixes branch uses semantic naming (no "7th setpoint" ordinal)'
);

console.log('\n=== v4.4.0 Surface Contracts — PAT-001: Unicode × normalized to ASCII x ===');

// PAT-001: ship.md has zero Unicode × (multiplication sign U+00D7)
assert(
  !/×/.test(shipMd),
  'ship.md uses ASCII "x" (zero Unicode × multiplication signs)'
);

// PAT-001: CHANGELOG inherits ASCII form for "(3 x N) + 2" references
assert(
  !/\(3\s*×\s*N\)/.test(changelogMd),
  'CHANGELOG.md uses ASCII "x" form in (3 x N) + 2 references'
);

console.log('\n=== v4.4.0 Surface Contracts — PAT-005: CHANGELOG D1/D2 semantic anchors ===');

// PAT-005: CHANGELOG D1/D2 entries do NOT use drifted hardcoded line numbers
const d1d2Region = changelogMd.split('### Changed')[1]
  ? changelogMd.split('### Changed')[1].split('### Fixed')[0]
  : '';
const d1Match = d1d2Region.match(/\*\*D1[\s\S]*?(?=\n- \*\*D2)/);
const d2Match = d1d2Region.match(/\*\*D2[\s\S]*?(?=\n- \*\*D3)/);
const d1Text = d1Match ? d1Match[0] : '';
const d2Text = d2Match ? d2Match[0] : '';

assert(
  !/review\.md:\d+|review-implementation\.md:\d+/.test(d1Text),
  'CHANGELOG D1 entry uses semantic anchors (no hardcoded file:line citations)'
);
assert(
  !/review\.md:\d+|review-implementation\.md:\d+/.test(d2Text),
  'CHANGELOG D2 entry uses semantic anchors (no hardcoded file:line citations)'
);

// ---------------------------------------------------------------------------
// Thinking Principles Skill (Quick 019) — canonical references in agent consumers
// ---------------------------------------------------------------------------

console.log('\n=== Thinking Principles — Skill file existence + section roster ===');

// Use SKILLS_DIR constant + readFile() helper per file convention (graceful FAIL
// on missing file instead of unhandled crash) — review F-TEST-001 fix
const thinkingSkillPath = path.join(SKILLS_DIR, 'thinking-principles', 'SKILL.md');
const thinkingSkill = readFile(thinkingSkillPath);

assert(
  thinkingSkill !== null,
  'plugins/bee/skills/thinking-principles/SKILL.md exists and is readable'
);

if (thinkingSkill !== null) {
  // Note: no separate non-empty assertion — rule-section regexes below would
  // fail naturally on empty content (per memory feedback_test_intent_or_skip).
  assert(
    /## Rule 7: Surface Conflicts/.test(thinkingSkill),
    'thinking-principles skill defines Rule 7 (Surface Conflicts)'
  );
  assert(
    /## Rule 8: Read Before Write/.test(thinkingSkill),
    'thinking-principles skill defines Rule 8 (Read Before Write)'
  );
  assert(
    /## Rule 9: Test Intent/.test(thinkingSkill),
    'thinking-principles skill defines Rule 9 (Test Intent)'
  );
  assert(
    /## Rule 12: Fail Visibly/.test(thinkingSkill),
    'thinking-principles skill defines Rule 12 (Fail Visibly)'
  );
  // Negative: rules already covered structurally by bee are NOT duplicated here.
  // R5/R6 are unused in the source taxonomy (Karpathy 1-4 + author's R7-R12).
  assert(
    !/## Rule 1: Think Before Coding|## Rule 2: Simplicity First|## Rule 3: Surgical Changes|## Rule 4: Goal-Driven|## Rule 10: Checkpoint|## Rule 11: Convention/.test(thinkingSkill),
    'thinking-principles skill does NOT duplicate rules already covered structurally by bee (1, 2, 3, 4, 10, 11; R5/R6 unused in source)'
  );
  // Review fix: no stale "Section 2.X" placeholder
  assert(
    !/Section 2\.X/.test(thinkingSkill),
    'thinking-principles skill R9 does NOT contain stale "Section 2.X" placeholder (replaced with concrete "Section 2.6 in both implementer.md and quick-implementer.md")'
  );
  // Review fix: canonical-reference example uses escaped inner backticks
  // (matching command-primitives precedent at SKILL.md:8-10) so the
  // example renders as a single inline-code span, not three.
  assert(
    /``See `skills\/thinking-principles\/SKILL\.md` Rule N/.test(thinkingSkill),
    'thinking-principles skill preamble uses double-backtick wrapper with escaped inner backticks (matches command-primitives precedent)'
  );
}

console.log('\n=== Thinking Principles — Canonical references in 6 consumer agents ===');

const THINKING_PRINCIPLE_CONSUMERS = {
  'implementer.md':       { rules: [8, 9, 12], titles: ['Read Before Write', 'Test Intent', 'Fail Visibly'] },
  'quick-implementer.md': { rules: [8, 9, 12], titles: ['Read Before Write', 'Test Intent', 'Fail Visibly'] },
  'researcher.md':        { rules: [8],        titles: ['Read Before Write'] },
  'bug-detector.md':      { rules: [7, 12],    titles: ['Surface Conflicts', 'Fail Visibly'] },
  'pattern-reviewer.md':  { rules: [7],        titles: ['Surface Conflicts'] },
  'fixer.md':             { rules: [12],       titles: ['Fail Visibly'] },
};

for (const [agentFile, expected] of Object.entries(THINKING_PRINCIPLE_CONSUMERS)) {
  // Use readFile() helper per file convention (graceful FAIL on missing/renamed
  // file instead of unhandled crash that would suppress all subsequent assertions)
  const content = readFile(path.join(AGENTS_DIR, agentFile));
  assert(
    content !== null,
    `${agentFile} exists and is readable (consumer agent expected to reference thinking-principles)`
  );
  if (content === null) continue;

  // Canonical reference literal present (justifies why this agent's role applies)
  assert(
    content.includes('skills/thinking-principles/SKILL.md'),
    `${agentFile} references skills/thinking-principles/SKILL.md (canonical Path A form pinning the cross-cutting rules that apply to this agent's role)`
  );
  // Frontmatter skills: array MUST list thinking-principles so SubagentStart
  // hook auto-loads the skill (precedent: bug-detector.md lists `review`,
  // fixer.md lists `context7` matching their body references). Review F-BUG-002.
  // Note: no separate "has YAML frontmatter" assertion — the regex below fails
  // naturally if frontmatter is missing (per memory feedback_test_intent_or_skip).
  const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
  assert(
    frontmatterMatch !== null && /^\s*-\s*thinking-principles\s*$/m.test(frontmatterMatch[1]),
    `${agentFile} frontmatter lists "thinking-principles" in skills: array — required so SubagentStart hook auto-loads the skill (inline directive alone is unreliable per review F-BUG-002)`
  );
  // Each expected rule named explicitly in the reference line — the rule numbers
  // are load-bearing because they tell the agent which sections to load
  for (let i = 0; i < expected.rules.length; i++) {
    const ruleNum = expected.rules[i];
    const ruleTitle = expected.titles[i];
    const ruleRef = new RegExp(`Rule\\s*${ruleNum}\\s*\\(${ruleTitle}\\)`);
    assert(
      ruleRef.test(content),
      `${agentFile} names Rule ${ruleNum} (${ruleTitle}) explicitly — this is the rule that addresses the failure mode this agent is most prone to`
    );
  }
}

console.log('\n=== Thinking Principles — Test Quality Gate in implementer 3a (user-project tests) ===');

// Pins the user-project test-quality gate prose in BOTH implementer agents
// (single assertion across both — meaningful failure mode: silent removal of
// the gate prose → implementer writes shallow tests on user projects).
for (const agentFile of ['implementer.md', 'quick-implementer.md']) {
  const content = readFile(path.join(AGENTS_DIR, agentFile));
  if (content === null) continue;
  assert(
    /Test Quality Gate \(apply per assertion\)/.test(content) &&
      /SKIP the assertion/.test(content) &&
      /quality > count/i.test(content),
    `${agentFile} Section 3a RED contains the Test Quality Gate (per-assertion intent check + SKIP-if-shallow + quality-over-count) — the rule that prevents shallow user-project tests`
  );
}

console.log('\n=== Thinking Principles — Plan file backfill (Quick 019 bee:quick ceremony) ===');

// Review fix PAT-003: bee:quick TDD convention requires a plan file at
// .bee/quick/{NNN}-{slug}.md. Quick 019 plan file backfilled retroactively.
const quick019PlanPath = path.join(__dirname, '..', '..', '..', '..', '.bee', 'quick', '019-thinking-principles-skill.md');
const quick019Plan = readFile(quick019PlanPath);
assert(
  quick019Plan !== null && quick019Plan.length > 0,
  '.bee/quick/019-thinking-principles-skill.md plan file exists (backfilled per review PAT-003; bee:quick ceremony compliance)'
);

// ---------------------------------------------------------------------------
// Final results
// ---------------------------------------------------------------------------

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
