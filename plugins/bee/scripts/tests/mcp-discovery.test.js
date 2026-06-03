#!/usr/bin/env node
// Paired-contract test for the MCP tool-discovery wiring.
//
// Each assertion is the executable form of an Owned-Literal Contract row: it
// greps an on-disk literal that one edit task is the sole owner of, so two
// tasks can never silently diverge on the same string. The test is authored to
// FAIL against the pre-edit tree and PASS once every literal lands on disk.

const fs = require('fs');
const path = require('path');

const PLUGIN_DIR = path.join(__dirname, '..', '..');
const COMMANDS_DIR = path.join(PLUGIN_DIR, 'commands');
const SKILLS_DIR = path.join(PLUGIN_DIR, 'skills');
const AGENTS_DIR = path.join(PLUGIN_DIR, 'agents');

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

function read(...segments) {
  return fs.readFileSync(path.join(...segments), 'utf8');
}

function countMatches(haystack, needle) {
  return haystack.split(needle).length - 1;
}

// Extract the first YAML frontmatter block of an agent .md file.
function frontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : '';
}

const initMd = read(COMMANDS_DIR, 'init.md');
const refreshMd = read(COMMANDS_DIR, 'refresh-context.md');
const researcherMd = read(AGENTS_DIR, 'researcher.md');
const phasePlannerMd = read(AGENTS_DIR, 'phase-planner.md');
const context7Skill = read(SKILLS_DIR, 'context7', 'SKILL.md');
const reactImplMd = read(AGENTS_DIR, 'stacks', 'laravel-inertia-react', 'implementer.md');
const vueImplMd = read(AGENTS_DIR, 'stacks', 'laravel-inertia-vue', 'implementer.md');

// ============================================================
// 1. config.mcp schema block documented in BOTH init.md JSON templates
// ============================================================
// WHY: init writes config.json; if the mcp block is missing from a template,
// projects on that init path get no mcp schema and every downstream config.mcp
// read silently degrades. Two templates (single-stack + multi-stack) must each
// carry it, each with both capability sub-keys.
console.log('\n1. config.mcp schema in both init.md JSON templates');
assert(
  countMatches(initMd, '"mcp"') >= 2,
  'init.md declares the "mcp" config block in >=2 places (single + multi-stack JSON templates)'
);
{
  // Each "mcp" block must carry both capability sub-keys within its body, so a
  // template that drops context7 or laravel_boost discovery fails here.
  const blocks = initMd
    .split('"mcp"')
    .slice(1)
    .map((seg) => seg.slice(0, 160));
  const bothKeysPerBlock = blocks.filter(
    (b) => b.includes('"context7"') && b.includes('"laravel_boost"')
  );
  assert(
    bothKeysPerBlock.length >= 2,
    'each "mcp" block carries both "context7" and "laravel_boost" sub-keys (discovery writes both capabilities)'
  );
}

// ============================================================
// 2-3. researcher + phase-planner frontmatter drop tools: (inherit-all)
// ============================================================
// WHY: these two agents must call a per-install-named Context7 tool. A fixed
// tools: allowlist cannot name an install-specific tool, so a stray tools: line
// would silently block the MCP call. Absence of tools: is the inherit-all
// mechanism that keeps the call name-agnostic.
console.log('\n2-3. researcher + phase-planner frontmatter has no tools: line');
assert(
  !/^tools:/m.test(frontmatter(researcherMd)),
  'researcher.md frontmatter omits tools: (inherit-all so per-install Context7 tool name is callable)'
);
assert(
  !/^tools:/m.test(frontmatter(phasePlannerMd)),
  'phase-planner.md frontmatter omits tools: (inherit-all so per-install Context7 tool name is callable)'
);

// ============================================================
// 4. config-driven resolution literal present in the three consumers
// ============================================================
// WHY: config.mcp.context7 is the literal that proves the prose resolves the
// Context7 tool name from config at runtime instead of hardcoding it. Missing it
// in any consumer means that consumer reverted to a hardcoded name.
console.log('\n4. config.mcp.context7 present in skill + researcher + phase-planner');
assert(
  context7Skill.includes('config.mcp.context7'),
  'context7 SKILL.md references config.mcp.context7 (resolution layer, not a hardcoded tool name)'
);
assert(
  researcherMd.includes('config.mcp.context7'),
  'researcher.md references config.mcp.context7 (resolves Context7 tool name from config)'
);
assert(
  phasePlannerMd.includes('config.mcp.context7'),
  'phase-planner.md references config.mcp.context7 (resolves Context7 tool name from config)'
);

// ============================================================
// 5. config.mcp.context7.available master-vs-resolution distinction
// ============================================================
// WHY: .available is the boolean gate the fallback prose branches on. Without it
// the skill cannot express "tool present vs absent", collapsing the graceful
// fallback into an unconditional call that hard-fails when MCP is absent.
console.log('\n5. config.mcp.context7.available present in context7 SKILL.md');
assert(
  context7Skill.includes('config.mcp.context7.available'),
  'context7 SKILL.md references config.mcp.context7.available (availability gate the fallback branches on)'
);

// ============================================================
// 6. config-driven Boost literal in BOTH laravel implementers
// ============================================================
// WHY: both implementers must resolve Laravel Boost tools from config; a missing
// literal in either means that implementer hardcoded (or omitted) Boost wiring,
// breaking parity across the two stacks.
console.log('\n6. config.mcp.laravel_boost present in both laravel implementers');
assert(
  reactImplMd.includes('config.mcp.laravel_boost'),
  'laravel-inertia-react implementer references config.mcp.laravel_boost (resolves Boost tools from config)'
);
assert(
  vueImplMd.includes('config.mcp.laravel_boost'),
  'laravel-inertia-vue implementer references config.mcp.laravel_boost (Boost section added at config-driven parity with react)'
);

// ============================================================
// 7. ToolSearch discovery marker in init + refresh-context
// ============================================================
// WHY: ToolSearch is the named introspection mechanism. Vague "detect the tools"
// prose would leave the discovery step unspecified; both the first-init path and
// the re-discovery path (refresh-context) must name it so a later refresh can
// repopulate config.mcp if MCP tools were not enumerable at first init.
console.log('\n7. ToolSearch discovery marker in init.md + refresh-context.md');
assert(
  initMd.includes('ToolSearch'),
  'init.md names ToolSearch as the MCP introspection mechanism (discovery step is concrete, not vague)'
);
assert(
  refreshMd.includes('ToolSearch'),
  'refresh-context.md names ToolSearch (re-runs discovery so a missed first-init populates config.mcp later)'
);

// ============================================================
// 8. ABSENCE (scoped): hardcoded mcp__context7__ gone from the inherit-all agents
// ============================================================
// WHY: if the hardcoded mcp__context7__ name survives in these two agents, the
// inherit-all migration is incomplete — the agent would still try the wrong
// per-install name. Scoped to the two genuinely-loosened agents only; the skill
// keeps the default name by design (asserted below).
console.log('\n8. hardcoded mcp__context7__ removed from researcher + phase-planner');
assert(
  !researcherMd.includes('mcp__context7__'),
  'researcher.md no longer hardcodes any mcp__context7__ name (would shadow the config-resolved per-install name)'
);
assert(
  !phasePlannerMd.includes('mcp__context7__'),
  'phase-planner.md no longer hardcodes any mcp__context7__ name (would shadow the config-resolved per-install name)'
);

// ============================================================
// 9. ABSENCE: hardcoded mcp__laravel-boost__ gone from react implementer
// ============================================================
// WHY: a surviving hardcoded Boost name in the react implementer means the edit
// only ADDED the config-driven form without REMOVING the old one, leaving two
// contradictory resolution paths.
console.log('\n9. hardcoded mcp__laravel-boost__ removed from react implementer');
assert(
  !reactImplMd.includes('mcp__laravel-boost__'),
  'laravel-inertia-react implementer no longer hardcodes mcp__laravel-boost__ (config.mcp.laravel_boost is the sole resolution path)'
);

// ============================================================
// 10. FALLBACK-SURVIVAL: graceful-fallback clause co-occurs in all three
// ============================================================
// WHY: presence/absence greps alone pass even if a partial edit dropped the
// "fall back to codebase patterns, never hard-fail" clause. This guard fails
// such an edit, ensuring the config-driven blocks still degrade gracefully when
// MCP is unavailable.
console.log('\n10. graceful-fallback marker co-occurs in researcher + phase-planner + skill');
const fallback = /codebase patterns|not available|never hard-fail/i;
assert(
  fallback.test(researcherMd),
  'researcher.md retains a graceful-fallback clause (degrades to codebase patterns when Context7 is unavailable)'
);
assert(
  fallback.test(phasePlannerMd),
  'phase-planner.md retains a graceful-fallback clause (degrades to codebase patterns when Context7 is unavailable)'
);
assert(
  fallback.test(context7Skill),
  'context7 SKILL.md retains a graceful-fallback clause (never hard-fails on missing MCP)'
);

// ============================================================
// 11. SHARED-SKILL: default Context7 name retained in the skill
// ============================================================
// WHY: tight-frontmatter consumers (5 reviewers + fixer) keep a fixed tools:
// allowlist and depend on the skill instructing the canonical default name. If
// the skill dropped it, those consumers' allowlists would no longer match the
// name the skill tells them to call.
console.log('\n11. default mcp__context7__resolve-library-id retained in context7 SKILL.md');
assert(
  context7Skill.includes('mcp__context7__resolve-library-id'),
  'context7 SKILL.md retains the default mcp__context7__resolve-library-id name (tight-frontmatter consumers depend on it)'
);

// ============================================================
// Results
// ============================================================
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
