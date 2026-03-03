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

- `memory/` directory holds per-agent persistent knowledge (see Agent memory system below)

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

### Agent memory system
Agents have persistent per-project memory stored in `.bee/memory/`. This is NOT loaded into the main context -- only agents load their own memory when spawned.

- `shared.md` -- cross-cutting knowledge all agents read
- `{agent-name}.md` -- per-agent knowledge (only that agent reads/writes it)

**Memory injection:** The SubagentStart hook (`scripts/inject-memory.sh`) automatically reads `shared.md` and `{agent-name}.md` and injects the content into the agent's context at spawn time. Agents do NOT need to read memory files manually. If no memory appears in context, the project has no accumulated knowledge yet -- fallback: read `.bee/memory/shared.md` and `.bee/memory/{agent-name}.md` manually.

**Rules for agents writing memory:**
- Append new learnings, never rewrite the entire file
- One entry per line: `- [{YYYY-MM-DD}] description`
- No duplicates -- check existing entries before appending
- Max 50 lines per file -- consolidate older entries when approaching the limit
- Only write genuinely useful project knowledge, not task-specific details
- Write-capable agents write memory automatically; read-only agents consume only

**What belongs in memory:**
- Project-specific patterns and conventions not obvious from code
- Gotchas and pitfalls that wasted time
- Architectural constraints and decisions
- Environment setup requirements
- Recurring issues and their root causes
- User preferences for workflow and communication

**What does NOT belong in memory:**
- Task-specific implementation details
- Temporary state or in-progress work
- Information already captured in STATE.md, config.json, or TASKS.md
- Generic framework knowledge (that's what Context7 and stack skills are for)

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

- **TASKS.md:** Execution contract for each phase. See [templates/tasks.md](templates/tasks.md)
- **STATE.md:** Project state tracking. See [templates/state.md](templates/state.md)
- **config.json:** Project configuration. See [templates/project-config.json](templates/project-config.json)
- **Wave conventions:** Wave 1 = no dependencies (parallel). Wave N+1 depends on Wave N. No file conflicts within a wave.
