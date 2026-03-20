---
description: Execute all plan-reviewed phases autonomously with review loops, decision logging, and final implementation review
argument-hint: ""
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`
- `.bee/PROJECT.md` — if not found: skip (project index not available)

## Spec Context (load before proceeding)

Use Glob to find `.bee/specs/*/spec.md`, `.bee/specs/*/requirements.md`, and `.bee/specs/*/phases.md`, then Read each:
- If no spec.md found: NO_SPEC
- If no requirements.md found: NO_REQUIREMENTS
- If no phases.md found: NO_PHASES

## Instructions

You are running `/bee:ship` -- the autonomous orchestrator that executes all plan-reviewed phases, reviews each phase's implementation, logs every decision, runs a final implementation review, and presents results at completion. This command is fully autonomous during its pipeline (no AskUserQuestion during execution/review). Follow these steps in order.

### Step 1: Validation Guards

Check these guards in order. Stop immediately if any fails:

1. **NOT_INITIALIZED guard:** If the dynamic context above contains "NOT_INITIALIZED" (meaning `.bee/STATE.md` does not exist), tell the user:
   "BeeDev is not initialized. Run `/bee:init` first."
   Do NOT proceed.

2. **NO_SPEC guard:** If the dynamic context above contains "NO_SPEC" (meaning no spec.md exists), tell the user:
   "No spec found. Run `/bee:new-spec` first to create a specification."
   Do NOT proceed.

3. **NO_PHASES guard:** If the dynamic context above contains "NO_PHASES" (meaning no phases.md exists), tell the user:
   "No phases found. Run `/bee:new-spec` first to create a spec with phases."
   Do NOT proceed.

4. **Phases needing work guard:** Read the Phases table from STATE.md. At least one phase must need work. A phase needs work if its Status is one of:
   - `PLAN_REVIEWED` -- ready for execution
   - `EXECUTING` -- execution in progress (resume)
   - `EXECUTED` -- executed but not yet reviewed (skip to review)
   - `REVIEWING` -- review in progress (resume review)

   If NO phases match any of these statuses, tell the user:
   "No phases need shipping. All phases are either not yet planned (run `/bee:plan-all` first) or already reviewed/tested/committed."
   Do NOT proceed.

### Step 2: Discover Phases and Build Work List

1. Read the Phases table from STATE.md. Extract all phase rows: phase number, phase name, Status, Plan column, Plan Review column, Executed column, Reviewed column.
2. Read phases.md from the Spec Context above to get full phase names and descriptions.
3. Read `config.ship.max_review_iterations` from config.json (default: 3). Store as `$MAX_REVIEW_ITERATIONS`.
4. Read `config.ship.final_review` from config.json (default: true). Store as `$FINAL_REVIEW_ENABLED`.
5. Read `config.implementation_mode` from config.json (defaults to `"quality"` if absent). Store as `$IMPLEMENTATION_MODE`.
6. Build a work list of phases in phase order (ascending by phase number). For each phase, classify its state:
   - **skip:** Status is `REVIEWED`, `TESTED`, or `COMMITTED` -- fully skip this phase
   - **needs_execution:** Status is `PLAN_REVIEWED` -- needs the full execution-then-review pipeline
   - **resume_execution:** Status is `EXECUTING` -- resume execution from pending wave, then review
   - **needs_review:** Status is `EXECUTED` -- skip execution, go directly to review
   - **resume_review:** Status is `REVIEWING` -- skip execution, resume review
7. Display the discovery summary:

   ```
   Ship: {total} phases discovered.

   {For each phase:}
   - Phase {N}: {name} -- {needs_execution | resume_execution | needs_review | resume_review | skip}
   ```

### Step 3: Sequential Phase Execution and Review

Process each phase in phase order (Phase 1 first, then Phase 2, etc.). For each phase that is NOT classified as "skip":

**3a. Phase Execution (for needs_execution and resume_execution phases)**

Skip this step if the phase is classified as "needs_review" or "resume_review" (execution already complete).

Execute the phase using the execute-phase pipeline (Steps 2-5 from execute-phase.md). The key difference from the interactive execute-phase command: ship does NOT use AskUserQuestion at any point during execution. No wave completion menus, no failure interaction menus.

**3a.1: Load TASKS.md**

1. Read STATE.md to find the Current Spec Path.
2. Find the phase directory using Glob: `{spec-path}/phases/{NN}-*/TASKS.md` where NN is the zero-padded phase number.
3. If Glob returns no results, log the decision and stop:
   - **[Task-failed]:** No TASKS.md found for phase {N}.
   - **Why:** Cannot execute without a task plan.
   - **Alternative rejected:** Continuing to next phase -- execution requires a plan.
   Do NOT proceed with this phase. Mark it as failed and continue to the next phase.
4. Read TASKS.md using the Read tool.

**3a.2: Parse Wave Structure and Detect Resume Point**

1. Parse TASKS.md for wave sections (`## Wave N` headers).
2. Count total waves and total tasks.
3. For each task, check the checkbox state:
   - `[x]` = completed (skip this task)
   - `[ ]` = pending (needs execution)
   - `[FAILED]` = previously failed (will get one retry)
4. Identify the first wave with any pending `[ ]` or `[FAILED]` tasks -- this is the resume point.
5. If ALL tasks are `[x]` (all complete): update STATE.md Status to EXECUTED and skip to Step 3b.

Display resume status:
- Fresh start: "Phase {N}: Starting execution -- {X} tasks in {Y} waves"
- Resume: "Phase {N}: Resuming from Wave {M}/{Y} -- {completed} tasks done, {pending} remaining"

**3a.3: Update STATE.md to EXECUTING**

1. Read current `.bee/STATE.md` from disk (fresh read, not cached).
2. Set the phase Status to `EXECUTING`.
3. If the Current Spec Status is `SPEC_CREATED`, set it to `IN_PROGRESS`.
4. Set the Executed column to `Wave 0/{total_waves}`.
5. Set Last Action to:
   - Command: `/bee:ship`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Phase {N} -- starting execution"
6. Write updated STATE.md to disk.

**3a.4: Execute Waves**

For each wave starting from the resume point, repeat the following:

**Build context packets for pending tasks in this wave:**

For each pending `[ ]` or `[FAILED]` task in the current wave, assemble a context packet. The packet is the sole input the implementer agent receives -- it must be self-contained.

Include in each context packet:
- **Task identity:** Task ID (e.g., T1.3) and full description line from TASKS.md
- **Acceptance criteria:** The task's `acceptance:` field verbatim
- **Research notes:** The task's `research:` field
- **Context file paths:** The task's `context:` field -- list of file paths for the agent to read at runtime
- **Dependency notes (Wave 2+ only):** Read the task's `needs:` field to find dependency task IDs. Look up each dependency task in TASKS.md and include its `notes:` section content.
- **For [FAILED] tasks:** Include the previous failure reason from the task's `notes:` section: "Previous attempt failed. Reason: {failure_reason}. Address this issue before proceeding."
- **Stack skill instruction:** Resolve the correct stack(s) for each task using the following logic:

  1. **Read config:** Check `.bee/config.json`. If `config.stacks` exists, use it. If `config.stacks` is absent (v2 config), treat `config.stack` as a single-entry stacks array: `[{ "name": config.stack, "path": "." }]`.

  2. **Single-stack fast path:** If the stacks array has exactly one entry, skip path-overlap logic entirely. Use the original instruction: "Read `.bee/config.json` to find your stack, then read the matching stack skill at `skills/stacks/{stack}/SKILL.md` for framework conventions."

  3. **Multi-stack path overlap:** When the stacks array has more than one entry, compare each stack's `path` value against the file paths listed in the task's `context:` and `research:` fields. A file matches a stack if the file path starts with (or is within) the stack's `path` value. A stack with `path` set to `"."` matches everything. Collect all stacks that have at least one matching file.

  4. **Build the instruction:**
     - If one or more stacks matched by path overlap, include: "Read `.bee/config.json` for the stacks array. Read the stack skill at `skills/stacks/{stack}/SKILL.md` for each of these stacks: [{matched_stack1}, {matched_stack2}]."
     - If NO files from the task overlap any specific stack path (or the task has no `context:` / `research:` files), include all stacks as a fallback.
- **TDD instruction:** "Follow TDD cycle: RED (write failing tests first), GREEN (minimal implementation to pass), REFACTOR (clean up with tests as safety net). Write structured Task Notes in your final message under a `## Task Notes` heading."

**Model tier resolution:** Use `$IMPLEMENTATION_MODE`:
- **economy** mode: pass `model: "sonnet"`
- **quality or premium** mode: omit the model parameter (agents inherit the parent model)

**Live progress -- TaskCreate:** After assembling context packets, call TaskCreate for each pending task in the wave. Use the task ID as the title and the full task description line as the body.

**Spawn parallel implementer agents:**

**Agent resolution (stack-specific fallback):** Before spawning each implementer, resolve whether a stack-specific implementer exists. Check if `plugins/bee/agents/stacks/{stack.name}/implementer.md` exists. If yes, use `{stack.name}-implementer` as the agent name. If no, fallback to the generic `implementer` agent.

**Live progress -- TaskUpdate in-progress:** Before spawning agents, call TaskUpdate to set ALL pending tasks in the wave to in-progress status.

Spawn ALL pending tasks in the current wave simultaneously using the Task tool. Each task becomes one parallel agent invocation.

CRITICAL: Spawn all agents in the wave at the same time using simultaneous Task tool calls. Do NOT wait for one agent to finish before spawning the next.

**Collect results and handle outcomes per agent:**

As each implementer agent completes, process its result:

**On success (agent completed with task notes):**
1. Read current TASKS.md from disk (fresh Read -- Read-Modify-Write pattern)
2. Extract the task notes from the agent's final response (the `## Task Notes` section)
3. Change the task's checkbox to `[x]` in TASKS.md (match either `[ ]` for pending tasks or `[FAILED]` for retried tasks)
4. Write the extracted task notes into the task's `notes:` section in TASKS.md
5. Write updated TASKS.md to disk
6. Call TaskUpdate to mark the task as completed

**On failure (agent did not complete successfully):**
1. Note the failure reason from the agent's output.
2. The task remains in-progress during the retry attempt -- do NOT call TaskUpdate yet.
3. Re-spawn ONE fresh implementer agent with the original context packet PLUS: "Previous attempt failed. Reason: {failure_reason}. Address this issue before proceeding with the task."
4. If the retry succeeds: process as success above (including TaskUpdate completed).
5. If the retry also fails:
   - Call TaskUpdate to mark the task as failed
   - Mark the task as `[FAILED]` in TASKS.md
   - Write the failure reason in the `notes:` section
   - Write TASKS.md to disk
   - Log the decision:
     - **[Task-failed]:** Task {task_id} failed after retry -- {failure_summary}.
     - **Why:** Implementation agent failed twice; further retries unlikely to succeed without manual intervention.
     - **Alternative rejected:** Stopping ship execution -- optimistic continuation allows remaining tasks and phases to proceed.
   - Continue with remaining tasks

IMPORTANT: The conductor is the SOLE writer to TASKS.md. Agents report notes in their final message; the conductor extracts and writes them. This prevents parallel write conflicts.

IMPORTANT: Always re-read TASKS.md from disk before each write (Read-Modify-Write pattern).

**After all agents in the wave complete:**

1. Read current `.bee/STATE.md` from disk.
2. Update the Executed column to `Wave {M}/{total_waves}`.
3. Update Last Action:
   - Command: `/bee:ship`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Phase {N} -- Wave {M}/{total_waves} complete"
4. Write updated STATE.md to disk.

If any task in the wave was marked `[FAILED]`:
- Display failure details (task ID, failure reason).
- Ship does NOT stop or ask the user. Log the decision and continue:
  - **[Optimistic-continuation]:** Continuing after {count} failed task(s) in Wave {M}: {failed_task_ids}.
  - **Why:** Remaining waves and phases may still succeed; failed tasks are noted for final summary.
  - **Alternative rejected:** Stopping execution -- ship is autonomous and continues optimistically.

Proceed to next wave. Repeat until all waves are processed.

**3a.5: Mark Phase as EXECUTED**

After all waves complete:

1. Read current `.bee/STATE.md` from disk.
2. Update the phase row:
   - Status: `EXECUTED`
   - Executed: `Yes`
3. Update Last Action:
   - Command: `/bee:ship`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Phase {N} executed -- {completed} tasks complete, {failed} failed"
4. Write updated STATE.md to disk.

Display: "Phase {N} executed. {completed} tasks complete, {failed} failed. Starting review..."

**3b. Phase Review Loop (for all qualifying phases)**

Run the autonomous review pipeline for this phase. Ship auto-fixes ALL finding categories (including STYLISTIC) without user interaction. This uses the review pipeline from review.md (Steps 3.5-8) but operates fully autonomously.

Initialize: `$REVIEW_ITERATION = 1`.

**3b.1: Build & Test Gate (non-interactive)**

Run the Build & Test Gate from review.md Step 3.5, but WITHOUT any AskUserQuestion:

**Build check (automatic, per-stack):**

For each stack in `config.stacks`, scoped to its `path`:
1. Check `package.json` for a `build` script within `{stack.path}`.
2. If a build script exists, run it via Bash scoped to the stack path.
3. If build **fails**: display "Build: {stack.name} FAILED" with error output. Log the decision:
   - **[Optimistic-continuation]:** Build failed for {stack.name} -- continuing review anyway.
   - **Why:** Build failure may be pre-existing or caused by incomplete phase; review can still catch code-level issues.
   - **Alternative rejected:** Stopping ship execution -- autonomous operation requires continuing through non-blocking failures.
4. If build **passes**: display "Build: {stack.name}: OK".
5. If no build script exists: display "Build: {stack.name}: skipped (no build script)".

**Test check (automatic, per-stack -- no user prompt):**

For each stack in `config.stacks`, resolve its test runner: read `stacks[i].testRunner` first, fall back to root `config.testRunner` if absent, then `"none"`.

For each stack:
1. Resolve the test runner. If `"none"`, display "Tests: {stack.name}: skipped (no test runner configured)" and continue.
2. Detect the best parallel-capable test command:
   - `vitest`: `cd {stack.path} && npx vitest run`
   - `jest`: `cd {stack.path} && npx jest --maxWorkers=auto`
   - `pest`: `cd {stack.path} && ./vendor/bin/pest --parallel`
3. Run the detected test command via Bash (timeout: 5 minutes).
4. If tests **pass**: display "Tests: {stack.name} ({runner}): {count} passed".
5. If tests **fail**: display the failure summary. Log the decision:
   - **[Optimistic-continuation]:** Tests failed for {stack.name} ({fail_count} failures) -- continuing review.
   - **Why:** Test failures may relate to in-progress work; review can still identify additional code-level issues.
   - **Alternative rejected:** Stopping ship execution -- autonomous pipeline continues through recoverable failures.

**3b.2: Context Cache (read once, pass to all review agents)**

Before spawning any review agents, read these files once and include their content in every agent's context packet:
1. Stack skill: `plugins/bee/skills/stacks/{stack}/SKILL.md`
2. Project context: `.bee/CONTEXT.md`
3. False positives: `.bee/false-positives.md`
4. User preferences: `.bee/user.md`

Pass these as part of the agent's prompt context -- agents should NOT re-read these files themselves.

**3b.3: Extract False Positives**

1. Read `.bee/false-positives.md` using the Read tool.
2. If the file exists, build a formatted false-positives list:
   ```
   EXCLUDE these documented false positives from your findings:
   - FP-001: {summary} ({file}, {reason})
   ...
   ```
3. If the file does not exist, set the false-positives list to: `"No documented false positives."`

**3b.4: Dependency Scan**

Before spawning review agents, expand the file scope:

1. Read TASKS.md to identify all files created/modified by this phase (from task notes).
2. For each modified file, grep for `import`/`require`/`use` statements to find its **dependencies** (files it imports).
3. Grep the project for files that `import`/`require` any modified file to find its **consumers** (files that import it).
4. Scan depth: direct imports only (not transitive).
5. **Test file discovery:** For each modified file, look for corresponding test files using common patterns: `{name}.test.{ext}`, `{name}.spec.{ext}`, `tests/{name}.{ext}`, `__tests__/{name}.{ext}`.
6. Limit: max 20 extra files (dependencies + consumers + test files combined) per agent context packet -- if more than 20, prioritize consumers over dependencies.
7. Include all expanded file paths in the agent's context packet alongside the modified files.
8. Instruct agents: "Also verify that modifications don't break consumer files. Check import compatibility, return type changes, and side effect changes. Verify test files cover the modified behavior."

**3b.5: Update STATE.md to REVIEWING**

1. Read current `.bee/STATE.md` from disk (fresh read).
2. Set the phase row's Status to `REVIEWING`.
3. Set Last Action to:
   - Command: `/bee:ship`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Phase {N} -- starting review (iteration {$REVIEW_ITERATION})"
4. Write updated STATE.md to disk.

Display: "Phase {N}: Starting autonomous review (iteration {$REVIEW_ITERATION}/{$MAX_REVIEW_ITERATIONS})..."

**3b.6: Spawn 4-Agent Review Pipeline**

Build context packets for four review agents using the same multi-stack logic as review.md Step 4:

**Agent resolution (stack-specific fallback):** For each per-stack agent, check if a stack-specific variant exists at `plugins/bee/agents/stacks/{stack.name}/{role}.md`. If yes, use `{stack.name}-{role}` as the agent name. If no, fallback to generic `bee:{role}`.

**Per-stack Agent: Bug Detector** (one per stack)
```
You are reviewing Phase {N} implementation for bugs and security issues.

Spec: {spec.md path}
TASKS.md: {TASKS.md path}
Phase directory: {phase_directory}
Phase number: {N}
Stack: {stack.name}

{Context Cache content: stack skill, CONTEXT.md, user.md}
{false-positives list}

Read TASKS.md to find the files created/modified by this phase. Scope your file search to files within the `{stack.path}` directory. Review those files for bugs, logic errors, null handling issues, race conditions, edge cases, and security vulnerabilities (OWASP). If a project-level CLAUDE.md exists at the project root, read it for project-specific overrides (CLAUDE.md takes precedence over stack skill for project-specific conventions).

Apply the Review Quality Rules from the review skill: same-class completeness (scan ALL similar constructs when finding one bug), edge case enumeration (verify loop bounds, all checkbox states, null paths), and crash-path tracing (for each state write, trace what happens if the session crashes here).

Report only HIGH confidence findings in your standard output format.

{Dependency scan instruction}
```

**Per-stack Agent: Pattern Reviewer** (one per stack)
```
You are reviewing Phase {N} implementation for pattern deviations.

Spec: {spec.md path}
TASKS.md: {TASKS.md path}
Phase directory: {phase_directory}
Phase number: {N}
Stack: {stack.name}

{Context Cache content: stack skill, CONTEXT.md, user.md}
{false-positives list}

Read TASKS.md to find the files created/modified by this phase. Scope your file search to files within the `{stack.path}` directory. For each file, find 2-3 similar existing files in the codebase, extract their patterns, and compare. If a project-level CLAUDE.md exists at the project root, read it for project-specific overrides.

Apply same-class completeness: when you find a pattern deviation in one location, scan ALL similar constructs across the codebase for the same deviation. Report ALL instances, not just the first.

Report only HIGH confidence deviations in your standard output format.

{Dependency scan instruction}
```

**Per-stack Agent: Stack Reviewer** (one per stack)
```
You are reviewing Phase {N} implementation for stack best practice violations.

Spec: {spec.md path}
TASKS.md: {TASKS.md path}
Phase directory: {phase_directory}
Phase number: {N}

{Context Cache content: stack skill, CONTEXT.md, user.md}
{false-positives list}

The stack for this review pass is `{stack.name}`. Load the stack skill at `skills/stacks/{stack.name}/SKILL.md` and check all code within the `{stack.path}` directory against that stack's conventions. If a project-level CLAUDE.md exists at the project root, read it for project-specific overrides (CLAUDE.md takes precedence over stack skill). Use Context7 to verify framework best practices. Report only HIGH confidence violations in your standard output format.

{Dependency scan instruction}
```

**Global Agent: Plan Compliance Reviewer** (spawned ONCE globally)

Before building the packet, check if `{spec-path}/requirements.md` exists on disk. Set the requirements line:
- If found: `Requirements: {spec-path}/requirements.md`
- If not found: `Requirements: (not found -- skip requirement tracking)`

```
You are reviewing Phase {N} implementation in CODE REVIEW MODE (not plan review mode).

Spec: {spec.md path}
TASKS.md: {TASKS.md path}
Requirements: {spec-path}/requirements.md OR (not found -- skip requirement tracking)
Phase directory: {phase_directory}
Phase number: {N}

{Context Cache content: stack skill, CONTEXT.md, user.md}
{false-positives list}

Review mode: code review. Check implemented code against spec requirements and acceptance criteria. Verify every acceptance criterion in TASKS.md has corresponding implementation. Check for missing features, incorrect behavior, and over-scope additions. If phase > 1, also check cross-phase integration (imports, data contracts, workflow connections, shared state). If a project-level CLAUDE.md exists at the project root, read it for project-specific overrides. Report findings in your standard code review mode output format.
```

**Spawn agents:**

**Economy mode** (`$IMPLEMENTATION_MODE: "economy"`): Pass `model: "sonnet"` for all agents. Spawn agents sequentially per stack:
1. Spawn the global plan-compliance-reviewer first. Wait for completion.
2. For each stack: spawn that stack's 3 per-stack agents in parallel. Wait for completion.

**Quality or Premium mode**: Spawn ALL agents via Task tool calls in a SINGLE message (parallel execution). Omit the model parameter for all agents (they inherit the parent model).

Wait for all agents to complete.

**3b.7: Parse, Deduplicate, Write REVIEW.md**

After all agents complete, consolidate findings using the same logic as review.md Steps 4.3-4.5:

1. **Parse findings** from each agent's final message:
   - Bug Detector findings -> Category: "Bug" (or "Security" for security-related)
   - Pattern Reviewer findings -> Category: "Pattern", Severity: Medium
   - Plan Compliance Reviewer findings -> Category: "Spec Gap", severity from entry
   - Stack Reviewer findings -> Category: "Standards", Severity: Medium

2. **Deduplicate and merge:** For each pair of findings from different agents, check if they reference the same file AND their line ranges overlap (within 5 lines). If so, merge (keep higher severity, combine categories/descriptions, use broader line range).

3. **Assign IDs and write REVIEW.md:** Write `{phase_directory}/REVIEW.md` using the review-report template. Set iteration to `{$REVIEW_ITERATION}`, status to PENDING.

4. Count total findings. If 0 findings:
   - Display: "Review for Phase {N} clean -- no findings (iteration {$REVIEW_ITERATION})."
   - Proceed to Step 3c (update STATE.md as REVIEWED).

**3b.8: Validate Findings**

For each finding in REVIEW.md:
1. Build validation context: finding ID, summary, severity, category, file path, line range, description, suggested fix, and `source_agent`.
2. Spawn `finding-validator` agent via Task tool. Model selection: economy passes `model: "sonnet"`, quality/premium omits model.
3. Batch up to 5 validators at a time.
4. Collect classifications from each validator.

**Escalate MEDIUM confidence classifications:**
- For each MEDIUM confidence classification, spawn a fresh `finding-validator` agent for a second opinion (NOT the source specialist). Provide the original finding, the validator's uncertain classification, and request a second opinion.
- Use the second opinion as the FINAL classification.

**Handle FALSE POSITIVE findings:**
- If `.bee/false-positives.md` does not exist, create it with a `# False Positives` header.
- For each FALSE POSITIVE finding, append an entry to `.bee/false-positives.md`.
- Update REVIEW.md: set the finding's Fix Status to "False Positive".

**Handle STYLISTIC findings (autonomous -- no user interaction):**
Ship auto-fixes ALL STYLISTIC findings. Add every STYLISTIC finding to the confirmed fix list. Log the decision:
- **[Auto-fix]:** Auto-fixing {count} STYLISTIC finding(s) in Phase {N} -- ship operates with full autonomy.
- **Why:** Ship auto-fixes all finding categories for maximum quality; stylistic consistency matters.
- **Alternative rejected:** Skipping stylistic fixes -- ship's autonomous mode prioritizes complete quality over speed.

Build confirmed fix list: all REAL BUG findings + all STYLISTIC findings. Exclude FALSE POSITIVE findings.

Update REVIEW.md with all classifications.

**3b.9: Fix Confirmed Issues**

1. Sort confirmed findings by priority: Critical > High > Standards (Medium) > Dead Code (Medium) > Other Medium.
2. If no confirmed findings: display "No confirmed findings to fix." Proceed to re-review check.

**Fixer Parallelization Strategy:**
1. Group confirmed findings by file path.
2. For findings on DIFFERENT files: spawn fixers in parallel (one fixer per file group).
3. For findings on the SAME file: run fixers sequentially within the group.

For each file group:
- Build fixer context packet with finding details, validation classification, and stack info.
- Spawn `fixer` agent via Task tool. Use the parent model (omit model parameter) -- fixers write production code.
- For same-file findings: WAIT for each fixer before spawning the next.
- Read the fixer's fix report and update REVIEW.md Fix Status.
- If fixer reports "Reverted" or "Failed": log the decision:
  - **[Skip-fix]:** Fix for F-{NNN} failed -- tests broke after fix. Changes reverted.
  - **Why:** Fixer's changes caused test failures; reverting preserves working state.
  - **Alternative rejected:** Keeping broken fix -- passing tests are more important than resolving one finding.

Display fix summary: "{fixed} fixed, {skipped} skipped, {failed} failed out of {total} confirmed findings."

**3b.10: Re-Review Check**

After fixing, check whether to re-review:

1. If `$REVIEW_ITERATION >= $MAX_REVIEW_ITERATIONS`:
   - Display: "Max review iterations ({$MAX_REVIEW_ITERATIONS}) reached for Phase {N}. Proceeding."
   - Log the decision:
     - **[Optimistic-continuation]:** Reached max review iterations ({$MAX_REVIEW_ITERATIONS}) for Phase {N} with {unresolved_count} unresolved finding(s).
     - **Why:** Further iterations unlikely to resolve remaining findings; continuing to next phase.
     - **Alternative rejected:** Stopping ship execution -- autonomous pipeline continues optimistically; unresolved findings will be noted in the final summary.
   - Proceed to Step 3c.
2. Increment `$REVIEW_ITERATION`.
3. Archive current REVIEW.md: rename to `{phase_directory}/REVIEW-{previous_iteration}.md`.
4. Re-extract false positives (`.bee/false-positives.md` may have new entries from this iteration).
5. Go back to Step 3b.5 (update STATE.md, re-spawn all four review agents with updated code and false positives).
6. If re-review finds 0 new findings: display "Re-review clean after iteration {$REVIEW_ITERATION}." Proceed to Step 3c.

**3c. Update STATE.md as REVIEWED**

After the review loop completes for this phase:

1. Read current `.bee/STATE.md` from disk (fresh read).
2. Set the phase row's **Reviewed** column to `Yes ({$REVIEW_ITERATION})` (the iteration that produced the clean or final review).
3. Set the phase row's **Status** to `REVIEWED`.
4. Set **Last Action** to:
   - Command: `/bee:ship`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Phase {N} reviewed ({$REVIEW_ITERATION} iteration(s), {total_findings} findings, {fixed} fixed)"
5. Write updated STATE.md to disk.

**3d. Inter-Phase Progress Summary**

After each phase completes (execution + review), display a combined progress summary before moving to the next phase:

```
Phase {N} complete: {phase_name}
  Execution: {completed_tasks}/{total_tasks} tasks ({failed_tasks} failed)
  Review: {$REVIEW_ITERATION} iteration(s), {total_findings} findings ({fixed} fixed, {false_positives} FP, {unresolved} unresolved)

Overall progress: {phases_done}/{total_phases} phases shipped
```

**3e. Proceed to Next Phase**

Move to the next phase in phase order. Repeat from Step 3a.

### Step 4: Final Implementation Review

After ALL qualifying phases have been individually executed and reviewed, run the final implementation review if enabled.

**4a. Check final_review config**

If `$FINAL_REVIEW_ENABLED` is false:
- Display: "Final implementation review: skipped (disabled in config)."
- Log the decision:
  - **[Skip-fix]:** Skipped final implementation review -- disabled via ship.final_review config.
  - **Why:** User configured ship.final_review: false.
  - **Alternative rejected:** Running final review anyway -- respecting user configuration.
- Proceed to Step 5.

If `$FINAL_REVIEW_ENABLED` is true:
- Display: "Starting final implementation review across all phases..."

**4b. Run review-implementation in Full Spec Mode**

Run the review-implementation pipeline (Steps 2-7 from review-implementation.md) autonomously. This is a single-pass review covering all executed phases together.

**Context Detection:** Full spec mode applies (spec exists and phases have been executed).

**Context Cache (read once, pass to all agents):**
1. Stack skill: `plugins/bee/skills/stacks/{stack}/SKILL.md`
2. Project context: `.bee/CONTEXT.md`
3. False positives: `.bee/false-positives.md`
4. User preferences: `.bee/user.md`

**Extract False Positives:** Re-extract from `.bee/false-positives.md` (includes all FPs documented during per-phase reviews).

**Dependency Scan:** Expand file scope using the same logic as Step 3b.4, but across ALL executed phases.

**Spawn review agents in Full Spec Mode:**

Collect all executed phase directory paths (phases with status EXECUTED, REVIEWED, TESTED, or COMMITTED).

Build agent context packets following review-implementation.md Step 4.1:

**Per-stack Agent: Bug Detector** (full spec mode context)
```
You are reviewing the FULL PROJECT implementation for bugs and security issues. This is a project-scope review across all executed phases, not a single-phase review.

Spec: {spec.md path}
Executed phases:
- Phase {N}: {phase_directory_path}
...
Stack: {stack.name}

{Context Cache content}
{false-positives list}

For EACH executed phase, read its TASKS.md to find the files created/modified. Scope your file search to files within the `{stack.path}` directory. Review those files for bugs, logic errors, null handling issues, race conditions, edge cases, and security vulnerabilities (OWASP). If a project-level CLAUDE.md exists at the project root, read it for project-specific overrides.

Apply the Review Quality Rules from the review skill: same-class completeness (scan ALL similar constructs when finding one bug), edge case enumeration (verify loop bounds, all checkbox states, null paths), and crash-path tracing (for each state write, trace what happens if the session crashes here).

Report only HIGH confidence findings in your standard output format.
```

**Per-stack Agent: Pattern Reviewer** (full spec mode context)
```
You are reviewing the FULL PROJECT implementation for pattern deviations. This is a project-scope review across all executed phases, not a single-phase review.

Spec: {spec.md path}
Executed phases:
- Phase {N}: {phase_directory_path}
...
Stack: {stack.name}

{Context Cache content}
{false-positives list}

For EACH executed phase, read its TASKS.md to find the files created/modified. Scope your file search to files within the `{stack.path}` directory. For each file, find 2-3 similar existing files in the codebase, extract their patterns, and compare. If a project-level CLAUDE.md exists at the project root, read it for project-specific overrides.

Apply same-class completeness: when you find a pattern deviation in one location, scan ALL similar constructs across the codebase for the same deviation. Report ALL instances, not just the first.

Report only HIGH confidence deviations in your standard output format.
```

**Per-stack Agent: Stack Reviewer** (full spec mode context)
```
You are reviewing the FULL PROJECT implementation for stack best practice violations. This is a project-scope review across all executed phases, not a single-phase review.

Spec: {spec.md path}
Executed phases:
- Phase {N}: {phase_directory_path}
...

{Context Cache content}
{false-positives list}

The stack for this review pass is `{stack.name}`. For EACH executed phase, read its TASKS.md to find the files created/modified. Load the stack skill at `skills/stacks/{stack.name}/SKILL.md` and check all code within the `{stack.path}` directory against that stack's conventions. If a project-level CLAUDE.md exists at the project root, read it for project-specific overrides. Use Context7 to verify framework best practices. Report only HIGH confidence violations in your standard output format.
```

**Global Agent: Plan Compliance Reviewer** (full spec mode context)
```
You are reviewing the FULL PROJECT implementation in CODE REVIEW MODE (not plan review mode). This is a project-scope review across ALL executed phases.

Spec: {spec.md path}
Requirements: {spec-path}/requirements.md OR (not found -- skip requirement tracking)
Executed phases:
- Phase {N}: {phase_directory_path}
...

{Context Cache content}
{false-positives list}

Review mode: code review. Check implemented code against spec requirements and acceptance criteria across ALL executed phases. For EACH phase, read its TASKS.md and verify every acceptance criterion has corresponding implementation. Check for missing features, incorrect behavior, and over-scope additions. CRITICAL: Check cross-phase integration across ALL executed phases (not just adjacent phases) -- verify imports, data contracts, workflow connections, and shared state consistency between every pair of phases. If a project-level CLAUDE.md exists at the project root, read it for project-specific overrides. Report findings in your standard code review mode output format.
```

**Global Agent: Audit Bug Detector** (`bee:audit-bug-detector`) -- full spec mode only, spawned ONCE globally
```
You are tracing end-to-end feature flows across ALL executed phases to find bugs that category-specific reviewers miss.

Spec: {spec.md path}
Executed phases:
- Phase {N}: {phase_directory_path}
...

{Context Cache content}
{false-positives list}

Trace complete user flows from entry point to completion. For each flow:
1. Follow data from frontend to backend to database and back
2. Check that types, field names, and contracts match at every boundary
3. Verify error handling exists at every async boundary
4. Check that state transitions are complete (no missing status values)
5. Verify resume/crash recovery paths work end-to-end

Report bugs that span multiple files or phases -- the kind that single-file reviewers miss. Report only HIGH confidence findings in your standard output format.
```

**Spawn agents:** Spawn all agents (per-stack + plan-compliance-reviewer + audit-bug-detector) using the same economy/quality/premium mode logic as Step 3b.6. Total agents in full spec mode: (3 x N) + 2 where N is number of stacks. Wait for all agents to complete.

**4c. Process Final Review Results**

1. Parse, deduplicate, and write `{spec-path}/REVIEW-IMPLEMENTATION.md` using the same consolidation logic as Step 3b.7.
2. If 0 findings: display "Final implementation review: clean -- no findings across all phases."
3. If findings exist:
   - Validate findings using the same pipeline as Step 3b.8 (finding-validators, escalation).
   - Auto-fix all confirmed findings using the same pipeline as Step 3b.9 (file-based parallel fixers).
   - Ship does NOT re-review after the final review. It is a single pass.
   - Log any unresolved findings:
     - **[Optimistic-continuation]:** Final review found {count} unresolved finding(s) after fixing.
     - **Why:** Final review is a single pass; remaining findings are documented for user review.
     - **Alternative rejected:** Re-running final review -- ship runs final review once to avoid unbounded loops.

**4d. Update STATE.md**

1. Read current `.bee/STATE.md` from disk (fresh read).
2. Set **Last Action** to:
   - Command: `/bee:ship`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Final review complete -- {total_findings} findings, {fixed} fixed, {unresolved} unresolved"
3. Write updated STATE.md to disk.

### Step 5: Completion Summary

Read the final state from disk. Build and display the completion summary.

**5a. Per-Phase Stats Table**

For each phase that was processed, display:

```
Ship complete!

Per-phase summary:
- Phase {N}: {name}
  Tasks: {completed}/{total} completed ({failed} failed)
  Review: {review_iterations} iteration(s), {findings} findings ({fixed} fixed, {fp} FP, {unresolved} unresolved)
  Status: {final_status}

{Repeat for each phase}

Final implementation review: {clean | {X} findings -- {Y} fixed, {Z} unresolved | skipped}
```

**5b. Decision Log Presentation**

Read the Decisions Log section from STATE.md. Present all decisions logged during this ship run:

```
Decisions made during ship:
{For each decision entry logged during this run:}
- [{type}]: {what}
  Why: {why}
  Alternative: {alternative}
```

If no decisions were logged: "No autonomous decisions were needed -- clean run."

**5c. Final Review Result**

If `$FINAL_REVIEW_ENABLED` was true:
- Display the final review finding count and fix summary.
- If there are unresolved findings from the final review, list them.

**5d. Exit Menu**

Present the completion menu using AskUserQuestion:

```
AskUserQuestion(
  question: "Ship complete. {X} phases shipped, {Y} tasks completed, {Z} decisions logged.",
  options: ["Commit", "Re-review phase", "Custom"]
)
```

- **Commit**: Execute `/bee:commit` -- suggest the user commit the shipped changes
- **Re-review phase**: Ask which phase number, then execute `/bee:review --phase {N}` for a manual interactive re-review
- **Custom**: Free text

---

**Design Notes (do not display to user):**

- Ship is fully autonomous during its pipeline. No AskUserQuestion calls during execution, review, fixing, or final review. This is the same explicit exception to R3 that plan-all uses -- the command is designed to run unattended. Entry points (validation guards, discovery summary) and exit points (completion summary, exit menu) may present menus, but the pipeline itself is unattended.
- Ship reuses the same agents as execute-phase (implementer) and review (bug-detector, pattern-reviewer, plan-compliance-reviewer, stack-reviewer, finding-validator, fixer). No new agent files are created. The difference is orchestration: ship sequences the phases and removes all interactive prompts from the inner loop.
- The review loop uses `ship.max_review_iterations` (NOT `review.max_loop_iterations`). These are deliberately separate settings: `review.max_loop_iterations` controls the interactive review command's loop behavior; `ship.max_review_iterations` controls the autonomous ship review loop. This separation allows users to configure different thresholds for interactive vs. autonomous review.
- Decision log entries use five types: auto-fix, skip-fix, optimistic-continuation, task-failed, plan-adaptation. Each entry follows the structured format: what/why/alternative rejected. Entries are appended to STATE.md Decisions Log using the Read-Modify-Write pattern.
- Resume behavior is status-based: REVIEWED/TESTED/COMMITTED phases are skipped entirely. EXECUTING phases resume from the first wave with pending tasks. EXECUTED phases skip to the review loop. REVIEWING phases resume the review loop. PLAN_REVIEWED phases get the full pipeline. The final implementation review always re-runs on resume (it is idempotent and cheap relative to per-phase work).
- Ship auto-fixes ALL finding categories including STYLISTIC. In the interactive review command, STYLISTIC findings prompt the user. In ship, they are auto-fixed because ship prioritizes complete quality and full autonomy. This is logged as a decision.
- The Build & Test Gate runs non-interactively in ship. Build or test failures do not stop the pipeline -- they are logged as optimistic-continuation decisions and noted for the final summary. This differs from the interactive review command where failures prompt the user.
- The final implementation review uses review-implementation.md's full spec mode pipeline but as a single pass (no re-review loop). This avoids unbounded iterations at the end of a potentially long ship run while still catching cross-phase integration issues.
- Per-phase progress summaries are displayed after each phase completes. This gives the user visibility into ship's progress when checking back on a long-running autonomous session.
- The conductor is the sole writer to TASKS.md and STATE.md. All updates use the Read-Modify-Write pattern: read from disk, modify in memory, write back. This prevents stale overwrites during parallel agent execution.
- Model selection follows the same implementation_mode pattern as other commands: premium mode inherits parent model, economy mode passes model: "sonnet", quality mode inherits parent model. Review agents and finding-validators follow the same model selection as the interactive review command. Fixers always use the parent model (production code writing).
- The Context Cache (Step 3b.2) reads stack skill, CONTEXT.md, false-positives.md, and user.md ONCE before spawning agents, and includes their content in every agent's context packet. This prevents N+1 file reads across parallel agents and ensures consistency (all agents see the same snapshot).
- Dependency Scan (Step 3b.4) expands the review file scope beyond just the files listed in TASKS.md. It discovers consumer files (files that import modified files), dependency files (files imported by modified files), and test files. This catches breakage at API boundaries and missing test coverage. Maximum 20 extra files per agent to avoid context bloat.
- Cross-plan review does NOT run during ship. It ran during plan-all. Ship trusts the plan-reviewed state and focuses on execution and code review.
- The exit menu at completion is the ONLY AskUserQuestion in the entire ship command. It gives the user three options: commit (most common next step), re-review a specific phase (if they want deeper inspection), or custom (free text). "Never auto-commit" is enforced -- the commit option executes the commit command, which has its own confirmation flow.
