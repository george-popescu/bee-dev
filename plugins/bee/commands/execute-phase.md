---
description: Execute a planned phase with wave-based parallel TDD implementation
argument-hint: "[phase-number]"
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`
- `.bee/PROJECT.md` — if not found: skip (project index not available)

## Instructions

You are running `/bee:execute-phase` -- the core execution engine for BeeDev. This conductor reads TASKS.md, launches parallel implementer agents per wave, collects results, handles failures, and updates state progressively. Follow these steps in order.

### Step 1: Validation Guards

Check these guards in order. Stop immediately if any fails:

1. **NOT_INITIALIZED guard:** If the dynamic context above contains "NOT_INITIALIZED" (meaning `.bee/STATE.md` does not exist), tell the user:
   "BeeDev is not initialized. Run `/bee:init` first."
   Do NOT proceed.

2. **NO_SPEC guard:** Read STATE.md from the dynamic context above. If no Current Spec Path exists or it shows "(none)", tell the user:
   "No spec found. Run `/bee:new-spec` first."
   Do NOT proceed.

3. **Phase number validation:** Check `$ARGUMENTS` for a phase number. If missing or empty, tell the user:
   "Please provide a phase number: `/bee:execute-phase 1`"
   Do NOT proceed.
   Read the Phases table from STATE.md. If the requested phase number exceeds the number of rows, tell the user:
   "Phase {N} does not exist. Your spec has {M} phases."
   Do NOT proceed.

4. **Not planned guard:** Read the Phases table from STATE.md. If the Plan column does NOT show "Yes" for the requested phase, tell the user:
   "Phase {N} is not planned yet. Run `/bee:plan-phase {N}` first."
   Do NOT proceed.

5. **Already executed guard:** If the Status column shows "EXECUTED", "REVIEWED", "TESTED", or "COMMITTED" for the requested phase, warn the user:
   "Phase {N} is already executed (status: {status}). Re-executing will re-run all incomplete tasks. Continue?"
   Wait for explicit confirmation before proceeding. If the user declines, stop.

### Step 2: Load TASKS.md

1. Read STATE.md to find the Current Spec Path
2. Construct the TASKS.md path: `{spec-path}/phases/{NN}-{slug}/TASKS.md` where NN is the zero-padded phase number and slug comes from the Phases table Name column (slugified: lowercase, hyphens, no spaces)
3. Read TASKS.md using the Read tool
4. If TASKS.md does not exist, tell the user:
   "No TASKS.md found for phase {N}. Run `/bee:plan-phase {N}` first."
   Do NOT proceed.

### Step 3: Parse Wave Structure and Detect Resume Point

1. Parse TASKS.md for wave sections (`## Wave N` headers)
2. Count total waves and total tasks
3. For each task, check the checkbox state:
   - `[x]` = completed (skip this task)
   - `[ ]` = pending (needs execution)
   - `[FAILED]` = previously failed (skip, alert user about prior failure)
4. Identify the first wave with any pending `[ ]` tasks -- this is the resume point
5. If ALL tasks are `[x]` (all complete): check if STATE.md shows EXECUTED for this phase. If not, update STATE.md Status to EXECUTED and tell user: "All tasks already complete. Phase {N} marked as EXECUTED." Stop. If already EXECUTED, tell user: "Phase {N} is already fully executed." Stop.

Display resume status to the user:
- Fresh start: "Starting phase {N} execution: {X} tasks in {Y} waves"
- Resume: "Resuming phase {N} from Wave {M}/{Y}: {completed} tasks done, {pending} remaining"
- If any `[FAILED]` tasks exist, list them: "Note: {count} previously failed task(s): {task_ids}. These will be skipped."

This checkpoint-based resume is the crash recovery mechanism. If the session ends mid-execution (context limit, crash, user stops), re-running `/bee:execute-phase {N}` picks up exactly where it left off by reading TASKS.md checkbox state.

### Step 4: Update STATE.md to EXECUTING

1. Read current `.bee/STATE.md` from disk (fresh read, not cached dynamic context)
2. Set the phase Status to `EXECUTING`
3. Set the Executed column to `Wave 0/{total_waves}`
4. Set Last Action to:
   - Command: `/bee:execute-phase {N}`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Starting execution"
5. Write updated STATE.md to disk

### Step 5: Execute Waves

For each wave starting from the resume point, repeat the following:

**5a. Build context packets for pending tasks in this wave:**

For each pending `[ ]` task in the current wave, assemble a context packet. The packet is the sole input the implementer agent receives -- it must be self-contained.

Include in each context packet:
- **Task identity:** Task ID (e.g., T1.3) and full description line from TASKS.md
- **Acceptance criteria:** The task's `acceptance:` field verbatim -- this is what the SubagentStop hook validates
- **Research notes:** The task's `research:` field -- patterns, reusable code, framework docs
- **Context file paths:** The task's `context:` field -- list of file paths for the agent to read at runtime. Include paths only, NOT file contents (agents read files within their own context window)
- **Dependency notes (Wave 2+ only):** Read the task's `needs:` field to find dependency task IDs. Look up each dependency task in TASKS.md and include its `notes:` section content. This is how completed Wave 1 work flows to Wave 2 agents.
- **Stack skill instruction:** "Read `.bee/config.json` to find your stack, then read the matching stack skill at `skills/stacks/{stack}/SKILL.md` for framework conventions."
- **TDD instruction:** "Follow TDD cycle: RED (write failing tests first), GREEN (minimal implementation to pass), REFACTOR (clean up with tests as safety net). Write structured Task Notes in your final message under a `## Task Notes` heading."

Keep each context packet to approximately 30% of context window. Include file paths for the agent to read at runtime, not file contents.

**5b. Spawn parallel implementer agents:**

Spawn ALL pending tasks in the current wave simultaneously using the Task tool. Each task becomes one parallel agent invocation:

- Agent: `implementer`
- Model: omit (inherit parent model) -- implementers write production code and need full reasoning capability
- Context: the assembled context packet for that task
- Each agent runs independently in its own context window

CRITICAL: Spawn all agents in the wave at the same time using simultaneous Task tool calls. Do NOT wait for one agent to finish before spawning the next. Sequential spawning defeats wave parallelism.

The SubagentStop hook in hooks.json fires automatically when each implementer agent completes. It validates TDD compliance, test passing, and task notes presence. If validation fails, the hook gives the agent a chance to self-correct before the conductor receives the result.

**5c. Collect results and handle outcomes per agent:**

As each implementer agent completes, process its result:

**On success (agent completed with task notes):**
1. Read current TASKS.md from disk (fresh Read -- another agent's result may have updated it)
2. Extract the task notes from the agent's final response (the `## Task Notes` section)
3. Change the task's `[ ]` to `[x]` in TASKS.md
4. Write the extracted task notes into the task's `notes:` section in TASKS.md
5. Write updated TASKS.md to disk

**On failure (agent did not complete successfully):**
1. Note the failure reason from the agent's output
2. Re-spawn ONE fresh implementer agent with the original context packet PLUS: "Previous attempt failed. Reason: {failure_reason}. Address this issue before proceeding with the task."
3. If the retry succeeds: process as success above
4. If the retry also fails: mark the task as `[FAILED]` in TASKS.md, write the failure reason in the `notes:` section, write TASKS.md to disk, continue with remaining tasks

IMPORTANT: The conductor is the SOLE writer to TASKS.md. Agents report notes in their final message; the conductor extracts and writes them. This prevents parallel write conflicts.

IMPORTANT: Always re-read TASKS.md from disk before each write (Read-Modify-Write pattern) to ensure you work with the latest state.

**5d. After all agents in the wave complete:**

1. Read current `.bee/STATE.md` from disk
2. Update the Executed column to `Wave {M}/{total_waves}` (where M is the current wave number)
3. Update Last Action:
   - Command: `/bee:execute-phase {N}`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Wave {M}/{total_waves} complete ({task_ids} done)"
4. Write updated STATE.md to disk

If any task in the wave was marked `[FAILED]`:
- Display failure details to the user (task ID, failure reason)
- Ask: "Task(s) {failed_ids} failed. You can: (a) Continue to next wave (dependent tasks may also fail), (b) Stop execution to fix manually, (c) Retry failed tasks"
- Handle user choice:
  - (a) Continue: proceed to next wave
  - (b) Stop: update STATE.md Last Action result to "Paused -- manual fix needed for {failed_ids}", stop execution
  - (c) Retry: re-spawn fresh agents for failed tasks with their original context, process results, then proceed

**5e. Repeat for next wave** until all waves are processed.

### Step 6: Completion

After all waves complete:

1. Read current `.bee/STATE.md` from disk
2. Update the phase row:
   - Status: `EXECUTED`
   - Executed: `Yes`
3. Update Last Action:
   - Command: `/bee:execute-phase {N}`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Phase {N} executed: {total_tasks} tasks complete"
4. Write updated STATE.md to disk

Display completion summary to the user:

```
Phase {N} executed!

Phase: {phase-name}
Tasks: {completed} completed, {failed} failed
Waves: {total_waves} waves processed

Task summary:
- Wave 1: {task_ids} ({status -- e.g., "all passed" or "T1.2 FAILED"})
- Wave 2: {task_ids} ({status})
...

Next step:
  /clear
  /bee:review
```

If any tasks are marked `[FAILED]`, add a note after the summary:
```
Warning: {count} task(s) failed. Review TASKS.md for failure details.
You may want to fix these manually before proceeding to review.
```

---

**Design Notes (do not display to user):**

- The conductor is the SOLE writer to TASKS.md. Agents report notes in their final message; the conductor extracts and writes them. This prevents parallel write conflicts during concurrent agent execution.
- TASKS.md is re-read from disk before each update (Read-Modify-Write pattern). Another agent's result may have been written between reads.
- Context packets include file PATHS, not file contents. Agents read files at runtime within their own context window.
- Agents are spawned simultaneously within a wave using parallel Task tool calls. Sequential spawning defeats the purpose of wave parallelism.
- Crash recovery works by re-reading TASKS.md checkbox states. `[x]` tasks are skipped, execution resumes from the first wave with pending `[ ]` tasks.
- The SubagentStop hook in hooks.json fires automatically when each implementer agent completes, validating TDD compliance and task notes before the conductor receives the result.
