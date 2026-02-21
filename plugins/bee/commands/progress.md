---
name: progress
description: Show current BeeDev project state and suggest next action
argument-hint: ""
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`

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

**3. Last Action:**

Show the Last Action section from STATE.md (command, timestamp, result).

### Suggest Next Command

Based on the current state, suggest exactly one next command. Use this logic:

| Current State | Suggested Command |
|--------------|-------------------|
| Status is `NO_SPEC` (no spec exists) | `/bee:new-spec` -- "Start by defining what you want to build." |
| Spec exists but no phases are planned | `/bee:plan-phase 1` -- "Your spec is ready. Plan the first phase." |
| A phase is planned but not yet executed | `/bee:execute-phase N` -- "Phase N is planned and ready to execute." |
| A phase is executed but not reviewed | `/bee:review` -- "Phase N is implemented. Time to review." |
| A phase is reviewed but not tested | `/bee:test` -- "Review is done. Generate test scenarios." |
| A phase is tested but not committed | `/bee:commit` -- "Tests pass. Ready to commit this phase." |
| All phases are complete | `/bee:review-project` -- "All phases complete. Run a final project review." |

Present the suggestion clearly:

```
Next step: /bee:{command}
{brief explanation of why this is the next step}
```

### Output Format

Keep the output concise. The entire response should fit in one screen -- no scrolling needed. Developers check progress frequently; respect their time.
