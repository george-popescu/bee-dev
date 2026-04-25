# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [4.3.0] - 2026-04-26 -- Agent Teams + Scoped Per-Wave Test Validation

### Added
- **Agent Teams integration** (experimental, Claude Code v2.1.32+) — bee can now spawn peer-to-peer teams instead of subagents for cross-layer review, scientific-debate debugging, cross-stack architectural planning, and audit domain split. New skills: `agent-teams/` (pre-flight, probe, CLAUDE.md bridge), `team-decisions/` (5-axis weighted scorer, hard constraints, threshold map), `team-templates/` (4 reusable spawn patterns).
- **Auto-Mode Marker primitive** in `skills/command-primitives/SKILL.md` — single source of truth for the auto-run lifecycle marker (`.bee/.autonomous-run-active`). Used by `/bee:ship`, `/bee:plan-all`, `/bee:autonomous`. File-existence is the sole detection signal — no PID, no nonce. Cleanup is unconditional on success and every error-exit branch.
- **Scoped per-wave test validation** in `/bee:execute-phase` Step 5d.0 — instead of running the full suite after every wave, runs only tests affected by the wave's changed files. New `Scoped Test Selection` primitive in `skills/command-primitives/SKILL.md` with per-runner table (vitest/jest native `--findRelatedTests`; pest/phpunit/pytest filename heuristic with composer.json psr-4 source-root detection; pytest src-layout uses `-k` form). New `phases.post_wave_validation: "auto" | "full" | "scoped" | "skip"` config (default `auto`).
- **Mandatory phase-end full validation** at `/bee:execute-phase` Step 5f — runs the FULL suite + linter + static analysis ONCE before marking phase EXECUTED. Always runs regardless of per-wave mode (the safety net for anything scoping missed). User prompted on failure with Pause / Retry / Mark anyway / Custom; result persisted to metrics + SUMMARY.md.
- **Linter file-extension mapping table** in `Stack/Linter/Test-Runner Resolution` primitive — covers pint, eslint, prettier, biome, phpcs, phpcbf, ruff, black, flake8. Enforces empty-list skip-with-log to prevent linters from scanning the entire project on waves that touched no matching files.
- **3 new stack-aware agents** for `laravel-inertia-react`: `bug-detector.md`, `implementer.md`, `pattern-reviewer.md`. Cloned from the laravel-inertia-vue stack and adapted for React 19 patterns + laravel-boost MCP for backend ops.
- **PID-aware auto-mode marker conventions** in `commands/ship.md`, `commands/plan-all.md`, `commands/autonomous.md` — three new markers (`.bee/.autonomous-run-active`, `.bee/.autonomous-team-spawned`, `.bee/.autonomous-team-claimed`) with documented sentinel-cleanup-on-failure contract in `skills/team-decisions/SKILL.md`.
- **TaskCompleted + TeammateIdle hooks** (`scripts/team-task-validator.sh`, `scripts/team-idle-validator.sh`) — enforce `## Task Notes` + deliverable-signature contracts on team teammates. Probe-team disambiguation by transcript-content match (the probe asks a unique TDD question), robust against orphaned probe directories.
- **`agent_teams` config block** added to `init.md` schema with 11 fields including `status`, `allow_in_auto_mode`, `auto_decision`, `high_cost_confirm`, `skill_injection`, `max_team_size`, `max_tokens_per_team_op` (adaptive per `implementation_mode`: 2.4M premium / 1.2M quality / 600K economy).
- **Re-init migrations** for both `phases.post_wave_validation` (default `"auto"`) and `agent_teams` (with semver version comparison + JSONC guard + post-write verification).

### Changed
- **`skills/core/SKILL.md` TDD applicability** clarified — TDD applies to business logic, not infrastructure boilerplate (migrations, factories, route registration). Worked PHP example added; anti-narration rule with aligned DON'T tokens added across 5 implementer agents.
- **`commands/audit.md` team path** now stamps `Validation: REAL BUG (in-team cross-evaluation)` + `Fix Status: pending` on every finding before handoff to `/bee:fix-implementation`. Without these stamps, fix-implementation's filter silently dropped team-produced audit findings.
- **`commands/fix-implementation.md` finding-ID regex** generalized to `### ([A-Z]+-)+[0-9]+` — covers multi-segment audit prefixes (`F-SEC-NNN`, `F-DB-NNN`, `F-API-NNN`, `F-FE-NNN`, `F-PERF-NNN`, `F-ARCH-NNN`, `F-ERR-NNN`, `F-INT-NNN`, `F-BUG-NNN`, `F-TEST-NNN`). The previous `[A-Z]+-NNN` pattern only matched 2-segment IDs.
- **`commands/health.md`** added Check 14 (orphan team detection); history schema, baseline, display, summary all updated 13 → 14.
- **`commands/do.md`** routing now recognizes `audit/review/swarm/trimite o echipă` and routes to the appropriate team-aware command instead of dispatching subagents manually.
- **`scripts/load-context.sh`** caps COMPACT-CONTEXT.md and SESSION-CONTEXT.md at 100 lines (-65% session bloat); `shopt -s nullglob` added for safer glob expansion.
- **Hook timeouts** for TaskCompleted + TeammateIdle raised from 10s to 30s to match peer transcript-validating hooks.
- Plugin version: 4.2.0 -> 4.3.0
- Marketplace version: 1.6.0 -> 1.7.0

### Fixed
- **Auto-mode PID-match self-identification was unreachable** (Bash tool spawns a fresh shell per invocation, so `$$` captured at marker-write never coincided with `$$` at marker-read). The cross-session warning fired on every legitimate auto-run. Replaced with file-existence detection.
- **Probe-team validator coexistence** — when both probe and real bee teams existed, the directory-presence check exited 0 globally and skipped validation for real-team teammates too. Switched to per-teammate transcript-content detection.
- **`init.md` semver compare** crashed under `set -e` when `claude --version` returned empty/non-standard output. Added empty-version guard with explicit "unavailable" status.
- **`init.md` adaptive ceiling** — JSON templates hardcoded `4000000`/`1200000` literals contradicting the documented adaptive rule. Replaced with `{adaptive_ceiling}` placeholder + explicit substitution step.
- **`team-idle-validator.sh` deliverable regex** missed `## Bugs Detected`, `## Stack Best Practice Violations`, `## Plan Compliance Findings`, audit summaries, debug `CHECKPOINT REACHED`/`INVESTIGATION INCONCLUSIVE`, and pattern/stack `Total: N deviations|violations` summary lines. Expanded to cover all documented agent contracts in hooks.json.
- **Sentinel cleanup-on-failure contract** specified in `skills/team-decisions/SKILL.md` — partial-failure path now releases `.autonomous-team-claimed` so subsequent team-eligible operations don't fall back to subagent for the rest of the run.
- **`pest --parallel` + positional files doesn't scope** (paratest discovers via phpunit.xml testsuites, ignoring positional args). `--parallel` removed from scoped pest/phpunit templates; reserved for phase-end full suite.
- **Step 3 fast-path bypassed Step 5f safety net** when re-running after a Step 5f Pause + manual fix. Step 3 now falls through to Step 5f when all tasks complete but status is not yet EXECUTED. Variables Step 5 normally seeds (`$FAILURE_TYPE_COUNTS`, `$ESCALATION_COUNT`, `per_wave`) are explicitly initialized on the fast-path so Step 6b doesn't write `undefined` into the metrics file.
- **Empty linter file-list scanned entire project** (pint, eslint, prettier all default to "scan everything" with no positional args). Empty-list skip-with-log added.
- **Shell injection on space-containing paths** — all interpolations in primitive command templates now shell-quoted.
- **Per-stack iteration unspecified** — concurrent stacks spawned 2N+ test workers competing on N cores. Both Step 5d.0 and Step 5f now explicitly say "executed sequentially".
- **Path normalization order** in Scoped Test Selection documented as load-bearing: existence filter → heuristic mapping → stack-relative rewrite LAST.
- **Re-init migration handles `phases: null`** distinctly from `phases: missing`.

### Reviews
4-round review loop (`.bee/reviews/2026-04-26-1.md`, `.bee/reviews/2026-04-26-2.md`, `.bee/reviews/2026-04-26-3.md`): Round 1 surfaced 25 findings (4 Critical, 6 High, 15 Medium); Round 2 surfaced 13 NEW issues introduced by Round 1 fixes; Round 3 caught a metrics-corruption regression from the Round 2 fast-path fix; Round 4 returned 0 findings, terminating the loop. 2 false positives persisted to `.bee/false-positives.md` (FP-001 STACKS_COUNT misread; FP-002 POSIX `[ ` is repo convention).

## [4.2.0] - 2026-04-23 -- Command Primitives Skill (Token-Optimization Pass)

### Added
- **`skills/command-primitives/SKILL.md`** — 7 reusable primitives (Validation Guards, Build & Test Gate, Context Cache, Stack/Linter/Test-Runner Resolution, Model Selection, Per-Stack Agent Resolution, Auto-Fix Loop, Re-Review Loop) with 3 split variants (Build & Test Gate Interactive/Autonomous, Auto-Fix Loop Quick/Full, Model Selection Reasoning/Scanning). 10 sections total.
- **171 paired-contract test assertions** (`scripts/tests/command-primitives.test.js`) verifying primitive ↔ caller invocation contract for every reference site.

### Changed
- **8 commands refactored** to reference command-primitives sections instead of inlining: `/bee:review`, `/bee:review-implementation`, `/bee:quick`, `/bee:audit`, `/bee:swarm-review`, `/bee:execute-phase`, `/bee:plan-all`, `/bee:plan-phase`.
- **Path-flatten sweep** across 9 files: 16 instances of `plugins/bee/` prefix removed from skill/agent/command refs (skill/agent/command paths are now relative to plugin root).
- **Skill namespace flatten** `skills/bee/` → `skills/`.
- **Pre-commit gate robustness** improved (config-driven case statement removed in favor of hard-coded whitelist).
- Plugin version: 4.1.0 -> 4.2.0
- Marketplace version: 1.5.0 -> 1.6.0

### Fixed
- 5 review findings surfaced during the refactor: review.md REVIEWING resume, multi-line MSI prose collapsed in 4 commands, test banner normalized, namespace flatten, plan-all cross-plan AFL collapsed.

### Tests
Final test counts: command-primitives 171/171 + vendor-citation 366/366 + agent-output-format 46/46 + quick-implementer-agent 35/35 = 618/618 passing.

## [4.1.0] - 2026-04-17 -- Vendor Citation Contract (Anti-Hallucination Guard)

### Added
- **Vendor citation contract across the review + audit pipeline** — every shipped finding from any of 24 reviewer/auditor agents must classify Evidence Strength as `[CITED]` (codebase trace, self-evidencing) or `[VERIFIED]` (vendor docs / OWASP / RFC / MDN / Context7-fetched), and provide a Citation pointer. Pure-`[ASSUMED]` findings are dropped, NOT shipped. Mirrors and extends the existing `agents/researcher.md:122-128` tag system precedent.
- **New schema fields** in `skills/core/templates/review-report.md`: `Evidence Strength: [CITED] | [VERIFIED]` and `Citation: <URL | Context7 lib ID + query | skill section path | codebase file:line>`. Slotted between existing `Evidence:` and `Impact:` fields. Total finding template now 13 fields (was 11).
- **`[CITED]` vs `[VERIFIED]` distinction** — empirical findings (codebase file:line trace) qualify as `[CITED]` even without external vendor docs; the trace IS the citation. Normative findings (best-practice claims) require `[VERIFIED]` external source. Avoids misclassifying legitimate empirical findings as STYLISTIC just because they lack vendor docs.
- **`DROPPED` verdict** in `finding-validator` and `audit-finding-validator` — distinct from `FALSE POSITIVE`. `DROPPED` means the reviewer made a process error (missing/`[ASSUMED]`/malformed citation); the underlying code claim was NOT evaluated. `quick.md` and `review.md` skip persistence of `DROPPED` to `.bee/false-positives.md` to avoid polluting the FP store and risking suppression of legitimate future findings via summary match.
- **`Evidence Requirement (Drop Policy)` sections** in `skills/review/SKILL.md` and `skills/audit/SKILL.md` documenting the contract, the empirical/normative split, the drop policy, and the distinction from researcher's permissive `[ASSUMED]` rules.
- **NEW test file** `plugins/bee/scripts/tests/vendor-citation-contract.test.js` — 166 structural assertions pinning the contract across all 24 agents + 3 schema files + 3 commands. Negative + positive checks ensure regression would fail CI.

### Changed
- 24 reviewer/auditor agent prompts updated with the contract (3 tiers: 5 with Context7 + full vendor lookup, 17 without Context7 + direct vendor URL citation, 2 validators with format-only fabrication checks + drop logic). Output formats extended with the 2 new fields per each agent's variant.
- 3 commands (`quick.md`, `review-implementation.md`, `review.md`) — inline finding-format lists extended from 10 to 13 fields.
- Plugin version: 4.0.7 -> 4.1.0
- Marketplace version: 1.4.3 -> 1.5.0

### Discussion
`.bee/discussions/2026-04-17-vendor-citation-reviews.md` captures the design rationale, the empirical/normative split decision, and the colleague's anti-hallucination motivation that drove the strict drop policy.

## [4.0.7] - 2026-04-17 -- Ceremony Bump Removal (Downstream Safety Hotfix)

### Fixed
- **`/bee:complete-spec` and `/bee:archive-spec` were silently corrupting the plugin install cache** for every downstream user. Both commands had a "Bump plugin version" step that tried `plugins/bee/.claude-plugin/plugin.json` first, then fell back to `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` — which resolves to `~/.claude/plugins/cache/bee-dev/bee/X.Y.Z/`. When a user ran the ceremony in their own project, the relative path missed, the fallback hit the cache, and the bump silently mutated the installed plugin. The drift warning then told the user to run `/plugin` reinstall — which would clobber the bump. Net result: silent install corruption + a misleading warning + a meaningless bump (downstream users don't author the bee plugin and their bumps would be erased on next marketplace install anyway).

### Removed
- **The "Bump plugin version" step is removed entirely from both ceremonies.** The plugin author's bump is a 1-user concern — burying a no-op step in user-facing flow is poor UX. Bee plugin versions are now managed manually by the plugin author (or via a future dedicated `/bee:release` command if it becomes annoying). `/bee:archive-spec` is now strictly about archiving; `/bee:complete-spec` is strictly about audit + changelog + tag + archive + history + state-reset.
- `archive-spec.md`: removed Step 6 entirely; Step 7 (Summary) renumbered to Step 6; dropped "Plugin version" line from summary; updated intro and design notes.
- `complete-spec.md`: removed "Bump plugin version" sub-block from Step 8 (including the cache drift warning); dropped "Plugin version" line from Step 9 summary; updated intro.

### Added
- **Negative-assertion regression contract.** Both `complete-spec-command.test.js` and `archive-spec-command.test.js` now contain assertions pinning that the ceremony command does NOT contain a "Bump plugin version" step, does NOT instruct writing to `plugin.json`, does NOT increment `PATCH`, and does NOT reference `${CLAUDE_PLUGIN_ROOT}` as a write fallback. A future regression that re-adds the bump (in any form) will fail CI.

### Changed
- Plugin version: 4.0.6 -> 4.0.7
- Marketplace version: 1.4.2 -> 1.4.3

## [4.0.6] - 2026-04-17 -- Hive Dashboard Empty Snapshot Fix

### Fixed
- **`/bee:hive` dashboard rendered empty for every user** — `scripts/hive-start.sh:99` was forwarding only `HIVE_OWNER_PID` to the spawned `node hive-server.js` child. `resolveBeeDir()` then walked up from `__dirname` (the plugin cache path, e.g. `~/.claude/plugins/cache/bee-dev/bee/4.0.5/scripts/`), found no `.bee/` ancestor, returned `null`, and the snapshot/config/file handlers were never wired. `/api/snapshot` stayed on the stub handler that returns only `{"timestamp":"..."}`. Fix adds `HIVE_BEE_DIR="$BEE_DIR"` to the `nohup env ...` prefix on the same line — `BEE_DIR` is unconditionally validated by the discovery block earlier in the script.

### Added
- **New integration test** (`plugins/bee/scripts/tests/hive-start-integration.test.js`) — spawns `hive-start.sh` as a real subprocess against a temp `.bee/` fixture and asserts the snapshot reflects a sentinel spec name written to a temp `STATE.md`. The sentinel is load-bearing: a simple `state !== undefined` assertion would pass even with the bug because `__dirname` walk-up finds the bee repo's own `.bee/` in the dev environment. Closes the test gap that let this bug ship — existing unit tests bypass the shell launcher by setting `process.env` directly.
- **Structural Test 15 in `hive-start.test.js`** — pins `HIVE_BEE_DIR="$BEE_DIR"` on the `nohup env ... node` line with a right-anchored negative lookahead `(?![A-Z_0-9])` to reject prefix-matched neighbors like `$BEE_DIR_OTHER`.

### Changed
- Plugin version: 4.0.5 -> 4.0.6
- Marketplace version: 1.4.1 -> 1.4.2

## [4.0.5] - 2026-04-12 -- TDD Applicability Guard

### Changed
- **TDD cycle now skips infrastructure code** — migrations, seeders, factory definitions, config files, route registration, middleware registration, and simple models with no business logic are no longer force-tested. TDD applies only to code with branching logic (controllers, services, policies, form requests, components, hooks, API endpoints). Mixed tasks test only the business logic parts.
- Updated `skills/standards/testing/SKILL.md` with "What NOT to Test" section listing infrastructure anti-patterns
- Updated `agents/implementer.md` with Step 2.6 TDD Applicability Check (evaluate before entering RED-GREEN-REFACTOR)
- Updated `agents/quick-implementer.md` with same Step 2.6 mirrored
- Updated `agents/stacks/laravel-inertia-vue/implementer.md` with Laravel-specific Step 2.6 (Eloquent `$fillable`/`$casts`, `match` expressions, observers, jobs, notifications)
- Plugin version: 4.0.4 -> 4.0.5

## [4.0.0] - 2026-04-09 -- Bee Sentinel: Debug & Recovery Intelligence + Skills Expansion + Command Quality Overhaul

### Added
- **Forensics command** (`/bee:forensics`) -- Read-only workflow diagnostics with 4-factor severity escalation (CRITICAL/HIGH/MEDIUM/LOW), 5-step cross-phase dependency tracing, rollback path generation (1-3 paths, safest-to-aggressive ordering), and forensics-to-debug handoff
- **Debug enhancement** (`/bee:debug`) -- Dynamic 3-7 hypothesis range with 20% auto-pruning, persistent session directories (state.json + report.md), `--resume` flag for interrupted sessions, pattern library with 40% keyword overlap matching for cross-session learning
- **Health intelligence** (`/bee:health`) -- 13 checks (up from 9): added workflow health, code quality trends, productivity metrics, forensic cross-reference. Historical baselining in health-history.json with per-check mode after 5 entries. 3+ consecutive degradation trend detection.
- **Error recovery** in `/bee:execute-phase` -- Failure classification (transient/persistent/architectural), cascading failure detection for Wave 2+ tasks, adaptive retry budgets (unlimited+backoff for transient, 3-attempt for persistent, 1+escalate for architectural), `$RECLASSIFIED_PERSISTENT` flag prevents classification loops
- **Cross-system bridges** -- Forensics-to-debug handoff with pre-populated symptoms, debug pattern library extraction on resolution, forensic cross-reference in health checks
- **Bee Mastery Guide** (`skills/guide/SKILL.md`) -- 205-line workflow intelligence skill with 6 sections: decision tree (spec + phase + multi-phase), command reference by intent (49 commands in 9 groups), smart feature suggestions (IF-THEN proactive rules), 13 anti-patterns, ecosystem model, self-referencing triggers. Dual delivery: compact excerpt at SessionStart + full guide on-demand.
- **Honeycomb statusline** -- New design with `bee` emoji, `hex` hexagons for phase progress, heavy-line context gauge, thin dotted separators
- **Scoped testing for parallel agents** -- Agents run ONLY their task-specific tests; conductor validates full suite + linter + static analysis once per wave (~70% time reduction)
- **Verification evidence** in SubagentStop hooks -- Implementer and quick-implementer agents must include actual test runner output, not just count claims
- **Context isolation docs** in core skill -- Defines what each agent type receives vs must NOT receive, with exceptions for retries and cascading failures
- **23 new commands**: autonomous, backlog, complete-spec, debug, forensics, health, insert-phase, next, note, pause, plan-all, profile, seed, ship, swarm-review, test-gen, thread, ui-review, ui-spec, workspace, audit-spec, do, help
- **7 new agents**: debug-investigator, dependency-auditor, assumptions-analyzer, integration-checker, swarm-consolidator, ui-auditor, testing-auditor
- **Post-wave full validation** (Step 5d.0 in execute-phase) -- Runs full test suite, linter, and static analysis ONCE per wave after all agents complete
- **Model escalation** in execute-phase -- Sonnet agents escalated to opus after 3 failures
- **18 new conditional library/standards skills** -- prisma, drizzle, tailwind-v4, tanstack-query, supabase, stripe, zustand, trpc, shadcn-vue, sentry, storybook, email, s3-storage, auth-patterns, realtime, ci-cd, docker, monorepo, i18n. All load conditionally based on package.json/config detection.
- **Firm rules R8 + R9** -- R8: no completion claims without evidence (paste actual test output). R9: HIGH confidence only for review findings (exact file:line, traceable impact, 5-15 per phase).
- **Async testing patterns** in standards/testing -- promises, timers, waitFor, error rejection, PHP queue fakes, flaky test prevention
- **Severity calibration table** in audit skill -- 7 borderline examples with "3 AM test" heuristic
- **Version-aware queries + result disambiguation** in context7 skill
- **Spec compliance procedure** in review skill -- list ACs by task ID, map to tests, trace code paths
- **Dark mode section** in frontend standards -- semantic tokens, Tailwind v3/v4 guidance

### Changed
- Plugin version: 3.3.0 -> 4.0.0
- Command count: 26 -> 49
- Agent count: 33 -> 39 (36 generic + 3 stack-specific)
- SubagentStop validators: 24 -> 27 (with negative lookbehind patterns for stack-specific agent support)
- Skills: 7 categories -> 22 SKILL.md files across 6 categories
- EOD command uses `bug-detector` and `plan-compliance-reviewer` agents (was `reviewer` and `project-reviewer` which didn't exist)
- EOD report template updated with dynamic Seed Health, Velocity, and Sentinel Status sections
- 5 agent skill references fixed: `testing` -> `standards/testing` (implementer, quick-implementer, test-auditor, test-planner, laravel-inertia-vue/implementer)
- `inject-memory.sh` refactored to `is_bee_agent()` function with suffix matching for stack-specific agents (`*-implementer`, `*-bug-detector`, `*-pattern-reviewer`, `*-stack-reviewer`)
- SubagentStop matchers use negative lookbehind to prevent double-match: `(?<!quick-)implementer$`, `(?<!audit-)bug-detector$`
- `pattern-reviewer$` and `stack-reviewer$` matchers unanchored to support stack-specific variants
- Guide ecosystem model: "7 scripts" -> "8 scripts" (was missing setup-statusline.js)
- Guide command reference: added 8 missing commands (init, update, profile, refresh-context, help, do, create-agent, create-skill)
- Romanian text removed from 6 command templates (review, plan-phase, new-spec, plan-review, review-implementation, audit)
- `autonomous.md` handles REVIEWING status, passes max_review_iterations from config, documents LEARNINGS.md as resume-only
- `ship.md` reads success criteria from ROADMAP.md (was phases.md)
- `seed.md` counts only active seeds toward 20 limit (was counting all including archived)
- `workspace.md` routes conflicted status directly to recovery
- `test.md`, `plan-review.md`, `test-gen.md` use Glob wildcard for phase directory lookup
- Skills count: 22 -> 41 (19 new, all conditional)
- Core skill compressed: rationalizations (12->6), Context7 (28->5), model delegation (10->3). Net -20 lines while adding R8+R9.
- **react-native-expo** major rewrite (300->527): expo-image, Reanimated 3, forms+keyboard, error recovery
- **kmp-compose** expanded: SQLDelight, Coil 3 image loading, Ktor interceptors+retry
- **claude-code-plugin** expanded: hook script patterns, SubagentStop validators, agent context packets
- **nestjs** expanded: Security Hardening (Helmet, CORS, Throttler, csrf-csrf)
- **angular** expanded: NgRx Signal Store example
- **react** expanded: concurrent rendering (startTransition, useDeferredValue)
- **playwright** expanded: accessibility testing (aria snapshots, axe-core), API testing
- **Default implementation mode: premium** -- All commands now default to `"premium"` (opus for everything)
- **Variable standardized:** `$IMPL_MODE` -> `$IMPLEMENTATION_MODE` across all commands
- **`$RESOLVED_MODEL` pattern** applied to plan-phase (8->1 reads), plan-all (5->1), discuss (2->1)
- **EXECUTING status** added to all 5 routing tables for mid-execution crash recovery
- **Swarm Review** added to completion menus of 6 commands
- **Protected agent names** expanded from 23 to 39 in create-agent.md
- **Heredoc commit pattern** in commit.md and quick.md for safe special character handling
- **Smart next-step routing** in commit.md checks if next phase is already planned/executed
- **Coverage map persisted** to TEST-GEN.md (was ephemeral)
- **DISCUSS-CONTEXT.md integration** in plan-all.md planner prompts
- **Predictive warnings** always run in plan-phase even when research_policy=skip

### Fixed
- EOD command referenced non-existent agents (`reviewer`, `project-reviewer`)
- Skill resolution for 5 agents pointed to non-existent `skills/testing/SKILL.md`
- Stack-specific agents not receiving user preferences from inject-memory.sh
- `quick-implementer` triggering `implementer$` SubagentStop hook (incompatible validation format)
- `audit-bug-detector` triggering `bug-detector$` SubagentStop hook (incompatible output format)
- `pre-commit-gate.sh` block paths used stderr + exit 2 (changed to stdout + exit 0)
- `session-end-summary.sh` git diff HEAD~0 when COMMITS=0
- **49 commands quality overhaul** -- all commands reviewed and optimized:
  - new-spec.md: duplicate heading, amend flow nav, spec-writer uses $IMPLEMENTATION_MODE
  - execute-phase.md: $FAILURE_TYPE_COUNTS preserved on crash+resume
  - review.md: $CLEAN_EXIT flag prevents STATE.md double-write on 0 findings
  - commit.md: targeted file staging (was overstaging entire spec tree)
  - complete-spec.md: plugin version bump fallback, ROADMAP.md in audit, memory archival
  - compact.md: CONTEXT.md no longer emitted verbatim pre-compaction
  - workspace.md: status subcommand exempt from nested worktree guard
  - audit-spec.md: dead pattern removed, results persisted to AUDIT-SPEC.md
  - audit.md: `find` replaced with Glob, irrelevant dependency scan removed
  - memory.md: full rewrite with proper frontmatter and AskUserQuestion
  - 15+ commands: R-M-W pattern added/made explicit for STATE.md writes
  - 10+ commands: free-text prompts replaced with AskUserQuestion
  - test-e2e.md, thread.md: STATE.md Last Action updates added
  - do.md: Skill() invocation for command routing

## [3.1.0] - 2026-03-17 -- Audit System & Quality Expansion

### Added
- **Comprehensive code audit system** — `/bee:audit` command orchestrates 9 specialized audit agents in parallel, validates findings to filter hallucinations, and generates a structured report
- **Audit-to-spec bridge** — `/bee:audit-to-spec` converts confirmed audit findings into actionable specs grouped by severity (CRITICAL → individual specs, HIGH → grouped, MEDIUM → cleanup, LOW → consolidated)
- **9 specialized audit agents**: security-auditor (SEC), error-handling-auditor (ERR), database-auditor (DB), architecture-auditor (ARCH), api-auditor (API), frontend-auditor (FE), performance-auditor (PERF), testing-auditor (TEST), audit-bug-detector (BUG)
- **Finding validator** — audit-finding-validator reads actual code to classify findings as CONFIRMED / FALSE POSITIVE / NEEDS CONTEXT, eliminating hallucinations
- **Report generator** — audit-report-generator merges validated findings into `AUDIT-REPORT.md` (human-readable) and `audit-findings.json` (machine-readable for audit-to-spec)
- **Audit skill** — `skills/audit/SKILL.md` defines severity levels, finding format with agent prefixes, validation rules, report template, and spec generation rules
- **11 SubagentStop validators** for all audit agents — enforce finding format, read-only compliance, and summary section presence
- **Context7 integration docs** in `core/SKILL.md` — centralized how-to, when-to-use, fallback behavior, multi-stack usage
- **Comprehensive error recovery** in `/bee:audit` — handles single agent crash, batch failures, validator crash, report generator crash, session loss, Context7 unavailability
- **Code Audit Workflow** documented in plugin README — step-by-step guide for vibecoded project takeover with selective auditing examples
- **3 implementation modes**: economy (sonnet everywhere), quality (sonnet scanning + opus critical), premium (opus everywhere) — replaces 2-mode system across all commands
- **Brainstorming-style discovery** in `/bee:discuss` and `/bee:new-spec` — adaptive questioning with no fixed round limit, one question per message, multiple choice preferred, decomposition check for multi-subsystem features, 2-3 approaches with trade-offs
- **Spec review loop** in `/bee:new-spec` (Step 9.5) — spawns `spec-reviewer` agent after spec-writer, auto-fixes issues, max 5 iterations
- **Auto-fix review loop** in `/bee:plan-phase` (Step 6.4) and `/bee:plan-review` — fixes findings automatically, re-runs 4 agents to verify, configurable max iterations
- **`spec-reviewer` agent** — validates spec completeness, consistency, clarity, YAGNI, scope, architecture
- **`/bee:test-e2e` command** — generate and run Playwright E2E tests with Page Object Model, fixtures, and auto-fix loop
- **Push notifications** — `/bee:init` offers cross-platform notification setup (macOS osascript, Linux notify-send, Windows PowerShell toast) for Stop, Notification, and PermissionRequest events
- **`notify.sh` script** — cross-platform native notification with safe argument passing (no shell injection)
- **Init stack skill validation** (Step 2.5) — warns when detected stack has no matching skill, suggests `/bee:create-skill`
- **Init multi-stack completion summary** — shows all stacks with path and skill status (✓ / ⚠)
- **4 new stack skills**: `vue` (4,146w), `kmp-compose` (2,227w), `angular` (2,416w), `nestjs-rabbitmq` library skill (2,569w)
- **`frontend-standards` skill** enriched with design quality section (typography, color, motion, anti-AI-aesthetics), 250-line component limit, no business logic in visual components, Core Web Vitals
- **`shadcn-ui` library skill** (1,868w) — component patterns, theming, cn() utility, composition, auto-detected when `components.json` exists
- **`playwright` testing skill** (1,624w) — POM, fixtures, selectors, assertions, auth, network mocking
- **TDD discipline enforcement** in core SKILL.md — Iron Law, Watch It Fail, rationalizations table (9 items), red flags list (7 items), anti-patterns (5 items), verification checklist (8 items)
- **Systematic debugging** in `fixer.md` — root cause investigation step (3.5), enhanced test failure protocol with defense-in-depth thinking, architectural escalation after 2 failed attempts
- **Architectural clarity** in `implementer.md` and `quick-implementer.md` — defense-in-depth layers (1-4), condition-based waiting for async, enhanced RED/GREEN/REFACTOR phases
- **CLAUDE.md wiring** in review context packets — all review agents now read project-level CLAUDE.md for overrides
- Auto-detection rules for `vue`, `angular`, `kmp-compose` stacks in init
- `frontend-standards` reference in all 7 frontend stack skills
- Library skill detection chain: stack skill → frontend-standards → shadcn-ui (if installed)

### Changed
- Plugin README updated: 26 commands (from 24), 33 agents (from 22), 24 SubagentStop validators (from 13)
- Core skill updated with Context7 integration section
- **Stack skills extended**: react (2.1k→3.3k), nextjs (2.6k→3.6k), nestjs (2.2k→4.3k), laravel-inertia-react (2.6k→5.2k) — React 19 hooks, Server Actions, state management detection, forms+validation
- **State management** in all stack skills follows "detect what's installed" pattern (Redux, Zustand, TanStack Query, Pinia, NgRx, etc.)
- **Per-stack linter/testRunner** — `linter` and `testRunner` moved from root config into each stack entry (backward compatible with fallback chain). `ci` stays global. Detection, init, scripts, commands, and agents all updated.
- **All hook matchers anchored** with `^name$` — prevents extension agent name collisions
- **Researcher hook** supports dual-mode (phase research + spec/quick research) without false rejection
- **Escalation** uses `finding-validator` with `## Classification` format (not specialist agents) — prevents SubagentStop hook conflicts
- **Review loop** uses separate `$LOOP_ITERATION` counter from cumulative `iteration_counter` — prevents premature exit
- **Finding-validator** respects implementation_mode (economy → sonnet, quality/premium → opus)
- **Execute-phase, review.md, commit.md** use Glob for phase directory lookup (not slug construction)
- **Plan-review** options changed from Approve/Re-review/Modify to Fix(recommended)/Accept-as-is/Fix-manually
- **SubagentStop hook** for plan-compliance-reviewer allows requirements.md checkbox updates
- **SubagentStop hooks** strengthened for implementer and quick-implementer: verify red-green cycle (tests fail before impl, pass after)
- **Discuss-partner hook** uses `Scan complete:` signal for mode detection (not heading presence)
- `inject-memory.sh` strips `bee:` prefix from agent types, removed dead agents (`reviewer`, `project-reviewer`)
- `auto-lint.sh` removed `set -euo pipefail` (prevents hook crash), biome uses `check --write` (format + lint)
- `stop-review-check.sh` awk column comment corrected
- `new-spec.md` amend flow routes through spec review loop
- Config template: removed stale `quick.agents` key (only `quick.fast` remains)
- Init migration summary no longer falsely claims adding `quick.agents`

### Removed
- AI artifact comments from ~46 test files (task IDs, acceptance criteria references)

## [2.1.0] - 2026-03-07

### Added
- `/bee:update` command for updating statusline and cleaning up legacy local copies

### Changed
- Statusline architecture: global-only via `~/.claude/hooks/` (no more local `.bee/statusline.js` copies)
- `setup-statusline.js` now injects plugin version into the global copy
- `bee-statusline.js` uses injectable `BEE_VERSION` constant with fallback to `plugin.json`
- `/bee:init` Step 5 verifies global statusline instead of creating local copies
- `/bee:quick` STATE.md tracking: only the latest quick task is shown (single row, old entries replaced)

### Removed
- Local `.bee/statusline.js` copy (legacy, replaced by global hook)
- Local `.claude/settings.json` statusLine config (global settings handle this)

## [2.0.0] - 2026-03-07 -- Workflow Overhaul

### Added
- 4 specialized review agents replacing single generalist: bug-detector, pattern-reviewer, plan-compliance-reviewer, stack-reviewer
- `/bee:add-phase` command for appending phases to current spec
- `--amend` flag for `/bee:quick` to modify existing quick task plans
- Plan persistence for quick tasks in `.bee/quick/{NNN}-{slug}.md`
- PreToolUse hook for pre-commit validation (linter + test gates)
- Plan review step in `/bee:plan-phase` with 4 parallel review agents
- "Plan Review" column in STATE.md phases table
- `quick.agents` config option (agents mode default for quick tasks)
- Laravel Inertia Vue SKILL.md major enhancement (authorization, dual-response, CRUD patterns)

### Changed
- `/bee:review` -- completely rewritten with 4 parallel specialized agents, finding deduplication, false-positive extraction, iteration tracking ("Yes (N)")
- `/bee:review-project` -- upgraded to 4 parallel specialists
- `/bee:quick-review` -- upgraded to 4 specialized agents
- `/bee:plan-review` -- upgraded to 4 parallel agents
- `/bee:quick` -- agents mode is now default (`--fast` for direct mode), removed `--agents` flag
- finding-validator agent -- added specialist escalation for uncertain findings
- fixer agent -- added Context7 tools
- STATE.md template -- added Quick Tasks section, Plan Review column, iteration tracking
- Statusline -- displays version number, format updated

### Removed
- `reviewer` agent (replaced by 4 specialists)
- `project-reviewer` agent (replaced by 4 specialists)

## [1.5.0] - 2026-03-04

- Version consolidation

## [1.4.0] - 2026-03-03

### Added
- Agent memory system with SubagentStart hook
- Memory archiving across sessions
- LICENSE and initial README files

## [1.3.0] - 2026-03-02

### Added
- `/bee:quick` command for fast tasks without spec pipeline
- `/bee:quick-review` lightweight review command
- Project memory system (`.bee/memory/`)
- `/bee:memory` command to view accumulated memories

## [1.2.0] - 2026-03-01

### Added
- Smart model delegation (sonnet for research/review, opus for implementation)
- Statusline with progress bar
- `/bee:quick-review` command
- `/bee:compact` smart compact command

## [1.1.0] - 2026-02-28

### Added
- Auto-configure statusline via SessionStart hook

## [1.0.0] - 2026-02-27

### Added
- Initial release
- Full spec-driven development pipeline: init, new-spec, plan-phase, execute-phase, review, commit
- 13 specialized agents (implementer, reviewer, researcher, etc.)
- 7 skill categories (core, context7, review, standards, stacks)
- 6 stack support files (Laravel Inertia Vue/React, React, Next.js, NestJS, React Native Expo)
- StatusLine integration with progress tracking
- Plan review command for validating phase plans
