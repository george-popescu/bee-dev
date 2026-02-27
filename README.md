# Bee

Spec-driven development workflow plugin for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

Bee takes a feature idea through a complete, repeatable pipeline: **spec > plan > execute > review > test > commit**. Every step is orchestrated by Claude Code with review gates between phases.

## Install

**Option 1: From GitHub (recommended)**

```bash
# Add the repo as a marketplace source
claude plugin marketplace add https://github.com/george-popescu/bee-dev

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
/bee:quick-review    # Lightweight review for uncommitted changes
```

## Commands

| Command | Description |
|---------|-------------|
| `/bee:init` | Initialize project -- detect stack, create `.bee/` config |
| `/bee:new-spec` | Create feature spec through conversational discovery with structured options. Use `--amend` to modify existing |
| `/bee:plan-phase N` | Plan a phase: task decomposition, research, wave assignment |
| `/bee:execute-phase N` | Execute a planned phase with wave-based parallel TDD |
| `/bee:review` | Review pipeline: code review, validate findings, fix, re-review. Use `--loop` for auto-loop |
| `/bee:test` | Manual testing handoff with scenario generation and fix loop |
| `/bee:commit` | Show diff summary, suggest commit message, require confirmation |
| `/bee:quick` | Fast-track task: describe, execute, commit. Supports `--agents` and `--review` flags |
| `/bee:quick-review` | Lightweight code review for uncommitted changes (no spec required) |
| `/bee:plan-review N` | Review a phase plan (TASKS.md) against the spec before execution |
| `/bee:compact` | Smart compact -- preserve bee context, then compress conversation |
| `/bee:progress` | Show current project state and suggest next action |
| `/bee:resume` | Restore full context after a break |
| `/bee:eod` | End-of-day audit with 4 parallel checks |
| `/bee:review-project` | Full project compliance review against original spec |
| `/bee:parallel-phases` | Execute multiple independent phases simultaneously using agent teams |
| `/bee:parallel-review` | Parallel code review with 4 specialized reviewers using agent teams |

## Workflow

```
/bee:init
    │
/bee:new-spec ─── Research codebase
    │              │
    │         Discovery conversation (AskUserQuestion rounds)
    │              │
    │         requirements.md → spec-writer → spec.md + phases.md
    │
    v
/bee:plan-phase 1 --> /bee:execute-phase 1 --> /bee:review --> /bee:test --> /bee:commit
    │                                                                            │
/bee:plan-phase 2 --> /bee:execute-phase 2 --> /bee:review --> /bee:test --> /bee:commit
    │                                                                            │
   ...                                                                          ...
    │
/bee:review-project  (optional: full spec compliance check)
    │
/bee:eod             (optional: end-of-day audit)
```

Each phase goes through the full pipeline before the next one starts. Review gates ensure quality between steps.

## Supported Stacks

- `laravel-inertia-vue`
- `laravel-inertia-react`
- `react`
- `nextjs`
- `nestjs`
- `react-native-expo`

Stack detection is automatic during `/bee:init` based on `package.json` and `composer.json`.

## Project Structure

After running `/bee:init`, your project gets a `.bee/` directory:

```
your-project/
└── .bee/
    ├── config.json          # Stack, linter, test runner, CI config
    ├── PROJECT.md           # Codebase index (structure, entry points, deps)
    ├── STATE.md             # Current workflow state (phases, progress)
    ├── COMPACT-CONTEXT.md   # Context snapshot for /bee:compact
    ├── specs/
    │   └── feature-name/
    │       ├── requirements.md  # Discovery conversation output
    │       ├── spec.md          # Feature specification
    │       └── phases.md        # Phase breakdown
    ├── quick-reviews/       # Lightweight review reports from /bee:quick-review
    └── eod-reports/         # End-of-day audit reports
```

## How It Works

1. **Spec creation** (`/bee:new-spec`) -- Conversational discovery with structured clickable options: researches codebase, asks multi-round questions, converges on requirements, then writes spec + phases.

2. **Phase planning** (`/bee:plan-phase`) -- Decomposes a phase into tasks, runs research, assigns tasks to parallel execution waves.

3. **Execution** (`/bee:execute-phase`) -- Spawns implementer agents per wave. Each agent follows TDD: write tests first, then implement, then verify.

4. **Review** (`/bee:review`) -- 4-step pipeline: code review against spec + standards, validate findings (filter false positives), auto-fix confirmed issues, optional re-review loop.

5. **Testing** (`/bee:test`) -- Generates manual test scenarios from the spec, presents them for developer verification, routes failures to fixer agent.

6. **Commit** (`/bee:commit`) -- Shows diff summary, suggests conventional commit message, waits for explicit confirmation.

## Smart Model Delegation

Bee optimizes cost and speed by dynamically selecting the model for each agent at spawn time:

- **Sonnet** -- structured work: research, planning, validation, classification, audits
- **Inherit (parent model)** -- production code, deep analysis, interactive sessions

The parent command (conductor) decides the model based on task complexity. Agents don't hardcode their model — the conductor overrides at spawn time.

## Quick Tasks

For small changes that don't need the full pipeline:

```
/bee:quick fix the login button alignment     # Direct execution + commit
/bee:quick --agents add dark mode toggle      # Research + implement with agents
/bee:quick --review update the footer links   # Execute + lightweight review before commit
/bee:quick-review                             # Standalone review of uncommitted changes
```

## Statusline

Bee installs a custom statusline (auto-configured on first session):

```
Opus │ 🐝 ▰▰▱▱▱ P2/5 EXEC │ 3Δ │ ████░░░░░░ 40%
```

Shows: model | implementation progress + active phase + status | git dirty count | context usage.

## Hooks

The plugin includes automatic hooks:

- **SessionStart** -- Loads `.bee/STATE.md` and config; auto-configures statusline
- **PostToolUse** -- Auto-lints after file edits (uses project's configured linter)
- **PreCompact** -- Saves session context before context compression
- **Stop** -- Warns if executed phases haven't been reviewed

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI installed
- A supported project stack (or manual configuration)

## License

MIT
