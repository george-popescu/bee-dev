---
name: build
description: Use when implementing — "implement the plan", "let's code this", "start building" — executing a plan.md, or writing any non-trivial code even without a plan. Enforces test-first development, runs independent waves as parallel subagents, and keeps plan checkboxes current as the single progress record. Not for deciding what to build (shape), creating the plan itself (plan), or investigating why something fails (debug).
---

# Build

Execute work test-first. With a `docs/work/<topic>/plan.md`, run its waves in order. Without one — quick-scale work, decided inline — the same TDD loop applies to every non-trivial change; only the wave machinery and the checkboxes drop away. Non-trivial means anything above trivial scale as defined by the shape skill: trivial edits just get done, everything from quick scale up gets tests first. "No plan" never means "no tests first".

## TDD loop

Apply this sequence to each task (or, without a plan, to each behavior being added or changed). The order is the discipline — no step may be skipped or reordered:

1. **Write the failing test.** One behavior, a name that describes it, assertions driven by the inputs. The test file exists on disk before any production code for that behavior.
2. **Run it and watch it fail.** Confirm it fails for the expected reason: the behavior is missing — not a typo, an import error, or broken test logic. If it passes, the behavior already exists or the test is wrong; fix the test before going further.
3. **Write the minimal code to pass.** No extra features, no speculative options, no code for tests not yet written.
4. **Run it and watch it pass.** If it fails, fix the implementation, never the test. Other tests in your run scope must stay green — for a wave subagent that scope is its own task's test files; the wave-level full-suite run covers the rest.
5. **Refactor with tests green.** Improve names, remove duplication, extract helpers. Re-run the tests after every change; do not add behavior here.

Never write the implementation first. Code written before its test gets a test that passes immediately, which proves nothing — delete the code and restart from step 1. "I'll add tests after" is the same violation.

**Test intent rule:** before writing each test, articulate WHY it matters — what regression would it catch, what user-visible failure does it detect? If you cannot answer concretely, do not write it. Zero tests beats shallow tests. Assertions that restate the implementation, assert a hardcoded constant with no input driving it, or check only that something "was called" add maintenance cost without coverage. This rule narrows what you test; it never reorders test-after-code.

Bug fix mid-build? Reproduce it as a failing test first, then fix — same loop.

## Wave execution

When executing a plan.md:

- Read the plan and find the first wave containing unchecked `- [ ]` tasks — that is where execution starts (or resumes).
- Execute waves strictly in order. Wave N+1 starts only when every task in wave N is done or has failed.
- **Overlap check before dispatch:** compare the `- files:` lists of the wave's unchecked tasks. Any shared path forces serial execution of the overlapping tasks; only the disjoint remainder runs in parallel. Do not rely on the plan being freshly generated — the codebase may have drifted since it was written.
- **Within a wave:** if more than one unchecked task remains after the overlap check, dispatch one subagent per unchecked task via the Agent tool, all spawned in a single message so they run in parallel. A wave of one task is executed directly, no subagent. Before dispatching, determine once the project's test command and its per-file invocation syntax — every subagent prompt carries it.
- **Each subagent's prompt includes:** its task line from plan.md verbatim — the `T<n>` ID, description, and "done when" criteria — its indented `- files:` list, the path to `docs/work/<topic>/design.md`, the five TDD loop steps written out in full (subagents never see this skill file, so "the loop above" means nothing to them), and the test command with per-file syntax plus the instruction to run only its own task's test files, never the full suite.
- Subagents report results in their final message. You are the sole writer of plan.md — subagents never edit it.
- **After all subagents in a wave return:** first re-verify each task's "done when" criteria yourself — re-run its test files; a subagent's claim of success is not verification. Then run the full test suite once. Tick the verified tasks only after the suite is green. If the suite is red from cross-task interaction, no task in the wave gets ticked until the regression is attributed to a specific task; fix or revert that task, then re-verify and re-run the suite.
- Do not pause between waves to ask "continue?" — proceed automatically to the next wave until the plan is done or a task fails.

## Progress

- Tick a task's checkbox (`- [ ]` → `- [x]`) in plan.md the moment its "done when" criteria are verified passing — for a parallel wave, immediately after the wave's verify-then-suite sequence is green. Never defer ticking across waves or to the end of the session.
- Never tick ahead: not when the code "should work", not when a subagent claims success you have not verified against the criteria.
- The checkboxes are the only progress state. No status notes, no separate tracking file, no progress summary elsewhere. If the session is interrupted at any point, the next session reads plan.md and resumes from the first unchecked task — which is only true if the boxes were kept current.

## Failure handling

When a task fails — tests will not pass, a "done when" criterion cannot be met:

- The failure stops the failed task's dependents (later waves), not its siblings. Let the rest of the current wave finish; do not start the next wave.
- Leave the box unchecked. A failed task is never ticked, partially or "optimistically".
- Report what failed with the actual error output — the real test failure or stack trace, quoted — not a paraphrase.
- If the cause is obvious, propose the fix and wait for the user's go-ahead before continuing; apply it through the TDD loop (failing test reproducing the problem first).
- If the cause is not obvious — the fix would be a guess, or a first attempt already failed — stop and switch to the debug skill. Do not brute-force repeated fix attempts against a failure you do not understand.

## Commits

After each completed task, suggest a commit: name the files changed and provide a ready-made commit message the user can approve as-is. Never commit without the user's standing or explicit approval. One commit per task keeps the history aligned with the plan's checkboxes — a reverted commit maps to exactly one box to untick.
