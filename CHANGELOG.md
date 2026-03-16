# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [3.1.0] - 2026-03-16 -- Quality & Stack Expansion

### Added
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
- **Stack skills extended**: react (2.1k→3.3k), nextjs (2.6k→3.6k), nestjs (2.2k→4.3k), laravel-inertia-react (2.6k→5.2k) — React 19 hooks, Server Actions, state management detection, forms+validation
- **State management** in all stack skills follows "detect what's installed" pattern (Redux, Zustand, TanStack Query, Pinia, NgRx, etc.)
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
