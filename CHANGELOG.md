# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [4.1.0] - 2026-04-10 -- Skills Expansion & Quality Optimization

### Added
- **18 new conditional library/standards skills** -- prisma, drizzle, tailwind-v4, tanstack-query, supabase, stripe, zustand, trpc, shadcn-vue, sentry, storybook, email, s3-storage, auth-patterns, realtime, ci-cd, docker, monorepo, i18n. All load conditionally based on package.json/config detection.
- **Firm rules R8 + R9** -- R8: no completion claims without evidence (paste actual test output). R9: HIGH confidence only for review findings (exact file:line, traceable impact, 5-15 per phase).
- **Async testing patterns** in standards/testing -- promises, timers, waitFor, error rejection, PHP queue fakes, flaky test prevention (86 lines)
- **Severity calibration table** in audit skill -- 7 borderline examples with "3 AM test" heuristic
- **Version-aware queries + result disambiguation** in context7 skill
- **Spec compliance procedure** in review skill -- list ACs by task ID, map to tests, trace code paths
- **FP staleness check** in review skill -- verify code unchanged before excluding false positives
- **Dark mode section** in frontend standards -- semantic tokens, Tailwind v3/v4 guidance
- **400 vs 422 clarification** in backend standards

### Changed
- Skills count: 22 -> 41 (19 new, all conditional)
- Core skill compressed: rationalizations table (12 -> 6 lines), Context7 section (28 -> 5 lines), model delegation (10 -> 3 lines). Net -20 lines while adding R8+R9.
- **react-native-expo** major rewrite (300 -> 527): expo-image, Reanimated 3, forms+keyboard, error recovery, SDK upgrade pattern
- **kmp-compose** expanded: SQLDelight (setup+driver+queries), Coil 3 image loading, Ktor interceptors+retry
- **claude-code-plugin** expanded: hook script patterns, SubagentStop validators, agent context packets, test patterns
- **laravel-inertia-react** expanded: DataTable with TanStack Table (columns, row actions, server pagination)
- **nestjs** expanded: Security Hardening (Helmet, CORS, Throttler, csrf-csrf, structured logging)
- **angular** expanded: NgRx Signal Store example (signalStore, withState, withComputed, withMethods)
- **react** expanded: concurrent rendering (startTransition, useDeferredValue, memoization guide)
- **nextjs** expanded: enhanced Image section (static, remote, fill, priority, blur, sizes)
- **playwright** expanded: accessibility testing (aria snapshots, axe-core), API testing, debugging
- **nestjs-rabbitmq** expanded: connection management, reconnection, RPC timeouts, competing consumers
- **shadcn-ui** and **shadcn-vue**: hardcoded colors in variant examples replaced with semantic tokens

## [4.0.0] - 2026-04-09 -- Bee Sentinel: Debug & Recovery Intelligence

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

### Fixed
- EOD command referenced non-existent agents (`reviewer`, `project-reviewer`)
- Skill resolution for 5 agents pointed to non-existent `skills/testing/SKILL.md`
- Stack-specific agents not receiving user preferences from inject-memory.sh
- `quick-implementer` triggering `implementer$` SubagentStop hook (incompatible validation format)
- `audit-bug-detector` triggering `bug-detector$` SubagentStop hook (incompatible output format)
- `pre-commit-gate.sh` block paths used stderr + exit 2 (changed to stdout + exit 0)
- `session-end-summary.sh` git diff HEAD~0 when COMMITS=0

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
