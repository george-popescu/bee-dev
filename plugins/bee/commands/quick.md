---
description: Execute a quick task without the full spec pipeline — just describe, execute, commit
argument-hint: "[--fast] [--review] [--amend] [task description]"
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`
- `.bee/PROJECT.md` — if not found: skip (project index not available)

Read `config.implementation_mode` and store as `$IMPL_MODE`. If not set, defaults to `"quality"`. Valid values: `"economy"` (use sonnet for all agent work to reduce cost), `"quality"` (use best models for reasoning-heavy work, sonnet for scanning), or `"premium"` (use best models for all agents).

## Instructions

You are running `/bee:quick` -- the fast-track command for small tasks that don't need the full spec > plan > execute > review pipeline. Think bug fixes, config tweaks, small refactors, dependency updates. Follow these steps in order.

### Step 1: Validation Guard

**NOT_INITIALIZED guard:** If `.bee/STATE.md` does not exist (NOT_INITIALIZED), tell the user:
"BeeDev is not initialized. Run `/bee:init` first."
Do NOT proceed.

No spec is required for quick tasks. No phase is required.

### Step 2: Parse Arguments

Check `$ARGUMENTS` for flags and task description.

1. **Check for `--fast` flag.** If present, store `$USE_FAST = true` and remove the flag from the remaining text.
2. **Check for `--amend` flag.** If present, store `$AMEND = true` and remove the flag from the remaining text. Check if the next token is a number -- if so, store it as `$AMEND_NUMBER` and remove it from the remaining text. If no number follows `--amend`, set `$AMEND_NUMBER = null` (will resolve to latest quick task).
3. **Check for `--review` flag.** If present, store `$USE_REVIEW = true` and remove the flag from the remaining text. Otherwise `$USE_REVIEW = false`. Also check `config.json` for `quick.review` setting -- if true, set `$USE_REVIEW = true` regardless of flag.
4. **Determine `$USE_FAST` (if not already set by `--fast`):**
   - If `--fast` was present, `$USE_FAST = true` (already set above).
   - Otherwise, check `config.json` for `quick.fast` setting -- if `true`, set `$USE_FAST = true`. If `false` or not set, set `$USE_FAST = false`.
   - Default when no flag and no config: `$USE_FAST = false` (TDD path is default).
5. **If `$AMEND` is true**, jump to Step 2a (Amend Flow) below.
6. **Get task description.** Use the remaining text after flag removal as `$DESCRIPTION`.
7. If `$DESCRIPTION` is empty, ask the user:

```
What's the quick task? Describe what you want to do.
```

Wait for the user's response. Store as `$DESCRIPTION`.

---

#### Step 2a: Amend Flow

When `--amend` is set:

1. **Resolve task number.** If `$AMEND_NUMBER` is null, read `.bee/STATE.md` and find the LATEST quick task row (highest number). Store as `$AMEND_NUMBER`.
2. **Find plan file.** Look in `.bee/quick/` for a file matching the prefix `{$AMEND_NUMBER zero-padded to 3 digits}-` (e.g., `003-`). Store the resolved path as `$PLAN_FILE`.
3. **If no plan file found**, display: "No plan file found for quick task {N}. Only tasks with plans can be amended." Stop.
4. **Set `$N` to `$AMEND_NUMBER`** (amend preserves the original task number, does not increment).
5. **Read the plan file** and present it to the user:

```
Current plan for quick task {N}:

{plan file contents}

What would you like to change?
```

5. Wait for the user's response. Update the plan file with the requested changes.
6. Set `$DESCRIPTION` from the plan file's title (the `# Quick Task {N}: {DESCRIPTION}` heading).
7. Set `$USE_FAST` and `$USE_REVIEW` from the plan file's metadata (Mode and Review fields). Mode `tdd` maps to `$USE_FAST = false`; Mode `fast` maps to `$USE_FAST = true`.
8. Proceed to Step 4 (Execute), using the amended plan file as context for the implementer.
9. After execution completes, update the plan file's `## Execution Notes` section and set Status to EXECUTED.
10. In Step 6 (Update STATE.md), the single-row replacement handles this naturally — the amended task becomes the latest entry.

---

### Step 3: Confirm Scope

Present the task back to the user:

```
Quick task: {DESCRIPTION}
Mode: {!$USE_FAST ? "tdd (implementer agent with Red-Green-Refactor)" : "fast (direct, no tests)"}
Review: {USE_REVIEW ? "yes (lightweight review before commit)" : "no"}

This will:
1. Implement the changes {!$USE_FAST ? "using TDD implementer agent" : "directly"}
{USE_REVIEW ? "2. Review changes for bugs and standards" : ""}
{USE_REVIEW ? "3" : "2"}. Commit the result
{USE_REVIEW ? "4" : "3"}. Track it in STATE.md

Proceed? (yes/no)
```

If the user says no, stop. If yes, continue.

### Step 3.5: Persist Plan (TDD mode only)

**Skip this step entirely if `$USE_FAST` is true (fast mode).** Fast mode produces no plan artifacts.

1. Create `.bee/quick/` directory if it doesn't exist.
2. Read `.bee/STATE.md` and parse the `#` column value from the existing single data row in the `## Quick Tasks` table. If a row exists, set `$N` to that number + 1. If no data rows exist, set `$N` to 1.
3. Slugify the description: lowercase, replace spaces with hyphens, strip all characters except `a-z`, `0-9`, and hyphens, collapse consecutive hyphens, trim leading/trailing hyphens, truncate to 50 characters.
4. Write plan file to `.bee/quick/{NNN}-{slug}.md` (3-digit zero-padded number) with this content:

```markdown
# Quick Task {N}: {DESCRIPTION}

- Date: {YYYY-MM-DD}
- Mode: {tdd|fast}
- Review: {yes|no}
- Status: PLANNED

## Description
{DESCRIPTION}

## Acceptance Criteria
{Derive 3-8 testable acceptance criteria from the task description. Each criterion should be a concrete, verifiable statement that the implementer can write a test for. Format as a numbered list.}

## Test File Targets
{Based on the description and project structure, list the test file path(s) the implementer should create. Use existing test directory conventions from the project.}

## Pattern References
{List 2-4 existing files in the codebase that the implementer should read as pattern references before writing code. Prioritize files that are structurally similar to what will be created or modified.}

## Research
{To be filled by researcher agent}

## Execution Notes
{To be filled after execution}
```

5. Store the plan file path as `$PLAN_FILE`.

### Step 4: Execute

**If `$USE_FAST` is true (fast mode):** execute directly in main context.

**If `$USE_FAST` is false (default TDD mode):** use the agent pipeline described in Step 4b below.

---

#### Step 4a: Direct Execution (fast mode)

Implement the task directly. Follow these rules:

1. **Read before writing.** Always read existing files before modifying them.
2. **Use the project's stack conventions.** Check `config.json` for the configured stacks. Determine which stack the modified files belong to by comparing file paths against each stack's `path` (a file matches a stack if its path starts with or is within the stack's path; `"."` matches everything). If unclear, use the first stack (`stacks[0]`). Follow the standards for that stack.
3. **Keep it small.** Quick tasks should touch a few files at most. If the task grows beyond ~5 files, suggest the user run `/bee:new-spec` instead.
4. **Resolve per-stack linter.** For the relevant stack, resolve the linter: read `stacks[i].linter` first, fall back to root `config.linter` if absent, then `"none"`. If a linter is configured, run it on modified files after implementation scoped to the stack's path.
5. **Run tests if relevant.** If you modified code that has existing tests, resolve the test runner for the relevant stack: read `stacks[i].testRunner` first, fall back to root `config.testRunner` if absent, then `"none"`. Run the test suite scoped to the stack's path to verify nothing broke.

After implementation, present a summary:

```
Done. Changes:
- {file1}: {what changed}
- {file2}: {what changed}
...
```

If `$USE_REVIEW` is true, continue to Step 4.5. Otherwise skip to Step 5.

---

#### Step 4b: Agent Execution (default TDD mode)

Use the Task tool to spawn specialized agents. The TDD implementer enforces Red-Green-Refactor with tests written before production code.

**Phase 1: Research**

Spawn the `researcher` agent to understand the codebase area before making changes. Research findings will be persisted to the plan file for traceability.

**Model selection for researcher:** If `$IMPL_MODE` is `"premium"`, omit the model parameter (inherit parent model). If `$IMPL_MODE` is `"economy"` or `"quality"` (default), pass `model: "sonnet"` (research is scanning work).

```
Task(
  subagent_type="bee:researcher",
  {$IMPL_MODE == "premium" ? '' : 'model="sonnet",'}

  description="Research: {DESCRIPTION}",
  prompt="
    QUICK TASK RESEARCH MODE -- No TASKS.md, no phase context.

    Research the codebase to understand how to: {DESCRIPTION}

    Project stack: {stack from config.json}

    Find:
    1. Relevant files and their current implementation
    2. Patterns and conventions used in this area
    3. Dependencies and imports that will be affected
    4. Existing tests that cover this area

    Do NOT write to TASKS.md -- return your findings in your final message as a concise
    summary with specific file paths and line numbers.

    Your findings will be persisted to the plan file at {$PLAN_FILE} for future reference.
  "
)
```

Store the research output as `$RESEARCH`.

**Persist research to plan file:** After the researcher returns, read `$PLAN_FILE` and update the `## Research` section with `$RESEARCH` content. Write the updated plan file to disk.

**Research complete — present menu:**

```
AskUserQuestion(
  question: "Research complete. Plan: {$PLAN_FILE}",
  options: ["Execute", "Revise plan", "Custom"]
)
```

- **Execute**: Proceed to spawn quick-implementer agent (Phase 2 below).
- **Revise plan**: Use AskUserQuestion to ask for revision instructions, update the plan file accordingly, then proceed to Phase 2.
- **Custom**: Wait for free-text input from the user and act on it.

**Phase 2: Implementation (TDD)**

Spawn the `quick-implementer` agent with the research context, plan file path, and enriched plan content. The quick-implementer enforces TDD: it reads acceptance criteria from the plan file, writes failing tests first, then implements the minimal code to make tests pass.

**Model selection:** If `$IMPL_MODE` is `"economy"`, pass `model: "sonnet"`. If `$IMPL_MODE` is `"quality"` or `"premium"`, omit the model parameter (inherit parent model).

```
Task(
  subagent_type="bee:quick-implementer",
  {$IMPL_MODE == "economy" ? 'model="sonnet",' : ''}
  description="Implement (TDD): {DESCRIPTION}",
  prompt="
    Implement this task using TDD (Red-Green-Refactor): {DESCRIPTION}

    Project stack: {stack from config.json}
    Linter: {resolved linter for this stack: stacks[i].linter ?? config.linter ?? "none"}
    Test runner: {resolved test runner for this stack: stacks[i].testRunner ?? config.testRunner ?? "none"}

    Plan file: {$PLAN_FILE}
    Read this file for acceptance criteria, test file targets, pattern references,
    and research findings before starting implementation.

    The plan file contains:
    - ## Acceptance Criteria -- drive your test writing from these
    - ## Test File Targets -- create tests at these paths
    - ## Pattern References -- read these files as code patterns to follow
    - ## Research -- context about the codebase area

    Follow the TDD cycle:
    1. RED: Write failing tests based on acceptance criteria
    2. GREEN: Write minimal code to make tests pass
    3. REFACTOR: Clean up with passing tests as safety net

    When done, end with: Task complete. [X] tests passing.
  "
)
```

After the implementer returns, present the summary to the user:

```
Agent execution complete.

Changes:
- {file1}: {what changed}
- {file2}: {what changed}

Tests: {pass/fail summary}
```

**Persist execution notes to plan file:** After the implementer returns, read `$PLAN_FILE` and update the `## Execution Notes` section with a summary of the changes made. Set `Status:` to `EXECUTED`. Write the updated plan file to disk.

If the implementer reported failures or issues, present them and ask the user how to proceed before continuing to Step 4.5.

**Implementation complete — present menu:**

```
AskUserQuestion(
  question: "Implementation complete. [X] tests passing.",
  options: ["Review", "Accept", "Custom"]
)
```

Replace `[X]` with the actual test count from the implementer's final message.

- **Review**: Proceed to Step 4.5 (spawn bug-detector, pattern-reviewer, stack-reviewer, plan-compliance-reviewer).
- **Accept**: Skip review entirely — jump directly to Step 5 (Commit).
- **Custom**: Wait for free-text input from the user and act on it.

### Step 4.5: Review Gate (if --review)

**Skip this step entirely if `$USE_REVIEW` is false.** Proceed directly to Step 5.

If `$USE_REVIEW` is true, run a review before committing. The review pipeline uses 4 agents when a plan file exists (TDD mode) or 3 agents when no plan file exists (fast mode).

**Build check:** If `package.json` has a `build` script, run `npm run build`. If it fails, display the error. Use AskUserQuestion: Question: "Build failed. How to proceed?" Options: "Fix first" (stop, user fixes), "Continue anyway" (note failure). If no build script, skip.

**Test check:** Ask: "Run tests before review? (yes/no)". If yes:
For each stack in `config.stacks`, resolve its test runner: read `stacks[i].testRunner` first, fall back to root `config.testRunner` if absent, then `"none"`. Run each stack's test runner scoped to its path. Report per-stack: "Tests: {stack.name} ({runner}): {result}".
For each stack:
1. Resolve the test runner using the fallback chain above. If `"none"`, display "Tests: {stack.name}: skipped (no test runner configured)" and continue to the next stack.
2. Run the test command scoped to the stack path (`vitest`: `cd {stack.path} && npx vitest run`, `jest`: `cd {stack.path} && npx jest --maxWorkers=auto`, `pest`: `cd {stack.path} && ./vendor/bin/pest --parallel`). Display results. If tests fail, use AskUserQuestion: Question: "Tests failed. How to proceed?" Options: "Fix first" (stop), "Continue anyway" (note failures).

#### 4.5.0: Detect review scope and compute output path

1. Run `git diff --stat` to identify all changed files. Filter to source files only (`.php`, `.js`, `.ts`, `.jsx`, `.tsx`, `.vue`, `.css`, `.scss`). Store as `$REVIEW_FILES`.
2. Create `.bee/quick-reviews/` directory if it does not exist.
3. Check what files already exist for today's date (YYYY-MM-DD pattern).
4. Set `{review_output_path}` = `.bee/quick-reviews/YYYY-MM-DD-{N}.md` where N is `(existing count for today) + 1`.

#### 4.5.1: Extract false positives

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
4. This formatted list is included verbatim in each agent's context packet in Step 4.5.2.

#### 4.5.15: Context Cache

**Context Cache (read once, pass to all agents):**

Before spawning any agents, read these files once and include their content in every agent's context packet:
1. Stack skill: `plugins/bee/skills/stacks/{stack}/SKILL.md`
2. Project context: `.bee/CONTEXT.md`
3. False positives: `.bee/false-positives.md`
4. User preferences: `.bee/user.md`

Pass these as part of the agent's prompt context — agents should NOT re-read these files themselves.

#### 4.5.2: Build context packets and spawn four agents in parallel

Build four agent-specific context packets. Each includes the changed files list, review mode instruction, and the false-positives list from Step 4.5.1.

**Model selection for review agents:** If `$IMPL_MODE` is `"economy"`, pass `model: "sonnet"` for all review agents. If `$IMPL_MODE` is `"quality"` or `"premium"`, omit the model parameter (inherit parent model) for all review agents.

**Agent 1: Bug Detector** (`bee:bug-detector`, economy: `model: "sonnet"`, quality/premium: omit)
```
QUICK REVIEW MODE -- No spec, no TASKS.md, no phase context.

You are reviewing changed files for bugs and security issues.

Review ONLY these changed files:
{$REVIEW_FILES -- one per line}

Project stack: {stack from config.json}

{false-positives list from Step 4.5.1}

SKIP these categories (no spec/phase context to evaluate):
- Spec Compliance (no spec exists)
- TDD Compliance (no acceptance criteria to check)

Review these files for bugs, logic errors, null handling issues, race conditions, edge cases, and security vulnerabilities (OWASP). Report only HIGH confidence findings in your standard output format.

Target 1-3 findings. Only report issues you have HIGH confidence in.
```

**Agent 2: Pattern Reviewer** (`bee:pattern-reviewer`, economy: `model: "sonnet"`, quality/premium: omit)
```
QUICK REVIEW MODE -- No spec, no TASKS.md, no phase context.

You are reviewing changed files for pattern deviations against the existing codebase.

Review ONLY these changed files:
{$REVIEW_FILES -- one per line}

{false-positives list from Step 4.5.1}

Compare changed files against existing codebase patterns only. There is no spec to reference -- focus on whether the changed files follow the patterns already established in the project. For each file, find 2-3 similar existing files and compare.

Target 1-3 findings. Only report deviations you have HIGH confidence in.
```

**Agent 3: Stack Reviewer** (`bee:stack-reviewer`, economy: `model: "sonnet"`, quality/premium: omit)
```
QUICK REVIEW MODE -- No spec, no TASKS.md, no phase context.

You are reviewing changed files for stack best practice violations.

Review ONLY these changed files:
{$REVIEW_FILES -- one per line}

Project stack: {stack from config.json}

{false-positives list from Step 4.5.1}

Check changed files against stack conventions only. Load the stack skill from config.json and verify all code follows the stack's conventions. Use Context7 to verify framework best practices.

Target 1-3 findings. Only report violations you have HIGH confidence in.
```

**Agent 4: Plan Compliance Reviewer** (`bee:plan-compliance-reviewer`, economy: `model: "sonnet"`, quality/premium: omit) -- **TDD mode only (skip if `$USE_FAST` is true)**

This agent is spawned only when a plan file exists (TDD mode). It checks the implementation against the plan file's acceptance criteria.

```
You are reviewing a quick task implementation in CODE REVIEW MODE against the plan file's acceptance criteria.

Plan file: {$PLAN_FILE}
Read this file and extract the ## Acceptance Criteria section.

Review ONLY these changed files:
{$REVIEW_FILES -- one per line}

Project stack: {stack from config.json}

{false-positives list from Step 4.5.1}

Check implemented code against the plan file's acceptance criteria. For each acceptance criterion, verify it has corresponding implementation. Check for missing features, incorrect behavior, and over-scope additions.

Report findings in your standard CODE REVIEW MODE output format.

Target 1-3 findings. Only report issues you have HIGH confidence in.
```

Spawn all agents via Task tool calls in a SINGLE message (parallel execution). In TDD mode, spawn all 4 agents. In fast mode, spawn only the first 3 agents (no plan-compliance-reviewer -- no plan file exists). Apply model selection per `$IMPL_MODE`: economy = `model: "sonnet"` for all agents, quality/premium = omit model parameter (inherit) for all agents.

Wait for all agents to complete.

#### 4.5.3: Parse findings from each agent

After all agents complete, parse findings from each agent's final message. Each agent has a distinct output format -- normalize all findings into a unified list:

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

**Plan Compliance Reviewer** findings (TDD mode only, from `## Plan Compliance Findings` section):
- SG-NNN entries (Spec Gap) -> Category: "Spec Gap", severity from the entry
- CI-NNN entries (Cross-Phase Integration) -> Category: "Spec Gap", severity from the entry
- OS-NNN entries (Over-Scope) -> Category: "Spec Gap", severity: Medium

If an agent reports no findings (e.g., "No bugs detected.", "No project pattern deviations found.", "No stack best practice violations found."), it contributes zero findings.

#### 4.5.4: Deduplicate and merge

For each pair of findings from different agents, check if they reference the same file AND their line ranges overlap (within 5 lines of each other). If so, merge them:
- Keep the higher severity (Critical > High > Medium)
- Combine categories (e.g., "Bug, Standards")
- Combine descriptions (concatenate with "; " separator)
- Use the broader line range

#### 4.5.5: Assign IDs and write REVIEW.md

1. Assign sequential IDs to all merged findings: F-001, F-002, F-003, ...
2. Write `{review_output_path}` using the review-report template (`skills/core/templates/review-report.md`):
   - Fill in the Summary section: Spec="Quick Review", Phase="N/A", date, iteration=1, status: PENDING
   - Fill in the Counts tables (by severity and by category)
   - Write each finding as a `### F-NNN` section with: Severity, Category, File, Lines, Description, Suggested Fix, Validation: pending, Fix Status: pending
   - Leave the False Positives section empty
   - Leave the Fix Summary table with one row per finding, all showing "pending"
3. Verify the REVIEW.md was written by reading it back with the Read tool.

#### 4.5.6: Evaluate and present findings

1. If 0 findings after consolidation: display "Quick review: clean!" and proceed to Step 5.

2. Display findings summary: "{N} findings from {agent_count} reviewers: {critical} critical, {high} high, {medium} medium"

3. For each finding, spawn `finding-validator` agent -- up to 5 in parallel -- to classify as REAL BUG / FALSE POSITIVE / STYLISTIC. Model selection: **economy** mode passes `model: "sonnet"`, **quality or premium** mode omits model (inherit parent).

4. Handle FALSE POSITIVE findings: if any findings were classified as FALSE POSITIVE, persist them to `.bee/false-positives.md`. If the file does not exist, create it with a `# False Positives` header. Read `.bee/false-positives.md`, count the number of existing `## FP-` headings, set the next FP number to count + 1. For each FALSE POSITIVE finding, append an entry (incrementing the FP number for each):
     ```
     ## FP-{NNN}: {one-line summary}
     - **Finding:** {original finding description}
     - **Reason:** {validator's reason for FALSE POSITIVE classification}
     - **Phase:** Quick Task
     - **Date:** {current ISO 8601 date}
     ```

5. Present confirmed findings (REAL BUG + STYLISTIC) to the user. Note: In ad-hoc review mode, STYLISTIC findings are auto-included as confirmed without per-issue user choice (unlike full `/bee:review` which asks for each). This is intentional -- the quick gate prioritizes speed over granular control:

```
Quick review found {N} confirmed issue(s):
{For each: F-NNN [severity] category: summary}
```

Use AskUserQuestion:
Question: "Quick review found {N} issue(s). What to do?"
Options: "Fix before commit" (spawn fixers for confirmed issues), "Commit as-is" (acknowledge and proceed), "Cancel" (stop here).

6. Handle user choice:
   - **Fix:** Sort confirmed findings by priority before spawning fixers:
     - Priority 1: Critical severity
     - Priority 2: High severity
     - Priority 3: Standards category (Medium)
     - Priority 4: Dead Code category (Medium)
     - Priority 5: Other Medium severity

     Display the sorted fix order:
     ```
     Fix order:
     1. F-{NNN}: {summary} (Critical)
     2. F-{NNN}: {summary} (High)
     ...
     ```

     Then for each finding in sorted priority order, spawn `fixer` agent SEQUENTIALLY (one at a time):
     1. Display: "Fixing F-{NNN}: {summary}..."
     2. Spawn fixer and WAIT for completion.
     3. Read the fixer's Fix Report status from its final message.
     4. If the fixer reports "Reverted" or "Failed": display "Fix for F-{NNN} failed -- changes reverted. Skipping." and continue to the next finding.
     5. After all findings processed, display: "{fixed} fixed, {skipped} skipped out of {total}."

        Then present the post-review menu:

        ```
        AskUserQuestion(
          question: "Review complete. [X] findings: [F] fixed, [FP] false positives.",
          options: ["Re-review", "Accept", "Custom"]
        )
        ```

        Replace `[X]` with total finding count, `[F]` with fixed count, `[FP]` with false positive count.

        - **Re-review**: Re-run all review agents (Steps 4.5.0–4.5.6) on the same `$REVIEW_FILES`. No iteration limit — repeat until user selects Accept or Custom.
        - **Accept**: End review cycle, proceed to Step 5.
        - **Custom**: Wait for free-text input from the user and act on it.

   - **Commit as-is:** Proceed to Step 5.
   - **Cancel:** Display "Cancelled. Changes remain unstaged." Stop.

### Step 5: Commit

1. Run `git diff --stat` and `git status --short` to see all changes.
2. Generate a conventional commit message:
   - `fix({scope}): {description}` for bug fixes
   - `feat({scope}): {description}` for new functionality
   - `refactor({scope}): {description}` for refactors
   - `chore({scope}): {description}` for config, deps, tooling
   - Derive `{scope}` from the primary area affected (module name, feature area, etc.)
3. Present to user:

```
Commit message: {message}

Files to stage:
- {list of changed files}

Commit? (yes / edit message / cancel)
```

4. Wait for confirmation.
   - **yes:** stage specific files and commit. NEVER use `git add -A` or `git add .`.
   - **edit:** wait for user's message, then commit with that.
   - **cancel:** display "Cancelled. Changes are unstaged." Stop.

### Step 6: Update STATE.md

1. Read `.bee/STATE.md` fresh from disk.
2. Find or create the `## Quick Tasks` section. If it doesn't exist, add it after the Phases table (or after Last Action if no Phases table):

```markdown
## Quick Tasks

| # | Description | Date | Commit |
|---|-------------|------|--------|
```

3. Determine `{N}`: **If `$AMEND` is true**, use `$N` (already set to `$AMEND_NUMBER` in Step 2a — preserve the original task number, do NOT increment). **Otherwise**, parse the `#` column value from the existing single data row: if a row exists (e.g., `| 5 | ... |`), set `{N}` to that number + 1; if no data rows exist, set `{N}` to 1. Get the commit hash: `git rev-parse --short HEAD`.
4. **Replace** all existing data rows in the Quick Tasks table with a SINGLE row for the current task. The table always shows only the latest quick task (old entries are removed — the commit history is the audit trail):

```markdown
| {N} | {DESCRIPTION} | {YYYY-MM-DD} | {commit_hash} |
```

Note: `{N}` still increments (it's the historical task counter), but the table only ever has one row.

5. Update the Last Action section:

```markdown
## Last Action
- Command: /bee:quick
- Timestamp: {ISO 8601}
- Result: Quick task {N}: {DESCRIPTION}
```

6. Write the updated STATE.md.

### Step 7: Complete

Display:

```
Quick task {N} complete: {DESCRIPTION}
Commit: {commit_hash}
{If $USE_REVIEW was false: "Tip: Use --review flag for a lightweight code review before commit."}
{If $USE_FAST was true: "Tip: TDD mode is the default. Omit --fast for implementer agent with Red-Green-Refactor."}

Next: /bee:progress to see project state, or /bee:quick for another task.
```

---

**Design Notes (do not display to user):**

- Quick tasks are INDEPENDENT of the spec/phase pipeline. They don't require a spec, don't create phases, and don't go through the full review/test gates.
- Quick tasks are tracked in STATE.md for audit trail purposes.
- NEVER auto-commit. Always show the diff and get explicit user confirmation.
- NEVER use `git add -A`, `git add .`, or destructive git operations.
- If the task seems too large (>5 files, complex architecture changes), recommend `/bee:new-spec` instead.
- The quick task table uses a simple incrementing number (1, 2, 3...) separate from phase numbering. Only the LATEST quick task is shown in the table (old rows are replaced). The incrementing number and commit history serve as the audit trail.
- **Default mode is TDD** (researcher on sonnet + quick-implementer with Red-Green-Refactor on inherit). `--fast` flag switches to direct execution in main context. The `quick.fast` config option controls the override: `true` = fast mode, `false` or not set = TDD mode (default). The `--fast` flag always forces fast mode regardless of config.
- TDD mode research uses the `bee:researcher` agent which runs on sonnet in economy/quality mode (research is scanning work) and inherits parent model in premium mode. Implementation uses `bee:quick-implementer` which in `"quality"` or `"premium"` mode inherits parent model for code quality, and in `"economy"` mode uses sonnet to reduce cost. All modes enforce the TDD cycle (Red-Green-Refactor).
- `--review` flag enables a review gate before commit. Can also be set permanently via `config.quick.review: true`.
- Review gate uses four specialized agents in TDD mode (bug-detector, pattern-reviewer, stack-reviewer, plan-compliance-reviewer) or three agents in fast mode (no plan-compliance-reviewer -- no plan file exists). The plan-compliance-reviewer operates in CODE REVIEW MODE, checking implementation against the plan file's acceptance criteria.
- All review agents run in parallel via Task tool calls in a single message. Model selection follows `$IMPL_MODE`: `"economy"` = all agents use `model: "sonnet"`, `"quality"` or `"premium"` = model parameter omitted (inherit parent model).
- Before spawning agents, documented false positives are extracted and included in each agent's context packet so known non-issues are excluded.
- Each agent targets 1-3 findings; combined target is 3-8 findings. Findings are consolidated, deduplicated (same file + line ranges within 5 lines merged), and written to `.bee/quick-reviews/`.
- The standalone `/bee:review-implementation` command (in ad-hoc mode) shares the same agent parallel pattern and can also be used to review quick task changes independently.
- Even in TDD mode, commit confirmation is always done in the main context (never auto-committed by agents).
- **Plan persistence:** In TDD mode, a plan file is written to `.bee/quick/{NNN}-{slug}.md` before execution. The plan captures the task description, acceptance criteria, test file targets, pattern references, research findings, and execution notes. This enables `--amend` and provides an audit trail. Fast mode (`--fast`) skips plan creation entirely -- no `.bee/quick/` artifacts.
- **Plan enrichment:** The plan file in TDD mode includes three enriched sections beyond the basic template: `## Acceptance Criteria` (testable criteria derived from the description), `## Test File Targets` (test file paths for the implementer), and `## Pattern References` (existing files to use as code patterns). These sections are consumed by the `bee:quick-implementer` agent.
- **`--amend` flow:** Allows re-executing a previous quick task with modifications. Reads the existing plan file, lets the user modify it, then re-executes. Only works for tasks that have plan files (TDD mode tasks). Fast mode tasks cannot be amended.
- **User choice gate:** The review gate presents three options via AskUserQuestion: Fix (spawns fixer agents sequentially for confirmed issues), Commit as-is (proceeds to commit), Cancel (stops). The sequential fixer loop follows the same pattern as `/bee:fix-implementation`.
