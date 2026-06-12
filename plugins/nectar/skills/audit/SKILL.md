---
name: audit
description: Use for whole-codebase health checks — "audit this", pre-release sweeps, taking over an unfamiliar project. Selects audit lenses by codebase shape, validates every finding adversarially, and produces a severity-grouped report. Not for reviewing a specific change or diff (review) or chasing one known bug (debug).
---

# Audit

Audit the whole codebase as it stands — a point-in-time health snapshot, not a review of a change. Audits inform; they never mutate. Do not fix anything inline, however small or however CRITICAL — the report file is the only thing an audit writes.

## Lens library

Ten lenses, each with a fixed scope:

- **security:** OWASP top 10, authz, secrets exposure
- **error handling:** unhandled paths, swallowed exceptions
- **database:** N+1, missing indexes, migration drift
- **API:** contract consistency, error formats, input validation
- **performance:** hot paths, caching, bundle size
- **frontend:** loading/empty/error states, leaks, a11y
- **architecture:** boundaries, duplication, dependency direction
- **dependencies:** vulnerabilities, abandonware
- **test health:** coverage gaps, stale or tautological tests
- **integration:** cross-layer wiring, dead endpoints, unreachable UI

## Lens selection

Pick lenses by codebase shape, not by default-everything:

- No UI → drop frontend.
- No database → drop database.
- Always include security and error handling — every codebase has both attack surface and failure paths.

Before running anything, state the selected lenses and the reason for each drop in one short list. Then run each lens against the actual code — entry points, routes, schema, configs — not against assumptions about what the code probably does.

Dispatch is decided mechanically: more than 2 selected lenses or more than ~50 source files → one subagent per lens via the Agent tool, all spawned in a single message so they run in parallel. Otherwise run the lenses inline, sequentially.

Before dispatch, survey the repo structure once and give each lens its own entry-point list matched to its scope — security gets auth middleware and config/secrets locations, database gets the schema and migrations, dependencies gets the manifests and lockfiles, frontend gets the component roots, and so on. One generic list handed to every lens is not acceptable. **Each subagent's prompt must contain:** its lens scope line from the library above, its entry-point list from the survey, the finding format block and the severity scale written out in full (subagents never see this skill file), and the instruction to report findings only in that format — no fixes, no file edits. One lens per subagent; straying outside its lens produces noise, not coverage.

Whether run inline or by subagent, a lens reports only what it can quote from the code. Theoretical vulnerabilities without code evidence, concerns the framework demonstrably handles, and missing features dressed up as defects do not ship as findings.

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

This is the same discipline as the review skill; findings from audit and review are interchangeable records.

## Validation

Before validating, merge duplicates across lenses: same file + line + root cause = one finding, kept at the highest severity any lens claimed. When multiple lenses independently flagged the same defect, note the agreement on the finding as a confidence signal. Severity is provisional until validated.

Then give EVERY finding the same adversarial treatment as in review — no exceptions, however obvious. Validate in severity order, CRITICAL → LOW: a session dying mid-validation has already produced the verdicts that matter most. Group findings by file or module and validate each group in one read of that code. For high volumes, validation may be dispatched to parallel subagents under the same prompt-completeness convention — each prompt carries the verdict definitions, the boundary rule, and the validation-note requirement written out in full.

For each finding, read the actual code at the cited location plus surrounding context, check whether the case is already handled (a guard clause, middleware, a framework convention, a covering test), and actively try to refute it. Then assign a verdict:

- CONFIRMED — evidence verified in the actual code.
- REFUTED — the code does not do what the finding claims; discard.
- STYLISTIC — real but a preference, not a defect; the user decides.

If a competent reviewer could argue either side, it is STYLISTIC, not a LOW defect.

Every verdict carries a one-line validation note naming what was checked — CONFIRMED: what was searched for and not found ("no guard in caller X, no test covers Y"); REFUTED: the quoted code that refutes it. The note is recorded with the verdict in the report.

A finding without quotable evidence is REFUTED by definition. When genuinely ambiguous, lean REFUTED — a false alarm in an audit report wastes a remediation cycle and erodes trust in every other finding.

## Report

Write `docs/work/audit-YYYY-MM-DD.md` — a file at the docs/work root, not a folder; this is the one deliberate exception to folder-per-topic because an audit is a point-in-time snapshot, not ongoing work. A second audit the same day overwrites the file — latest snapshot wins.

The report contains:

1. **The lens manifest:** the selected lenses and the one-line reason for each drop — the same list stated at selection time, persisted. Without it, a lens with no findings is ambiguous between "clean" and "not examined".
2. **Validated findings grouped by severity, CRITICAL first.** Each finding in the standard format plus its verdict and validation note. STYLISTIC findings go in their own short section after LOW.
3. **The REFUTED count**, disclosed plainly ("validation refuted N of M raw findings") — transparency about the validation kill rate is what makes the surviving findings trustworthy.
4. **A "start here" list** of the top 3 actions, ordered by severity and blast radius.

A clean audit — zero CONFIRMED findings — still writes the report: the lens manifest and the REFUTED count are the value.

Writing this file is the only mutation an audit performs. Suggest a commit message for the report; never commit without the user's approval.

## Hand-off

Audits inform, they do not mutate. Never fix findings inline — not during the lens pass, not during validation, not after the report.

- Offer to shape the top findings into work topics via the shape skill — a CONFIRMED finding plus its suggested fix is ready-made raw material for a design.
- A finding that needs investigation rather than fixing — "this behaves wrongly and we do not know why" — routes to the debug skill instead.
- STYLISTIC findings are presented as choices; the user decides whether any become work.
