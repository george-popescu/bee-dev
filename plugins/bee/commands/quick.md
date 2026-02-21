---
name: quick
description: Execute a quick task without the full spec pipeline — just describe, execute, commit
argument-hint: "[--agents] [task description]"
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`

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
2. **Get task description.** Use the remaining text after flag removal as `$DESCRIPTION`.
3. If `$DESCRIPTION` is empty, ask the user:

```
What's the quick task? Describe what you want to do.
```

Wait for the user's response. Store as `$DESCRIPTION`.

### Step 3: Confirm Scope

Present the task back to the user:

```
Quick task: {DESCRIPTION}
Mode: {USE_AGENTS ? "agents (researcher + implementer)" : "direct (main context)"}

This will:
1. Implement the changes {USE_AGENTS ? "using specialized agents" : "directly"}
2. Commit the result
3. Track it in STATE.md

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

Skip to Step 5.

---

#### Step 4b: Agent Execution (--agents)

Use the Task tool to spawn specialized agents. This is useful when the task benefits from deeper research or parallel work.

**Phase 1: Research (optional but recommended)**

Spawn a researcher agent to understand the codebase area before making changes:

```
Task(
  subagent_type="Explore",
  description="Research: {DESCRIPTION}",
  prompt="
    Research the codebase to understand how to: {DESCRIPTION}

    Project stack: {stack from config.json}

    Find:
    1. Relevant files and their current implementation
    2. Patterns and conventions used in this area
    3. Dependencies and imports that will be affected
    4. Existing tests that cover this area

    Return a concise summary with specific file paths and line numbers.
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

If the implementer reported failures or issues, present them and ask the user how to proceed before continuing to Step 5.

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

Next: /bee:progress to see project state, or /bee:quick for another task.
```

---

**Design Notes (do not display to user):**

- Quick tasks are INDEPENDENT of the spec/phase pipeline. They don't require a spec, don't create phases, and don't go through review/test gates.
- Quick tasks are tracked in STATE.md for audit trail purposes.
- NEVER auto-commit. Always show the diff and get explicit user confirmation.
- NEVER use `git add -A`, `git add .`, or destructive git operations.
- If the task seems too large (>5 files, complex architecture changes), recommend `/bee:new-spec` instead.
- The quick task table uses a simple incrementing number (1, 2, 3...) separate from phase numbering.
- Default mode (no flag) runs in main context for speed. `--agents` mode spawns researcher + implementer for deeper work.
- Agent mode is useful for tasks that need codebase exploration or touch unfamiliar areas.
- Even in agent mode, commit confirmation is always done in the main context (never auto-committed by agents).
