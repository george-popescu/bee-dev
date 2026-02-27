---
description: Review entire implementation against original spec
argument-hint: ""
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`

## Instructions

You are running `/bee:review-project` -- the full project compliance review for BeeDev. This command spawns the project-reviewer agent to check all phase implementations against the original spec and produce a comprehensive REVIEW-PROJECT.md report. Follow these steps in order.

### Step 1: Validation Guards

Check these guards in order. Stop immediately if any fails:

1. **NOT_INITIALIZED guard:** If the dynamic context above contains "NOT_INITIALIZED" (meaning `.bee/STATE.md` does not exist), tell the user:
   "BeeDev is not initialized. Run `/bee:init` first."
   Do NOT proceed.

2. **NO_SPEC guard:** Read STATE.md from the dynamic context above. If no Current Spec Path exists or it shows "(none)", tell the user:
   "No spec found. Run `/bee:new-spec` first."
   Do NOT proceed.

### Step 2: Load Spec Context

From STATE.md in the dynamic context above, extract:
- Current spec path
- All phase directories and their statuses (from the Phases table)

Read `spec.md` from the spec path to confirm it exists. If it does not exist, tell the user:
"Spec file not found at {spec-path}/spec.md. STATE.md may be stale."
Do NOT proceed.

Collect all phase directory paths that have been executed (status EXECUTED or beyond: REVIEWED, TESTED, COMMITTED). These are the phases with actual implementation to review.

If no phases have been executed, tell the user:
"No phases have been executed yet. Run `/bee:execute-phase 1` first."
Do NOT proceed.

Determine the output path: `{spec-path}/REVIEW-PROJECT.md`

Display to user: "Starting full project review against spec..."

### Step 3: Spawn Project-Reviewer Agent

Use the Task tool to spawn the `project-reviewer` agent with `model: "sonnet"` (spec compliance cross-referencing). Provide context:
- "Full project review mode. Read the spec at {spec-path}/spec.md. Check all phase implementations against spec requirements. Write your compliance report to {spec-path}/REVIEW-PROJECT.md."
- Include: spec.md path, all executed phase directory paths (so the agent can read TASKS.md and implementation files), output file path.

Wait for the agent to complete.

After the agent completes, read `{spec-path}/REVIEW-PROJECT.md` using the Read tool. Verify the file was created. If REVIEW-PROJECT.md does not exist, tell the user:
"Project-reviewer did not produce REVIEW-PROJECT.md. Review failed."
Do NOT proceed.

### Step 4: Present Compliance Report

Read the REVIEW-PROJECT.md file and present the user a condensed summary:

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
...

Recommendations:
- {recommendation 1}
- {recommendation 2}
...

Full report: {spec-path}/REVIEW-PROJECT.md
```

If overall compliance is 100%: congratulate the user and note the project fully meets the spec.

If gaps exist: suggest creating additional phases to address them. For example:
"Consider running `/bee:plan-phase {N+1}` to address the {gap_count} remaining gaps."

Update `.bee/STATE.md` Last Action:
- Command: `/bee:review-project`
- Timestamp: current ISO 8601 timestamp
- Result: "Project review: {overall_percentage}% spec compliance"

---

**Design Notes (do not display to user):**

- This is the SIMPLEST orchestrator in the plugin -- single agent spawn, no loop, no parallel agents.
- The project-reviewer agent handles all the heavy lifting (reading spec, reading implementations, producing the report). The command is a thin orchestrator.
- REVIEW-PROJECT.md is written to the spec directory (not a phase directory) because it spans all phases.
- The project-reviewer agent is the SAME agent used by `/bee:eod` in EOD mode. Here it runs in "full project review mode" which writes a file instead of returning a message summary.
- Always re-read STATE.md from disk before writing updates (Read-Modify-Write pattern).
