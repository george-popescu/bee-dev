# Bee

Spec-driven development workflow plugin for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

Bee takes a feature idea through a complete, repeatable pipeline: **spec > plan > execute > review > test > commit**. Every step is orchestrated by Claude Code with review gates between phases. Includes a comprehensive code audit system for analyzing inherited/vibecoded projects, debug & recovery intelligence, fully autonomous pipeline orchestration, and the **Bee Hive live dashboard** — a local web UI for browsing phases, reports, notes, seeds, and workflow state in a readable IDE-style interface.

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
/bee:new-spec        # Conversational discovery -> spec -> phases
/bee:plan-phase 1    # Plan phase 1 with tasks and wave grouping
/bee:execute-phase 1 # Execute with parallel TDD implementation
/bee:review          # 4-step code review pipeline
/bee:test            # Generate test scenarios, verify with developer
/bee:commit          # Guided commit with diff summary
/bee:quick           # Fast-track: describe, execute, commit (no spec needed)
/bee:audit           # Comprehensive 10-agent code audit
/bee:ship            # Autonomous: plan-reviewed phases -> execute + review + commit all
/bee:hive            # Open the live web dashboard at http://localhost:3333
```

## Commands (50)

### Setup & Navigation
| Command | Description |
|---------|-------------|
| `/bee:init` | Initialize project -- detect stack, create `.bee/` config |
| `/bee:progress` | Show current project state and suggest next action |
| `/bee:next` | Auto-suggest the right next command based on state |
| `/bee:resume` | Restore full context after a break |
| `/bee:pause` | Save work-in-progress state for later |
| `/bee:compact` | Smart compact -- preserve bee context, then compress conversation |
| `/bee:profile` | View/edit user profile and preferences |
| `/bee:memory` | View accumulated agent memories for the current project |
| `/bee:refresh-context` | Re-run codebase context extraction, overwriting CONTEXT.md |
| `/bee:update` | Update bee statusline and clean up legacy local copies |
| `/bee:do` | Natural language intent router -- type what you want, get the right command |
| `/bee:help` | Full command reference and usage guide |

### Specification
| Command | Description |
|---------|-------------|
| `/bee:new-spec` | Create feature spec through conversational discovery. `--amend` to modify, `--from-discussion` to use discussion notes |
| `/bee:discuss` | Guided brainstorming-style codebase-grounded discussion before creating a spec |
| `/bee:plan-phase N` | Plan a phase: task decomposition, research, wave assignment + auto-fix review loop |
| `/bee:plan-review` | Review a phase plan (TASKS.md) against the spec before execution |
| `/bee:plan-all` | Plan all remaining phases sequentially with cross-plan consistency review |
| `/bee:add-phase` | Append a new phase to the current spec |
| `/bee:insert-phase N.1` | Insert an urgent phase mid-spec (decimal numbering) |
| `/bee:ui-spec` | Generate a UI design contract for frontend phases |

### Execution
| Command | Description |
|---------|-------------|
| `/bee:execute-phase N` | Execute a planned phase with wave-based parallel TDD agents |
| `/bee:quick` | Fast-track task. `--fast` for direct mode, `--amend N` to modify existing, `--review` for post-review |
| `/bee:autonomous` | Fully autonomous pipeline: plan + execute + review per phase, no user interaction |
| `/bee:ship` | Execute all plan-reviewed phases: execute + review loop + commit. Resumable. |
| `/bee:workspace new` | Parallel worktrees for independent features |

### Quality
| Command | Description |
|---------|-------------|
| `/bee:review` | Multi-agent parallel review (4 specialists) with finding validation, escalation, and auto-fix. `--loop` for auto-loop |
| `/bee:swarm-review` | Deep multi-agent review with segmented parallel execution |
| `/bee:review-implementation` | Cross-phase compliance review -- full spec mode or ad-hoc mode |
| `/bee:fix-implementation` | Standalone fix -- reads review output and fixes confirmed findings |
| `/bee:ui-review` | 6-pillar visual/UI audit |

### Testing
| Command | Description |
|---------|-------------|
| `/bee:test` | Generate manual test scenarios and verify with developer |
| `/bee:test-gen` | Requirement-driven test generation from acceptance criteria |
| `/bee:test-e2e` | Generate and run Playwright E2E tests with Page Object Model |

### Audit
| Command | Description |
|---------|-------------|
| `/bee:audit` | Comprehensive 10-agent code audit with finding validation and structured report. `--only security,database` for selective |
| `/bee:audit-to-spec` | Convert audit findings into actionable specs by severity. `--critical` for critical only, `--dry-run` to preview |
| `/bee:audit-spec` | Spec traceability matrix -- verify all requirements are covered |

### Debug & Recovery
| Command | Description |
|---------|-------------|
| `/bee:debug` | Systematic bug investigation with hypothesis tracking, session persistence, and `--resume` support |
| `/bee:forensics` | Read-only workflow forensics with severity scoring, dependency tracing, and rollback paths |
| `/bee:health` | 13-check project health diagnostics with historical baselining and trend detection |

### Session & Ideas
| Command | Description |
|---------|-------------|
| `/bee:commit` | Show diff summary, suggest commit message, require confirmation |
| `/bee:complete-spec` | Full spec completion ceremony (audit + changelog + tag + archive) |
| `/bee:archive-spec` | Quick archive without ceremony |
| `/bee:eod` | End-of-day integrity check with 4 parallel audits + velocity + sentinel status |
| `/bee:seed` | Capture an idea for later with trigger conditions |
| `/bee:backlog` | Manage the seed backlog (review, promote, archive) |
| `/bee:note` | Zero-friction note capture |
| `/bee:thread` | Cross-session knowledge persistence |

### Visualization
| Command | Description |
|---------|-------------|
| `/bee:hive` | Start or stop the Bee Hive dashboard server and open it in the browser. `stop` subcommand to shut down |

### Extensibility
| Command | Description |
|---------|-------------|
| `/bee:create-agent` | Create a custom project-local agent extension |
| `/bee:create-skill` | Create a custom project-local skill extension |

## Workflows

### Full Feature Workflow
```
/bee:init -> /bee:new-spec -> /bee:plan-phase 1 -> /bee:execute-phase 1 -> /bee:review -> /bee:test -> /bee:commit
                                                      | repeat for each phase |
                              /bee:review-implementation -> /bee:complete-spec -> /bee:eod
```

### Autonomous Workflow
```
/bee:init -> /bee:new-spec -> /bee:plan-all -> /bee:ship     # Fully autonomous pipeline
/bee:init -> /bee:new-spec -> /bee:autonomous                # Plan + execute + review per phase
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
/bee:init -> /bee:audit -> /bee:audit-to-spec -> /bee:new-spec (per spec) -> standard pipeline
```

### Debug Workflow
```
/bee:forensics -> /bee:debug          # Read-only diagnosis -> systematic investigation
/bee:debug --resume {session}         # Resume interrupted debug session
/bee:health                           # 13-check project health with trend detection
```

## Agents (42)

| Category | Count | Agents |
|----------|-------|--------|
| Implementation | 3 | implementer, quick-implementer, fixer |
| Planning | 4 | researcher, phase-planner, spec-writer, spec-shaper |
| Review | 8 | bug-detector, pattern-reviewer, plan-compliance-reviewer, stack-reviewer, finding-validator, plan-reviewer, spec-reviewer, swarm-consolidator |
| Audit | 7 | security-auditor, error-handling-auditor, database-auditor, architecture-auditor, api-auditor, frontend-auditor, performance-auditor |
| Audit Support | 3 | audit-bug-detector, audit-finding-validator, audit-report-generator |
| Debug & Health | 3 | debug-investigator, integrity-auditor, testing-auditor |
| Specialized | 5 | context-builder, discuss-partner, test-auditor, test-planner, ui-auditor |
| Infrastructure | 4 | assumptions-analyzer, dependency-auditor, integration-checker |
| Stack-Specific | 3 | laravel-inertia-vue-implementer, laravel-inertia-vue-bug-detector, laravel-inertia-vue-pattern-reviewer |

## Skills (45)

| Category | Skills |
|----------|--------|
| Core | core (TDD, disk-is-truth, firm rules R1-R9), guide (workflow intelligence) |
| Quality | audit (finding format, severity calibration), review (quality rules, spec compliance), context7 (live docs, version-aware) |
| Standards (10) | global, frontend, backend, testing, auth, realtime, ci-cd, docker, monorepo, i18n |
| Stacks (10) | laravel-inertia-vue, laravel-inertia-react, nestjs, vue, nextjs, react, angular, react-native-expo, kmp-compose, claude-code-plugin |
| Libraries (14) | prisma, drizzle, tailwind-v4, tanstack-query, supabase, stripe, zustand, trpc, shadcn-ui, shadcn-vue, nestjs-rabbitmq, sentry, storybook, email, s3-storage |
| Testing | playwright (a11y, API testing, POM) |

All library skills load conditionally based on `package.json` detection. Zero overhead when not used.

## Supported Stacks (10)

- `laravel-inertia-vue` (gold standard -- 3 stack-specific agents)
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
+-- .bee/
    +-- config.json          # Stack, linter, test runner, CI config
    +-- PROJECT.md           # Codebase index (structure, entry points, deps)
    +-- CONTEXT.md           # Extracted codebase patterns (from context-builder)
    +-- STATE.md             # Current workflow state (phases, progress, decisions)
    +-- user.md              # User preferences and work style rules
    +-- COMPACT-CONTEXT.md   # Context snapshot for /bee:compact
    +-- AUDIT-REPORT.md      # Latest audit report (from /bee:audit)
    +-- audit-findings.json  # Machine-readable findings (for /bee:audit-to-spec)
    +-- specs/               # Feature specs
    +-- audit-specs/         # Spec descriptions generated from audit findings
    +-- quick/               # Persisted quick task plans
    +-- reviews/             # Review reports from /bee:review-implementation
    +-- eod-reports/         # End-of-day audit reports
    +-- seeds/               # Deferred ideas with trigger conditions
    +-- debug/               # Debug sessions (state.json + report.md)
    +-- metrics/             # Phase metrics and health history
    +-- forensics/           # Forensic reports
    +-- discussions/         # Discussion notes from /bee:discuss
    +-- notes/               # Quick notes from /bee:note
    +-- threads/             # Cross-session knowledge
    +-- false-positives.md   # Review findings marked as false positives
    +-- LEARNINGS.md         # Phase learnings for implementer adjustments
```

## How It Works

1. **Spec creation** (`/bee:new-spec`) -- Structured developer interview (adaptive rounds): researches codebase first, then converges on requirements and writes spec + phases.

2. **Phase planning** (`/bee:plan-phase`) -- Decomposes a phase into tasks, runs research, assigns to parallel waves. Auto-reviews plan with 4 agents before proceeding.

3. **Execution** (`/bee:execute-phase`) -- Spawns implementer agents per wave. Each follows TDD: write tests first, then implement, then verify. Post-wave validation runs full suite + linter + static analysis once. Adaptive error recovery classifies failures and retries intelligently.

4. **Review** (`/bee:review`) -- 4 specialized agents review in parallel (bug-detector, pattern-reviewer, plan-compliance-reviewer, stack-reviewer), findings validated with specialist escalation, auto-fixed, optionally re-reviewed.

5. **Testing** (`/bee:test`) -- Generates manual test scenarios, presents for verification, routes failures to fixer agent.

6. **Commit** (`/bee:commit`) -- Shows diff summary, suggests conventional commit message, waits for confirmation.

7. **Audit** (`/bee:audit`) -- 10 specialized agents scan the entire codebase in parallel (security, errors, database, architecture, API, frontend, performance, testing, end-to-end flows, dependencies). Findings validated to filter hallucinations. Report generated with severity grouping.

8. **Debug** (`/bee:debug`) -- Hypothesis-driven investigation with 3-7 dynamic hypotheses, auto-pruning, session persistence, pattern library for cross-session learning.

9. **Forensics** (`/bee:forensics`) -- Read-only workflow diagnostics with 4-factor severity escalation, cross-phase dependency tracing, rollback path generation, and handoff to debug.

## Implementation Modes

Three modes control cost and speed via model selection:

| Mode | Scanning agents | Critical agents |
|------|----------------|-----------------|
| **Economy** | sonnet | sonnet |
| **Quality** (default) | sonnet | opus |
| **Premium** | opus | opus |

Set via `config.implementation_mode` in `.bee/config.json`.

## Hooks (11 events, 42 validators)

- **SessionStart** -- Load project context + configure honeycomb statusline
- **PostToolUse** -- Auto-lint after file edits
- **PreToolUse** -- Pre-commit validation gate (linter + tests)
- **PreCompact** -- Save session context before compression
- **SubagentStart** -- Inject user preferences into subagent context (covers all 39 agents including stack-specific variants)
- **SubagentStop** -- 27 role-specific output validators (TDD compliance, verification evidence, finding format, read-only enforcement)
- **Stop** -- Warn about unreviewed phases
- **SessionEnd** -- Session metrics summary

## Statusline

```
Opus bee 4.0 | hexhexhex P2/5 EXEC | gauge 40% | d3
```

Shows: model + bee version | honeycomb phase progress + status | context gauge | git dirty.

## Bee Hive Dashboard

A local web dashboard for browsing your `.bee/` workflow state in a readable IDE-style interface. Perfect for reading phase plans, reviewing generated reports, or navigating notes and seeds without cat/less gymnastics in the terminal.

```
/bee:hive          # Start the server and open the browser (default: http://localhost:3333)
/bee:hive stop     # Stop the server
```

**What you get:**

- **3-column IDE layout** — Left sidebar file tree, main content area with tabs, right sidebar live activity feed. Both sidebars collapsible via header toggles.
- **File tree navigation** — Browse phases, notes, seeds, quick tasks, discussions, forensics, debug sessions, and archived specs. Section counts + status badges per entry.
- **Tab system with markdown viewer** — Click any file to open it in a tab. Markdown rendered with hive-themed headings, code blocks, tables, and links. JSON/YAML files shown as plain text. Overview tab is pinned and always accessible.
- **Phase detail view** — Click a phase to see a rich view with workflow progress chain (plan → review → execute → test → commit), description, goal, deliverables, success criteria, requirements, and dependencies — cross-referenced from `state.phases` + `spec.phases` + `roadmap.phaseMapping`.
- **Roadmap timeline** — Header button opens a roadmap tab with a vertical phase timeline. Click any phase card to jump to its detail view.
- **Split pane** — Click the split button on any tab to pop it into a second column for side-by-side viewing (e.g., compare a phase's PLAN.md and REVIEW.md).
- **Keyboard shortcuts** — `[`/`]` for prev/next tab, `\` to toggle split, `Escape` to close split or active tab. All gated on "no input focused" so typing into search boxes is safe.
- **Persistent state** — Open tabs, active tab, sidebar collapse state, and expanded sections all persist across reloads via localStorage.
- **Live snapshot polling** — Activity feed detects new files, phase status changes, and metric updates every 5 seconds with graceful degradation on network errors.
- **Config editing** — The Config panel in the Overview has inline toggles for `review.against_spec`, `review.against_standards`, `review.dead_code`, `ship.final_review`, `ship.max_review_iterations`, and `implementation_mode`. Changes POST to `/api/config` and persist to `.bee/config.json`.

**When to use it:**

- Reading long phase plans (TASKS.md, PLAN.md) or review reports (REVIEW.md) — much nicer than terminal
- Browsing the seed backlog or note collection without scrolling through directories
- Showing a colleague "what did Bee do for this feature" without SSH-ing into the repo
- Inspecting the roadmap and phase status at a glance
- Comparing files side-by-side via split pane

**When to skip it:**

- Single-file edits or quick grep tasks — the terminal is faster
- Running Bee commands — always done via the Claude Code CLI, not the dashboard
- When you're in a `/bee:autonomous` or `/bee:ship` flow and don't need the distraction

The server is a zero-dependency Node.js HTTP server under `plugins/bee/scripts/hive-server.js`. It binds `127.0.0.1` only (no remote exposure) and shuts down automatically when the Claude Code session that started it exits (owner PID monitoring).

## Scoped Testing

Parallel implementer agents run ONLY their task-specific tests. After each wave, the conductor runs **scoped post-wave validation** — only tests affected by the wave's changed files (vitest/jest native `--findRelatedTests`; pest/phpunit/pytest filename heuristic with composer.json psr-4 source-root detection). Configurable via `phases.post_wave_validation: "auto" | "full" | "scoped" | "skip"` (default `auto`). A mandatory full-suite pass runs at phase end before the phase is marked EXECUTED — catches anything the heuristic missed.

## Agent Teams (experimental)

Bee can spawn peer-to-peer Claude Code Agent Teams instead of subagents for cross-layer review, scientific-debate debugging, cross-stack architectural planning, and audit domain split. Requires Claude Code v2.1.32+ and the `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` env var. Bee auto-decides per-command via a 5-axis weighted scorer (hypothesis breadth, cross-layer coverage, independence, uncertainty, stakes); cost ceiling is adaptive per `implementation_mode` (2.4M tokens premium / 1.2M quality / 600K economy). One team per autonomous run is enforced via marker files. `/bee:init` and `/bee:update` detect availability and prompt opt-in. See `skills/agent-teams/`, `skills/team-decisions/`, `skills/team-templates/`.

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI installed
- A supported project stack (or manual configuration)

## License

MIT
