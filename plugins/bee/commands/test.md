---
description: Generate manual test scenarios and verify with developer
argument-hint: ""
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`

## Instructions

You are running `/bee:test` -- the manual testing handoff for BeeDev. This command spawns the test-planner agent to generate scenarios, presents them for developer verification, routes failures to the fixer agent, and loops until all pass. Follow these steps in order.

### Step 1: Validation Guards

Check these guards in order. Stop immediately if any fails:

1. **NOT_INITIALIZED guard:** If the dynamic context above contains "NOT_INITIALIZED" (meaning `.bee/STATE.md` does not exist), tell the user:
   "BeeDev is not initialized. Run `/bee:init` first."
   Do NOT proceed.

2. **NO_SPEC guard:** Read STATE.md from the dynamic context above. If no Current Spec Path exists or it shows "(none)", tell the user:
   "No spec found. Run `/bee:new-spec` first."
   Do NOT proceed.

3. **Phase detection:** Read the Phases table from STATE.md. Find the first phase where: Status is "REVIEWED" AND the Tested column is NOT "Pass". This is the phase to test. If no such phase exists, tell the user:
   "No reviewed phases waiting for testing. Run `/bee:review` first."
   Do NOT proceed.

4. **Already testing guard:** If the Status column for the detected phase shows "TESTING", warn the user:
   "Phase {N} testing is in progress. Continue from where it left off?"
   Wait for explicit confirmation before proceeding. If the user declines, stop.

### Step 2: Load Phase Context

1. Read STATE.md to find the Current Spec Path
2. Determine the phase number and slug from the Phases table
3. Construct paths:
   - Phase directory: `{spec-path}/phases/{NN}-{slug}/`
   - TASKS.md: `{phase_directory}/TASKS.md`
   - spec.md: `{spec-path}/spec.md`
4. Read TASKS.md to identify files created/modified by the phase
5. Update STATE.md: set the phase row's Status to `TESTING`
6. Update Last Action:
   - Command: `/bee:test`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Starting testing of phase {N}"
7. Write updated STATE.md to disk

Display to user: "Starting testing of Phase {N}: {phase-name}..."

### Step 3: Generate Scenarios (spawn test-planner agent)

1. Build the test-planner context packet:
   - Spec path: `{spec.md path}` -- agent reads this for requirements
   - TASKS.md path: `{TASKS.md path}` -- agent reads this for acceptance criteria and file list
   - Phase directory: `{phase_directory}` -- agent writes TESTING.md here
   - Phase number: `{N}`
   - Phase name: `{phase_name}`
   - Instruction: "Generate manual test scenarios for this phase. Read the spec, TASKS.md, and implementation files. Write TESTING.md to the phase directory."

2. Spawn the `test-planner` agent via Task tool with the context packet above. Wait for it to complete.

3. After the test-planner completes, read `{phase_directory}/TESTING.md` using the Read tool. Verify the file was created and contains scenarios.

4. If TESTING.md was not created, tell the user: "Test-planner did not produce TESTING.md. Scenario generation failed." Stop.

### Step 4: Present Scenarios to Developer

1. Display all scenarios from TESTING.md organized by category:

   ```
   Manual Test Scenarios for Phase {N}: {phase_name}

   ## Happy Path
   1. {scenario 1}
   2. {scenario 2}

   ## Validation
   1. {scenario 1}

   ## Edge Cases
   1. {scenario 1}

   ## Permissions
   1. {scenario 1}
   ```

2. Ask the developer:
   "Please test these scenarios manually. When ready, tell me: **'all pass'** or describe any failures (e.g., 'happy path 3 fails -- no toast message after submit')."

### Step 5: Handle Developer Response

This step loops until the developer confirms all scenarios pass.

**If developer says "all pass" / "pass" / confirms everything works:**

1. Read current TESTING.md from disk. Check all scenario boxes `[x]`. Set Dev Result Status to "PASS".
2. Write updated TESTING.md to disk.
3. Read current `.bee/STATE.md` from disk. Update the phase row:
   - Tested: "Pass"
   - Status: `TESTED`
4. Update Last Action:
   - Command: `/bee:test`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Phase {N} tested: all {count} scenarios passed"
5. Write updated STATE.md to disk.
6. Display:
   ```
   All {count} scenarios passed! Phase {N} testing complete.

   Next step:
     /clear
     /bee:commit
   ```
7. Stop.

**If developer describes failures:**

1. Parse the failure descriptions. For each failure, identify:
   - Which scenario failed (by number, category, or description)
   - What the developer observed (the actual behavior vs expected)

2. Initialize fix attempt tracking per scenario (set to 0 if first time).

3. For EACH failure (SEQUENTIAL -- one at a time, never parallel):

   a. Increment fix attempts for this scenario.

   b. If fix attempts > 3 for this scenario, present options:
      "Scenario '{scenario}' has failed 3 fix attempts. Options:
       (a) Mark as known issue and continue
       (b) Skip -- you'll fix it manually
       (c) Try one more fix"
      - If (a): mark scenario with `[!]` in TESTING.md, add to Dev Result Failures as "known issue"
      - If (b): mark scenario as skipped in TESTING.md, continue to next failure
      - If (c): proceed with fix below

   c. Build fixer context packet:
      - Full scenario line from TESTING.md
      - Developer's failure observation (their exact words)
      - Category (Happy Path / Validation / Edge Cases / Permissions)
      - Relevant file paths from TASKS.md (files created/modified by the phase)
      - Stack info from config.json
      - Instruction: "The developer manually tested this scenario and it failed. The scenario was: '{scenario}'. The developer observed: '{observation}'. Fix the implementation so this scenario passes. Read the relevant files, identify the issue, apply a minimal fix, and run tests."

   d. Spawn `fixer` agent via Task tool with the context packet. Wait for completion.

   e. Read the fixer's fix report from its final message.

   f. Read current TESTING.md from disk. Update Dev Result: note the fix under "Fixed" section. Write TESTING.md to disk.

4. After all failures are addressed, re-present ONLY the previously-failed scenarios:

   ```
   The following scenarios were fixed. Please re-test:

   - [ ] {previously failed scenario 1}
   - [ ] {previously failed scenario 2}

   Tell me: 'all pass' or describe any remaining failures.
   ```

5. Loop back to the start of Step 5 (handle the developer's new response).

---

**Design Notes (do not display to user):**

- The command auto-detects the phase to test (first REVIEWED but Tested != "Pass"). No phase number argument needed.
- TESTING.md is the pipeline state, progressively updated as scenarios are verified and fixes applied. Analogous to REVIEW.md in the review command.
- Fixes are SEQUENTIAL (one fixer at a time) to prevent file conflicts. Same pattern as the review command's fix step.
- Only previously-failed scenarios are re-presented after fixes -- not all scenarios. This respects the developer's time.
- The developer controls the loop. The command never auto-declares pass.
- Fix attempt limit: 3 per scenario, then offer options (not a hard block). This prevents infinite loops.
- The fixer agent is the SAME fixer from Phase 5 review pipeline (agents/fixer.md) -- reused without modification. The context packet substitutes a REVIEW.md finding with the scenario description and developer observation.
- Always re-read STATE.md and TESTING.md from disk before each update (Read-Modify-Write pattern) to ensure latest state.
- If the session ends mid-testing (context limit, crash, user stops), re-running `/bee:test` detects the TESTING status and offers to resume. TESTING.md on disk reflects the state at interruption.
