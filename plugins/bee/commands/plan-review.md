---
description: Review a phase plan (TASKS.md) against the original spec to find coverage gaps and discrepancies
argument-hint: "[phase-number]"
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` -- if not found: NOT_INITIALIZED
- `.bee/config.json` -- if not found: use `{}`

## Spec Context (load before proceeding)

Use Glob to find `.bee/specs/*/spec.md`, `.bee/specs/*/requirements.md`, and `.bee/specs/*/phases.md`, then Read each:
- If no spec.md found: NO_SPEC
- If no requirements.md found: NO_REQUIREMENTS
- If no phases.md found: NO_PHASES

## Instructions

You are running `/bee:plan-review` -- the plan review command for BeeDev. This command spawns the plan-reviewer agent to analyze a phase's TASKS.md against the original spec and requirements, finding coverage gaps and discrepancies before execution begins. Follow these steps in order.

### Step 1: Validation Guards

Check these guards in order. Stop immediately if any fails:

1. **NOT_INITIALIZED guard:** If the dynamic context above contains "NOT_INITIALIZED" (meaning `.bee/STATE.md` does not exist), tell the user:
   "BeeDev is not initialized. Run `/bee:init` first."
   Do NOT proceed.

2. **NO_SPEC guard:** If the dynamic context above contains "NO_SPEC" (meaning no spec.md exists), tell the user:
   "No spec found. Run `/bee:new-spec` first to create a specification."
   Do NOT proceed.

3. **Phase number validation:** Check `$ARGUMENTS` for a phase number. If missing or empty, tell the user:
   "Please provide a phase number: `/bee:plan-review 1`"
   Do NOT proceed.
   Read phases.md from the dynamic context above and count the phases. If the requested phase number exceeds the number of phases, tell the user:
   "Phase {N} does not exist. Your spec has {M} phases."
   Do NOT proceed.

4. **NO_REQUIREMENTS guard:** If the dynamic context above contains "NO_REQUIREMENTS" (meaning no requirements.md exists), tell the user:
   "No requirements found. Run `/bee:new-spec` to create a spec with requirements."
   Do NOT proceed.

5. **Phase planned guard:** Read STATE.md from the dynamic context above and check the Phases table. If the Plan column does NOT show "Yes" for the requested phase, tell the user:
   "Phase {N} is not yet planned. Run `/bee:plan-phase {N}` first."
   Do NOT proceed.

6. **Already reviewed guard:** Use Glob or Read to check if `{phase_directory}/PLAN-REVIEW.md` already exists. If yes, warn the user:
   "Phase {N} plan already has a review. Re-running will overwrite it. Continue?"
   Wait for explicit user confirmation before proceeding. If the user declines, stop.

### Step 2: Load Phase Context

1. Read STATE.md to find Current Spec Path
2. Determine phase number and slug from the Phases table
3. Construct paths:
   - Spec directory: `{spec-path}/`
   - Phase directory: `{spec-path}/phases/{NN}-{slug}/`
   - spec.md: `{spec-path}/spec.md`
   - requirements.md: `{spec-path}/requirements.md`
   - phases.md: `{spec-path}/phases.md`
   - TASKS.md: `{phase_directory}/TASKS.md`
4. Read TASKS.md to verify it exists and has content. If empty or missing, tell the user:
   "TASKS.md not found or empty for phase {N}. Run `/bee:plan-phase {N}` first."
   Do NOT proceed.

### Step 3: Spawn plan-reviewer Agent

1. Build the reviewer context packet:
   - spec.md path
   - requirements.md path
   - phases.md path
   - TASKS.md path
   - Phase directory path (where to write PLAN-REVIEW.md)
   - Phase number
   - Instruction: "Review the plan for phase {N}. Read spec.md for feature behavior and acceptance criteria. Read requirements.md for the structured requirements summary. Read phases.md for phase decomposition context. Read TASKS.md for the planned tasks. Write PLAN-REVIEW.md to the phase directory."

2. Spawn `plan-reviewer` agent via Task tool with `model: "sonnet"` (cross-reference comparison work) and the context packet above. Wait for the reviewer to complete.

3. After the reviewer completes, read `{phase_directory}/PLAN-REVIEW.md` using the Read tool. Verify the file was created. If PLAN-REVIEW.md does not exist, tell the user:
   "Plan reviewer did not produce PLAN-REVIEW.md. Review failed."
   Do NOT proceed.

### Step 4: Present Findings

1. Parse PLAN-REVIEW.md summary counts: total requirements, covered, partial, not covered, over-engineered

2. If status is CLEAN (0 gaps, 0 partial, 0 drift, 0 over-engineering):
   - Display:
     ```
     Plan review complete -- plan fully covers the spec!
     No gaps or discrepancies found.

     Proceed with `/bee:execute-phase {N}` when ready.
     ```
   - Stop.

3. If issues found, display a formatted summary:
   ```
   Plan Review for Phase {N}: {phase-name}

   Requirements: {total} checked
   - Covered: {N}
   - Partial: {N}
   - Not covered: {N}

   Issues:
   - Gaps: {N} requirements not covered
   - Spec drift: {N} tasks misaligned with spec
   - Over-engineering: {N} tasks beyond spec scope

   Full review: {phase_directory}/PLAN-REVIEW.md
   ```

4. Present options to the user:
   ```
   What would you like to do?
   (a) Approve plan as-is -- proceed to execution despite findings
   (b) Revise plan -- re-run /bee:plan-phase {N} to address the gaps
   (c) Add missing requirements -- expand the plan to cover gaps
   ```

5. Handle responses:
   - **(a) Approve:** Display "Plan approved. Run `/bee:execute-phase {N}` to start." Stop.
   - **(b) Revise:** Display "Re-run `/bee:plan-phase {N}` to create a revised plan. The PLAN-REVIEW.md will be available for the planner to reference." Stop. Do NOT auto-run plan-phase -- let the user do it in a fresh context.
   - **(c) Add missing:** For each gap in PLAN-REVIEW.md, ask the user which gaps to add. Then display: "To add these requirements, re-run `/bee:plan-phase {N}` and mention these gaps. The planner will read PLAN-REVIEW.md for context." Stop.

---

**Design Notes (do not display to user):**

- This command does NOT modify TASKS.md or STATE.md. It is a read-analyze-report command.
- The plan-reviewer agent is read-only except for writing PLAN-REVIEW.md.
- The command does not auto-chain into plan-phase. It presents findings and lets the user decide next steps in a fresh context window.
- For future integration with plan-phase: the plan-phase command can optionally spawn this review between Step 5 and Step 6 if `config.planReview` is true. That integration is not part of this task -- it can be added later as a one-line spawn in plan-phase.md.
- Always re-read files from disk, never rely on cached dynamic context for file contents.
