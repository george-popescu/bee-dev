---
name: review
description: Code review methodology -- checklist, severity levels, categories, false positive rules
---

# Review Methodology

## How to Review

Follow these steps in order for every review:

1. **Read the spec and acceptance criteria.** Open spec.md and TASKS.md for the phase being reviewed. Understand what was supposed to be built, not just what exists.

2. **Read false positives.** Open `.bee/false-positives.md` (if it exists). Note every documented FP. Compare each potential finding against this list before including it.

3. **Identify files to review.** Read TASKS.md task entries to find all files created or modified by the phase. These are the review targets.

4. **Scan incrementally.** For each file, use Grep and Read to examine the code. Do NOT load all files into context at once -- scan one file at a time, focusing on areas relevant to the checklist categories below.

5. **Check against the checklist.** Walk through the 7-section checklist for each file. Record findings only when you have HIGH confidence.

6. **Verify confidence before including.** For each potential finding, ask: "Am I certain this is wrong?" If unsure, skip it. The finding-validator handles ambiguity.

7. **Write REVIEW.md.** Write the review report to the phase directory using the template at `skills/core/templates/review-report.md`.

**Calibration guidance:** Only report findings you have HIGH confidence in. A review with 30+ findings overwhelms the pipeline and destroys usefulness. Target 5-15 findings per phase review. Quality over quantity -- a focused review with 8 specific, actionable findings is worth more than a broad review with 25 vague ones.

## Severity Levels

### Critical

Findings that represent immediate risk to security, data integrity, or application stability.

- Security vulnerabilities (XSS, SQL injection, auth bypass, exposed secrets)
- Data loss or corruption risks (unprotected destructive operations, missing transactions)
- Application crash in core user flow (null dereference in critical path, unhandled exceptions in main workflow)
- Missing authentication or authorization on protected routes or endpoints

A Critical finding means: "This must be fixed before the code can ship."

**Boundary with High:** If an issue could lead to data loss or security breach under normal usage, it is Critical. If it causes incorrect behavior but does not compromise security or data, it is High.

### High

Findings that affect correctness of business logic or completeness of the implementation.

- Spec compliance gaps (required feature missing or behaving incorrectly per acceptance criteria)
- Logic errors affecting correctness of business rules (wrong conditions, inverted checks, off-by-one)
- Missing error handling for critical operations (API calls, database operations, file I/O with no try/catch or fallback)
- Test coverage gaps for acceptance criteria (acceptance criterion exists but no test covers it)

A High finding means: "This is wrong or incomplete and needs attention before review passes."

**Boundary with Medium:** If an issue changes the correctness of output or violates a spec requirement, it is High. If it only affects readability, maintainability, or convention adherence, it is Medium.

### Medium

Findings that affect code quality, maintainability, or adherence to standards.

- Standards violations (naming conventions, directory structure, import patterns not matching stack skill)
- Dead code (unused imports, unreachable branches, orphaned functions or components)
- Code quality issues (DRY violations, excessive complexity, unclear naming)
- Minor pattern inconsistencies (new code deviating from established project conventions)

A Medium finding means: "This should be cleaned up but does not break functionality."

**Boundary with "not a finding":** If an issue is purely a style preference with no impact on readability or maintainability, it is not a finding. Only flag Medium issues that have a concrete negative effect on the codebase.

## Finding Categories

| Category  | What It Covers                                            | Look For                                                                              |
|-----------|-----------------------------------------------------------|---------------------------------------------------------------------------------------|
| Bug       | Logic errors, incorrect behavior, runtime errors          | Wrong conditions, off-by-one, null dereference, type mismatches, race conditions      |
| Spec Gap  | Feature missing or not matching spec requirements         | Acceptance criteria without implementation, behavior mismatch with spec               |
| Standards | Naming, structure, pattern violations                     | Stack skill conventions not followed, global standards violations, wrong file location |
| Dead Code | Unused imports, unreachable code, orphaned functions      | `import` without usage, code after `return`, functions never called, commented-out blocks |
| Security  | XSS, injection, auth, data exposure                       | Unsanitized input, raw SQL, missing auth middleware, exposed env vars, hardcoded secrets |
| TDD       | Missing tests, test-after-implementation, untested criteria | Production files without test files, acceptance criteria without test coverage         |
| Pattern   | Inconsistency with existing codebase patterns             | New code deviating from established conventions in the same project                   |

## False Positive Rules

Recognize these patterns as potential false positives -- findings that look wrong but are actually correct:

- **Framework-specific patterns:** Laravel facades, Vue reactivity transforms, Inertia shared props, Next.js server components, convention-over-configuration patterns. These look like violations but are the framework's intended usage.

- **Intentional design choices:** Code documented in task notes or spec as deliberately chosen. If TASKS.md notes say "using X approach because Y," do not flag X as a problem.

- **Concern handled elsewhere:** Validation in middleware instead of controller, error handling in a global handler instead of per-function, authorization in a policy instead of inline. Check the full request lifecycle before flagging missing logic.

- **Official boilerplate:** Configuration files, migration stubs, factory patterns, and scaffolding that follows the framework's official documentation pattern. These are not "dead code" or "standards violations."

- **Dynamic usage:** Dependency injection containers, event listeners, magic methods, reflection-based invocations. Static code reading misses runtime resolution -- check for DI bindings, event registrations, and service provider configurations before flagging "unused" code.

**Matching against `.bee/false-positives.md`:** Each entry in false-positives.md has a file path, finding description, and reason. When you encounter a potential finding, check:
1. Does the file match (same file or same pattern of file)?
2. Does the issue match (same type of concern)?
3. Does the reason still apply (has the code changed since the FP was documented)?

If all three match, exclude the finding. If the code has changed since the FP was documented, include the finding -- the FP may no longer be valid.

**When in doubt, include the finding.** The finding-validator will classify it as FALSE POSITIVE or STYLISTIC if appropriate. Better to report a borderline case than miss a real bug.

## Review Checklist

### 1. Spec Compliance

Read spec.md and TASKS.md acceptance criteria first. For each criterion, verify the implementation delivers the specified behavior.

- [ ] All acceptance criteria from TASKS.md have corresponding implementation
- [ ] Behavior matches spec.md requirements (not just structure -- actual behavior)
- [ ] No extra features beyond spec (YAGNI -- flag any unrequested additions)
- [ ] Edge cases described in spec are handled
- [ ] Return values, error states, and user-visible messages match spec

### 2. Stack Standards

Read the stack skill from `skills/stacks/{stack}/SKILL.md` (where `{stack}` comes from config.json). Apply stack-specific conventions to every file.

- [ ] Read the stack skill for framework conventions
- [ ] File naming follows stack conventions
- [ ] Directory structure matches stack patterns
- [ ] Framework APIs used correctly (no anti-patterns)
- [ ] Import patterns follow stack conventions
- [ ] Read the global standards skill (`skills/standards/global/SKILL.md`) for cross-stack rules
- [ ] If reviewing frontend code: read the frontend standards skill (`skills/standards/frontend/SKILL.md`) for component architecture, a11y, responsive design, and CSS methodology
- [ ] If reviewing backend code: read the backend standards skill (`skills/standards/backend/SKILL.md`) for API design, database, migrations, and query optimization

### 3. Dead Code

Use Grep to search for usage of each export, function, and import. Do not rely on reading a single file -- verify cross-file references.

- [ ] No unused imports in any file
- [ ] No unreachable code (after return, break, throw)
- [ ] No orphaned functions or components (defined but never called or rendered)
- [ ] No commented-out code blocks
- [ ] No unused variables or parameters (check for underscore-prefix convention before flagging)

### 4. Code Quality

- [ ] No DRY violations (duplicated logic that should be extracted)
- [ ] Functions and methods are reasonably sized (not exceeding ~50 lines)
- [ ] Variable and function names are clear and descriptive
- [ ] Error handling is present for all fallible operations

### 5. Security

- [ ] No hardcoded secrets or credentials
- [ ] User input is validated and sanitized before use
- [ ] Authentication checks on protected routes and endpoints
- [ ] No raw SQL or unsanitized database queries
- [ ] Sensitive data not exposed in client-facing responses

### 6. TDD Compliance

Read the testing standards skill (`skills/standards/testing/SKILL.md`) for project-specific test conventions. Verify tests exist and cover the acceptance criteria.

- [ ] Test files exist for every production file
- [ ] Tests cover all acceptance criteria from TASKS.md
- [ ] Tests test behavior, not implementation details
- [ ] Tests would fail if the feature were removed (not trivially passing)
- [ ] Test file naming and location follows the project test conventions

### 7. Pattern Consistency

- [ ] New code follows patterns established in existing codebase
- [ ] Naming matches existing conventions (not introducing new conventions)
- [ ] Directory organization matches existing structure
- [ ] Error handling pattern matches existing error handling

## Output Format

Write REVIEW.md to the phase directory (same location as TASKS.md).

Use the template at `skills/core/templates/review-report.md` as the format reference. The template defines:

- **Summary section** with spec, phase, date, iteration number, and status
- **Counts tables** for severity and category totals
- **Findings section** with individual finding entries

Each finding gets a sequential ID: `F-001`, `F-002`, `F-003`, etc.

For every finding, include all 8 fields:

1. **Severity:** Critical, High, or Medium
2. **Category:** Bug, Spec Gap, Standards, Dead Code, Security, TDD, or Pattern
3. **File:** Exact file path relative to project root
4. **Lines:** Start and end line numbers (be specific -- generic findings without location are useless)
5. **Description:** Detailed explanation of what is wrong and why
6. **Suggested Fix:** Concrete description of what to change
7. **Validation:** Set to `pending` (the review command handles validation)
8. **Fix Status:** Set to `pending` (the review command handles fixing)

**Summary counts:** After writing all findings, fill in the summary tables at the top of REVIEW.md:
- Severity counts table: total findings per severity level (set Real Bug, False Positive, Stylistic, and Fixed columns to 0 -- these are updated after validation)
- Category counts table: total findings per category

**Finding quality checklist (self-check before writing):**
- Every finding has a specific file path (not "various files" or "multiple locations")
- Every finding has line numbers (not "somewhere in the file")
- Every description explains WHY the code is wrong, not just WHAT is wrong
- Every suggested fix is concrete enough for another agent to implement

Do NOT include findings you are not confident about. Do NOT include findings that match documented false positives. Do NOT include vague findings without specific file and line references.
