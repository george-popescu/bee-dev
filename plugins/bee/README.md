# Bee - Spec-Driven Development Workflow

A Claude Code plugin that enforces disciplined, spec-driven development with TDD, parallel agent execution, persistent agent memory, review gates, and autonomous autopilot mode.

## What Bee Does

Bee structures your development workflow into a lifecycle: **Spec > Plan > Execute > Review > Test > Commit**. Each step produces artifacts on disk, every feature goes through review gates, and 13 specialized agents handle different aspects of the work.

## Commands (19)

### Setup & Navigation
| Command | Args | Description |
|---------|------|-------------|
| `/bee:init` | | Initialize Bee for a project -- detect stack, create `.bee/`, configure workflow |
| `/bee:progress` | | Show project state, phase progress, and suggest next action |
| `/bee:resume` | | Resume work from previous session with full context restoration |
| `/bee:compact` | | Smart compact -- preserve bee context, then compress conversation |
| `/bee:memory` | | View accumulated agent memories for the current project |

### Specification
| Command | Args | Description |
|---------|------|-------------|
| `/bee:new-spec` | `[--amend] [feature description]` | Create or amend a feature spec through conversational discovery |
| `/bee:plan-phase` | `[phase-number]` | Plan a phase with tasks, acceptance criteria, research, and wave grouping |
| `/bee:plan-review` | `[phase-number]` | Review plan coverage against spec -- find gaps and discrepancies |

### Execution
| Command | Args | Description |
|---------|------|-------------|
| `/bee:execute-phase` | `[phase-number]` | Execute a phase with wave-based parallel TDD agents |
| `/bee:parallel-phases` | `[phase-numbers]` | Execute independent phases simultaneously using agent teams |
| `/bee:autopilot` | | Run all spec phases automatically -- plan, execute, review loop with auto-compacting |
| `/bee:quick` | `[--agents] [--review] [task description]` | Fast-track task without full spec pipeline -- describe, execute, commit |

### Quality
| Command | Args | Description |
|---------|------|-------------|
| `/bee:review` | `[--loop]` | Review phase implementation against spec, standards, and quality checklist |
| `/bee:parallel-review` | `[--loop]` | Run review with 4 specialized reviewer teammates in parallel |
| `/bee:quick-review` | | Lightweight review of uncommitted changes -- no spec required |
| `/bee:review-project` | | Review entire implementation against original spec for compliance |
| `/bee:test` | | Generate manual test scenarios and verify with developer |

### Finalization
| Command | Args | Description |
|---------|------|-------------|
| `/bee:commit` | | Show diff summary and create a commit with user approval |
| `/bee:eod` | | End-of-day integrity check with 4 parallel audits |

## Workflows

### Full Feature Workflow (Spec to Done)

The complete lifecycle for building a feature with full quality gates:

```
1. /bee:init                    # One-time project setup
2. /bee:new-spec                # Describe the feature, answer questions, get spec.md + phases.md
3. /bee:plan-phase 1            # Decompose phase 1 into tasks with acceptance criteria
   /bee:plan-review 1           # (Optional) Verify plan covers all spec requirements
4. /bee:execute-phase 1         # TDD implementation -- agents work in parallel waves
5. /bee:review                  # Code review against spec + standards, auto-fix findings
6. /bee:test                    # Generate manual test scenarios, verify with developer
7. /bee:commit                  # Review diff, approve commit message
   --- repeat steps 3-7 for each phase ---
8. /bee:review-project          # Final compliance check: does implementation match spec?
9. /bee:eod                     # End-of-day health check (integrity, tests, compliance)
```

**What happens at each step:**

| Step | Input | Output | Agents Used |
|------|-------|--------|-------------|
| `new-spec` | Feature description + Q&A | `spec.md`, `phases.md`, `requirements.md` | spec-shaper, spec-writer |
| `plan-phase` | `spec.md` + phase number | `TASKS.md` with waves | phase-planner, researcher |
| `execute-phase` | `TASKS.md` | Implementation + tests | implementer (parallel per wave) |
| `review` | Implementation files | `REVIEW.md` with findings | reviewer, finding-validator, fixer |
| `test` | Implementation + spec | `TESTING.md` with scenarios | test-planner |
| `commit` | Git diff | Git commit | (none -- main context) |
| `review-project` | All phases + spec | `REVIEW-PROJECT.md` | project-reviewer |
| `eod` | Full project state | Integrity + health report | integrity-auditor, test-auditor, project-reviewer, reviewer |

### Autopilot Workflow (Hands-Off)

Run all phases from a spec automatically with no human gates:

```
1. /bee:new-spec                # Create the spec first
2. /bee:autopilot               # Start autopilot -- plans, executes, reviews all phases
   /compact                     # At each compact point, compress context
   /bee:autopilot               # Resume -- autopilot picks up where it left off
   --- repeat compact + autopilot until all phases done ---
3. Review changes and commit    # No commits are made during autopilot
```

**What autopilot does per phase:**

```
Plan (3-pass, auto-approved) -> Execute (parallel waves) -> Review + Auto-fix -> Next Phase
```

- No commits (you review and commit after)
- No manual testing (relies on automated tests during TDD)
- All gates auto-approved (plans, review findings, stylistic fixes)
- Compact points between steps for context management
- Resumable via STATE.md tracking (crash-safe)

### Quick Task Workflow (No Spec)

For small tasks that don't need the full spec pipeline:

```
1. /bee:quick fix the login button alignment on mobile
   # Bee executes the task directly with TDD, no spec needed

2. /bee:quick --agents add dark mode toggle to the settings page
   # Same but spawns researcher + implementer agents for more complex work

3. /bee:quick --review refactor the auth middleware to use JWT
   # Executes + runs a quick review before presenting for commit
```

**Quick workflow flow:**

```
Describe task --> Execute (TDD) --> [Optional: Review] --> Approve --> Commit
```

### Quick Review Workflow (No Spec)

For reviewing changes you've made outside of Bee:

```
# Make changes manually or with regular Claude Code...
# Then review what you've done:

/bee:quick-review              # Reviews uncommitted changes against standards
                                # No spec required -- works on any git changes
```

### Multi-Phase Parallel Workflow

When phases have no dependencies between them:

```
/bee:plan-phase 2
/bee:plan-phase 3
/bee:parallel-phases 2 3        # Both phases execute simultaneously with agent teams
/bee:review                     # Review each completed phase
```

### Resume After Break

```
/bee:resume                     # Restores full context from STATE.md + SESSION-CONTEXT.md
/bee:progress                   # Shows where you left off and suggests next action
```

## Agents (13)

| Agent | Role | Tools |
|-------|------|-------|
| **implementer** | TDD full-stack implementation | Read, Write, Edit, Bash, Grep, Glob |
| **fixer** | Minimal targeted fixes for review findings | Read, Write, Edit, Bash, Grep, Glob |
| **researcher** | Codebase patterns and Context7 docs | Read, Grep, Glob, Bash, Write |
| **reviewer** | Code review against spec and standards | Read, Grep, Glob, Bash |
| **finding-validator** | Classify findings as real/false/stylistic | Read, Grep, Glob |
| **phase-planner** | Decompose phases into tasks and waves | Read, Grep, Glob, Bash, Write |
| **plan-reviewer** | Review plan coverage against spec | Read, Grep, Glob, Write |
| **spec-writer** | Write spec and phase breakdown | Read, Grep, Glob, Write |
| **spec-shaper** | Interactive requirements gathering | Read, Grep, Glob, Bash, Write |
| **test-planner** | Generate manual test scenarios | Read, Grep, Glob, Write |
| **test-auditor** | Audit test suite health | Read, Grep, Glob, Bash |
| **integrity-auditor** | Verify STATE.md matches disk reality | Read, Grep, Glob, Bash |
| **project-reviewer** | Spec compliance review | Read, Grep, Glob, Bash |

## Agent Memory System

Agents accumulate per-project learnings in `.bee/memory/`:

- `shared.md` -- cross-cutting project knowledge all agents read
- `{agent-name}.md` -- per-agent knowledge (patterns, gotchas, conventions)

Memory is automatically injected via the `SubagentStart` hook. Write-capable agents append learnings after each task. The main context stays lean -- memory is only loaded by subagents.

## Hooks

| Event | Purpose |
|-------|---------|
| **SessionStart** | Load project context (STATE.md, config) + configure statusline |
| **PostToolUse** | Auto-lint modified files after Write/Edit |
| **PreCompact** | Snapshot session context before compaction |
| **SubagentStart** | Inject agent memory into subagent context |
| **SubagentStop** | Validate agent output (TDD compliance, format, completeness) |
| **Stop** | Check for unreviewed executed phases |
| **SessionEnd** | Warn about memory files approaching limits |

## Configuration

Bee stores configuration in `.bee/config.json`:

```json
{
  "stack": "laravel-inertia-vue",
  "linter": "pint",
  "testRunner": "pest",
  "context7": true,
  "review": { "against_spec": true, "against_standards": true },
  "phases": { "require_review_before_next": true }
}
```

## License

MIT
