---
description: Run all spec phases automatically -- plan, execute, review loop with auto-compacting
argument-hint: ""
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` -- if not found: NOT_INITIALIZED
- `.bee/config.json` -- if not found: use `{}`
- `.bee/PROJECT.md` -- if not found: skip (project index not available)

## Spec Context (load before proceeding)

Use Glob to find `.bee/specs/*/spec.md` and `.bee/specs/*/phases.md`, then Read each:
- If no spec.md found: NO_SPEC
- If no phases.md found: NO_PHASES

## Instructions

You are running `/bee:autopilot` -- the autonomous execution engine for BeeDev. This command loops through ALL phases in a spec, running the full lifecycle per phase (plan, execute, review+fix) without human gates. It auto-approves plans, auto-fixes confirmed review findings, skips manual testing, and skips commits. Context is managed via compact points between steps. Follow these steps in order.

### Step 1: Validation Guards

Check these guards in order. Stop immediately if any fails:

1. **NOT_INITIALIZED guard:** If the dynamic context above contains "NOT_INITIALIZED" (meaning `.bee/STATE.md` does not exist), tell the user:
   "BeeDev is not initialized. Run `/bee:init` first."
   Do NOT proceed.

2. **NO_SPEC guard:** If the dynamic context above contains "NO_SPEC" (meaning no spec.md exists), tell the user:
   "No spec found. Run `/bee:new-spec` first to create a specification."
   Do NOT proceed.

3. **NO_PHASES guard:** If the dynamic context above contains "NO_PHASES" (meaning no phases.md exists), tell the user:
   "No phases breakdown found. Run `/bee:new-spec` to create a spec with phases."
   Do NOT proceed.

4. **All complete guard:** Read the Phases table from STATE.md. If ALL phases have Status of REVIEWED or COMMITTED:
   - Tell the user: "All phases are already reviewed. Run `/bee:review-project` for the final compliance check."
   - Do NOT proceed.

### Step 2: Detect Resume or Fresh Start

Read STATE.md and check for an `## Autopilot` section.

**If Autopilot section exists (RESUME mode):**
1. Parse the section: Current Phase, Current Step, Total Phases, Completed list
2. Display:
   ```
   Resuming autopilot from Phase {N}, step: {step}
   Progress: {completed_count}/{total} phases complete
   Completed: {completed list or "none"}
   ```
3. Set `$RESUME = true`, `$CURRENT_PHASE = {N}`, `$CURRENT_STEP = {step}`

**If Autopilot section does NOT exist (FRESH start):**
1. Read phases.md to count total phases
2. Read the Phases table from STATE.md
3. Find the first phase that is NOT yet REVIEWED (status is PENDING, PLANNED, EXECUTING, EXECUTED, or REVIEWING)
4. Set `$CURRENT_PHASE` to that phase number, `$CURRENT_STEP = plan`
5. Set `$TOTAL_PHASES` to the total number of phases from phases.md
6. Write the Autopilot section to STATE.md:
   ```markdown
   ## Autopilot
   - Status: RUNNING
   - Current Phase: {$CURRENT_PHASE}
   - Current Step: plan
   - Total Phases: {$TOTAL_PHASES}
   - Completed: (none)
   ```
7. Display:
   ```
   Autopilot starting!
   Spec: {spec name}
   Phases: {$TOTAL_PHASES} total, starting from phase {$CURRENT_PHASE}

   Flow per phase: plan -> compact -> execute -> compact -> review+fix -> compact
   After all phases: project review

   No commits. No manual testing. All gates auto-approved.
   ```

### Step 3: Phase Loop

For each phase from `$CURRENT_PHASE` to `$TOTAL_PHASES`, execute steps 3a through 3d in sequence. Before each sub-step, check STATE.md to see if that step is already complete for this phase (enables skip-ahead on resume).

---

#### Step 3a: Plan Phase

**Skip condition:** If the Phases table shows Plan = "Yes" for this phase AND Status is PLANNED or later (EXECUTING, EXECUTED, REVIEWING, REVIEWED, COMMITTED), skip to Step 3b.

1. Read phases.md to get the phase name for phase `$CURRENT_PHASE`
2. Slugify the phase name: `echo "{name}" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-'`
3. Determine the spec folder path from STATE.md (Current Spec Path)
4. Create the phase directory: `.bee/specs/{spec-folder}/phases/{NN}-{slug}/` where NN is the zero-padded phase number
5. If the directory already exists, note TASKS.md will be overwritten

**Pass 1 -- Plan What:**

Spawn the `phase-planner` agent via Task tool with `model: "sonnet"` (structured decomposition). Provide:
- Phase directory path (where to write TASKS.md)
- Phase number
- Spec folder path (where spec.md and phases.md live)
- Instruction: "This is Pass 1 (Plan What). Read spec.md and phases.md to understand the feature. Decompose phase {N} into granular tasks with testable acceptance criteria. Read the TASKS.md template at skills/core/templates/tasks.md for the output structure. Write initial TASKS.md (task list without waves) to the phase directory."

If phase number > 1, also provide paths to completed phases' TASKS.md files so the planner knows what is already built.

Wait for completion. Verify TASKS.md was created. If not: display "Autopilot: Phase {N} planning failed (Pass 1). Fix and re-run `/bee:autopilot`." Stop.

**Pass 2 -- Plan How (Research):**

Spawn the `researcher` agent via Task tool with `model: "sonnet"` (codebase scanning). Provide:
- Phase directory path
- Spec folder path
- Instruction: "Read TASKS.md from the phase directory. For each task, research the codebase for existing patterns to follow, identify reusable code, and if Context7 is enabled in config.json, fetch relevant framework docs. Update TASKS.md with research notes under each task's research: field."

Wait for completion. If no research notes added, continue (not blocking).

**Pass 3 -- Plan Who (Wave Assignment):**

Re-spawn the `phase-planner` agent via Task tool with `model: "sonnet"` (dependency analysis). Provide:
- Phase directory path
- Instruction: "This is Pass 2 (Plan Who). Read the research-enriched TASKS.md. Analyze task dependencies, detect file ownership conflicts (no two tasks in the same wave may modify the same file), group tasks into parallel waves, and define context packets per task. Write the final TASKS.md with wave structure, replacing the pre-wave version."

Wait for completion. Verify wave sections exist. If not: display "Autopilot: Phase {N} wave assignment failed. Fix and re-run `/bee:autopilot`." Stop.

**Auto-approve and update state:**

1. Read the final TASKS.md. Display a brief summary (NOT the full plan):
   ```
   Phase {N} planned: {X} tasks in {Y} waves (auto-approved)
   ```
2. Read current STATE.md from disk (fresh Read)
3. Set phase Plan column to "Yes"
4. Set phase Status to "PLANNED"
5. Update Autopilot section: Current Step = "execute"
6. Update Last Action:
   - Command: `/bee:autopilot`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Autopilot: Phase {N} planned with {X} tasks in {Y} waves"
7. Write STATE.md to disk

**Compact Point:** Proceed to Step 3e (Compact).

---

#### Step 3b: Execute Phase

**Skip condition:** If the Phases table shows Status as EXECUTED, REVIEWING, REVIEWED, or COMMITTED for this phase, skip to Step 3c.

1. Read STATE.md to find spec path
2. Construct TASKS.md path: `{spec-path}/phases/{NN}-{slug}/TASKS.md`
3. Read TASKS.md

**Parse wave structure:**
- Parse `## Wave N` headers
- Count total waves and tasks
- Check checkbox states: `[x]` = done, `[ ]` = pending, `[FAILED]` = failed
- Find resume point (first wave with pending tasks)
- If ALL tasks `[x]`: update Status to EXECUTED, skip to Step 3c

Display: "Executing Phase {N}: {pending} tasks remaining in {waves} waves"

**Update STATE.md to EXECUTING:**
1. Read STATE.md from disk
2. Set Status to "EXECUTING"
3. Set Executed column to "Wave 0/{total_waves}"
4. Update Autopilot section: Current Step = "execute"
5. Write STATE.md

**Wave execution loop:**

For each wave from the resume point:

1. Build context packets for each pending `[ ]` task (same pattern as `/bee:execute-phase`):
   - Task identity, acceptance criteria, research notes, context file paths
   - Dependency notes from completed waves (read `needs:` fields, look up dependency `notes:`)
   - Stack skill instruction
   - TDD instruction

2. Spawn ALL pending tasks in wave simultaneously via Task tool:
   - Agent: `implementer`
   - Model: omit (inherit parent)
   - Context: assembled context packet

   CRITICAL: Spawn all agents in the wave at the same time. Do NOT wait sequentially.

3. Collect results per agent:
   - **Success:** Read TASKS.md from disk (fresh), change `[ ]` to `[x]`, write task notes, write TASKS.md
   - **Failure:** Re-spawn ONE fresh agent with failure context. If retry fails: mark `[FAILED]`, write failure reason, continue

   IMPORTANT: Conductor is SOLE writer to TASKS.md. Always Read-Modify-Write.

4. After wave completes:
   - Read STATE.md, update Executed column to "Wave {M}/{total}"
   - Update Last Action result: "Autopilot: Phase {N} Wave {M}/{total} complete"
   - Write STATE.md
   - If any `[FAILED]` tasks: display warning but continue (autopilot does not stop for failures)

5. Repeat for next wave.

**After all waves:**
1. Read STATE.md, set Status to "EXECUTED", Executed column to "Yes"
2. Update Autopilot section: Current Step = "review"
3. Update Last Action result: "Autopilot: Phase {N} executed"
4. Write STATE.md

Display:
```
Phase {N} executed: {completed} tasks done, {failed} failed
```

**Compact Point:** Proceed to Step 3e (Compact).

---

#### Step 3c: Review Phase

**Skip condition:** If the Phases table shows Status as REVIEWED or COMMITTED for this phase, skip to Step 3d.

1. Read STATE.md, find spec path, construct phase directory path
2. Read TASKS.md to identify files modified by the phase

**Update STATE.md to REVIEWING:**
1. Read STATE.md from disk
2. Set Status to "REVIEWING"
3. Update Autopilot section: Current Step = "review"
4. Write STATE.md

**Build check (automatic):**

Check `package.json` for a `build` script. If exists, run `npm run build` via Bash. If build fails: display warning but continue (autopilot does not stop for build failures).

**Spawn reviewer agent:**

Spawn `reviewer` agent via Task tool (inherit parent model). Provide:
- Spec path (spec.md), TASKS.md path, phase directory, false positives path (if exists), phase number
- Instruction: "Review the phase implementation. Read spec.md for requirements, TASKS.md for acceptance criteria and file list. Write REVIEW.md to the phase directory."

Wait for completion. Read `{phase_directory}/REVIEW.md`.

If REVIEW.md not created: display "Autopilot: Review failed for Phase {N} (no REVIEW.md). Skipping review." Update STATE.md Status to REVIEWED, Reviewed to "Yes (skip)", continue to Step 3d.

**Parse findings:**
- Count total findings, by severity (critical, high, medium), by category
- If 0 findings: update STATE.md (Reviewed = "Yes (0)", Status = REVIEWED). Display "Phase {N} review: clean!" Skip to Step 3d.

**Validate findings (parallel):**

For each finding, spawn `finding-validator` agent via Task tool with `model: "sonnet"`. Batch up to 5 validators at a time.

Collect classifications: REAL BUG / FALSE POSITIVE / STYLISTIC.

Update REVIEW.md with validation results.

**Handle classifications (AUTO mode):**
- **FALSE POSITIVE:** Document in `.bee/false-positives.md`. Set Fix Status to "False Positive" in REVIEW.md.
- **REAL BUG + STYLISTIC:** Both go into the confirmed fix list (autopilot auto-fixes all confirmed findings without asking).

**Fix confirmed findings (SEQUENTIAL):**

Sort by priority: Critical > High > Medium.

For EACH confirmed finding in priority order (SEQUENTIAL -- one at a time):
- Spawn `fixer` agent via Task tool (inherit parent model)
- Provide: finding details, validation classification, stack info
- WAIT for completion before next fixer
- Read fixer's fix report
- Update REVIEW.md Fix Status (Fixed / Reverted / Failed)
- If "Reverted" or "Failed": display warning, mark "Skipped (tests failed)" in REVIEW.md, continue

CRITICAL: Spawn fixers SEQUENTIALLY. Never parallel.

**After all findings processed:**

1. Read STATE.md from disk
2. Set Reviewed column to "Yes ({N})" where N = total confirmed findings fixed
3. Set Status to "REVIEWED"
4. Update Autopilot section: Current Step = "plan" (for next phase), increment Current Phase
5. Update Last Action:
   - Command: `/bee:autopilot`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Autopilot: Phase {N} reviewed -- {findings} findings, {fixed} fixed, {fp} false positives"
6. Update Autopilot Completed list: add this phase number
7. Write STATE.md

Display:
```
Phase {N} reviewed: {findings} total, {real_bugs} bugs ({fixed} fixed), {fp} false positives, {stylistic} stylistic ({style_fixed} fixed)
```

---

#### Step 3d: Phase Transition

After review completes (or skip conditions met), move to next phase:

1. If current phase is the last phase (`$CURRENT_PHASE == $TOTAL_PHASES`): break out of the loop, proceed to Step 4
2. Otherwise: increment `$CURRENT_PHASE`, set `$CURRENT_STEP = plan`

**Compact Point:** Proceed to Step 3e (Compact) before starting next phase.

---

#### Step 3e: Compact Point

At each compact point, perform context preservation:

1. Read current STATE.md from disk to get the latest Autopilot state
2. Read `config.json` for stack info
3. Run `git diff --stat` and `git branch --show-current` via Bash

4. Write `.bee/COMPACT-CONTEXT.md` using the Write tool:
   ```markdown
   # Bee Compact Context

   > Auto-generated by `/bee:autopilot` -- do not edit manually.

   ## Snapshot
   - **Timestamp:** {ISO 8601 now}
   - **Branch:** {current git branch}
   - **Uncommitted:** {count} files

   ## Project
   - **Stack:** {stack}
   - **Spec:** {spec name} ({status})
   - **Path:** {spec path}

   ## Autopilot Progress
   - **Current Phase:** {N}/{total}
   - **Current Step:** {step}
   - **Completed Phases:** {list or "none"}

   ## Phase Progress
   {Per-phase one-liner from Phases table}

   ## Last Action
   - **Command:** /bee:autopilot
   - **When:** {timestamp}
   - **Result:** {result}

   ## Next Step
   `/bee:autopilot` -- resume from Phase {N}, step: {step}
   ```

5. Output the context summary directly in the conversation:
   ```
   --- BEE AUTOPILOT CONTEXT (preserved across compact) ---

   Spec: {spec name} | Stack: {stack}
   Autopilot: Phase {N}/{total} | Step: {step}
   Completed: {list or "none"}
   Branch: {branch} | Uncommitted: {count} files

   Last: {result}

   Next: /bee:autopilot -- resume from Phase {N}, step: {step}
   --- END BEE AUTOPILOT CONTEXT ---
   ```

6. Display:
   ```
   Context preserved. Run these commands to continue:

   /compact
   /bee:autopilot

   Autopilot will resume from Phase {N}, step: {step}.
   ```

7. **STOP here.** Do NOT attempt to invoke `/compact` programmatically. The user must run it manually. When the user runs `/bee:autopilot` again, Step 2 detects the resume state and continues from the right point.

---

### Step 4: Project Review

After all phases are reviewed (the phase loop is complete):

1. Display: "All phases complete. Starting project review..."

2. Read STATE.md to collect all phase directory paths

3. Spawn the `project-reviewer` agent via Task tool with `model: "sonnet"` (spec compliance cross-referencing). Provide:
   - Spec path (spec.md)
   - All phase directory paths
   - Output path: `{spec-path}/REVIEW-PROJECT.md`
   - Instruction: "Full project review mode. Read the spec at {spec-path}/spec.md. Check all phase implementations against spec requirements. Write your compliance report to {spec-path}/REVIEW-PROJECT.md."

4. Wait for completion. Read REVIEW-PROJECT.md.

5. If not created: display "Project review failed (no report produced)." Skip to Step 5.

6. Present condensed summary:
   ```
   Project Review Complete

   Per-Phase Compliance:
   - Phase 1 ({name}): {percentage}%
   - Phase 2 ({name}): {percentage}%
   ...

   Overall Spec Compliance: {overall_percentage}%

   Key Gaps:
   - {gap 1}
   - {gap 2}

   Full report: {spec-path}/REVIEW-PROJECT.md
   ```

7. Update STATE.md Last Action:
   - Command: `/bee:autopilot`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Autopilot complete: project review {overall_percentage}% compliance"

### Step 5: Completion

1. Read STATE.md from disk
2. **Remove the `## Autopilot` section entirely** from STATE.md (autopilot is done)
3. Update Last Action:
   - Command: `/bee:autopilot`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Autopilot complete: {total_phases} phases processed"
4. Write STATE.md

5. Display final summary:
   ```
   Autopilot complete!

   Spec: {spec name}
   Phases: {total} processed

   Phase Results:
   - Phase 1 ({name}): {tasks} tasks, {findings} findings ({fixed} fixed)
   - Phase 2 ({name}): {tasks} tasks, {findings} findings ({fixed} fixed)
   ...

   Project Compliance: {percentage}%

   No commits were made. Review the changes and commit when ready:
     git diff --stat
     /bee:commit    (per phase, or all at once)
   ```

---

**Design Notes (do not display to user):**

- Autopilot inlines the logic from plan-phase, execute-phase, review, compact, and review-project. It does NOT invoke those slash commands (which can't be called programmatically). The patterns are replicated with autopilot-specific behavior.
- The `## Autopilot` section in STATE.md is the resume mechanism. It survives compaction (written to disk). On re-invocation, Step 2 detects it and resumes from the tracked phase and step.
- Compact points are mandatory between major steps. The command STOPS at each compact point and instructs the user to run `/compact` then `/bee:autopilot`. This is because `/compact` is a built-in CLI command that cannot be invoked programmatically.
- No commits are made. The user reviews and commits manually after autopilot completes (or per phase if they prefer).
- No manual testing. The `/bee:test` step is entirely skipped.
- All human gates are auto-approved: plan approval, stylistic finding classification, >10 findings confirmation, already-planned/executed warnings.
- STYLISTIC findings are auto-fixed (same as quick-review behavior) rather than asking per finding.
- FALSE POSITIVE findings are documented in `.bee/false-positives.md` automatically.
- The Autopilot section is removed from STATE.md on completion. If the user runs `/bee:autopilot` again after completion, Step 1 "All complete guard" catches it.
- Error handling: planning failures stop autopilot (structural problem). Execution task failures are tolerated (marked FAILED, continue). Review failures are tolerated (skip review, continue). This keeps autopilot moving forward.
- The conductor is the SOLE writer to STATE.md and TASKS.md. Agents report via their final messages.
- Always Read-Modify-Write pattern for STATE.md and TASKS.md updates.
- Context packets for implementer agents include file PATHS, not contents. Agents read files at runtime.
- Wave execution spawns agents simultaneously (parallel Task tool calls). Fixer execution is sequential (one at a time).
