---
name: plan-phase
description: Create a detailed execution plan for a spec phase with researched tasks and wave grouping
argument-hint: "[phase-number]"
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`

## Spec Context (load before proceeding)

Use Glob to find `.bee/specs/*/spec.md` and `.bee/specs/*/phases.md`, then Read each:
- If no spec.md found: NO_SPEC
- If no phases.md found: NO_PHASES

## Instructions

You are running `/bee:plan-phase` -- the three-step planning command for BeeDev. This command orchestrates the complete planning pipeline: task decomposition, research, and wave assignment. Follow these steps in order.

### Step 1: Validation Guards

Check these four guards in order. Stop immediately if any fails:

1. **NOT_INITIALIZED guard:** If the dynamic context above contains "NOT_INITIALIZED" (meaning `.bee/STATE.md` does not exist), tell the user:
   "BeeDev is not initialized. Run `/bee:init` first."
   Do NOT proceed.

2. **NO_SPEC guard:** If the dynamic context above contains "NO_SPEC" (meaning no spec.md exists), tell the user:
   "No spec found. Run `/bee:new-spec` first to create a specification."
   Do NOT proceed.

3. **Phase number validation:** Check `$ARGUMENTS` for a phase number. If missing or empty, tell the user:
   "Please provide a phase number: `/bee:plan-phase 1`"
   Do NOT proceed.
   Read phases.md from the dynamic context above and count the phases. If the requested phase number exceeds the number of phases, tell the user:
   "Phase {N} does not exist. Your spec has {M} phases."
   Do NOT proceed.

4. **Already planned guard:** Read STATE.md from the dynamic context above and check the Phases table. If the Plan column shows "Yes" for the requested phase:
   - If the phase Status is PLANNED or earlier: warn the user: "Phase {N} is already planned. Re-planning will overwrite the existing TASKS.md. Continue?"
   - If the phase Status is EXECUTING or later: strongly warn: "Phase {N} is already being executed. Re-planning will overwrite TASKS.md and discard execution progress. This is destructive. Continue?"
   Wait for explicit user confirmation before proceeding. If the user declines, stop.

### Step 2: Create Phase Directory

1. Read phases.md to get the phase name for the requested phase number
2. Slugify the phase name: `echo "{name}" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-'`
3. Determine the spec folder path from STATE.md (Current Spec Path)
4. Create the phase directory: `.bee/specs/{spec-folder}/phases/{NN}-{slug}/` where NN is the zero-padded phase number (e.g., 01, 02, 03)
5. If the directory already exists (re-planning scenario), note that TASKS.md will be overwritten but preserve the directory

### Step 3: Plan What -- Spawn phase-planner Agent (Pass 1)

Spawn the `phase-planner` agent as a subagent with the following context:

- The phase directory path (where to write TASKS.md)
- The phase number being planned
- The spec folder path (where spec.md and phases.md live)
- Instruction: "This is Pass 1 (Plan What). Read spec.md and phases.md to understand the feature. Decompose phase {N} into granular tasks with testable acceptance criteria. Read the TASKS.md template at skills/core/templates/tasks.md for the output structure. Write initial TASKS.md (task list without waves) to the phase directory."

If the phase number is greater than 1, also provide:
- Paths to completed phases' TASKS.md files (so the planner knows what is already built)
- Instruction addition: "Read TASKS.md from completed phases to understand what is already built. Avoid duplicating existing work."

Wait for the phase-planner to complete. Verify that TASKS.md was created in the phase directory:
```
ls {phase-directory}/TASKS.md
```

If TASKS.md was not created, tell the user the planner failed and stop.

### Step 4: Plan How -- Spawn researcher Agent

After the phase-planner completes, spawn the `researcher` agent as a subagent with the following context:

- The phase directory path (where TASKS.md lives)
- The spec folder path
- Instruction: "Read TASKS.md from the phase directory. For each task, research the codebase for existing patterns to follow, identify reusable code, and if Context7 is enabled in config.json, fetch relevant framework docs. Update TASKS.md with research notes under each task's research: field."

Wait for the researcher to complete. Verify that TASKS.md now has research notes:
```
grep "research:" {phase-directory}/TASKS.md
```

If no research notes were added, warn the user but continue (research enrichment is valuable but not blocking).

### Step 5: Plan Who -- Spawn phase-planner Agent (Pass 2)

Re-spawn the `phase-planner` agent as a subagent with the following context:

- The phase directory path (where research-enriched TASKS.md lives)
- Instruction: "This is Pass 2 (Plan Who). Read the research-enriched TASKS.md. Analyze task dependencies, detect file ownership conflicts (no two tasks in the same wave may modify the same file), group tasks into parallel waves, and define context packets per task. Write the final TASKS.md with wave structure, replacing the pre-wave version."

Wait for the phase-planner to complete. Verify that TASKS.md now has wave sections:
```
grep "Wave" {phase-directory}/TASKS.md
```

If no wave sections were added, tell the user the wave assignment failed and stop.

### Step 6: Present Plan to User for Approval

Read the final TASKS.md from disk. Present a formatted summary to the user:

1. **Overview:** Total tasks and wave count
2. **Per wave:** List tasks with their acceptance criteria (brief summary)
3. **Flags:** Highlight any tasks with empty research notes (flag for attention)

Then ask the user:

"Does this plan look good? You can:
(a) **Approve** it as-is
(b) **Modify** -- describe changes (reorder tasks, modify acceptance criteria, move between waves, add/remove tasks)
(c) **Reject** and re-plan from scratch"

Handle each response:

- **(a) Approve:** Proceed to Step 7.
- **(b) Modify:** Apply the user's requested changes to TASKS.md on disk. Re-present the updated plan summary. Repeat until the user approves.
- **(c) Reject:** Ask the user for additional guidance or constraints, then re-run from Step 3 (re-spawn planner Pass 1 with the user's new guidance as additional context).

IMPORTANT: Never auto-approve the plan. Always present it and wait for explicit user approval.

### Step 7: Update STATE.md

After the user approves the plan, update `.bee/STATE.md`:

1. Set the phase row's **Plan** column to `Yes`
2. Set the phase row's **Status** to `PLANNED`
3. Set **Last Action** to:
   - Command: `/bee:plan-phase {N}`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Phase {N} planned with {X} tasks in {Y} waves"

### Step 8: Completion Summary

Display to the user:

```
Phase {N} planned!

Phase: {phase-name}
Tasks: {X} tasks in {Y} waves
Path: .bee/specs/{folder}/phases/{NN}-{slug}/TASKS.md

Wave breakdown:
- Wave 1: {count} tasks (parallel, no dependencies)
- Wave 2: {count} tasks (depends on Wave 1)
...

Next step:
  /clear
  /bee:execute-phase {N}
```
