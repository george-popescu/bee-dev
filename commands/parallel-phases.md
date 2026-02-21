---
name: parallel-phases
description: Execute independent phases simultaneously using agent teams (experimental, requires agent teams)
argument-hint: "[phase-numbers]"
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`

## Instructions

You are running `/bee:parallel-phases` -- the experimental parallel phase execution command for BeeDev. This command uses Claude Code agent teams to execute multiple independent phases simultaneously, with dependency analysis, file conflict detection, and coordinated state management. Follow these steps in order.

### Step 1: Validation Guards

Check these guards in order. Stop immediately if any fails:

1. **NOT_INITIALIZED guard:** If the dynamic context above contains "NOT_INITIALIZED" (meaning `.bee/STATE.md` does not exist), tell the user:
   "BeeDev is not initialized. Run `/bee:init` first."
   Do NOT proceed.

2. **NO_SPEC guard:** Read STATE.md from the dynamic context above. If no Current Spec Path exists or it shows "(none)", tell the user:
   "No spec found. Run `/bee:new-spec` first."
   Do NOT proceed.

3. **Phase numbers validation:** Parse `$ARGUMENTS` for comma-separated or space-separated phase numbers (e.g., "2,3" or "2 3"). If no arguments provided, read the Phases table from STATE.md and auto-detect all phases where Plan column shows "Yes" AND Status is NOT "EXECUTED", "REVIEWED", "TESTED", or "COMMITTED". If fewer than 2 phases qualify, tell the user:
   "Only {N} phase(s) available for parallel execution. Use `/bee:execute-phase {N}` for single phase execution."
   Do NOT proceed.

4. **Phase existence and readiness:** For each requested phase number:
   - Verify the phase number exists in the Phases table. If not: "Phase {N} does not exist. Your spec has {M} phases." Stop.
   - Verify the Plan column shows "Yes". If not: "Phase {N} is not planned yet. Run `/bee:plan-phase {N}` first." Stop.
   - Verify the Status is NOT "EXECUTED", "REVIEWED", "TESTED", or "COMMITTED". If it is: "Phase {N} is already {status}. Skipping." Remove from the list. If all phases are skipped, stop.

5. **Agent teams prerequisite guard:** Attempt to use TeamCreate to create a team (the team will be used in Step 5). If TeamCreate fails or the tool is not available, tell the user:
   "Agent teams are not enabled. To use parallel phases, add to your settings.json:"
   ```json
   { "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }
   ```
   "Use `/bee:execute-phase N` for each phase sequentially instead."
   Do NOT proceed.

### Step 2: Dependency Analysis

1. Read the Current Spec Path from STATE.md. Construct the path to the spec's `phases.md` file: `{spec-path}/phases.md`.
2. Read `phases.md` to understand phase descriptions and dependencies. Phase dependencies are stated in the phase descriptions (e.g., "depends on Phase 2 output", "requires Phase 1 models").
3. For each pair of requested phases, check if one depends on the other. Build a dependency graph of the requested phases.
4. If any pair of requested phases has a dependency relationship, tell the user:
   "Phases {X} and {Y} have a dependency: {description}. They cannot run in parallel."
   "Options:"
   "(a) Execute only the independent phases in parallel: {list of independent phases}"
   "(b) Cancel and run sequentially with `/bee:execute-phase`"
   Wait for user choice. If (a), filter to only independent phases. If (b), stop.
5. If fewer than 2 independent phases remain after filtering, tell the user:
   "Only 1 independent phase remaining. Use `/bee:execute-phase {N}` instead."
   Do NOT proceed.

### Step 3: File Conflict Pre-Check

1. For each independent phase, construct the TASKS.md path: `{spec-path}/phases/{NN}-{slug}/TASKS.md` where NN is the zero-padded phase number and slug comes from the Phases table Name column (slugified: lowercase, hyphens, no spaces).
2. Read each phase's TASKS.md. Extract all file paths from each task's `context:`, `acceptance:`, and `research:` fields.
3. Compare file paths across phases. Build a set of files referenced by each phase. Check for intersection.
4. If any file path appears in two or more phases, warn the user:
   "Warning: Phases {X} and {Y} both reference `{file}`. Parallel execution may cause file conflicts."
   "Options:"
   "(a) Proceed anyway (risk conflicts)"
   "(b) Execute sequentially instead with `/bee:execute-phase`"
   "(c) Cancel"
   Wait for user choice:
   - (a) Proceed with the warning acknowledged
   - (b) Stop and suggest sequential execution
   - (c) Stop entirely

### Step 4: Present Execution Plan and Get Confirmation

1. Display the execution plan:
   ```
   Parallel Phase Execution Plan

   Phases to execute in parallel: {list with names}
   Tasks per phase:
     Phase {X} ({name}): {N} tasks in {M} waves
     Phase {Y} ({name}): {N} tasks in {M} waves

   WARNING: This is an experimental feature using agent teams.
   Token usage will be approximately {count}x that of sequential execution
   (one context window per phase).
   ```

2. Ask for confirmation: "Execute these phases in parallel? (y/n)"
3. If the user declines, stop.

### Step 5: Create Agent Team

1. If TeamCreate was not already called in Step 1 (agent teams guard), create the team now. Use TeamCreate with:
   - team_name: "bee-phases-{spec_name}" (spec_name slugified from the spec directory name)
   - description: "Parallel execution of phases {list}"
2. If TeamCreate fails, tell the user:
   "Agent team creation failed. Use `/bee:execute-phase N` for each phase sequentially."
   Do NOT proceed.
3. Create one task per phase via TaskCreate:
   - Title: "Execute Phase {N}: {phase-name}"
   - Description: "Execute all tasks in Phase {N} using wave-based TDD pattern"

### Step 6: Spawn Phase Execution Teammates

Spawn ALL phase execution teammates SIMULTANEOUSLY using the Task tool. Each teammate is a full Claude Code session that executes one phase. Do NOT wait for one teammate to finish before spawning the next.

Each teammate receives this context packet:

```
You are executing Phase {N}: {phase-name} for the BeeDev workflow.

Spec path: {spec-path}
TASKS.md: {spec-path}/phases/{NN}-{slug}/TASKS.md
Phase directory: {spec-path}/phases/{NN}-{slug}
Stack: {stack from config.json}

Execute all tasks in this phase following the TDD wave-based execution pattern:
1. Read TASKS.md to understand waves and tasks
2. For each wave (starting from first wave with pending [ ] tasks):
   a. For each pending task in the wave, spawn an implementer subagent via Task tool
      with the task's context packet (task ID, acceptance criteria, research notes,
      context file paths, dependency notes, stack skill instruction, TDD instruction)
   b. Wait for all implementer subagents in the wave to complete
   c. For each completed implementer, update TASKS.md: mark [x], write task notes
   d. Move to next wave
3. After all waves complete, report your results in a message to the team lead.
   Include: total tasks completed, any failures, wave summary.

IMPORTANT: You are the sole writer to YOUR phase's TASKS.md.
Do NOT write to .bee/STATE.md -- the lead handles state updates.
Do NOT modify files in other phase directories.

Read `.bee/config.json` to find the stack, then read the matching
stack skill at `skills/stacks/{stack}/SKILL.md` for conventions.
```

### Step 7: Monitor Execution

1. Monitor teammate progress via TaskList and teammate messages.
2. As each teammate completes its phase, the lead (this command) reads the result from the teammate's message. The message should include: total tasks completed, any failures, and a wave summary.
3. After receiving a completion message from a teammate, update STATE.md:
   - Read current `.bee/STATE.md` from disk (fresh Read -- always re-read before writing)
   - Set that phase's Status to `EXECUTED`
   - Set the Executed column to `Yes`
   - Set Last Action timestamp to current ISO 8601 and result to "Phase {N} executed via parallel-phases"
   - Write updated STATE.md to disk
   - IMPORTANT: The lead is the SOLE writer to STATE.md. Always re-read STATE.md from disk before each update (Read-Modify-Write pattern). Never cache STATE.md across updates.
4. If a teammate reports failure:
   - Note the failure and which phase
   - Continue monitoring other teammates (do NOT stop the team)
   - Report the failure to the user after all teammates complete

### Step 8: Collect Results and Clean Up

1. After all teammates complete (or timeout after a reasonable wait):
   - Send `shutdown_request` to each teammate via SendMessage:
     ```
     SendMessage type: "shutdown_request"
     recipient: "{teammate_name}"
     content: "Phase execution complete. Shutting down."
     ```
   - Wait for shutdown approvals from each teammate
   - Run TeamDelete to clean up team resources (config files and task lists)
2. If TeamDelete fails (teammates still active), attempt shutdown_request again. If still failing, inform the user:
   "Team cleanup incomplete. Run `rm -rf ~/.claude/teams/bee-phases-*` to manually clean up."
3. If any teammate did not complete:
   - Report which phase(s) did not finish
   - Suggest: "Run `/bee:execute-phase {N}` to complete Phase {N} manually."

### Step 9: Present Results and Suggest Next Steps

Display completion summary:

```
Parallel Phase Execution Complete!

{For each phase:}
Phase {N}: {phase-name}
  Tasks: {completed} completed, {failed} failed
  Waves: {wave_count} waves
  Status: {EXECUTED or FAILED}

Next steps:
- Run `/bee:review` for each executed phase (reviews must be sequential)
- Phase execution order for review: {list phases in numerical order}
```

Update `.bee/STATE.md` Last Action:
- Read current STATE.md from disk (fresh Read)
- Command: `/bee:parallel-phases`
- Timestamp: current ISO 8601 timestamp
- Result: "Parallel execution: {N} phases executed ({list})"
- Write updated STATE.md to disk

---

**Design Notes (do not display to user):**

- This command is an experimental alternative to running multiple `/bee:execute-phase N` calls sequentially. It is NOT a replacement. The standard sequential approach is simpler and more reliable.
- Agent teams are experimental and disabled by default. If any team operation fails, suggest sequential execution with `/bee:execute-phase`.
- The command IS the team lead. No separate coordinator agent is needed. In Claude Code agent teams, the main session that creates the team acts as the lead.
- Teammates can spawn their own subagents (implementer agents for wave execution) -- this is NOT nested teams. Teammates using the Task tool to spawn subagents within their own session is fully supported. Nested teams (teammates creating their own teams via TeamCreate) are prohibited by Claude Code.
- STATE.md sole-writer pattern: only the lead (this command) writes STATE.md. Teammates report progress via messages. The lead translates these into STATE.md updates using the Read-Modify-Write pattern (re-read from disk before each write).
- TASKS.md is per-phase isolated: each teammate writes only to its own phase's TASKS.md. There is no cross-phase TASKS.md conflict because each phase has its own directory.
- Reviews are NOT run in parallel. After parallel execution, the user runs `/bee:review` for each phase sequentially. Review involves file modifications (fixing) which could conflict across phases. Sequential review is safer.
- Token usage scales linearly with the number of phases executed in parallel. Each phase teammate gets its own full context window.
- The pre-execution file conflict check (Step 3) is conservative -- it flags potential conflicts even if tasks ultimately do not touch the same lines. It compares file paths referenced in TASKS.md, not actual file modifications.
- If the command crashes mid-execution, teammates may still be running. The user can clean up with `rm -rf ~/.claude/teams/bee-phases-*`. Re-running `/bee:execute-phase N` for each incomplete phase will resume from TASKS.md checkbox state (crash recovery via checkpoints).
- Always re-read STATE.md from disk before writing updates. Another teammate's completion message may have triggered a previous write between reads.
