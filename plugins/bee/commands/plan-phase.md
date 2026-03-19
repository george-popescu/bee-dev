---
description: Create a detailed execution plan for a spec phase with researched tasks and wave grouping
argument-hint: "[phase-number]"
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`
- `.bee/PROJECT.md` — if not found: skip (project index not available)

## Spec Context (load before proceeding)

Use Glob to find `.bee/specs/*/spec.md`, `.bee/specs/*/requirements.md`, and `.bee/specs/*/phases.md`, then Read each:
- If no spec.md found: NO_SPEC
- If no requirements.md found: NO_REQUIREMENTS (optional -- plan phase can proceed without it)
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

Read `config.implementation_mode` from config.json (defaults to `"quality"` if absent).

**Premium mode** (`implementation_mode: "premium"`): Omit the model parameter (inherit parent model) -- premium uses the strongest model for all work.

**Economy or Quality mode** (default): Pass `model: "sonnet"` -- scanning/planning work is structured and does not require deep reasoning.

Spawn the `phase-planner` agent as a subagent with the model determined above. Provide the following context:

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

If no research notes were added, warn the user but continue (research enrichment is valuable but not blocking).

### Step 5: Plan Who -- Spawn phase-planner Agent (Pass 2)

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

If no wave sections were added, tell the user the wave assignment failed and stop.

### Step 6: Plan Review -- Spawn Four Specialized Agents in Parallel

After wave assignment completes, run a mandatory plan review. Four specialized agents review the plan against the spec to catch coverage gaps, pattern deviations, potential bugs, and stack best practice issues before the developer sees the plan.

Read `config.implementation_mode` from config.json (defaults to `"quality"` if absent). This determines the model tier for the four review agents spawned in Step 6.2.

#### 6.1: Build context packets

Build a shared context base for all four agents:
- Spec path: `{spec.md path}`
- Requirements path: `{requirements.md path}` (in spec folder, if it exists -- if not, omit)
- Phases path: `{phases.md path}`
- TASKS.md path: `{phase_directory}/TASKS.md`
- Phase number: `{N}`

Then build four agent-specific context packets:

**Agent 1: Bug Detector** (`bee:bug-detector`) -- model set in 6.2 by implementation_mode
```
This is a PLAN REVIEW (not code review). Review the planned tasks against the spec requirements for potential bugs and logic errors.

Spec: {spec.md path}
Requirements: {requirements.md path} (if it exists)
Phases: {phases.md path}
TASKS.md: {phase_directory}/TASKS.md
Phase number: {N}

Read TASKS.md to understand the planned tasks, their acceptance criteria, and wave assignments. Read spec.md and phases.md to understand what the feature should do. Look for potential bugs in the plan: tasks that could introduce logic errors, missing error handling, security vulnerabilities, race conditions, or edge cases that the plan does not account for. Report only HIGH confidence findings in your standard output format.
```

**Agent 2: Pattern Reviewer** (`bee:pattern-reviewer`) -- model set in 6.2 by implementation_mode
```
This is a PLAN REVIEW (not code review). Review the planned tasks against established project patterns.

Spec: {spec.md path}
Requirements: {requirements.md path} (if it exists)
Phases: {phases.md path}
TASKS.md: {phase_directory}/TASKS.md
Phase number: {N}

Read TASKS.md to understand the planned tasks. Search the codebase for similar existing implementations. Check whether the planned approach follows established project patterns or deviates from them. Report only HIGH confidence deviations in your standard output format.
```

**Agent 3: Plan Compliance Reviewer** (`bee:plan-compliance-reviewer`) -- model set in 6.2 by implementation_mode
```
This is a PLAN REVIEW (not code review). You are operating in PLAN REVIEW MODE.

Spec: {spec.md path}
Requirements: {requirements.md path} (if it exists)
Phases: {phases.md path}
TASKS.md: {phase_directory}/TASKS.md
Phase number: {N}

Review mode: plan review. Follow your Plan Review Mode steps (Steps 3p-7p). Extract all spec requirements, extract all plan tasks, build the coverage matrix, and identify gaps, partial coverage, spec drift, and over-engineering. Report findings in your standard plan review mode output format.
```

**Agent 4: Stack Reviewer** (`bee:stack-reviewer`) -- model set in 6.2 by implementation_mode
```
This is a PLAN REVIEW (not code review). Review the planned tasks against stack best practices.

Spec: {spec.md path}
Requirements: {requirements.md path} (if it exists)
Phases: {phases.md path}
TASKS.md: {phase_directory}/TASKS.md
Phase number: {N}

Read TASKS.md to understand the planned tasks. Load the stack skill dynamically from config.json and check whether the planned approach follows the stack's conventions and best practices. Use Context7 to verify framework best practices. Report only HIGH confidence violations in your standard output format.
```

#### 6.2: Spawn all four agents in parallel

Spawn all four agents via four Task tool calls in a SINGLE message (parallel execution). The model tier for these four review agents depends on `implementation_mode`:

**Economy mode** (`implementation_mode: "economy"`): Pass `model: "sonnet"` for all agents.

**Quality or Premium mode** (default `"quality"`, or `"premium"`): Omit the model parameter for all agents (they inherit the parent model).

Wait for all four agents to complete.

#### 6.3: Consolidate findings into categorized plan updates

After all four agents complete, consolidate their findings into categorized plan updates. Do NOT present raw review reports -- transform agent output into actionable plan update categories.

Parse each agent's output:

- **Bug Detector** output -> **Bug Fixes Required** section: extract entries from `## Bugs Detected` (severity-grouped findings)
- **Pattern Reviewer** output -> **Pattern Issues** section: extract entries from `## Project Pattern Deviations`
- **Plan Compliance Reviewer** output -> **Spec Compliance Gaps** section: extract entries from `## Plan Compliance Review` (gaps G-NNN, partial coverage P-NNN, spec drift D-NNN, over-engineering O-NNN)
- **Stack Reviewer** output -> **Stack Best Practice Issues** section: extract entries from `## Stack Best Practice Violations`

Format the consolidated output as:

```markdown
## Plan Updates Required

### Bug Fixes Required
- [Specific change needed based on bug detector findings]

### Pattern Issues
- [Specific change needed based on pattern reviewer findings]

### Spec Compliance Gaps
- [Specific change needed based on plan compliance reviewer findings]

### Stack Best Practice Issues
- [Specific change needed based on stack reviewer findings]

---

**Summary:** X changes required across Y categories.
```

If a category has no issues from its agent, omit that category section entirely.

If NO issues found across all four agents: display "Plan review complete. No changes required." and proceed directly to Step 7 (present plan to user). Set the plan review result to "clean" for use in Step 8.

#### 6.4: Fix issues and re-review (auto-fix loop)

If no issues were found (the "clean" case from 6.3), set plan review result to "reviewed" and proceed directly to Step 7 without prompting. Display: "Plan review clean -- no issues found."

If issues were found, **fix them automatically** in TASKS.md (this is the default, recommended behavior):

Initialize: `$PLAN_REVIEW_ITERATION = 1`. Read `config.review.max_plan_review_iterations` from config.json (default: 3). Store as `$MAX_PLAN_REVIEW_ITERATIONS`.

**6.4.1: Present findings and fix**

Display the findings clearly to the developer with what you're about to fix:

```
Plan review (iteration {$PLAN_REVIEW_ITERATION}): {X} issues found.

{For each finding, show:}
- [{Category}] {description} → Fix: {what you'll change in TASKS.md}

Fixing these in TASKS.md...
```

Apply all fixes directly to TASKS.md on disk. For each finding:
- Spec compliance gaps → add missing acceptance criteria or tasks
- Bug risks → add edge case handling to acceptance criteria
- Pattern issues → update task descriptions to follow established patterns
- Stack issues → align task approach with stack conventions

After fixing, display: "Fixed {N} issues. Re-running review..."

**6.4.2: Re-review loop**

After applying fixes:
1. Increment `$PLAN_REVIEW_ITERATION`
2. If `$PLAN_REVIEW_ITERATION > $MAX_PLAN_REVIEW_ITERATIONS`: display "Max review iterations ({$MAX_PLAN_REVIEW_ITERATIONS}) reached. Proceeding with current plan." Set plan review result to "reviewed". Proceed to Step 7.
3. Otherwise: go back to **Step 6.2** (re-spawn all four review agents with the updated TASKS.md). After agents complete, re-run Steps 6.3 and 6.4.
4. If the re-review finds 0 issues: display "Plan review clean after {$PLAN_REVIEW_ITERATION} iterations." Set plan review result to "reviewed". Proceed to Step 7.

**6.4.3: Developer override (optional)**

After presenting findings but BEFORE auto-fixing, the developer may interrupt with a message. If the developer intervenes:
- "skip" or "skip review" → set plan review result to "skipped", proceed to Step 7
- "I'll fix it manually" → display "Edit TASKS.md at `{phase_directory}/TASKS.md`, then re-run `/bee:plan-review {N}` for a fresh review." Stop.
- Specific instructions → apply the developer's requested changes instead of auto-fix, then re-review

If the developer does NOT intervene (no message), proceed with auto-fix as described above. Auto-fix is the default.

### Step 7: Present Plan to User for Approval

Read the final TASKS.md from disk. Present a formatted summary to the user:

1. **Overview:** Total tasks and wave count
2. **Per wave:** List tasks with their acceptance criteria (brief summary)
3. **Flags:** Highlight any tasks with empty research notes (flag for attention)

Then ask the user:

Use AskUserQuestion:
```
AskUserQuestion(
  question: "Plan phase {N} complet. {X} tasks în {W} waves.",
  options: ["Plan Review", "Accept", "Revise", "Custom"]
)
```

- **Plan Review**: Execute plan review pipeline (4 agents in parallel) — re-run Step 6 (spawn four specialized review agents in parallel) then continue to Step 8 on completion
- **Accept**: Skip review, update STATE.md (Step 8), end command
- **Revise**: Follow-up AskUserQuestion (text liber) for revision instructions — apply changes to TASKS.md, re-present updated plan summary, repeat the menu
- **Custom**: Free text

IMPORTANT: Never auto-approve the plan. Always present it and wait for explicit user approval.

### Step 8: Update STATE.md

After the user approves the plan, update `.bee/STATE.md`:

1. Set the phase row's **Plan** column to `Yes`
2. Set the phase row's **Plan Review** column based on the plan review result from Step 6:
   - If plan review result is "reviewed" (developer accepted, modified, or no issues found): set to `Yes (1)`
   - If plan review result is "skipped" (developer chose to skip): set to `Skipped`
3. Set the phase row's **Status** based on the plan review result from Step 6:
   - If plan review result is "reviewed" (developer accepted, modified, or no issues found): set to `PLAN_REVIEWED`
   - If plan review result is "skipped" (developer chose to skip): set to `PLANNED`
4. Set **Last Action** to:
   - Command: `/bee:plan-phase {N}`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Phase {N} planned with {X} tasks in {Y} waves (plan review: {reviewed|skipped})"

### Step 9: Completion Summary

Display to the user:

```
Phase {N} planned!

Phase: {phase-name}
Tasks: {X} tasks in {Y} waves
Plan review: {Yes (1) | skipped | clean -- no issues found} {(N iterations) if N > 1}
Path: .bee/specs/{folder}/phases/{NN}-{slug}/TASKS.md

Wave breakdown:
- Wave 1: {count} tasks (parallel, no dependencies)
- Wave 2: {count} tasks (depends on Wave 1)
...

Next step: /bee:execute-phase {N}
```
