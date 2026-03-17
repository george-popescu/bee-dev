# Bee

Spec-driven development workflow plugin for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

Bee takes a feature idea through a complete, repeatable pipeline: **spec > plan > execute > review > test > commit**. Every step is orchestrated by Claude Code with review gates between phases. Includes a comprehensive code audit system for analyzing inherited/vibecoded projects.

## Install

**Option 1: From GitHub (recommended)**

```bash
# Add the repo as a marketplace source
claude plugin marketplace add https://github.com/BEE-CODED/bee-dev

# Install the plugin
claude plugin install bee
```

**Option 2: Local path (for development)**

```bash
# Use --plugin-dir flag pointing to the plugin inside the repo
claude --plugin-dir /path/to/bee-dev/plugins/bee
```

## Quick Start

```
/bee:init            # Detect stack, create .bee/ config
/bee:new-spec        # Conversational discovery → spec → phases
/bee:plan-phase 1    # Plan phase 1 with tasks and wave grouping
/bee:execute-phase 1 # Execute with parallel TDD implementation
/bee:review          # 4-step code review pipeline
/bee:test            # Generate test scenarios, verify with developer
/bee:commit          # Guided commit with diff summary
/bee:quick           # Fast-track: describe, execute, commit (no spec needed)
/bee:audit           # Comprehensive 9-agent code audit (great for inherited projects)
```

## Commands (26)

### Setup & Navigation
| Command | Description |
|---------|-------------|
| `/bee:init` | Initialize project -- detect stack, create `.bee/` config |
| `/bee:progress` | Show current project state and suggest next action |
| `/bee:resume` | Restore full context after a break |
| `/bee:compact` | Smart compact -- preserve bee context, then compress conversation |
| `/bee:memory` | View accumulated agent memories for the current project |
| `/bee:refresh-context` | Re-run codebase context extraction, overwriting CONTEXT.md |
| `/bee:create-agent` | Create a custom project-local agent extension |
| `/bee:create-skill` | Create a custom project-local skill extension |
| `/bee:update` | Update bee statusline and clean up legacy local copies |

### Specification
| Command | Description |
|---------|-------------|
| `/bee:new-spec` | Create feature spec through conversational discovery. `--amend` to modify, `--from-discussion` to use discussion notes |
| `/bee:plan-phase N` | Plan a phase: task decomposition, research, wave assignment + auto-fix review loop |
| `/bee:plan-review N` | Review a phase plan (TASKS.md) against the spec before execution |
| `/bee:add-phase` | Append a new phase to the current spec |
| `/bee:discuss` | Guided brainstorming-style codebase-grounded discussion before creating a spec |

### Execution
| Command | Description |
|---------|-------------|
| `/bee:execute-phase N` | Execute a planned phase with wave-based parallel TDD agents |
| `/bee:quick` | Fast-track task. `--fast` for direct mode, `--amend N` to modify existing, `--review` for post-review |

### Quality
| Command | Description |
|---------|-------------|
| `/bee:review` | Multi-agent parallel review (4 specialists) with finding validation, escalation, and auto-fix. `--loop` for auto-loop |
| `/bee:review-implementation` | Context-aware review -- full spec mode (4 agents per stack) or ad-hoc mode (3 agents) |
| `/bee:fix-implementation` | Standalone fix -- reads review output and fixes confirmed findings sequentially |
| `/bee:test` | Generate manual test scenarios and verify with developer |
| `/bee:test-e2e` | Generate and run Playwright E2E tests with Page Object Model |

### Audit
| Command | Description |
|---------|-------------|
| `/bee:audit` | Comprehensive 9-agent code audit with finding validation and structured report. `--only security,database` for selective |
| `/bee:audit-to-spec` | Convert audit findings into actionable specs by severity. `--critical` for critical only, `--dry-run` to preview |

### Finalization
| Command | Description |
|---------|-------------|
| `/bee:commit` | Show diff summary, suggest commit message, require confirmation |
| `/bee:archive-spec` | Archive completed spec, reset STATE.md, bump plugin version |
| `/bee:eod` | End-of-day integrity check with 4 parallel audits |

## Workflows

### Full Feature Workflow
```
/bee:init → /bee:new-spec → /bee:plan-phase 1 → /bee:execute-phase 1 → /bee:review → /bee:test → /bee:commit
                                                    ↑ repeat for each phase ↓
                            /bee:review-implementation → /bee:archive-spec → /bee:eod
```

### Quick Task Workflow
```
/bee:quick fix the login button alignment     # Agents mode (default): research + implement
/bee:quick --fast fix the button color        # Direct execution, no agents
/bee:quick --amend 3                          # Modify existing quick task plan #3
/bee:quick --review update the footer links   # Execute + review before commit
```

### Code Audit Workflow (Vibecoded Project Takeover)
```
/bee:init → /bee:audit → /bee:audit-to-spec → /bee:new (per spec) → standard pipeline
```

## Agents (33)

11 core agents, 5 review agents, 11 audit agents, 3 EOD agents, 3 stack-specific agents. See `plugins/bee/README.md` for full details.

## Supported Stacks (10)

- `laravel-inertia-vue` (gold standard — 3 stack-specific agents)
- `laravel-inertia-react`
- `nestjs`
- `vue`
- `nextjs`
- `react`
- `angular`
- `react-native-expo`
- `kmp-compose`
- `claude-code-plugin`

Stack detection is automatic during `/bee:init` based on `package.json`, `composer.json`, and `build.gradle.kts`.

## Project Structure

After running `/bee:init`, your project gets a `.bee/` directory:

```
your-project/
└── .bee/
    ├── config.json          # Stack, linter, test runner, CI config
    ├── PROJECT.md           # Codebase index (structure, entry points, deps)
    ├── CONTEXT.md           # Extracted codebase patterns (from context-builder)
    ├── STATE.md             # Current workflow state (phases, progress, audit history)
    ├── COMPACT-CONTEXT.md   # Context snapshot for /bee:compact
    ├── AUDIT-REPORT.md      # Latest audit report (from /bee:audit)
    ├── audit-findings.json  # Machine-readable findings (for /bee:audit-to-spec)
    ├── specs/               # Feature specs
    ├── audit-specs/         # Spec descriptions generated from audit findings
    ├── quick/               # Persisted quick task plans
    ├── memory/              # Agent memory (shared.md + per-agent .md files)
    ├── reviews/             # Review reports from /bee:review-implementation
    └── eod-reports/         # End-of-day audit reports
```

## How It Works

1. **Spec creation** (`/bee:new-spec`) — Structured developer interview (2-5 adaptive rounds): researches codebase first, then converges on requirements and writes spec + phases.

2. **Phase planning** (`/bee:plan-phase`) — Decomposes a phase into tasks, runs research, assigns to parallel waves. Auto-reviews plan with 4 agents before proceeding.

3. **Execution** (`/bee:execute-phase`) — Spawns implementer agents per wave. Each follows TDD: write tests first, then implement, then verify.

4. **Review** (`/bee:review`) — 4 specialized agents review in parallel (bug-detector, pattern-reviewer, plan-compliance-reviewer, stack-reviewer), findings validated with specialist escalation, auto-fixed, optionally re-reviewed.

5. **Testing** (`/bee:test`) — Generates manual test scenarios, presents for verification, routes failures to fixer agent.

6. **Commit** (`/bee:commit`) — Shows diff summary, suggests conventional commit message, waits for confirmation.

7. **Audit** (`/bee:audit`) — 9 specialized agents scan the entire codebase in parallel (security, errors, database, architecture, API, frontend, performance, testing, end-to-end flows). Findings validated to filter hallucinations. Report generated with severity grouping and actionable recommendations.

## Implementation Modes

Three modes control cost and speed via model selection:

| Mode | Scanning agents | Critical agents |
|------|----------------|-----------------|
| **Economy** | sonnet | sonnet |
| **Quality** (default) | sonnet | opus |
| **Premium** | opus | opus |

Set via `config.implementation_mode` in `.bee/config.json`.

## Hooks (8 events, 24 validators)

- **SessionStart** — Load project context + configure statusline
- **PostToolUse** — Auto-lint after file edits
- **PreToolUse** — Pre-commit validation gate (linter + tests)
- **PreCompact** — Save session context before compression
- **SubagentStart** — Inject agent memory into subagent context
- **SubagentStop** — 24 role-specific output validators (TDD compliance, finding format, read-only enforcement)
- **Stop** — Warn about unreviewed phases
- **SessionEnd** — Memory file limit warnings

## Statusline

```
Opus | v3.1.0 | 🐝 ▰▰▱▱▱ P2/5 EXEC | 3Δ | ████░░░░░░ 40%
```

Shows: model | bee version | phase progress + status | git dirty count | context usage.

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI installed
- A supported project stack (or manual configuration)

## License

MIT
