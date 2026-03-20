---
description: Plan all unplanned phases sequentially with plan review and cross-plan consistency check
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

You are running `/bee:plan-all` -- the orchestrator that plans all unplanned phases sequentially, reviews each plan autonomously, and runs a cross-plan consistency review across all phase plans together. This command is fully autonomous during its inner loop (no AskUserQuestion during planning/review iterations). Follow these steps in order.

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

4. **Phases needing work guard:** Read the Phases table from STATE.md. At least one phase must need planning work. A phase needs work if:
   - Its Plan column is empty (not yet planned), OR
   - Its Plan Review column is empty (planned but not yet reviewed)

   Phases with Status=PLANNED also qualify as needing work (already planned but not yet reviewed).

   If ALL phases have Plan set to "Yes" AND Plan Review set to a non-empty value (e.g., "Yes (1)", "Skipped"):
   - All per-phase planning and review is complete. Skip to Step 4 (Cross-Plan Review) directly — the cross-plan review always runs when all phases are individually plan-reviewed (it has no separate checkpoint and is idempotent).
   - Display: "All phases individually planned and reviewed. Running cross-plan consistency review..."

### Step 2: Discover Phases

1. Read the Phases table from STATE.md. Extract all phase rows: phase number, phase name, Status, Plan column, Plan Review column.
2. Read phases.md from the Spec Context above to get full phase names and descriptions.
3. Build a work list of phases in phase order (ascending by phase number). For each phase, classify its state:
   - **needs_planning:** Plan column is empty (not "Yes") -- needs the full three-pass planning pipeline
   - **needs_review:** Plan column is "Yes" but Plan Review column is empty -- skip planning, go directly to plan review
   - **complete:** Plan column is "Yes" AND Plan Review column is non-empty -- fully skip this phase
4. Display the discovery summary:

   ```
   Plan-all: {total} phases discovered.

   {For each phase:}
   - Phase {N}: {name} -- {needs_planning | needs_review | complete (skip)}
   ```

### Step 3: Sequential Phase Planning and Review

Process each phase in phase order (Phase 1 first, then Phase 2, etc.). For each phase that is NOT classified as "complete":

**3a. Create Phase Directory (for needs_planning phases only)**

Skip this step if the phase is classified as "needs_review" (directory already exists).

1. Read phases.md to get the phase name for the current phase number
2. Slugify the phase name: `echo "{name}" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-'`
3. Determine the spec folder path from STATE.md (Current Spec Path)
4. Construct the phase directory path: `{spec-path}/phases/{NN}-{slug}/` where NN is the zero-padded phase number (e.g., 01, 02, 03)
5. Create the directory if it does not exist: `mkdir -p {phase-directory}`
6. If the directory already exists, note that TASKS.md will be overwritten but preserve the directory

**3b. Plan What -- Spawn phase-planner Agent (Pass 1) (for needs_planning phases only)**

Skip this step if the phase is classified as "needs_review".

Read `config.implementation_mode` from config.json (defaults to `"quality"` if absent).

**Premium mode** (`implementation_mode: "premium"`): Omit the model parameter (inherit parent model) -- premium uses the strongest model for all work.

**Economy or Quality mode** (default): Pass `model: "sonnet"` -- scanning/planning work is structured and does not require deep reasoning.

Spawn the `phase-planner` agent as a subagent with the model determined above. Provide the following context:

- The phase directory path (where to write TASKS.md)
- The phase number being planned
- The spec folder path (where spec.md and phases.md live)
- Instruction: "This is Pass 1 (Plan What). Read spec.md and phases.md to understand the feature. Decompose phase {N} into granular tasks with testable acceptance criteria. Read the TASKS.md template at skills/core/templates/tasks.md for the output structure. Write initial TASKS.md (task list without waves) to the phase directory."

If the phase number is greater than 1, also provide:
- Paths to ALL prior phases' TASKS.md files (so the planner knows what is already built and planned). Use Glob to find them: `{spec-path}/phases/{NN}-*/TASKS.md` for each prior phase number.
- Instruction addition: "Read TASKS.md from prior phases to understand what is already built or planned. Avoid duplicating existing work. Reference outputs from earlier phases where needed."

Wait for the phase-planner to complete. Verify that TASKS.md was created in the phase directory:
```
ls {phase-directory}/TASKS.md
```

If TASKS.md was not created, tell the user the planner failed for phase {N} and stop.

**3c. Plan How -- Spawn researcher Agent (for needs_planning phases only)**

Skip this step if the phase is classified as "needs_review".

Read `config.implementation_mode` from config.json (defaults to `"quality"` if absent).

**Premium mode** (`implementation_mode: "premium"`): Omit the model parameter (inherit parent model) -- premium uses the strongest model for all work.

**Economy or Quality mode** (default): Pass `model: "sonnet"` -- scanning/planning work is structured and does not require deep reasoning.

After the phase-planner completes, spawn the `researcher` agent as a subagent with the model determined above. Provide the following context:

- The phase directory path (where TASKS.md lives)
- The spec folder path
- Instruction: "Read TASKS.md from the phase directory. For each task, research the codebase for existing patterns to follow, identify reusable code, and if Context7 is enabled in config.json, fetch relevant framework docs. Update TASKS.md with research notes under each task's research: field."

Wait for the researcher to complete. Verify that TASKS.md now has research notes:
```
grep "research:" {phase-directory}/TASKS.md
```

If no research notes were added, warn but continue (research enrichment is valuable but not blocking).

**3d. Plan Who -- Spawn phase-planner Agent (Pass 2) (for needs_planning phases only)**

Skip this step if the phase is classified as "needs_review".

Read `config.implementation_mode` from config.json (defaults to `"quality"` if absent).

**Premium mode** (`implementation_mode: "premium"`): Omit the model parameter (inherit parent model) -- premium uses the strongest model for all work.

**Economy or Quality mode** (default): Pass `model: "sonnet"` -- scanning/planning work is structured and does not require deep reasoning.

Re-spawn the `phase-planner` agent as a subagent with the model determined above. Provide the following context:

- The phase directory path (where research-enriched TASKS.md lives)
- Instruction: "This is Pass 2 (Plan Who). Read the research-enriched TASKS.md. Analyze task dependencies, detect file ownership conflicts (no two tasks in the same wave may modify the same file), group tasks into parallel waves, and define context packets per task. Write the final TASKS.md with wave structure, replacing the pre-wave version."

Wait for the phase-planner to complete. Verify that TASKS.md now has wave sections:
```
grep "Wave" {phase-directory}/TASKS.md
```

If no wave sections were added, tell the user the wave assignment failed for phase {N} and stop.

**3e. Update STATE.md Plan Column**

After the three-pass planning pipeline completes (or was skipped because the phase was "needs_review"):

If the phase was classified as "needs_planning" (just completed planning):
1. Read current `.bee/STATE.md` from disk (fresh read, not cached)
2. Set the phase row's **Plan** column to `Yes`
3. Set the phase row's **Status** to `PLANNED`
4. Set **Last Action** to:
   - Command: `/bee:plan-all`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Phase {N} planned"
5. Write updated STATE.md to disk

Display: "Phase {N} planning complete. Starting plan review..."

**3f. Autonomous Plan Review**

Run the plan review pipeline for this phase. This is an autonomous auto-fix loop -- no interactive prompts. Plan-all does NOT invoke the interactive plan-review command; it reuses the same agents but skips all interactive prompts.

Read `config.ship.max_review_iterations` from config.json (default: 3). Store as `$MAX_PLAN_REVIEW_ITERATIONS`.

Initialize: `$PLAN_REVIEW_ITERATION = 1`.

**3f.1: Build context packets for four review agents**

Build a shared context base:
- Spec path: `{spec.md path}`
- Requirements path: `{requirements.md path}` (if it exists -- if NO_REQUIREMENTS, omit)
- Phases path: `{phases.md path}`
- TASKS.md path: `{phase_directory}/TASKS.md`
- Phase number: `{N}`

Build four agent-specific context packets:

**Agent 1: Bug Detector** (`bee:bug-detector`)
```
This is a PLAN REVIEW (not code review). Review the planned tasks against the spec requirements for potential bugs and logic errors.

Spec: {spec.md path}
Requirements: {requirements.md path} (if it exists)
Phases: {phases.md path}
TASKS.md: {phase_directory}/TASKS.md
Phase number: {N}

Read TASKS.md to understand the planned tasks, their acceptance criteria, and wave assignments. Read spec.md and phases.md to understand what the feature should do. Look for potential bugs in the plan: tasks that could introduce logic errors, missing error handling, security vulnerabilities, race conditions, or edge cases that the plan does not account for.

Apply the Review Quality Rules from the review skill: same-class completeness (scan ALL similar constructs when finding one bug), edge case enumeration (verify loop bounds, all checkbox states, null paths), and crash-path tracing (for each state write, trace what happens if the session crashes here).

Report only HIGH confidence findings in your standard output format.
```

**Agent 2: Pattern Reviewer** (`bee:pattern-reviewer`)
```
This is a PLAN REVIEW (not code review). Review the planned tasks against established project patterns.

Spec: {spec.md path}
Requirements: {requirements.md path} (if it exists)
Phases: {phases.md path}
TASKS.md: {phase_directory}/TASKS.md
Phase number: {N}

Read TASKS.md to understand the planned tasks. Search the codebase for similar existing implementations. Check whether the planned approach follows established project patterns or deviates from them.

Apply same-class completeness: when you find a pattern deviation in one location, scan ALL similar constructs across the codebase for the same deviation. Report ALL instances, not just the first.

Report only HIGH confidence deviations in your standard output format.
```

**Agent 3: Plan Compliance Reviewer** (`bee:plan-compliance-reviewer`)
```
This is a PLAN REVIEW (not code review). You are operating in PLAN REVIEW MODE.

Spec: {spec.md path}
Requirements: {requirements.md path} (if it exists)
Phases: {phases.md path}
TASKS.md: {phase_directory}/TASKS.md
Phase number: {N}

Review mode: plan review. Follow your Plan Review Mode steps (Steps 3p-7p). Extract all spec requirements, extract all plan tasks, build the coverage matrix, and identify gaps, partial coverage, spec drift, and over-engineering. Report findings in your standard plan review mode output format.
```

**Agent 4: Stack Reviewer** (`bee:stack-reviewer`)
```
This is a PLAN REVIEW (not code review). Review the planned tasks against stack best practices.

Spec: {spec.md path}
Requirements: {requirements.md path} (if it exists)
Phases: {phases.md path}
TASKS.md: {phase_directory}/TASKS.md
Phase number: {N}

Read TASKS.md to understand the planned tasks. Load the stack skill dynamically from config.json and check whether the planned approach follows the stack's conventions and best practices. Use Context7 to verify framework best practices. Report only HIGH confidence violations in your standard output format.
```

**3f.2: Spawn all four agents in parallel**

Read `config.implementation_mode` from config.json (defaults to `"quality"` if absent).

**Economy mode** (`implementation_mode: "economy"`): Pass `model: "sonnet"` for all agents.

**Quality or Premium mode** (default `"quality"`, or `"premium"`): Omit the model parameter for all agents (they inherit the parent model).

Spawn all four agents via four Task tool calls in a SINGLE message (parallel execution).

Wait for all four agents to complete.

**3f.3: Consolidate findings**

After all four agents complete, consolidate their findings:

- **Bug Detector** output -> **Bug Fixes Required**: extract entries from `## Bugs Detected`
- **Pattern Reviewer** output -> **Pattern Issues**: extract entries from `## Project Pattern Deviations`
- **Plan Compliance Reviewer** output -> **Spec Compliance Gaps**: extract entries from `## Plan Compliance Review` (gaps G-NNN, partial coverage P-NNN, spec drift D-NNN, over-engineering O-NNN)
- **Stack Reviewer** output -> **Stack Best Practice Issues**: extract entries from `## Stack Best Practice Violations`

Count total issues across all agents.

**3f.4: Auto-fix loop**

If 0 issues found: display "Plan review for Phase {N} clean -- no issues found." Set plan review result to "reviewed". Proceed to Step 3g.

If issues found:

Display: "Plan review for Phase {N} (iteration {$PLAN_REVIEW_ITERATION}): {X} issues found. Auto-fixing..."

For each finding, apply fixes directly to TASKS.md on disk:
- Spec compliance gaps -> add missing acceptance criteria or tasks
- Bug risks -> add edge case handling to acceptance criteria
- Pattern issues -> update task descriptions to follow established patterns
- Stack issues -> align task approach with stack conventions

Display: "Fixed {X} issues in Phase {N} TASKS.md."

Log the decision to STATE.md Decisions Log:
- **[Plan review auto-fix]:** Auto-fixed {X} issues in Phase {N} plan (iteration {$PLAN_REVIEW_ITERATION}).
- **Why:** Plan review found issues that could be resolved automatically without user input.
- **Alternative rejected:** Stopping for manual fix -- plan-all is autonomous; auto-fix is faster and consistent.

If `$PLAN_REVIEW_ITERATION >= $MAX_PLAN_REVIEW_ITERATIONS`: display "Max review iterations ({$MAX_PLAN_REVIEW_ITERATIONS}) reached for Phase {N}. Proceeding with current plan." Log unresolved findings to Decisions Log. Set plan review result to "reviewed". Proceed to Step 3g.

Increment `$PLAN_REVIEW_ITERATION`.

Go back to **Step 3f.2** (re-spawn all four review agents with the updated TASKS.md). After agents complete, re-run 3f.3 and 3f.4. If the re-review finds 0 issues: display "Plan review for Phase {N} clean after {$PLAN_REVIEW_ITERATION} iterations." Set plan review result to "reviewed". Proceed to Step 3g.

**3g. Update STATE.md Plan Review Column**

After plan review completes for this phase:

1. Read current `.bee/STATE.md` from disk (fresh read, not cached)
2. Set the phase row's **Plan Review** column to `Yes (1)` (or `Yes ({$PLAN_REVIEW_ITERATION})` if multiple iterations ran)
3. Set the phase row's **Status** to `PLAN_REVIEWED`
4. Set **Last Action** to:
   - Command: `/bee:plan-all`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Phase {N} plan reviewed ({$PLAN_REVIEW_ITERATION} iteration(s), {issues_found} issues fixed)"
5. Write updated STATE.md to disk

Display: "Phase {N} planned and reviewed. {task_count} tasks in {wave_count} waves."

**3h. Proceed to next phase**

Move to the next phase in phase order. Repeat from Step 3a.

### Step 4: Cross-Plan Consistency Review

After ALL phases have been individually planned and reviewed, run the cross-plan consistency review. This examines all phase plans together to catch inter-phase issues that per-phase reviews cannot detect.

NOTE: Cross-plan review has no separate checkpoint in STATE.md. It always runs when all phases are individually plan-reviewed. This is intentional: cross-plan review is cheap (2 agents) and idempotent, so re-running it on resume is acceptable.

**4a. Gather all phase TASKS.md paths**

Use Glob to find all TASKS.md files: `{spec-path}/phases/*/TASKS.md`

Read the spec path from STATE.md (Current Spec Path).

Build a list of all phase TASKS.md paths in phase order.

**4b. Build cross-plan context packets**

Read `config.ship.max_review_iterations` from config.json (default: 3). Store as `$MAX_CROSS_PLAN_ITERATIONS`.

Initialize: `$CROSS_PLAN_ITERATION = 1`.

Build two agent-specific context packets:

**Agent 1: Plan Compliance Reviewer -- Cross-Plan Mode** (`bee:plan-compliance-reviewer`)
```
This is a CROSS-PLAN CONSISTENCY REVIEW. You are reviewing ALL phase plans together to find inter-phase issues that per-phase reviews cannot detect.

Spec: {spec.md path}
Requirements: {requirements.md path} (if it exists)
Phases: {phases.md path}
Phase TASKS.md files (read ALL of these):
{For each phase: - Phase {N}: {phase_directory}/TASKS.md}

Review ALL phase plans simultaneously. Check for:
- Data contract consistency: field names, types, and data shapes used across phases are consistent
- Dependency chain integrity: tasks in later phases reference correct outputs from earlier phases
- File ownership conflicts: two phases modifying the same file with potentially incompatible changes
- Scope overlap: two phases creating the same component or updating the same service
- API contract alignment: backend endpoints from one phase match frontend calls from another phase
- Test coverage gaps at phase boundaries: integration points between phases with no phase claiming test responsibility

Report findings using CI-NNN codes for cross-phase integration issues. Report only HIGH confidence findings in your standard output format.
```

**Agent 2: Bug Detector -- Cross-Plan Mode** (`bee:bug-detector`)
```
This is a CROSS-PLAN CONSISTENCY REVIEW. You are reviewing ALL phase plans together to find inter-phase bugs that per-phase reviews cannot detect.

Spec: {spec.md path}
Requirements: {requirements.md path} (if it exists)
Phases: {phases.md path}
Phase TASKS.md files (read ALL of these):
{For each phase: - Phase {N}: {phase_directory}/TASKS.md}

Review ALL phase plans simultaneously. Look for potential bugs that span multiple phases: data flow issues where one phase produces output that another phase consumes incorrectly, race conditions in cross-phase dependencies, missing error handling at phase boundaries, and security gaps that emerge when phases interact. Report only HIGH confidence findings in your standard output format.
```

**4c. Spawn both agents in parallel**

Read `config.implementation_mode` from config.json (defaults to `"quality"` if absent).

**Economy mode** (`implementation_mode: "economy"`): Pass `model: "sonnet"` for both agents.

**Quality or Premium mode** (default `"quality"`, or `"premium"`): Omit the model parameter for both agents (they inherit the parent model).

Spawn both agents via two Task tool calls in a SINGLE message (parallel execution).

Wait for both agents to complete.

**4d. Consolidate cross-plan findings**

Parse both agents' output:
- **Plan Compliance Reviewer** -> cross-phase integration issues (CI-NNN codes)
- **Bug Detector** -> cross-phase bug risks

Count total cross-plan issues.

**4e. Cross-plan auto-fix loop**

If 0 issues found: display "Cross-plan review clean -- no inter-phase issues found." Proceed to Step 5.

If issues found:

Display: "Cross-plan review (iteration {$CROSS_PLAN_ITERATION}): {X} inter-phase issues found. Auto-fixing..."

For each finding, identify the affected phase(s) and apply fixes to the relevant TASKS.md file(s):
- Data contract mismatches -> update field names/types in the phase that is inconsistent
- Dependency chain breaks -> add or update dependency references in the later phase's tasks
- File ownership conflicts -> add coordination notes to the affected tasks in both phases
- Scope overlap -> consolidate duplicated work into the appropriate phase, remove from the other
- API contract misalignment -> align the frontend or backend phase's task to match the other
- Test coverage gaps -> add integration test tasks to the appropriate phase boundary

Display: "Fixed {X} cross-plan issues across {Y} phase(s)."

Log the decision to STATE.md Decisions Log:
- **[Cross-plan auto-fix]:** Auto-fixed {X} inter-phase issues across {Y} phase(s) (iteration {$CROSS_PLAN_ITERATION}).
- **Why:** Cross-plan review found inter-phase inconsistencies that could cause integration failures.
- **Alternative rejected:** Ignoring cross-plan issues -- these are structural problems that would surface as bugs during execution.

If `$CROSS_PLAN_ITERATION >= $MAX_CROSS_PLAN_ITERATIONS`: display "Max cross-plan review iterations ({$MAX_CROSS_PLAN_ITERATIONS}) reached. Proceeding with current plans." Log unresolved findings to Decisions Log. Proceed to Step 5.

Increment `$CROSS_PLAN_ITERATION`.

Go back to **Step 4c** (re-spawn both agents with the updated TASKS.md files). After agents complete, re-run 4d and 4e. If 0 issues: display "Cross-plan review clean after {$CROSS_PLAN_ITERATION} iterations." Proceed to Step 5.

### Step 5: Completion Summary

Read the final state from disk. For each phase, read its TASKS.md and count tasks and waves.

Display the completion summary:

```
Plan-all complete!

Per-phase summary:
{For each phase:}
- Phase {N}: {name}
  Tasks: {task_count} tasks in {wave_count} waves
  Plan review: {iterations} iteration(s), {issues_fixed} issues fixed

Cross-plan review: {clean | {X} issues fixed in {Y} iterations | max iterations reached with {Z} unresolved}

Total: {total_tasks} tasks across {total_waves} waves in {total_phases} phases

Next step: /bee:ship or /bee:execute-phase 1
```

Update STATE.md Last Action:
- Command: `/bee:plan-all`
- Timestamp: current ISO 8601 timestamp
- Result: "All phases planned: {total_tasks} tasks across {total_phases} phases (cross-plan: {clean|fixed|unresolved})"

Present the exit menu using AskUserQuestion:

```
AskUserQuestion(
  question: "Plan-all complete. {total_phases} phases planned, {total_tasks} tasks.",
  options: ["Ship", "Execute Phase 1", "Custom"]
)
```

- **Ship**: Execute `/bee:ship`
- **Execute Phase 1**: Execute `/bee:execute-phase 1`
- **Custom**: Free text

---

**Design Notes (do not display to user):**

- Plan-all is fully autonomous during its inner loop. No AskUserQuestion calls during planning, review, or cross-plan review. This is the same explicit exception to R3 that ship uses -- the command is designed to run unattended.
- The three-pass planning pipeline (Steps 3b-3d) is identical to plan-phase.md Steps 3-5. The same agents are spawned with the same context packets. The difference is that plan-all orchestrates this per-phase in a loop.
- The plan review pipeline (Step 3f) reuses the same four agents as plan-review.md Step 3 but operates autonomously: findings are auto-fixed without user confirmation, and re-review loops until clean or max iterations.
- Cross-plan review (Step 4) uses only two of the four review agents: plan-compliance-reviewer and bug-detector. The pattern-reviewer and stack-reviewer are omitted because they operate on code patterns within a single phase and do not benefit from cross-plan scope.
- Cross-plan review has no separate STATE.md checkpoint. It always runs when all phases are individually plan-reviewed. This is by design: cross-plan review is cheap (2 agents) and idempotent. Re-running on resume is acceptable and simpler than adding a separate state column.
- Resume behavior checks both Plan and Plan Review columns independently. A crash between planning and reviewing resumes at the review step (needs_review), not from scratch. A crash during cross-plan review re-runs cross-plan review for all phases (idempotent, cheap).
- The conductor is the sole writer to TASKS.md and STATE.md. All updates use the Read-Modify-Write pattern: read from disk, modify in memory, write back. This prevents stale overwrites.
- When planning phase N > 1, the planner receives paths to ALL prior phases' TASKS.md files. This enables dependency awareness: later phases can reference what earlier phases produce.
- Model selection follows the same pattern as plan-phase.md: premium mode inherits the parent model, economy/quality mode passes model: "sonnet" for structured planning work. Review agent model selection follows the same implementation_mode pattern as plan-review.md.
- The `ship.max_review_iterations` config setting is shared between plan-all (plan review auto-fix loop) and ship (code review auto-fix loop). It defaults to 3.
- Decision log entries follow the format defined in the STATE.md template: what, why, alternative rejected. Each auto-fix action and each max-iterations-reached event generates a decision log entry.
