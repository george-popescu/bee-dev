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

### Step 3: Compute Output Path

1. Create `.bee/quick-reviews/` directory if it does not exist.
2. Check what files already exist for today's date (YYYY-MM-DD pattern).
3. Set `{review_output_path}` = `.bee/quick-reviews/YYYY-MM-DD-{N}.md` where N is `(existing count for today) + 1`.

### Step 3.9: Extract False Positives

Before spawning review agents, extract documented false positives so each agent can exclude known non-issues:

1. Read `.bee/false-positives.md` using the Read tool.
2. If the file exists, build a formatted false-positives list from its contents. Extract each `## FP-NNN` entry with its finding description, reason, and file reference. Format the list as:
   ```
   EXCLUDE these documented false positives from your findings:
   - FP-001: {summary} ({file}, {reason})
   - FP-002: {summary} ({file}, {reason})
   ...
   ```
3. If the file does not exist, set the false-positives list to: `"No documented false positives."`
4. This formatted list is included verbatim in each agent's context packet in Step 4.

### Step 4: Spawn Three Specialized Review Agents (parallel)

Spawn three specialized review agents in parallel. Each agent focuses on a distinct review domain. The command (not the agents) writes the consolidated REVIEW.md after collecting all findings. The plan-compliance-reviewer is excluded because quick reviews have no spec or plan context.

#### 4.1: Build context packets

Build three agent-specific context packets. Each includes the changed files list, "quick review mode" instruction, and the false-positives list from Step 3.9:

**Agent 1: Bug Detector** (`bee:bug-detector`, `model: "sonnet"`)
```
QUICK REVIEW MODE -- No spec, no TASKS.md, no phase context.

You are reviewing changed files for bugs and security issues.

Review ONLY these changed files:
{$REVIEW_FILES -- one per line}

Project stack: {stack from config.json}

{false-positives list from Step 3.9}

SKIP these categories (no spec/phase context to evaluate):
- Spec Compliance (no spec exists)
- TDD Compliance (no acceptance criteria to check)

Review these files for bugs, logic errors, null handling issues, race conditions, edge cases, and security vulnerabilities (OWASP). Report only HIGH confidence findings in your standard output format.

Target 1-3 findings. Only report issues you have HIGH confidence in.
```

**Agent 2: Pattern Reviewer** (`bee:pattern-reviewer`, `model: "sonnet"`)
```
QUICK REVIEW MODE -- No spec, no TASKS.md, no phase context.

You are reviewing changed files for pattern deviations against the existing codebase.

Review ONLY these changed files:
{$REVIEW_FILES -- one per line}

{false-positives list from Step 3.9}

Compare changed files against existing codebase patterns only. There is no spec to reference -- focus on whether the changed files follow the patterns already established in the project. For each file, find 2-3 similar existing files and compare.

Target 1-3 findings. Only report deviations you have HIGH confidence in.
```

**Agent 3: Stack Reviewer** (`bee:stack-reviewer`, `model: "sonnet"`)
```
QUICK REVIEW MODE -- No spec, no TASKS.md, no phase context.

You are reviewing changed files for stack best practice violations.

Review ONLY these changed files:
{$REVIEW_FILES -- one per line}

Project stack: {stack from config.json}

{false-positives list from Step 3.9}

Check changed files against stack conventions only. Load the stack skill from config.json and verify all code follows the stack's conventions. Use Context7 to verify framework best practices.

Target 1-3 findings. Only report violations you have HIGH confidence in.
```

#### 4.2: Spawn all three agents in parallel

Spawn all three agents via three Task tool calls in a SINGLE message (parallel execution). Use `model: "sonnet"` for all three agents -- they perform focused scope scanning and classification work.

Wait for all three agents to complete.

#### 4.3: Parse findings from each agent

After all three agents complete, parse findings from each agent's final message. Each agent has a distinct output format -- normalize all findings into a unified list:

**Bug Detector** findings (from `## Bugs Detected` section):
- Each `- **[Bug type]:** [Description] - \`file:line\`` entry becomes one finding
- Severity: taken from the Critical/High/Medium subsection the entry appears under
- Category: "Bug" (or "Security" if the bug type mentions security, injection, XSS, CSRF, auth, or access control)

**Pattern Reviewer** findings (from `## Project Pattern Deviations` section):
- Each `- **[Pattern type]:** [Deviation description] - \`file:line\`` entry becomes one finding
- Severity: Medium (pattern deviations default to Medium)
- Category: "Pattern"

**Stack Reviewer** findings (from `## Stack Best Practice Violations` section):
- Each `- **[Rule category]:** [Violation description] - \`file:line\`` entry becomes one finding
- Severity: Medium (stack violations default to Medium)
- Category: "Standards"

If an agent reports no findings (e.g., "No bugs detected.", "No project pattern deviations found.", "No stack best practice violations found."), it contributes zero findings.

#### 4.4: Deduplicate and merge

For each pair of findings from different agents, check if they reference the same file AND their line ranges overlap (within 5 lines of each other). If so, merge them:
- Keep the higher severity (Critical > High > Medium)
- Combine categories (e.g., "Bug, Standards")
- Combine descriptions (concatenate with "; " separator)
- Use the broader line range

#### 4.5: Assign IDs and write REVIEW.md

1. Assign sequential IDs to all merged findings: F-001, F-002, F-003, ...
2. Write `{review_output_path}` using the review-report template (`skills/core/templates/review-report.md`):
   - Fill in the Summary section: Spec="Quick Review", Phase="N/A", date, iteration=1, status: PENDING
   - Fill in the Counts tables (by severity and by category)
   - Write each finding as a `### F-NNN` section with: Severity, Category, File, Lines, Description, Suggested Fix, Validation: pending, Fix Status: pending
   - Leave the False Positives section empty
   - Leave the Fix Summary table with one row per finding, all showing "pending"
3. Verify the REVIEW.md was written by reading it back with the Read tool.

#### 4.6: Evaluate findings

1. Count total findings, count by severity (critical, high, medium), count by category.

2. If 0 findings after consolidation:
   - Display: "Quick review: clean code! No findings."
   - Stop here.

3. Display findings summary: "{N} findings from 3 reviewers: {critical} critical, {high} high, {medium} medium"

4. If more than 10 findings: present the list to user before proceeding:
   "The review found {N} findings (above typical range). Review the list at {review_output_path} and confirm you want to proceed with validation."
   Wait for user confirmation. If user declines, stop.

### Step 5: Validate Findings

1. For each finding, spawn `finding-validator` agent via Task tool with `model: "sonnet"` (single-finding classification):
   - Build validation context: finding ID, summary, severity, category, file path, line range, description, suggested fix, and `source_agent` (the specialist agent that originally produced the finding -- determined by category mapping: Bug/Security -> `bug-detector`, Pattern -> `pattern-reviewer`, Standards -> `stack-reviewer`)
   - Batch up to 5 validators in parallel (they are read-only and independent)
2. Collect classifications from each validator's final message (the `## Classification` section with Finding, Verdict, Confidence, Source Agent, and Reason fields)
3. Escalate MEDIUM confidence classifications to specialist agents for a second opinion:
   - Filter the collected classifications: separate HIGH confidence (proceed unchanged) from MEDIUM confidence (need escalation)
   - For each MEDIUM confidence classification, read the `Source Agent` field to identify which specialist originally found the issue (one of: `bug-detector`, `pattern-reviewer`, or `stack-reviewer`)
   - Spawn the identified specialist agent (`bee:{source_agent}`) via Task tool with `model: "sonnet"` and a context packet containing:
     ```
     You are providing a second opinion on a review finding that received an uncertain classification.

     ## Original Finding
     - **ID:** F-{NNN}
     - **Severity:** {severity}
     - **Category:** {category}
     - **File:** {file_path}
     - **Lines:** {line_range}
     - **Description:** {description}
     - **Suggested Fix:** {suggested_fix}

     ## Validator Classification
     - **Verdict:** {verdict}
     - **Confidence:** MEDIUM
     - **Reason:** {validator_reason}

     ## Your Task
     Provide a second opinion on whether this finding is valid. Read the file and surrounding context. Respond with your verdict: REAL BUG or FALSE POSITIVE, followed by your reasoning.

     End your response with:
     ## Second Opinion
     - **Verdict:** {REAL BUG | FALSE POSITIVE}
     - **Reason:** {your reasoning}
     ```
   - Specialist escalations are spawned SEQUENTIALLY (one at a time) -- each is a focused re-analysis
   - After the specialist responds, parse the `## Second Opinion` section from the specialist's final message
   - Use the specialist's verdict as the FINAL classification, overriding the validator's uncertain MEDIUM confidence classification
   - If the specialist confirms REAL BUG: the finding stays with verdict REAL BUG
   - If the specialist says FALSE POSITIVE: the finding's verdict becomes FALSE POSITIVE
   - Record the escalation: append " (Escalated to {source_agent} -- reclassified as {verdict})" to the finding's Validation field in REVIEW.md (e.g., "FALSE POSITIVE (Escalated to bug-detector -- reclassified as FALSE POSITIVE)" or "REAL BUG (Escalated to pattern-reviewer -- reclassified as REAL BUG)")
   - Display each escalation: "Escalated F-{NNN} to {source_agent} -- reclassified as {verdict}"
4. Read current REVIEW.md from disk (fresh read -- validators may have run in parallel batches). Update the REVIEW.md file with classifications:
   - Set each finding's Validation field to the final classification:
     - HIGH confidence findings: the validator's verdict (REAL BUG / FALSE POSITIVE / STYLISTIC)
     - Escalated MEDIUM confidence findings: the specialist's verdict with escalation note (e.g., "REAL BUG (Escalated to bug-detector -- reclassified as REAL BUG)")
   - Update the Counts table with classification breakdown
5. Handle FALSE POSITIVE findings (including those reclassified by specialist escalation):
   - If `.bee/false-positives.md` does not exist, create it with a `# False Positives` header
   - For each FALSE POSITIVE finding, append an entry:
     ```
     ## FP-{NNN}: {one-line summary}
     - **Finding:** {original finding description from REVIEW.md}
     - **Reason:** {validator's reason for FALSE POSITIVE classification}
     - **Scope:** Quick Review
     - **Date:** {current ISO 8601 date}
     ```
   - For findings reclassified as FALSE POSITIVE via specialist escalation, include the specialist's reason (not the validator's) in the Reason field
   - Update REVIEW.md: set the finding's Fix Status to "False Positive"
6. Handle STYLISTIC findings (user interaction):
   - For each STYLISTIC finding, present to user:
     "STYLISTIC finding: F-{NNN} -- '{summary}'. Options: (a) Fix it, (b) Ignore, (c) False Positive (won't be flagged again)"
   - Wait for user response for each STYLISTIC finding
   - If user chooses (a): add finding to the confirmed fix list
   - If user chooses (b): mark as "Skipped (user ignored)" in REVIEW.md Fix Status
   - If user chooses (c): append to `.bee/false-positives.md` (same format as step 5) and mark as "False Positive" in REVIEW.md
7. Build confirmed fix list: all REAL BUG findings + user-approved STYLISTIC findings (those where user chose option a)

If 0 confirmed findings after validation:
- Display: "All findings were false positives or ignored. Code is clean!"
- Stop.

Display validated summary:

```
Validated: {real_bug} real bugs, {false_positive} false positives, {stylistic} stylistic ({user_fix} to fix, {user_ignore} ignored), {escalated} escalated ({escalated_real_bug} confirmed, {escalated_false_positive} reclassified as FP)
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
- Three specialized agents (bug-detector, pattern-reviewer, stack-reviewer) replace the single reviewer agent. All three run in parallel via three Task tool calls in a single message. All use `model: "sonnet"` (focused scope scanning/classification work).
- The plan-compliance-reviewer is excluded because quick reviews have no spec or plan context to evaluate.
- The command (not the agents) writes REVIEW.md. Agents report findings in their own output formats; the command normalizes, deduplicates, and writes the unified REVIEW.md.
- Step 3.9 extracts false positives BEFORE spawning agents. Each agent receives the formatted false-positives list in its context packet so it can self-filter.
- Deduplication merges findings from different agents when they reference the same file AND line ranges overlap within 5 lines. Higher severity is kept, categories and descriptions are combined.
- Each agent targets 1-3 findings; combined target is 3-8 findings (reduced from the standard 5-15) since the scope is smaller.
- REVIEW.md is saved to `.bee/quick-reviews/` directory for audit trail, not to a phase directory.
- Does NOT update STATE.md Phases table (no phase exists). Quick reviews are ephemeral.
- The validate-fix pipeline (Steps 5-7) reuses the same finding-validator and fixer agents as `/bee:review`.
- Always use Read-Modify-Write pattern when updating REVIEW.md (re-read before each write).
