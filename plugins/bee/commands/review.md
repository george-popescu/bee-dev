---
description: Review current phase implementation against spec, standards, and quality checklist
argument-hint: "[--loop]"
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`

## Instructions

You are running `/bee:review` -- the code review pipeline for BeeDev. This command orchestrates a four-step pipeline: review code, validate findings, fix confirmed issues, and optionally re-review. Follow these steps in order.

### Step 1: Validation Guards

Check these guards in order. Stop immediately if any fails:

1. **NOT_INITIALIZED guard:** If the dynamic context above contains "NOT_INITIALIZED" (meaning `.bee/STATE.md` does not exist), tell the user:
   "BeeDev is not initialized. Run `/bee:init` first."
   Do NOT proceed.

2. **NO_SPEC guard:** Read STATE.md from the dynamic context above. If no Current Spec Path exists or it shows "(none)", tell the user:
   "No spec found. Run `/bee:new-spec` first."
   Do NOT proceed.

3. **Phase detection:** Read the Phases table from STATE.md. Find the first phase where: Status is "EXECUTED" AND the Reviewed column is NOT "Yes" (or not "Yes (N)" for any N). This is the phase to review. If no such phase exists, tell the user:
   "No executed phases waiting for review. Run `/bee:execute-phase N` first."
   Do NOT proceed.

4. **Already reviewing guard:** If the Status column for the detected phase shows "REVIEWING", warn the user:
   "Phase {N} review is in progress. Continue from where it left off?"
   Wait for explicit confirmation before proceeding. If the user declines, stop.

### Step 2: Load Phase Context

1. Read STATE.md to find the Current Spec Path
2. Determine the phase number and slug from the Phases table
3. Construct paths:
   - Phase directory: `{spec-path}/phases/{NN}-{slug}/`
   - TASKS.md: `{phase_directory}/TASKS.md`
   - spec.md: `{spec-path}/spec.md`
4. Read TASKS.md to identify files created/modified by the phase
5. Read `.bee/false-positives.md` if it exists (pass path to reviewer)
6. Check `$ARGUMENTS` for `--loop` flag
7. Read `config.json` from dynamic context for `review.loop` and `review.max_loop_iterations` settings
8. Determine loop mode: enabled if `--loop` in arguments OR `config.review.loop` is true
9. Set max iterations: from `config.review.max_loop_iterations` (default: 3)
10. Initialize iteration counter to 1

### Step 3: Update STATE.md to REVIEWING

Read current `.bee/STATE.md` from disk (fresh read, not cached dynamic context). Update the detected phase:

1. Set the phase row's Status to `REVIEWING`
2. Set Last Action to:
   - Command: `/bee:review`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Starting review of phase {N}"
3. Write updated STATE.md to disk

Display to user: "Starting review of Phase {N}: {phase-name}..."

### Step 4: STEP 1 -- REVIEW (spawn reviewer agent)

1. Build the reviewer context packet:
   - Spec path: `{spec.md path}` -- reviewer reads this for requirements
   - TASKS.md path: `{TASKS.md path}` -- reviewer reads this for acceptance criteria and file list
   - Phase directory: `{phase_directory}` -- reviewer writes REVIEW.md here
   - False positives path: `.bee/false-positives.md` (if the file exists; otherwise include "no false positives file yet")
   - Phase number: `{N}`
   - Instruction: "Review the phase implementation. Read spec.md for requirements, TASKS.md for acceptance criteria and file list. Write REVIEW.md to the phase directory."

2. Spawn the `reviewer` agent via Task tool with the context packet above. Wait for the reviewer to complete.

3. After the reviewer completes, read `{phase_directory}/REVIEW.md` using the Read tool. Verify the file was created. If REVIEW.md does not exist, tell the user: "Reviewer did not produce REVIEW.md. Review failed." Stop.

4. Parse findings from REVIEW.md:
   - Count total findings (each `### F-NNN` section is one finding)
   - Count by severity: critical, high, medium
   - Count by category: bug, spec gap, standards, dead code, security, TDD, pattern

5. If 0 findings:
   - Read current STATE.md from disk
   - Set Reviewed column to "Yes (0)"
   - Set Status to REVIEWED
   - Set Last Action result to "Phase {N} reviewed: 0 findings -- clean code"
   - Write STATE.md to disk
   - Display: "Review complete -- clean code! No findings. Next step: Run `/bee:test` to test this phase."
   - Stop here.

6. Display findings summary: "{N} findings: {critical} critical, {high} high, {medium} medium"

7. If more than 10 findings: present the list to user before proceeding:
   "The reviewer found {N} findings (above typical range). Review the list in REVIEW.md and confirm you want to proceed with validation."
   Wait for user confirmation. If user declines, stop.

### Step 5: STEP 2 -- VALIDATE EACH FINDING (spawn finding-validator agents)

1. For each finding in REVIEW.md (parsed from the `### F-NNN` sections):
   - Build validation context: finding ID, summary, severity, category, file path, line range, description, suggested fix
   - Spawn `finding-validator` agent via Task tool with the finding context
   - Multiple validators CAN be spawned in parallel (they are read-only and independent)
   - Batch up to 5 validators at a time to avoid overwhelming the system
2. Collect classifications from each validator's final message (the `## Classification` section with Finding, Verdict, Confidence, Reason fields)
3. Read current REVIEW.md from disk (fresh read -- another validator batch may have been processed). Update REVIEW.md:
   - Set each finding's Validation field to the classification (REAL BUG / FALSE POSITIVE / STYLISTIC)
   - Update the Counts table with classification breakdown
4. Handle FALSE POSITIVE findings:
   - If `.bee/false-positives.md` does not exist, create it with a `# False Positives` header
   - For each FALSE POSITIVE finding, append an entry:
     ```
     ## FP-{NNN}: {one-line summary}
     - **Finding:** {original finding description from REVIEW.md}
     - **Reason:** {validator's reason for FALSE POSITIVE classification}
     - **Phase:** {phase number}
     - **Date:** {current ISO 8601 date}
     ```
   - Update REVIEW.md: set the finding's Fix Status to "False Positive"

5. Handle STYLISTIC findings (user interaction):
   - For each STYLISTIC finding, present to user:
     "STYLISTIC finding: F-{NNN} -- '{summary}'. Options: (a) Fix it, (b) Ignore, (c) False Positive (won't be flagged again)"
   - Wait for user response for each STYLISTIC finding
   - If user chooses (a): add finding to the confirmed fix list
   - If user chooses (b): mark as "Skipped (user ignored)" in REVIEW.md Fix Status
   - If user chooses (c): append to `.bee/false-positives.md` (same format as step 4) and mark as "False Positive" in REVIEW.md

6. Build confirmed fix list: all REAL BUG findings + user-approved STYLISTIC findings (those where user chose option a)
7. Display validation summary: "{real_bug} real bugs, {false_positive} false positives, {stylistic} stylistic ({user_fix} to fix, {user_ignore} ignored)"

### Step 6: STEP 3 -- FIX CONFIRMED ISSUES (spawn fixer agents sequentially)

1. Sort confirmed findings by priority order:
   - Priority 1: Critical severity
   - Priority 2: High severity
   - Priority 3: Standards category (Medium)
   - Priority 4: Dead Code category (Medium)
   - Priority 5: Other Medium severity
2. If no confirmed findings (all were false positives, ignored, or skipped): display "No confirmed findings to fix -- all findings were classified as false positives or stylistic (ignored)." Update STATE.md and skip to Step 8.
3. For EACH confirmed finding in priority order (SEQUENTIAL -- one at a time, never parallel):
   - Build fixer context packet:
     - Finding details: ID, summary, severity, category, file path, line range, description, suggested fix
     - Validation classification: REAL BUG or STYLISTIC (user-approved)
     - Stack info: stack name from config.json for the fixer to load the stack skill
   - Spawn `fixer` agent via Task tool with the context packet
   - WAIT for the fixer to complete before spawning the next fixer
   - Read the fixer's fix report from its final message (## Fix Report section)
   - Read current REVIEW.md from disk (fresh read -- Read-Modify-Write pattern)
   - Update REVIEW.md: set Fix Status for this finding to the fixer's reported status (Fixed / Reverted / Failed)
   - Write updated REVIEW.md to disk
   - If fixer reports "Reverted" or "Failed" (tests broke and changes were reverted):
     - Display failure to user: "Fix for F-{NNN} failed -- tests broke after fix. Changes reverted. Skipping this finding."
     - Update REVIEW.md Fix Status to "Skipped (tests failed)"

CRITICAL: Spawn fixers SEQUENTIALLY, one at a time. Never spawn multiple fixers in parallel. One fix may change the context for the next finding. Sequential execution prevents file conflicts and ensures each fixer sees the latest code state.

4. After all confirmed findings have been processed, display fix summary:
   "{fixed} fixed, {skipped} skipped, {failed} failed out of {total} confirmed findings"

### Step 7: STEP 4 -- RE-REVIEW (if loop mode enabled)

1. If loop mode is NOT enabled: skip to Step 8 (completion)
2. Increment iteration counter
3. If iteration counter > max iterations:
   - Display: "Max review iterations ({max}) reached. Review complete."
   - Skip to Step 8
4. Display: "Starting re-review iteration {counter} of {max}..."
5. Re-spawn the `reviewer` agent with the same context as Step 4:
   - The reviewer reads the updated code (including fixes applied in previous iteration)
   - The reviewer reads the updated `.bee/false-positives.md` (which now includes FPs from the previous iteration)
   - The reviewer produces a fresh REVIEW.md (overwrites the previous one)
6. Read the new REVIEW.md
7. If 0 new findings: display "Re-review clean -- no new findings after iteration {counter}." Skip to Step 8.
8. If new findings found:
   - Display: "Re-review found {N} new findings. Validating and fixing..."
   - Repeat from Step 5 (validate findings -> fix confirmed -> check for another loop iteration)

### Step 8: Completion

After all steps complete (or early exit from clean review):

1. Update STATE.md:
   - Reviewed column: "Yes ({N})" where N = total confirmed findings fixed across all iterations
   - Status: `REVIEWED`
   - Last Action:
     - Command: `/bee:review`
     - Timestamp: current ISO 8601 timestamp
     - Result: "Phase {N} reviewed: {total_findings} findings, {confirmed} confirmed, {fixed} fixed, {false_positives} false positives"
2. Write updated STATE.md to disk
3. Display completion summary:

```
Phase {N} reviewed!

Phase: {phase-name}
Findings: {total} total
- Real bugs: {confirmed} ({fixed} fixed, {failed} failed)
- False positives: {fp_count} (documented in .bee/false-positives.md)
- Stylistic: {stylistic} ({user_fixed} fixed, {user_ignored} ignored)
Iterations: {iteration_count}

Next step:
  /clear
  /bee:test              (or /bee:plan-phase {N+1} to skip testing)
```

---

**Design Notes (do not display to user):**

- The command auto-detects the phase to review (first EXECUTED but not REVIEWED). No phase number argument needed.
- REVIEW.md is the pipeline state, progressively updated as validation and fixing proceed. Analogous to TASKS.md checkboxes in execute-phase.
- Finding validation can be parallel (up to 5 at a time). Fixing MUST be sequential (one at a time) to prevent fix conflicts.
- The command handles user interaction for STYLISTIC findings. Commands handle interaction, agents handle work.
- `.bee/false-positives.md` is created on first use when the first false positive is documented. If no false positives exist yet, the file does not exist.
- Loop mode is opt-in: `--loop` flag or `config.review.loop`. Capped at `max_loop_iterations` (default 3).
- Always re-read STATE.md from disk before each update (Read-Modify-Write pattern) to ensure latest state.
- The reviewer, finding-validator, and fixer are spawned via Task tool as foreground subagents. The SubagentStop hook in hooks.json fires for implementer agents only (matcher: "implementer") -- it does NOT fire for review pipeline agents.
- If the session ends mid-review (context limit, crash, user stops), re-running `/bee:review` detects the REVIEWING status and offers to resume. REVIEW.md on disk reflects the pipeline state at the time of interruption.
