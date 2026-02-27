---
name: core
description: BeeDev workflow rules -- TDD mandatory, disk-is-truth, no auto-commit. Spec-driven development with phase lifecycle.
---

# Core Workflow Knowledge

## Workflow Rules

These rules apply to ALL work within a Bee-managed project. No exceptions.

### TDD is mandatory
Write tests BEFORE implementation. Follow the Red-Green-Refactor cycle:
1. **Red:** Write a failing test that defines the desired behavior
2. **Green:** Write the minimal code to make the test pass
3. **Refactor:** Clean up while keeping tests green

Never write implementation code without a corresponding test first.

### Disk is truth
All critical state lives on disk. Never rely on conversation memory.
- `STATE.md` tracks current spec, phase progress, decisions, and last action
- `TASKS.md` is the execution contract -- tasks, waves, research notes, agent notes, completion status
- `config.json` holds project configuration (stack, linter, test runner, CI, review settings)

If it is not on disk, it does not exist.

### No auto-commit
The user decides when and what to commit via `/bee:commit`. Never commit automatically. Never stage files without explicit user instruction through the commit command.

### User stays in control
- Never make forced decisions -- always confirm before destructive actions
- Present options and let the user choose
- Show what will change before making changes

### Smart model delegation
When spawning agents via the Task tool, the conductor (parent command) chooses the model based on the agent's work complexity. All agents use `model: inherit` in their frontmatter -- the conductor overrides at spawn time.

**Model selection guide:**

| Model | When to use | Examples |
|-------|-------------|---------|
| `model: "sonnet"` | Structured/template work, scanning, classification, validation, comparison | researcher, spec-writer, phase-planner, plan-reviewer, finding-validator, integrity-auditor, test-auditor, test-planner, project-reviewer, reviewer (quick-review mode — focused scope scan) |
| (omit / inherit) | Production code, complex reasoning, deep analysis, interactive sessions | implementer, fixer, reviewer (full phase review — deep multi-category analysis), spec-shaper |

**Decision principle:** If the agent follows a template, does read-only scanning, runs tools mechanically, or classifies into fixed categories -- pass `model: "sonnet"`. If the agent writes production code, makes architectural decisions, or needs deep nuanced analysis -- omit the model parameter (inherits parent model).

The conductor SHOULD assess each spawn and pass `model: "sonnet"` explicitly for structured work, or omit the model for reasoning-heavy work. This is not optional -- it is how Bee manages cost and speed.

### Spec-driven development
Work only on features and tasks defined in specs. No ad-hoc implementation.
- Specs define WHAT to build (behavior, acceptance criteria)
- Phase plans define HOW to build it (tasks, waves, dependencies)
- Implementation follows the plan, not improvisation

### Phase lifecycle
Every feature follows this lifecycle:

| Step | Command | Output |
|------|---------|--------|
| Plan What | `/bee:new-spec` | Spec document with requirements |
| Plan How | `/bee:plan-phase` | TASKS.md with waves and tasks |
| Do | `/bee:execute-phase` | Implementation with TDD |
| Check | `/bee:review` | Review findings, validated fixes |
| Test | `/bee:test` | Manual test verification |
| Commit | `/bee:commit` | Clean, reviewed commit |

Phases must be reviewed before advancing to the next phase (`phases.require_review_before_next` in config).

## File Format References

### TASKS.md structure
The execution contract for each phase. Contains:
- **Header:** Phase name, spec reference, status
- **Wave table:** Tasks grouped by wave number (Wave 1 = no dependencies, Wave N+1 depends on Wave N)
- **Task entries:** Each has an ID, description, acceptance criteria, assigned agent, status checkbox
- **Research notes:** Findings from the researcher agent
- **Agent notes:** Implementation notes from executing agents

Tasks within the same wave have NO file conflicts and can run in parallel.

### STATE.md format
Tracks overall project state with four sections:
- **Current Spec:** Name, path, and status of the active spec (NO_SPEC when none loaded)
- **Phases table:** Progress grid with Plan/Executed/Reviewed/Tested/Committed columns per phase
- **Decisions Log:** Record of key decisions made during the workflow
- **Last Action:** Most recent command, timestamp, and result

For the STATE.md template, see [templates/state.md](templates/state.md).

### Wave conventions
- **Wave 1:** Tasks with no dependencies. Can all run in parallel.
- **Wave N+1:** Tasks that depend on output from Wave N.
- Within a wave, tasks are assigned to avoid file ownership conflicts.
- The conductor orchestrates wave execution: run all tasks in Wave 1, wait, then Wave 2, etc.

### config.json format
Project configuration with these fields:
- `version` -- Bee plugin version
- `stack` -- Detected project stack (e.g., "laravel-inertia-vue")
- `linter` -- Detected linter (e.g., "pint", "eslint", "none")
- `testRunner` -- Detected test runner (e.g., "pest", "vitest", "none")
- `ci` -- Detected CI system (e.g., "github-actions", "none")
- `context7` -- Whether to use Context7 MCP for framework docs (default: true)
- `review` -- Review settings (against_spec, against_standards, dead_code, loop, max_loop_iterations)
- `phases` -- Phase settings (require_review_before_next)

For the config.json template, see [templates/project-config.json](templates/project-config.json).
