---
name: review
description: Use after implementation is complete, or whenever the user asks to review code — "review this", "review what we did", "check my changes" — covering a change, diff, or recent work. Runs a multi-lens review where every finding must survive an adversarial validation pass — only evidence-backed findings get fixed — then re-reviews until clean. Not for whole-codebase health sweeps (audit) or diagnosing a specific failure (debug).
---

# Review

Review the change at hand — never the whole codebase. Resolve the diff scope by precedence:

1. Files the user explicitly named.
2. The union of `- files:` lists from the topic plan.md's ticked tasks.
3. Uncommitted work — staged + unstaged + untracked (`git diff HEAD` plus `git status`).
4. Clean tree: commits on this branch since its merge-base with the main branch.

State the resolved scope back to the user in one line before lensing.

The pipeline is fixed: lenses produce findings → deduplicate → adversarially validate → fix CONFIRMED only → re-review until a full-scope, full-lens-set pass yields zero CONFIRMED findings. No step may be skipped; no finding may jump ahead.

## Lens selection

Scale the lens set to the diff. Trivial-scale work gets the ≤3-file treatment with an inline report.

- **≤3 files:** 2 lenses — correctness + conventions — run inline.
- **≤15 files:** 3 lenses minimum — add tests; add security when the diff touches input, auth, or data paths. Inline or subagents, your call.
- **Larger:** all 5 lenses — add performance — and dispatch one subagent per lens via the Agent tool, all spawned in a single message so they run in parallel.

A lens pass produces findings only — never edits — regardless of who runs it, inline or subagent.

Lens definitions:

- **correctness:** logic, edge cases, error paths
- **conventions:** does it read like the surrounding code
- **security:** injection, authz, secrets, unsafe input
- **tests:** do they verify behavior, not implementation
- **performance:** N+1, unnecessary work in hot paths

**Each lens subagent's prompt includes:** the diff scope (the explicit file list or git range), its lens definition line from above, the finding format block and the severity scale written out in full (subagents never see this skill file), and the instruction to report findings only in that format — no fixes, no file edits. One lens per subagent; straying outside its lens or scope produces noise, not coverage.

Report only findings with real evidence behind them — vague findings die in validation anyway.

## Finding format

Every finding, from every lens, uses exactly this format:

```markdown
### [SEVERITY] <one-line title>
- **Where:** path/to/file.ext:line
- **Evidence:** <the actual code or behavior, quoted>
- **Why it matters:** <concrete consequence>
- **Suggested fix:** <specific change>
```

Evidence is quoted code or observed behavior — not a paraphrase, not an inference.

## Severity scale

- CRITICAL = data loss, security breach, or crash in a main path.
- HIGH = incorrect behavior a user will hit.
- MEDIUM = incorrect behavior in an edge case, or a maintainability trap.
- LOW = polish, naming, minor inefficiency.

## Deduplicate

Before validating, merge duplicates across lenses: same file + line + root cause = one finding, kept at the highest severity any lens claimed — provisional until validated. Different framings of the same root defect — same underlying cause, same fix — are one finding. When multiple lenses independently flagged the same defect, note the agreement on the finding as a confidence signal.

## Adversarial validation

For EVERY finding — no exceptions, however obvious — actively try to refute it:

1. **Read the actual code** at the cited location, plus surrounding context.
2. **Check whether the case is already handled** — a guard clause, a validating caller, middleware, a framework convention, or a test covering exactly this path.
3. **Check the suggested fix** — would applying it break callers or tests touching the same code?
4. **Confirm or adjust the severity** against the scale — dedup's highest-claimed severity is provisional until validated.

Then assign a verdict:

- CONFIRMED — evidence verified in the actual code.
- REFUTED — the code does not do what the finding claims; discard.
- STYLISTIC — real but a preference, not a defect; the user decides.

If a competent reviewer could argue either side, it is STYLISTIC, not a LOW defect.

Every verdict carries a one-line validation note naming what was checked — CONFIRMED: what was searched for and not found ("no guard in caller X, no test covers Y"); REFUTED: the quoted code that refutes it. The note is recorded with the verdict in the report.

A finding without quotable evidence is REFUTED by definition. Validation is mandatory — an unvalidated finding must never reach the fix step. When genuinely ambiguous, lean REFUTED: a wrong fix costs more than a missed nitpick, and the re-review catches anything real.

## Fix loop

1. Fix CONFIRMED findings only. Minimal targeted edits, one finding at a time — never batch unrelated fixes, never "improve" beyond what the finding requires.
2. Present STYLISTIC findings to the user as a choice: fix or leave. Apply only what the user picks.
3. **Any applied edit resets the loop** — a CONFIRMED fix and a user-chosen STYLISTIC fix alike. The clean pass must postdate the last edit of any kind.
4. Re-review with the same validation discipline. Intermediate rounds may narrow scope to the changed areas and the lenses that produced the confirmed findings — but the terminal pass is always full-scope, full-lens-set.
5. The loop ends only when that full-scope, full-lens-set pass yields zero CONFIRMED findings. Never declare the work clean without it.
6. **Circuit breaker:** if a finding survives 2 fix rounds, or a fix regresses something else, stop — report the current state to the user and hand off to the debug skill. No brute-force fix loops.

## Report

- **Feature/project-scale work:** write `docs/work/<topic>/review.md`, overwriting any previous round. Group findings by severity (CRITICAL first); record each in the standard format plus its verdict, validation note, and resolution (fixed / user declined / discarded as REFUTED). End with the round count and the clean-pass confirmation.
- **Quick/trivial-scale work:** present the same content inline instead of writing a file.

After the clean pass, suggest a commit with a ready-made message covering the fixes. Never commit without the user's approval.
