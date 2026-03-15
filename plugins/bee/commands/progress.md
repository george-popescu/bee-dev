---
description: Show current BeeDev project state and suggest next action
argument-hint: ""
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`
- If a spec path exists in STATE.md (Current Spec > Path is not "(none)"), also read `{spec path}/requirements.md` — if not found or file does not exist, note: no requirements file

## Instructions

You are running `/bee:progress` -- a quick status check for the current BeeDev project. Read the injected state above and present a clear, actionable summary.

### Not Initialized

If the state above contains `NOT_INITIALIZED`, respond:

"BeeDev is not initialized for this project. Run `/bee:init` to get started."

Stop here -- do not proceed with the rest of the instructions.

### Display Project Status

Read STATE.md and config.json from the injected context above. Present the following:

**1. Project Overview (one line):**
```
Stack: {stack from config.json} | Spec: {spec name or "(none)"} | Status: {spec status}
```

**2. Phase Progress Table:**

Re-render the Phases table from STATE.md with status indicators for scannability:
- Use a checkmark for completed columns (Plan, Executed, Reviewed, Tested, Committed)
- Use a dash for incomplete columns
- Use an arrow or indicator for the currently active phase

If the Phases table is empty, note: "No phases planned yet."

**2.5. Requirements Coverage:**

If requirements.md was loaded from the spec path, count all `- [ ]` (unchecked) and `- [x]` (checked) checkbox items. Compute coverage as:
- Total = count of `- [ ]` + count of `- [x]`
- Covered = count of `- [x]`
- Percentage = (Covered / Total) * 100, rounded to nearest integer

Display:
```
Requirements: {covered}/{total} covered ({percentage}%)
```

If no requirements.md exists, the spec path is "(none)", or the file contains no checkboxes (total = 0):
```
Requirements: No requirements tracking
```

**3. Quick Tasks (if any):**

If STATE.md has a Quick Tasks section with entries, show a summary line:
```
Quick tasks: {count} completed
```

If there are uncommitted changes in the working directory (run `git diff --stat` via Bash), add:
```
Uncommitted changes detected. Run /bee:review-implementation for a code review.
```

**4. Lifecycle Status and Last Action:**

Display the spec lifecycle state with contextual messaging. The status field from STATE.md maps to these lifecycle states:

| Status | Message |
|--------|---------|
| NO_SPEC | "No active spec. Start a new feature with /bee:new-spec." |
| SPEC_CREATED | "Spec created. Plan the first phase to begin implementation." |
| IN_PROGRESS | "Implementation in progress." (show current phase info) |
| COMPLETED | "All phases complete. Archive the spec or start a new one." |
| ARCHIVED | "Spec archived. Start a new feature with /bee:new-spec." |

Then show the Last Action section from STATE.md (command, timestamp, result).

### Suggest Next Command

Based on the current state, suggest exactly one next command. Use this logic:

| Current State | Suggested Command |
|--------------|-------------------|
| No spec but uncommitted changes exist | `/bee:review-implementation` -- "Uncommitted changes found. Review them before committing." |
| Status is `NO_SPEC` (no spec exists, no uncommitted changes) | `/bee:new-spec` -- "Start by defining what you want to build." |
| Status is `SPEC_CREATED` (spec exists but no phases planned) | `/bee:plan-phase 1` -- "Your spec is ready. Plan the first phase." |
| Status is `IN_PROGRESS`, a phase is planned but not yet executed | `/bee:execute-phase N` -- "Phase N is planned and ready to execute." |
| Status is `IN_PROGRESS`, a phase is executed but not reviewed | `/bee:review` -- "Phase N is implemented. Time to review." |
| Status is `IN_PROGRESS`, a phase is reviewed but not tested | `/bee:test` -- "Review is done. Generate test scenarios." |
| Status is `IN_PROGRESS`, a phase is tested but not committed | `/bee:commit` -- "Tests pass. Ready to commit this phase." |
| Status is `COMPLETED` (all phases committed + reviewed) | `/bee:archive-spec` -- "All phases complete. Archive the spec or start a new feature." |
| Status is `ARCHIVED` | `/bee:new-spec` -- "Spec archived. Start a new feature." |

Present the suggestion clearly:

```
Next step: /bee:{command}
{brief explanation of why this is the next step}
```

### Output Format

Keep the output concise. The entire response should fit in one screen -- no scrolling needed. Developers check progress frequently; respect their time.
