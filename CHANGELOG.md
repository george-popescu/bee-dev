# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
