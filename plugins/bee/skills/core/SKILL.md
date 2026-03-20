---
name: core
description: BeeDev workflow rules -- TDD mandatory, disk-is-truth, no auto-commit. Spec-driven development with phase lifecycle.
---

# Core Workflow Knowledge

## Workflow Rules

These rules apply to ALL work within a Bee-managed project. No exceptions.

### TDD is mandatory

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write code before the test? **Delete it. Start over.**
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete

**The Red-Green-Refactor cycle:**
1. **Red:** Write a failing test. Run it. Watch it FAIL. Verify the failure is about missing implementation, not test logic errors.
2. **Green:** Write the MINIMAL code to make the test pass. Nothing extra.
3. **Refactor:** Clean up with passing tests as safety net. Tests must pass after every change.

**Watch It Fail (MANDATORY):**
After writing a test, run it and confirm:
- Test FAILS (not errors — actual assertion failure)
- Failure message matches expected behavior
- Fails because feature is missing, not because of typos

Test passes immediately? You're testing existing behavior. Fix the test.

**Verification before completion:**
Before claiming work is done, verify with fresh evidence:
- [ ] Every new function/method has a test
- [ ] Watched each test fail before implementing
- [ ] Tests fail for expected reason
- [ ] Wrote minimal code to pass
- [ ] All tests pass (fresh run, not cached)
- [ ] Output is clean (no errors, no warnings)
- [ ] Tests use real code (mocks only when unavoidable)
- [ ] Edge cases and error paths covered

**Testing anti-patterns (avoid these):**
- Testing mock behavior instead of real behavior — assert on what the code DOES, not what mocks return
- Test-only methods in production classes — move cleanup/reset to test utilities
- Mocking without understanding dependencies — know what side effects you're replacing
- Incomplete mocks with partial data — mirror real data structures completely
- Tests added after implementation — tests-after prove nothing; they pass immediately

**Common rationalizations (all wrong):**

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests-after pass immediately and prove nothing. |
| "Already manually tested" | Manual testing is not systematic and cannot be re-run. |
| "Deleting my code is wasteful" | Sunk cost fallacy. Unverified code is technical debt. |
| "Keep code as reference" | You'll adapt it. That's testing-after in disguise. |
| "Need to explore first" | Fine. Throw away exploration, then start with TDD. |
| "Hard to test = skip test" | Hard to test = hard to use. Listen to the test. |
| "TDD will slow me down" | TDD is faster than debugging. Always. |
| "Existing code has no tests" | You're improving it. Start with tests for your changes. |

**Red flags — STOP and start over:**
- Code written before test
- Test passes immediately (no red phase)
- Can't explain why test failed
- "Just this once" rationalization
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "This is different because..."

All of these mean: delete code, start over with TDD.

### Disk is truth
All critical state lives on disk. Never rely on conversation memory.
- `STATE.md` tracks current spec, phase progress, decisions, and last action
- `TASKS.md` is the execution contract -- tasks, waves, research notes, agent notes, completion status
- `config.json` holds project configuration (stacks with per-stack linter and test runner, CI, review settings, ship settings)
- `user.md` holds user preferences and work style rules (see User Preferences below)

If it is not on disk, it does not exist.

### No auto-commit
The user decides when and what to commit via `/bee:commit`. Never commit automatically. Never stage files without explicit user instruction through the commit command.

### User stays in control
- Never make forced decisions -- always confirm before destructive actions
- Present options and let the user choose
- Show what will change before making changes

## Firm Rules

These rules are non-negotiable and apply to ALL commands and agents.

**R1: Bee never auto-commits.** Commit is only a suggestion. User confirms via `/bee:commit`.

**R2: Bee never suggests clear or compact.** User sees the statusbar and decides. If user explicitly asks for clear/compact via Custom option, then execute.

**R3: Interactive menu at every major step.** Use `AskUserQuestion` with selectable `options` parameter. Last option is always "Custom" (free text input). On ALL workflows without exception.

**R4: Re-review available after any review/fix cycle.** No iteration limit. User decides when it's clean.

**R5: Unlimited clarifying questions.** discuss, new-spec, and any conversational flow — no hardcoded limit. Continue one-at-a-time questions until context is sufficient. User can always choose to move forward.

**R6: When user selects an option, execute it.** No follow-up warnings, no extra confirmation (exception: commit has its own confirmation flow via bee:commit).

**R7: user.md is the only persistent memory.** Injected to all agents at SubagentStart. Contains preferences, rules, work style. Only conductors write to it, never agents.

### Smart model delegation
When spawning agents via the Task tool, the conductor (parent command) chooses the model based on the agent's work complexity. All agents use `model: inherit` in their frontmatter -- the conductor overrides at spawn time.

**Model selection guide:**

| Model | When to use | Examples |
|-------|-------------|---------|
| `model: "sonnet"` | Structured/template work, scanning, classification, validation, comparison | researcher, spec-writer, phase-planner, plan-reviewer, finding-validator, integrity-auditor, test-auditor, test-planner, reviewer (ad-hoc mode — focused scope scan) |
| (omit / inherit) | Production code, complex reasoning, deep analysis, interactive sessions | implementer, fixer, reviewer (full phase review — deep multi-category analysis), spec-shaper |

**Decision principle:** If the agent follows a template, does read-only scanning, runs tools mechanically, or classifies into fixed categories -- pass `model: "sonnet"`. If the agent writes production code, makes architectural decisions, or needs deep nuanced analysis -- omit the model parameter (inherits parent model).

The conductor SHOULD assess each spawn and pass `model: "sonnet"` explicitly for structured work, or omit the model for reasoning-heavy work. This is not optional -- it is how Bee manages cost and speed.

### User Preferences

`.bee/user.md` is the only persistent memory file. It contains user preferences, work style rules, and recurring decisions. It is injected to all agents via the SubagentStart hook. Only conductor commands write to it — agents never modify it directly.

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

## Context7 Integration

Context7 provides live documentation lookups for framework APIs and best practices. Several agents (researcher, bug-detector, stack-reviewer, security-auditor, api-auditor, audit-bug-detector) have Context7 tools in their frontmatter.

### How to use Context7

1. Read `skills/context7/SKILL.md` for the **Library IDs Per Stack** table — this maps stack names to Context7 library names
2. Resolve the library ID: `mcp__context7__resolve-library-id` with the library name from the table
3. Query documentation: `mcp__context7__query-docs` with the resolved `libraryId` and a specific question

### When to use Context7

- Verifying that an API call matches the current version of a framework
- Checking whether a flagged pattern is actually the recommended approach in the latest version
- Looking up security best practices (CSRF, XSS prevention, auth middleware)
- Resolving ambiguity when a stack skill describes a convention but you need confirmation
- Checking for known vulnerability patterns in specific library versions

### When Context7 is unavailable

Context7 MCP tools may not be available in all environments. If the tools are missing or fail:
- Fall back to the stack skill rules and codebase patterns
- Never hard-fail because Context7 is unavailable
- Note in your output that documentation verification was skipped

### Context7 in multi-stack projects

For projects with multiple stacks, each agent should resolve library IDs for the specific stack it's working with. The researcher agent resolves libraries for ALL configured stacks when doing broad research.

## File Format References

- **TASKS.md:** Execution contract for each phase. See [templates/tasks.md](templates/tasks.md)
- **STATE.md:** Project state tracking. See [templates/state.md](templates/state.md)
- **config.json:** Project configuration. See [templates/project-config.json](templates/project-config.json)
  - **`ship` section:** Controls the autonomous review loop used by `ship` and `plan-all` commands. Properties:
    - `max_review_iterations` (int, default `3`) -- maximum number of autonomous review-fix cycles before stopping. **This is independent from `review.max_loop_iterations`**, which controls the interactive `/bee:review` command loop. The two settings govern different pipelines and do not affect each other.
    - `final_review` (bool, default `true`) -- whether ship runs a final cross-phase implementation review after all phases complete.
  - When the `ship` section is absent from config.json, both commands apply the defaults (`max_review_iterations=3`, `final_review=true`).
- **Wave conventions:** Wave 1 = no dependencies (parallel). Wave N+1 depends on Wave N. No file conflicts within a wave.
