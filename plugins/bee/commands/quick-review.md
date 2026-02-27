---
description: Lightweight review of uncommitted changes -- no spec required
argument-hint: ""
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` -- if not found: NOT_INITIALIZED
- `.bee/config.json` -- if not found: use `{}`
- `.bee/PROJECT.md` -- if not found: skip (project index not available)

## Instructions

You are running `/bee:quick-review` -- a lightweight code review for changes that don't belong to a spec/phase pipeline. This reviews uncommitted or recently committed quick-task changes against stack standards, common bugs, and security basics. Follow these steps in order.

### Step 1: Validation Guards

Check these guards in order. Stop immediately if any fails:

1. **NOT_INITIALIZED guard:** If `.bee/STATE.md` does not exist (NOT_INITIALIZED), tell the user:
   "BeeDev is not initialized. Run `/bee:init` first."
   Do NOT proceed.

2. **Changes exist guard:** Run `git diff --stat` and `git diff --cached --stat` via Bash. If BOTH are empty (no unstaged and no staged changes), check `git status --short` for untracked files. If no changes and no untracked files exist, tell the user:
   "No changes to review. Make some changes first, or use `/bee:review` for phase-based review."
   Do NOT proceed.

### Step 2: Detect Review Scope

1. Run `git diff --stat` and `git diff --cached --stat` to identify all changed files (staged + unstaged)
2. Run `git status --short` to also catch untracked files
3. Filter to source files only (`.php`, `.js`, `.ts`, `.jsx`, `.tsx`, `.vue`, `.css`, `.scss`, `.json` config files). Exclude lock files, generated files, and `.bee/` directory files.
4. Store the filtered file list as `$REVIEW_FILES`
5. If `$REVIEW_FILES` is empty after filtering, tell the user:
   "No reviewable source files found in changes. Only non-source files were modified."
   Do NOT proceed.

Display to user:

```
Quick review scope: {count} files
{file list}

Starting lightweight review...
```

### Step 2.5: Build & Test Gate

**Build check (automatic):**

1. Check `package.json` for a `build` script. If stack is PHP-only, skip.
2. If a build script exists, run `npm run build` via Bash.
3. If build **fails**: display the error and ask:
   "Build failed. (a) Fix first (b) Continue review anyway"
   - If (a): stop.
   - If (b): continue.
4. If build **passes**: display "Build: OK".
5. If no build script: display "Build: skipped" and continue.

**Test check (user opt-in):**

Ask: "Run tests before review? (yes/no)"

If **yes**:
1. Read `testRunner` from `config.json`. If `none`, skip.
2. Run the test command with parallel support:
   - `vitest`: `npx vitest run`
   - `jest`: `npx jest --maxWorkers=auto`
   - `pest`: `./vendor/bin/pest --parallel`
3. If tests **pass**: display "Tests: passed". Continue.
4. If tests **fail**: display failures and ask: "(a) Fix first (b) Continue review anyway"

If **no**: display "Tests: skipped" and continue.

### Step 3: Spawn Reviewer

Before spawning the reviewer, compute the output path:
1. Create `.bee/quick-reviews/` directory if it does not exist.
2. Check what files already exist for today's date (YYYY-MM-DD pattern).
3. Set `{review_output_path}` = `.bee/quick-reviews/YYYY-MM-DD-{N}.md` where N is `(existing count for today) + 1`.

Spawn the `reviewer` agent via Task tool with `model: "sonnet"` (quick review is a focused scope scan, not deep multi-phase analysis) and an adapted context packet for quick-review mode:

```
Task(
  subagent_type="bee:reviewer",
  description="Quick review: {count} changed files",
  prompt="
    QUICK REVIEW MODE -- No spec, no TASKS.md, no phase context.

    Review ONLY these changed files against stack conventions, code quality, and common bug patterns:
    {$REVIEW_FILES -- one per line}

    Project stack: {stack from config.json}
    False positives: {path to .bee/false-positives.md if exists, otherwise 'none'}

    Review focus (in priority order):
    1. Bug: Logic errors, null handling, incorrect behavior, edge cases
    2. Security: Input validation, injection, data exposure relevant to the stack
    3. Stack Standards: Naming, structure, imports, framework best practices
    4. Dead Code: Unused imports, unreachable paths, orphaned functions
    5. Pattern Consistency: Does new code follow existing codebase patterns?

    SKIP these categories (no spec/phase context to evaluate):
    - Spec Compliance (no spec exists)
    - TDD Compliance (no acceptance criteria to check)

    Write REVIEW.md to the current directory (you will be told the output path).
    Target 3-8 findings. Only report issues you have HIGH confidence in.
    Use the same REVIEW.md format as standard reviews (F-NNN IDs, severity, category, file, line range, description, suggested fix).

    Output path for REVIEW.md: {review_output_path}
  "
)
```

Wait for the reviewer to complete.

### Step 4: Parse and Present Findings

1. Read the REVIEW.md produced by the reviewer. If it does not exist, tell the user: "Reviewer did not produce findings. Review failed." Stop.
2. Parse findings (each `### F-NNN` section)
3. Count by severity and category

If 0 findings:
- Display: "Quick review: clean code! No findings."
- Stop.

Display findings summary:

```
Quick review: {N} findings

{For each finding:}
F-{NNN} [{severity}] {category}: {one-line summary}
  {file}:{line_range}
```

### Step 5: Validate Findings

1. For each finding, spawn `finding-validator` agent via Task tool with `model: "sonnet"` (single-finding classification):
   - Build validation context: finding ID, summary, severity, category, file path, line range, description, suggested fix
   - Batch up to 5 validators in parallel (they are read-only and independent)
2. Collect classifications (REAL BUG / FALSE POSITIVE / STYLISTIC)
3. Update the REVIEW.md file with classifications
4. Handle FALSE POSITIVE findings:
   - Create or update `.bee/false-positives.md` with documented false positives
   - Mark as "False Positive" in REVIEW.md
5. Filter to confirmed findings: all REAL BUG + STYLISTIC findings

If 0 confirmed findings after validation:
- Display: "All findings were false positives. Code is clean!"
- Stop.

Display validated summary:

```
Validated: {real_bug} real bugs, {false_positive} false positives, {stylistic} stylistic
```

### Step 6: User Decision

Present options to the user:

```
{confirmed_count} confirmed finding(s) to address.

Options:
(a) Fix findings -- spawn fixer agents to address confirmed issues
(b) Commit anyway -- acknowledge findings and proceed
(c) Cancel -- stop here, review saved at {review_output_path}
```

Wait for user response:
- **(a) Fix:** proceed to Step 7
- **(b) Commit anyway:** display "Findings acknowledged. Run `/bee:commit` or `/bee:quick` to commit." Stop.
- **(c) Cancel:** display "Review saved at {review_output_path}." Stop.

### Step 7: Fix Confirmed Issues

For EACH confirmed finding in priority order (SEQUENTIAL -- one at a time, never parallel):

1. Build fixer context packet:
   - Finding details: ID, summary, severity, category, file path, line range, description, suggested fix
   - Validation classification: REAL BUG or STYLISTIC
   - Stack info: stack name from config.json
2. Spawn `fixer` agent via Task tool (omit model -- fixers write production code and need full reasoning)
3. WAIT for the fixer to complete before spawning the next
4. Read fixer's report from its final message
5. Update REVIEW.md: set Fix Status (Fixed / Reverted / Failed)
6. If fixer reports tests broke: display failure, mark as "Skipped (tests failed)", continue

CRITICAL: Spawn fixers SEQUENTIALLY. One fix may change context for the next.

After all findings processed, display:

```
Quick review complete!

Findings: {total} total
- Fixed: {fixed}
- False positives: {fp}
- Skipped: {skipped}

Review saved: {review_output_path}
```

---

**Design Notes (do not display to user):**

- Quick review is INDEPENDENT of the spec/phase pipeline. It does not require a spec, phases, or TASKS.md.
- Review scope is determined by git diff (uncommitted changes), not by a TASKS.md file list.
- The reviewer runs in "quick review mode" with reduced categories (no Spec Compliance, no TDD Compliance) since there is no spec or acceptance criteria.
- Findings target 3-8 (reduced from the standard 5-15) since the scope is smaller.
- REVIEW.md is saved to `.bee/quick-reviews/` directory for audit trail, not to a phase directory.
- Does NOT update STATE.md Phases table (no phase exists). Quick reviews are ephemeral.
- The validate-fix pipeline reuses the same finding-validator and fixer agents as `/bee:review`.
- Always use Read-Modify-Write pattern when updating REVIEW.md (re-read before each write).
