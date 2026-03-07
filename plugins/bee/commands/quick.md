---
description: Execute a quick task without the full spec pipeline — just describe, execute, commit
argument-hint: "[--agents] [--review] [task description]"
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`
- `.bee/PROJECT.md` — if not found: skip (project index not available)

## Instructions

You are running `/bee:quick` -- the fast-track command for small tasks that don't need the full spec > plan > execute > review pipeline. Think bug fixes, config tweaks, small refactors, dependency updates. Follow these steps in order.

### Step 1: Validation Guard

**NOT_INITIALIZED guard:** If `.bee/STATE.md` does not exist (NOT_INITIALIZED), tell the user:
"BeeDev is not initialized. Run `/bee:init` first."
Do NOT proceed.

No spec is required for quick tasks. No phase is required.

### Step 2: Parse Arguments

Check `$ARGUMENTS` for flags and task description.

1. **Check for `--agents` flag.** If present, store `$USE_AGENTS = true` and remove the flag from the remaining text. Otherwise `$USE_AGENTS = false`.
2. **Check for `--review` flag.** If present, store `$USE_REVIEW = true` and remove the flag from the remaining text. Otherwise `$USE_REVIEW = false`. Also check `config.json` for `quick.review` setting -- if true, set `$USE_REVIEW = true` regardless of flag.
3. **Get task description.** Use the remaining text after flag removal as `$DESCRIPTION`.
4. If `$DESCRIPTION` is empty, ask the user:

```
What's the quick task? Describe what you want to do.
```

Wait for the user's response. Store as `$DESCRIPTION`.

### Step 3: Confirm Scope

Present the task back to the user:

```
Quick task: {DESCRIPTION}
Mode: {USE_AGENTS ? "agents (researcher + implementer)" : "direct (main context)"}
Review: {USE_REVIEW ? "yes (lightweight review before commit)" : "no"}

This will:
1. Implement the changes {USE_AGENTS ? "using specialized agents" : "directly"}
{USE_REVIEW ? "2. Review changes for bugs and standards" : ""}
{USE_REVIEW ? "3" : "2"}. Commit the result
{USE_REVIEW ? "4" : "3"}. Track it in STATE.md

Proceed? (yes/no)
```

If the user says no, stop. If yes, continue.

### Step 4: Execute

**If `$USE_AGENTS` is false (default):** execute directly in main context.

**If `$USE_AGENTS` is true:** use the agent pipeline described in Step 4b below.

---

#### Step 4a: Direct Execution (default)

Implement the task directly. Follow these rules:

1. **Read before writing.** Always read existing files before modifying them.
2. **Use the project's stack conventions.** Check `config.json` for the configured stack, linter, and test runner. Follow the standards for that stack.
3. **Keep it small.** Quick tasks should touch a few files at most. If the task grows beyond ~5 files, suggest the user run `/bee:new-spec` instead.
4. **Run the linter.** If config has a linter configured (eslint, pint, biome, prettier), run it on modified files after implementation.
5. **Run tests if relevant.** If you modified code that has existing tests, run the test suite to verify nothing broke.

After implementation, present a summary:

```
Done. Changes:
- {file1}: {what changed}
- {file2}: {what changed}
...
```

If `$USE_REVIEW` is true, continue to Step 4.5. Otherwise skip to Step 5.

---

#### Step 4b: Agent Execution (--agents)

Use the Task tool to spawn specialized agents. This is useful when the task benefits from deeper research or parallel work.

**Phase 1: Research (optional but recommended)**

Spawn the `researcher` agent (runs on sonnet for speed) to understand the codebase area before making changes:

```
Task(
  subagent_type="bee:researcher",
  model="sonnet",
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
  "
)
```

Store the research output as `$RESEARCH`.

**Phase 2: Implementation**

Spawn an implementer agent with the research context:

```
Task(
  subagent_type="general-purpose",
  description="Implement: {DESCRIPTION}",
  prompt="
    Implement this task: {DESCRIPTION}

    Project stack: {stack from config.json}
    Linter: {linter from config.json}
    Test runner: {testRunner from config.json}

    Research context:
    {$RESEARCH}

    Rules:
    1. Read files before modifying them
    2. Follow existing patterns and conventions found in research
    3. Run the linter on modified files after implementation
    4. Run relevant tests to verify nothing broke
    5. If tests fail, fix the issues before reporting done

    When done, report:
    - Files created/modified (with brief description of each change)
    - Tests run and their results
    - Any decisions made during implementation
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

If the implementer reported failures or issues, present them and ask the user how to proceed before continuing to Step 4.5.

### Step 4.5: Review Gate (if --review)

**Skip this step entirely if `$USE_REVIEW` is false.** Proceed directly to Step 5.

If `$USE_REVIEW` is true, run a lightweight review before committing:

**Build check:** If `package.json` has a `build` script, run `npm run build`. If it fails, display the error and ask: "(a) Fix first (b) Continue anyway". If no build script, skip.

**Test check:** Ask: "Run tests before review? (yes/no)". If yes:
1. Read `testRunner` from `config.json`. If `none`, display "No test runner configured. Skipping." and continue.
2. Run the test command (`vitest`: `npx vitest run`, `jest`: `npx jest --maxWorkers=auto`, `pest`: `./vendor/bin/pest --parallel`). Display results. If tests fail, ask: "(a) Fix first (b) Continue anyway".

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

#### 4.5.2: Build context packets and spawn three agents in parallel

Build three agent-specific context packets. Each includes the changed files list, "quick review mode" instruction, and the false-positives list from Step 4.5.1. The plan-compliance-reviewer is excluded because quick tasks have no spec or plan context.

**Agent 1: Bug Detector** (`bee:bug-detector`, `model: "sonnet"`)
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

**Agent 2: Pattern Reviewer** (`bee:pattern-reviewer`, `model: "sonnet"`)
```
QUICK REVIEW MODE -- No spec, no TASKS.md, no phase context.

You are reviewing changed files for pattern deviations against the existing codebase.

Review ONLY these changed files:
{$REVIEW_FILES -- one per line}

{false-positives list from Step 4.5.1}

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

{false-positives list from Step 4.5.1}

Check changed files against stack conventions only. Load the stack skill from config.json and verify all code follows the stack's conventions. Use Context7 to verify framework best practices.

Target 1-3 findings. Only report violations you have HIGH confidence in.
```

Spawn all three agents via three Task tool calls in a SINGLE message (parallel execution). Use `model: "sonnet"` for all three agents -- they perform focused scope scanning and classification work.

Wait for all three agents to complete.

#### 4.5.3: Parse findings from each agent

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

2. Display findings summary: "{N} findings from 3 reviewers: {critical} critical, {high} high, {medium} medium"

3. For each finding, spawn `finding-validator` agent with `model: "sonnet"` (single-finding classification) -- up to 5 in parallel -- to classify as REAL BUG / FALSE POSITIVE / STYLISTIC.

4. Present confirmed findings (REAL BUG + STYLISTIC) to the user. Note: In quick-review mode, STYLISTIC findings are auto-included as confirmed without per-issue user choice (unlike full `/bee:review` which asks for each). This is intentional -- the quick gate prioritizes speed over granular control:

```
Quick review found {N} confirmed issue(s):
{For each: F-NNN [severity] category: summary}

Options:
(a) Fix before commit -- spawn fixers for confirmed issues
(b) Commit anyway -- acknowledge and proceed
(c) Cancel -- stop here
```

5. Handle user choice:
   - **(a) Fix:** For each confirmed finding, spawn `fixer` agent SEQUENTIALLY (one at a time). After all fixes, proceed to Step 5.
   - **(b) Commit anyway:** Proceed to Step 5.
   - **(c) Cancel:** Display "Cancelled. Changes remain unstaged." Stop.

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

3. Count existing quick task rows to determine the next number.
4. Get the commit hash: `git rev-parse --short HEAD`
5. Append a new row:

```markdown
| {N} | {DESCRIPTION} | {YYYY-MM-DD} | {commit_hash} |
```

6. Update the Last Action section:

```markdown
## Last Action
- Command: /bee:quick
- Timestamp: {ISO 8601}
- Result: Quick task {N}: {DESCRIPTION}
```

7. Write the updated STATE.md.

### Step 7: Complete

Display:

```
Quick task {N} complete: {DESCRIPTION}
Commit: {commit_hash}
{If $USE_REVIEW was false: "Tip: Use --review flag for a lightweight code review before commit."}

Next: /bee:progress to see project state, or /bee:quick for another task.
```

---

**Design Notes (do not display to user):**

- Quick tasks are INDEPENDENT of the spec/phase pipeline. They don't require a spec, don't create phases, and don't go through the full review/test gates.
- Quick tasks are tracked in STATE.md for audit trail purposes.
- NEVER auto-commit. Always show the diff and get explicit user confirmation.
- NEVER use `git add -A`, `git add .`, or destructive git operations.
- If the task seems too large (>5 files, complex architecture changes), recommend `/bee:new-spec` instead.
- The quick task table uses a simple incrementing number (1, 2, 3...) separate from phase numbering.
- Default mode (no flag) runs in main context for speed. `--agents` mode spawns researcher (sonnet) + implementer (inherit) for deeper work.
- Agent mode research uses the `bee:researcher` agent which runs on sonnet for speed. Implementation uses `general-purpose` which inherits parent model for code quality.
- `--review` flag enables a lightweight review gate before commit. Can also be set permanently via `config.quick.review: true`.
- Review gate uses three specialized agents (bug-detector, pattern-reviewer, stack-reviewer) in quick-review mode (no spec/TDD checks, focus on bugs/standards/security). All three run in parallel via three Task tool calls in a single message. All use `model: "sonnet"` (focused scope scanning/classification work).
- The plan-compliance-reviewer is excluded because quick tasks have no spec or plan context to evaluate.
- Before spawning agents, documented false positives are extracted and included in each agent's context packet so known non-issues are excluded.
- Each agent targets 1-3 findings; combined target is 3-8 findings. Findings are consolidated, deduplicated (same file + line ranges within 5 lines merged), and written to `.bee/quick-reviews/`.
- The standalone `/bee:quick-review` command shares the same three-agent parallel pattern and can also be used to review quick task changes independently.
- Even in agent mode, commit confirmation is always done in the main context (never auto-committed by agents).
