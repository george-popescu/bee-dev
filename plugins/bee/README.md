# Bee - Spec-Driven Development Workflow

A Claude Code plugin that enforces disciplined, spec-driven development with TDD, parallel agent execution, persistent agent memory, and review gates.

## What Bee Does

Bee structures your development workflow into a lifecycle: **Spec > Plan > Execute > Review > Test > Commit**. Each step produces artifacts on disk, every feature goes through review gates, and 18 specialized agents handle different aspects of the work.

## Commands (23)

### Setup & Navigation
| Command | Args | Description |
|---------|------|-------------|
| `/bee:init` | | Initialize Bee for a project -- detect stack, create `.bee/`, configure workflow |
| `/bee:progress` | | Show project state, phase progress, and suggest next action |
| `/bee:resume` | | Resume work from previous session with full context restoration |
| `/bee:compact` | | Smart compact -- preserve bee context, then compress conversation |
| `/bee:memory` | | View accumulated agent memories for the current project |
| `/bee:refresh-context` | | Re-run codebase context extraction, overwriting CONTEXT.md with fresh analysis |
| `/bee:create-agent` | `[agent-name]` | Create a custom project-local agent extension for bee |
| `/bee:create-skill` | `[skill-name]` | Create a custom project-local skill extension for bee |

### Specification
| Command | Args | Description |
|---------|------|-------------|
| `/bee:new-spec` | `[--amend] [feature description]` | Create or amend a feature spec through structured developer interview (2-5 adaptive rounds with selectable options) |
| `/bee:plan-phase` | `[phase-number]` | Plan a phase with tasks, acceptance criteria, research, and wave grouping |
| `/bee:plan-review` | `[phase-number]` | Review plan coverage against spec -- find gaps and discrepancies |
| `/bee:add-phase` | | Append a new phase to the current spec |
| `/bee:discuss` | `[topic description]` | Launch a guided codebase-grounded discussion to clarify requirements before creating a spec |

### Execution
| Command | Args | Description |
|---------|------|-------------|
| `/bee:execute-phase` | `[phase-number]` | Execute a phase with wave-based parallel TDD agents |
| `/bee:quick` | `[--fast] [--amend] [--review] [task description]` | Fast-track task without full spec pipeline -- agents mode default, `--fast` for direct, `--amend` to modify existing plan |

### Quality
| Command | Args | Description |
|---------|------|-------------|
| `/bee:review` | `[--loop]` | Multi-agent parallel review (4 specialized agents) with finding validation, specialist escalation, and auto-fix |
| `/bee:review-implementation` | | Context-aware review -- full spec mode (4 agents) or ad-hoc mode (3 agents, no spec required) |
| `/bee:fix-implementation` | `[path/to/REVIEW.md]` | Standalone fix command -- reads review output and fixes confirmed findings sequentially |
| `/bee:test` | | Generate manual test scenarios and verify with developer |

### Finalization
| Command | Args | Description |
|---------|------|-------------|
| `/bee:commit` | | Show diff summary and create a commit with user approval |
| `/bee:archive-spec` | | Archive completed spec, reset STATE.md, bump plugin version |
| `/bee:eod` | | End-of-day integrity check with 4 parallel audits |

### Maintenance
| Command | Args | Description |
|---------|------|-------------|
| `/bee:update` | | Update bee statusline and clean up legacy local copies |

## Workflows

### Full Feature Workflow (Spec to Done)

The complete lifecycle for building a feature with full quality gates:

```
1. /bee:init                    # One-time project setup
2. /bee:new-spec                # Describe the feature, answer questions, get spec.md + phases.md
3. /bee:plan-phase 1            # Decompose phase 1 into tasks with acceptance criteria
                                # Plan review runs automatically (4 parallel agents) -- developer approves or modifies
   /bee:plan-review 1           # Standalone plan review still available if needed separately
4. /bee:execute-phase 1         # TDD implementation -- agents work in parallel waves
5. /bee:review                  # Code review against spec + standards, auto-fix findings
6. /bee:test                    # Generate manual test scenarios, verify with developer
7. /bee:commit                  # Review diff, approve commit message
   --- repeat steps 3-7 for each phase ---
8. /bee:review-implementation   # Final compliance check: does implementation match spec?
9. /bee:archive-spec            # Archive completed spec, reset STATE.md
10. /bee:eod                    # End-of-day health check (integrity, tests, compliance)
```

**What happens at each step:**

| Step | Input | Output | Agents Used |
|------|-------|--------|-------------|
| `new-spec` | Feature description + structured interview (2-5 adaptive rounds) | `spec.md`, `phases.md`, `requirements.md` | spec-shaper, spec-writer |
| `plan-phase` | `spec.md` + phase number | `TASKS.md` with waves | phase-planner, researcher, plan-reviewer (automatic review step) |
| `execute-phase` | `TASKS.md` | Implementation + tests | implementer (parallel per wave) |
| `review` | Implementation files | `REVIEW.md` with findings | bug-detector, pattern-reviewer, plan-compliance-reviewer, stack-reviewer, finding-validator, fixer |
| `test` | Implementation + spec | `TESTING.md` with scenarios | test-planner |
| `commit` | Git diff | Git commit | (none -- main context) |
| `review-implementation` | All phases + spec (or ad-hoc changes) | `REVIEW-IMPLEMENTATION.md` | bug-detector, pattern-reviewer, plan-compliance-reviewer, stack-reviewer, finding-validator, fixer |
| `archive-spec` | Completed spec | Archived spec, reset STATE.md | (none -- main context) |
| `eod` | Full project state | Integrity + health report | integrity-auditor, test-auditor, plan-compliance-reviewer, pattern-reviewer |

### Quick Task Workflow (No Spec)

For small tasks that don't need the full spec pipeline. Quick tasks are tracked in a separate STATE.md section with no impact on the spec/phase pipeline.

```
1. /bee:quick fix the login button alignment on mobile
   # Agents mode (default) -- spawns researcher + implementer agents

2. /bee:quick --fast fix the button color
   # Direct mode -- executes inline without agents

3. /bee:quick --amend 3
   # Modify existing quick task plan #3

4. /bee:quick --review refactor the auth middleware to use JWT
   # Executes + runs a quick review before presenting for commit
```

**Quick workflow flow:**

```
Describe task --> Execute (TDD) --> [Optional: Review] --> Approve --> Commit
```

### Ad-hoc Review (No Spec)

For reviewing changes you've made outside of Bee:

```
# Make changes manually or with regular Claude Code...
# Then review what you've done:

/bee:review-implementation      # Auto-detects ad-hoc mode (3 agents, no spec required)
                                # Works on any uncommitted git changes
```

### Resume After Break

```
/bee:resume                     # Restores full context from STATE.md + SESSION-CONTEXT.md
/bee:progress                   # Shows where you left off and suggests next action
```

## Agents (18)

| Agent | Role | Tools |
|-------|------|-------|
| **implementer** | TDD full-stack implementation | Read, Write, Edit, Bash, Grep, Glob |
| **fixer** | Minimal targeted fixes for review findings | Read, Write, Edit, Bash, Grep, Glob, Context7 |
| **researcher** | Codebase patterns and Context7 docs | Read, Grep, Glob, Bash, Write |
| **bug-detector** | Detect bugs, logic errors, and security issues | Read, Glob, Grep, Context7 |
| **pattern-reviewer** | Review code against established project patterns | Read, Glob, Grep |
| **plan-compliance-reviewer** | Review code/plans against spec and acceptance criteria | Read, Glob, Grep |
| **stack-reviewer** | Review code against stack-specific best practices (dynamically loaded) | Read, Glob, Grep, Context7 |
| **finding-validator** | Classify findings as real/false/stylistic (with source agent for specialist escalation) | Read, Grep, Glob |
| **phase-planner** | Decompose phases into tasks and waves | Read, Grep, Glob, Bash, Write |
| **plan-reviewer** | Review plan coverage against spec | Read, Grep, Glob, Write |
| **spec-writer** | Write spec and phase breakdown | Read, Grep, Glob, Write |
| **spec-shaper** | Interactive requirements gathering | Read, Grep, Glob, Bash, Write |
| **test-planner** | Generate manual test scenarios | Read, Grep, Glob, Write |
| **test-auditor** | Audit test suite health | Read, Grep, Glob, Bash |
| **integrity-auditor** | Verify STATE.md matches disk reality | Read, Grep, Glob, Bash |
| **context-builder** | Scan codebase and extract observed patterns into CONTEXT.md | Read, Glob, Grep, Write |
| **quick-implementer** | TDD-enforced implementer for quick tasks | Read, Write, Edit, Bash, Grep, Glob |
| **discuss-partner** | Scan codebase to ground a discussion, produce structured notes | Read, Glob, Grep, Write |

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
| **PreToolUse** | Pre-commit validation gate -- runs linter + test checks before allowing commits |
| **PreCompact** | Snapshot session context before compaction |
| **SubagentStart** | Inject agent memory into subagent context |
| **SubagentStop** | Validate agent output (TDD compliance, format, completeness) -- includes role-specific validation for 4 specialized review agents |
| **Stop** | Check for unreviewed executed phases |
| **SessionEnd** | Warn about memory files approaching limits |

## Configuration

Bee stores configuration in `.bee/config.json`:

```json
{
  "version": "0.1.0",
  "stacks": [
    { "name": "laravel-inertia-vue", "path": "." }
  ],
  "implementation_mode": "quality",
  "linter": "pint",
  "testRunner": "pest",
  "ci": "github-actions",
  "context7": true,
  "review": {
    "against_spec": true,
    "against_standards": true,
    "dead_code": true,
    "loop": false,
    "max_loop_iterations": 3
  },
  "phases": { "require_review_before_next": true },
  "quick": { "review": false, "agents": true, "fast": false }
}
```

## License

MIT
