---
description: Create a new feature specification through interactive Q&A
argument-hint: "[--amend]"
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`
- `.bee/PROJECT.md` — if not found: skip (project index not available)

## Instructions

You are running `/bee:new-spec` -- the interactive spec creation command for BeeDev. Follow these steps in order. Never auto-decide -- always present information and ask the user for input.

### Step 1: Initialization Guard

If the dynamic context above contains "NOT_INITIALIZED" (meaning `.bee/STATE.md` does not exist), stop immediately. Tell the user:

"BeeDev is not initialized for this project. Run `/bee:init` first to set up your project."

Do NOT proceed with any further steps.

### Step 2: Check for --amend Flag

Check if `$ARGUMENTS` contains `--amend`. If it does, skip to **Step 7: Amend Flow**. Otherwise, continue with the standard new spec flow below.

### Step 3: Get Spec Name

Ask the user:

"What feature would you like to spec? Give me a brief name (e.g., 'user-management', 'order-processing')."

Wait for the user's response. This name will be used to create the spec folder.

### Step 4: Create Spec Folder Structure

Create the spec directory using the user's chosen name:

1. Get today's date: `date +%Y-%m-%d`
2. Slugify the name (lowercase, hyphens, no spaces or special characters): `echo "{name}" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-'`
3. Create the directories:
   - `.bee/specs/{YYYY-MM-DD}-{slug}/`
   - `.bee/specs/{YYYY-MM-DD}-{slug}/visuals/`

Tell the user: "Spec folder created at `.bee/specs/{folder}/`. If you have mockups or screenshots, place them in `.bee/specs/{folder}/visuals/` now before we continue."

Wait for the user to confirm they are ready to proceed (they may need time to add visuals).

### Step 5: Spawn spec-shaper Agent

Spawn the `spec-shaper` agent as a subagent (omit model parameter -- interactive requirements gathering needs full reasoning). Provide the following context:

- The spec folder path (e.g., `.bee/specs/2026-02-20-user-management/`)
- The user's feature name and any initial description they provided
- Instruction: "Scan the codebase first, then ask 4-8 targeted questions. Write requirements.md to the spec folder when complete."

The spec-shaper agent will:
1. Scan the codebase structure and existing patterns
2. Generate 4-8 targeted questions informed by the scan
3. Check `visuals/` for mockup images and analyze them
4. Write `requirements.md` to the spec folder

Relay all agent questions to the user. Provide the user's answers back to the agent. This is the interactive requirements gathering phase -- let the conversation flow naturally between the user and the spec-shaper agent.

### Step 6: Spawn spec-writer Agent

After the spec-shaper completes (requirements.md has been written), spawn the `spec-writer` agent as a subagent with `model: "sonnet"` (structured template-filling from gathered requirements). Provide the following context:

- The spec folder path
- Instruction: "Read requirements.md from the spec folder, then write spec.md and phases.md following the templates in skills/core/templates/"

The spec-writer agent will:
1. Read `requirements.md` and any visuals
2. Search the codebase for reusable code referenced in requirements
3. Write `spec.md` (descriptions only -- NO code)
4. Write `phases.md` (2-5 implementation phases)

This step is NOT interactive -- the spec-writer works from the gathered requirements without additional user input. Wait for it to complete.

After the spec-writer finishes, proceed to **Step 8: Update STATE.md**.

### Step 7: Amend Flow

This step runs only when `$ARGUMENTS` contains `--amend`.

1. Read `.bee/STATE.md` and find the current spec path from the "Current Spec" section.
2. If the Status is `NO_SPEC` or no current spec path exists, tell the user: "No active spec found. Run `/bee:new-spec` first to create one." Stop here.
3. Read the existing `requirements.md`, `spec.md`, and `phases.md` from the current spec folder.

**Spawn spec-shaper in amend mode:**
Provide the spec-shaper agent with:
- The spec folder path
- The full content of the existing `requirements.md`
- Instruction: "This is an existing spec being amended. Skip the codebase scan. Present the current requirements summary and ask the user what needs to change. Update only affected sections of requirements.md."

Relay the amendment discussion between the agent and the user.

**Spawn spec-writer in amend mode:**
After the spec-shaper finishes updating `requirements.md`, spawn the spec-writer with `model: "sonnet"`. Provide the spec-writer agent with:
- The spec folder path
- Instruction: "This is an amended spec. Read the updated requirements.md. Rewrite only sections affected by the changes in spec.md and phases.md. Preserve unchanged content exactly."

After the spec-writer finishes, proceed to **Step 8: Update STATE.md**.

### Step 8: Update STATE.md

After both agents complete successfully (in either the new or amend flow), update `.bee/STATE.md`:

1. Set **Current Spec Name** to the spec name (e.g., `user-management`)
2. Set **Current Spec Path** to the spec folder path (e.g., `.bee/specs/2026-02-20-user-management/`)
3. Set **Current Spec Status** to `SPEC_CREATED`
4. Read the newly created (or updated) `phases.md` from the spec folder
5. Populate the **Phases** table with one row per phase, all with Status `PENDING` and all other columns empty
6. Set **Last Action** to:
   - Command: `/bee:new-spec` (or `/bee:new-spec --amend` if amending)
   - Timestamp: current ISO 8601 timestamp
   - Result: "Spec created" (or "Spec amended") with the spec name

### Step 9: Completion Summary

Display the following summary to the user:

```
Spec created!

Spec: {spec-name}
Path: .bee/specs/{folder}/
Phases: {N} phases
- Phase 1: {name}
- Phase 2: {name}
...

Files:
- requirements.md (from Q&A)
- spec.md (feature specification)
- phases.md (implementation phases)

Next step:
  /clear
  /bee:plan-phase 1
```

If this was an amend, adjust the message:

```
Spec amended!

Spec: {spec-name}
Path: .bee/specs/{folder}/
Changes: {brief summary of what changed}
Phases: {N} phases (updated if affected)

Next step:
  /clear
  /bee:plan-phase N    (re-plan affected phases)
```
