# Changelog

All notable changes to the Bee plugin are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [3.1.0] - 2026-03-17

### Added

- **Comprehensive code audit system** — `/bee:audit` command orchestrates 9 specialized audit agents in parallel, validates findings to filter hallucinations, and generates a structured report
- **Audit-to-spec bridge** — `/bee:audit-to-spec` converts confirmed audit findings into actionable specs grouped by severity (CRITICAL → individual specs, HIGH → grouped, MEDIUM → cleanup, LOW → consolidated)
- **8 specialized audit agents** — security-auditor (SEC), error-handling-auditor (ERR), database-auditor (DB), architecture-auditor (ARCH), api-auditor (API), frontend-auditor (FE), performance-auditor (PERF), testing-auditor (TEST)
- **End-to-end bug detector** — audit-bug-detector (BUG) traces complete feature flows from UI to DB, finds cross-layer bugs that category-specific auditors miss
- **Finding validator** — audit-finding-validator reads actual code to classify findings as CONFIRMED / FALSE POSITIVE / NEEDS CONTEXT, eliminating hallucinations
- **Report generator** — audit-report-generator merges validated findings into `AUDIT-REPORT.md` (human-readable) and `audit-findings.json` (machine-readable for audit-to-spec)
- **Audit skill** — `skills/audit/SKILL.md` defines severity levels, finding format with agent prefixes, validation rules, report template, and spec generation rules
- **11 SubagentStop validators** for all new audit agents — enforce finding format, read-only compliance, and summary section presence
- **Context7 integration docs** in `core/SKILL.md` — centralized how-to, when-to-use, fallback behavior, multi-stack usage
- **Comprehensive error recovery** in `/bee:audit` — handles single agent crash, batch failures, validator crash, report generator crash, session loss, Context7 unavailability
- **Code Audit Workflow** documented in plugin README — step-by-step guide for vibecoded project takeover with selective auditing examples

### Changed

- Plugin README updated: 26 commands (from 24), 33 agents (from 22), 24 SubagentStop validators (from 13)
- Core skill updated with Context7 integration section
- SubagentStop validator count in README corrected to 24

## [3.0.0] - 2025-03-14

### Added

- **Implementation modes** — economy/quality/premium model tier delegation system (`config.implementation_mode`)
- **Multi-stack support** — projects can declare multiple stacks with path scoping in `config.stacks[]`
- **4 new commands** — `discuss`, `review-implementation`, `fix-implementation`, `archive-spec`, `test-e2e`, `refresh-context`, `create-agent`, `create-skill`
- **4 new agents** — quick-implementer, spec-reviewer, discuss-partner, context-builder
- **4 new stack skills** — vue, angular, kmp-compose, claude-code-plugin
- **3 library skills** — shadcn-ui, nestjs-rabbitmq, playwright (auto-detected)
- **CONTEXT.md system** — context-builder agent extracts codebase patterns via `/bee:refresh-context`
- **Extensibility** — `/bee:create-agent` and `/bee:create-skill` for project-local extensions
- **Stack-specific agent overrides** — `agents/stacks/{stack}/` directory for framework-deep agents (laravel-inertia-vue ships with 3)
- **13 SubagentStop validators** with role-specific output validation
- **Native OS notifications** — macOS (osascript), Linux (notify-send), Windows (PowerShell toast)
- **Agent memory system** — persistent per-project memory in `.bee/memory/` with SubagentStart injection
- **Spec review loop** — spec-reviewer validates specs before planning begins
- **Plan review auto-fix loop** — plan-reviewer findings trigger automatic fixes and re-review
- **Finding validator with specialist escalation** — MEDIUM confidence findings escalated back to source agent
- **Wave-based parallel execution** — tasks grouped into dependency waves for parallel TDD implementation
- **Smart compact** — `/bee:compact` preserves bee context before conversation compression
- **Statusline** — custom statusline showing model, version, phase progress, git state, context usage

### Changed

- Full architecture rewrite from v2
- Config format: `.stack` (string) → `.stacks[]` (array with name, path, linter, testRunner)
- Review pipeline: single-pass → 4-agent parallel review with validation and auto-fix
- Spec creation: template-based → adaptive discovery conversation with AskUserQuestion
- Phase planning: manual → 3-pass automated (decompose → research → waves) with review loop
- Agent system: direct invocation → conductor model delegation with `model: inherit`

### Removed

- Legacy single-stack config (backward compatibility maintained via fallback)
- Manual spec template filling (replaced by spec-writer agent)
- Single-reviewer system (replaced by 4 specialist reviewers)

## [2.1.0] - 2025-02-28

### Added

- Persistent agent memory system (`.bee/memory/`)
- SubagentStart hook for memory injection
- EOD command with integrity audit and test audit
- Pre-commit validation gate (PreToolUse hook)
- Auto-lint on file edits (PostToolUse hook)

### Changed

- Review system upgraded to multi-agent (bug-detector + pattern-reviewer + stack-reviewer)
- Finding validation added as post-review step

## [2.0.0] - 2025-02-15

### Added

- Multi-agent review pipeline
- Stack skills for laravel-inertia-vue, laravel-inertia-react, nestjs, react, nextjs, react-native-expo
- Phase-based execution with TASKS.md contracts
- Quick task workflow (`/bee:quick`)
- TDD enforcement in core skill

### Changed

- Full rewrite from v1
- Moved from single-file specs to directory-based spec structure

## [1.0.0] - 2025-01-20

### Added

- Initial release
- Basic spec-driven workflow: init → spec → execute → commit
- Single-stack support (laravel-inertia-vue)
- Basic code review (single reviewer agent)
- STATE.md tracking
