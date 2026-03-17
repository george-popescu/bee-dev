---
description: Add a new phase to the current spec's phases.md and STATE.md
argument-hint: "[phase name]"
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`

## Instructions

You are running `/bee:add-phase` -- the command to append a new phase to the current spec. This command interactively gathers phase details, appends to phases.md, and adds a new row to the Phases table in STATE.md. Follow these steps in order.

### Step 1: Validation Guards

Check these guards in order. Stop immediately if any fails:

1. **NOT_INITIALIZED guard:** If the dynamic context above contains "NOT_INITIALIZED" (meaning `.bee/STATE.md` does not exist), tell the user:
   "BeeDev is not initialized. Run `/bee:init` first."
   Do NOT proceed.

2. **NO_SPEC guard:** Read STATE.md from the dynamic context above. If no Current Spec Path exists or it shows "(none)", tell the user:
   "No spec found. Run `/bee:new-spec` first."
   Do NOT proceed.

### Step 2: Determine Next Phase Number

1. Read the Phases table from STATE.md.
2. Count existing phase rows. The new phase number is `existing_count + 1`. Store as `$PHASE_NUMBER`.
3. Read the current spec's `phases.md` file (at the spec path from STATE.md). Verify the phase count matches the STATE.md table. If it doesn't, use the higher of the two counts to avoid overwriting.

### Step 3: Get Phase Details

Check `$ARGUMENTS` for a phase name.

**If arguments provided** (e.g., `/bee:add-phase Infrastructure cleanup`):

Use the argument text as `$PHASE_NAME`. Then ask the user:

```
Adding Phase {$PHASE_NUMBER}: {$PHASE_NAME}

Please provide:
1. Description — what does this phase deliver?
2. Deliverables — list the concrete deliverables (one per line)
```

Wait for the user's response. Store description as `$DESCRIPTION` and deliverables as `$DELIVERABLES`.

**If no arguments provided:**

Ask the user:

```
What is the name for Phase {$PHASE_NUMBER}?
```

Wait for the user's response. Store as `$PHASE_NAME`. Then ask:

```
Adding Phase {$PHASE_NUMBER}: {$PHASE_NAME}

Please provide:
1. Description — what does this phase deliver?
2. Deliverables — list the concrete deliverables (one per line)
```

Wait for the user's response. Store description as `$DESCRIPTION` and deliverables as `$DELIVERABLES`.

### Step 4: Ask for Dependencies

Determine the default dependency: if `$PHASE_NUMBER` is 1, the default is "None". Otherwise, the default is "Phase {$PHASE_NUMBER - 1}".

Ask the user:

```
Dependencies for Phase {$PHASE_NUMBER}?
Default: {default dependency}

(Press enter to accept default, or specify different dependencies)
```

Wait for the user's response. If the user accepts the default (empty response, "yes", "default", or similar affirmative), use the default. Otherwise store the user's response as `$DEPENDENCIES`.

### Step 5: Append to phases.md

1. Read the current spec's `phases.md` file from disk (fresh read).
2. Append the new phase section at the end of the file:

```markdown

## Phase {$PHASE_NUMBER}: {$PHASE_NAME}
**Description:** {$DESCRIPTION}
**Deliverables:**
- {deliverable 1}
- {deliverable 2}
- ...
**Dependencies:** {$DEPENDENCIES}
```

3. Write the updated `phases.md` back to disk.

### Step 6: Append to STATE.md

1. Read `.bee/STATE.md` fresh from disk (not cached dynamic context).
2. Find the `## Phases` table. Append a new row at the end of the table:

```
| {$PHASE_NUMBER} | {$PHASE_NAME} | PENDING | | | | | | |
```

3. Update the **Last Action** section:

```markdown
## Last Action
- Command: /bee:add-phase
- Timestamp: {current ISO 8601 timestamp}
- Result: Phase {$PHASE_NUMBER} added: {$PHASE_NAME}
```

4. Write the updated STATE.md to disk.

### Step 7: Completion Summary

Display to the user:

```
Phase {$PHASE_NUMBER} added!

Phase: {$PHASE_NAME}
Description: {$DESCRIPTION}
Deliverables: {count} items
Dependencies: {$DEPENDENCIES}

Updated:
- {spec_path}/phases.md
- .bee/STATE.md

Next step: /bee:plan-phase {$PHASE_NUMBER} (/clear first if context is long)
```

---

**Design Notes (do not display to user):**

- This command does NOT use any agents -- it operates entirely within the main Claude context with interactive Q&A.
- Always re-read files from disk before writing updates (Read-Modify-Write pattern).
- NEVER overwrite existing phases in phases.md or STATE.md -- only append.
- The phase number is derived from counting existing phases, not from user input. This prevents numbering gaps or conflicts.
- Dependencies default to the previous phase for sequential workflows but can be overridden for parallel phase structures.
- The phases.md format must match the template exactly so that other commands (plan-phase, execute-phase) can parse it reliably.
