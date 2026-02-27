---
description: Create a new feature specification through conversational discovery
argument-hint: "[--amend] [feature description]"
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`
- `.bee/PROJECT.md` — if not found: skip (project index not available)

## Instructions

You are running `/bee:new-spec` -- the interactive spec creation command for BeeDev. This command uses **conversational discovery** to gather requirements through structured questions with selectable options before writing the spec. Follow these steps in order.

### Step 1: Initialization Guard

If the dynamic context above contains "NOT_INITIALIZED" (meaning `.bee/STATE.md` does not exist), stop immediately. Tell the user:

"BeeDev is not initialized for this project. Run `/bee:init` first to set up your project."

Do NOT proceed with any further steps.

### Step 2: Check for --amend Flag

Check if `$ARGUMENTS` contains `--amend`. If it does, skip to **Step 10: Amend Flow**. Otherwise, continue with the standard new spec flow below.

### Step 3: Get Spec Name

Check `$ARGUMENTS` for a feature description (the text remaining after flag removal).

If a description is provided, use it as the initial description AND derive the spec name from it (slugify the first 3-4 words).

If no description is provided, ask the user:

"What feature would you like to spec? Describe it briefly (e.g., 'user management with roles and permissions')."

Wait for the user's response. Extract a short name for the spec folder and store the full description as `$INITIAL_DESCRIPTION`.

### Step 4: Create Spec Folder Structure

Create the spec directory:

1. Get today's date: `date +%Y-%m-%d`
2. Slugify the name (lowercase, hyphens, no spaces or special characters): `echo "{name}" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-'`
3. Create the directories:
   - `.bee/specs/{YYYY-MM-DD}-{slug}/`
   - `.bee/specs/{YYYY-MM-DD}-{slug}/visuals/`

Tell the user: "Spec folder created at `.bee/specs/{folder}/`. If you have mockups or screenshots, place them in `.bee/specs/{folder}/visuals/` now before we continue."

Wait for the user to confirm they are ready to proceed (they may need time to add visuals).

### Step 5: Research Codebase

Spawn the `researcher` agent via Task tool with `model: "sonnet"` (structured codebase scanning). Provide this context:

```
Task(
  subagent_type="bee:researcher",
  model="sonnet",
  description="Research: {spec name}",
  prompt="
    SPEC RESEARCH MODE -- No TASKS.md, no phase context.

    Research the codebase to inform a new feature spec: {$INITIAL_DESCRIPTION}

    Project stack: {stack from config.json}

    Find and report:
    1. Project structure: key directories, entry points, routing
    2. Existing patterns: how similar features are built (controllers, components, services, models)
    3. Reusable code: components, composables, utilities, layouts that could be leveraged
    4. Data patterns: how models/schemas/migrations are structured
    5. UI patterns: component library, design system, page layouts in use
    6. Testing patterns: how tests are organized, what frameworks are used

    For each finding, include the EXACT file path and a brief description of what it does.

    Return your findings as a structured summary -- do NOT write to any files.
  "
)
```

Store the researcher's output as `$RESEARCH`. Display a brief summary to the user:

```
Codebase scanned. Found:
- {N} existing patterns/components
- {M} reusable code opportunities
- Stack: {stack}

Starting discovery conversation...
```

### Step 6: Discovery Conversation

This is the core of the command. Use `AskUserQuestion` to run a multi-round conversational discovery loop directly in main context. The questions are informed by `$RESEARCH` findings and adapt based on previous answers.

Store all questions and answers in `$DISCOVERY_LOG` (accumulate across rounds).

#### Round 1: Feature Shape

Use AskUserQuestion to ask 2-4 questions about the high-level feature shape. Each question MUST have 2-4 options. Reference specific codebase findings from `$RESEARCH` when relevant.

**Mandatory questions for Round 1:**

1. **Feature type** — What kind of feature is this?
   - Options should be derived from the description and research (e.g., CRUD management, dashboard/reporting, integration/API, workflow/process, UI component)

2. **Pattern to follow** — Reference a specific finding from `$RESEARCH`:
   - "I found {pattern/component} at {file path}. Should we follow this pattern?"
   - Options: "Yes, follow this pattern (Recommended)" / "Use a different approach" / "This is unique, design from scratch"

3. **Scope/Access** — Who uses this feature?
   - Options derived from what auth/role patterns exist in the codebase

**Optional Round 1 questions (pick 0-1 based on relevance):**

4. **Data model** — If the feature involves data, ask about the model approach
   - Reference existing models found in research

#### Round 2: Behavior Details

Based on Round 1 answers, use AskUserQuestion to ask 2-3 more specific questions:

- **UI approach** — If a UI is involved, reference existing pages/components from research
- **Edge cases** — "What happens when {edge case}?" with common options
- **Integration points** — If the feature touches existing systems, ask how
- **Data relationships** — If entities are involved, ask about relationships to existing models

Adapt questions to what's relevant based on Round 1 answers. Skip questions that are already answered or not applicable.

#### Round 3+: Convergence

After Round 2, present a structured summary of your understanding:

```
Here's what I understand so far:

Feature: {name}
Type: {type from Round 1}
Pattern: {pattern choice}
Access: {who}
Key behaviors:
- {behavior 1 from answers}
- {behavior 2}
- {behavior 3}
Reusable code: {components/patterns to leverage}
```

Then use AskUserQuestion with a single convergence question:

```
question: "Is this understanding complete? Ready to write the spec?"
header: "Status"
options:
  - "Yes, write the spec (Recommended)" — Proceed to requirements
  - "I need to add more details" — Ask what's missing, then another round
  - "Something needs to change" — Ask what to change, then update understanding
```

**If "add more":** Ask the user what's missing (free text), then ask 1-3 targeted follow-up questions with AskUserQuestion based on their response. Return to convergence check.

**If "change":** Ask what needs changing (free text), update understanding, return to convergence check.

**If "yes":** Proceed to Step 7.

**Maximum 5 rounds total** (including Round 1 and 2). If 5 rounds reached without convergence, present current understanding and proceed anyway with a note: "Proceeding with current understanding. Use `/bee:new-spec --amend` later to refine."

### Step 7: Visual Analysis

Check the spec's `visuals/` directory for image files using Bash (`ls`).

- If images are found, use the Read tool to analyze each image (Claude is multimodal)
- Note layout structure, UI components, interactions, navigation
- Add visual analysis findings to `$DISCOVERY_LOG`
- MANDATORY: Always check `visuals/` regardless of earlier discussion -- users sometimes add files without mentioning them

If no visuals found, note "No visual assets provided" and continue.

### Step 8: Write requirements.md

Read the template at `skills/core/templates/requirements.md` to understand the expected structure.

Write `requirements.md` to the spec folder using the Write tool. Populate it with ALL data gathered:

- **Initial Description:** `$INITIAL_DESCRIPTION`
- **Requirements Discussion:**
  - Questions & Answers: ALL rounds from `$DISCOVERY_LOG`, numbered sequentially (Q1, A1, Q2, A2, ...)
  - Existing Code to Reference: Components, patterns, files from `$RESEARCH` with exact file paths
  - Follow-up Questions: Any rounds beyond Round 2
- **Visual Assets:** Analysis from Step 7 (or "No visual assets provided")
- **Requirements Summary:**
  - Functional Requirements: Concrete, testable requirements derived from the discovery conversation
  - Non-Functional Requirements: Performance, security, accessibility if discussed
  - Reusability Opportunities: Existing code to leverage with file paths
  - Scope Boundaries: In scope vs. out of scope
  - Technical Considerations: Integration points, constraints, dependencies

Display to user: "Requirements written to `{spec_folder}/requirements.md`"

### Step 9: Spawn spec-writer Agent

Spawn the `spec-writer` agent as a subagent with `model: "sonnet"` (structured template-filling from gathered requirements). Provide the following context:

- The spec folder path
- Instruction: "Read requirements.md from the spec folder, then write spec.md and phases.md following the templates in skills/core/templates/"

The spec-writer agent will:
1. Read `requirements.md` and any visuals
2. Search the codebase for reusable code referenced in requirements
3. Write `spec.md` (descriptions only -- NO code)
4. Write `phases.md` (2-5 implementation phases)

This step is NOT interactive -- the spec-writer works from the gathered requirements without additional user input. Wait for it to complete.

After the spec-writer finishes, proceed to **Step 11: Update STATE.md**.

### Step 10: Amend Flow

This step runs only when `$ARGUMENTS` contains `--amend`.

1. Read `.bee/STATE.md` and find the current spec path from the "Current Spec" section.
2. If the Status is `NO_SPEC` or no current spec path exists, tell the user: "No active spec found. Run `/bee:new-spec` first to create one." Stop here.
3. Read the existing `requirements.md`, `spec.md`, and `phases.md` from the current spec folder.

**Spawn spec-shaper in amend mode:**
Provide the spec-shaper agent with (omit model parameter -- amend mode needs full reasoning for nuanced changes):
- The spec folder path
- The full content of the existing `requirements.md`
- Instruction: "This is an existing spec being amended. Skip the codebase scan. Present the current requirements summary and ask the user what needs to change. Update only affected sections of requirements.md."

Relay the amendment discussion between the agent and the user.

**Spawn spec-writer in amend mode:**
After the spec-shaper finishes updating `requirements.md`, spawn the spec-writer with `model: "sonnet"`. Provide the spec-writer agent with:
- The spec folder path
- Instruction: "This is an amended spec. Read the updated requirements.md. Rewrite only sections affected by the changes in spec.md and phases.md. Preserve unchanged content exactly."

After the spec-writer finishes, proceed to **Step 11: Update STATE.md**.

### Step 11: Update STATE.md

After all steps complete successfully (in either the new or amend flow), update `.bee/STATE.md`:

1. Set **Current Spec Name** to the spec name (e.g., `user-management`)
2. Set **Current Spec Path** to the spec folder path (e.g., `.bee/specs/2026-02-20-user-management/`)
3. Set **Current Spec Status** to `SPEC_CREATED`
4. Read the newly created (or updated) `phases.md` from the spec folder
5. Populate the **Phases** table with one row per phase, all with Status `PENDING` and all other columns empty
6. Set **Last Action** to:
   - Command: `/bee:new-spec` (or `/bee:new-spec --amend` if amending)
   - Timestamp: current ISO 8601 timestamp
   - Result: "Spec created" (or "Spec amended") with the spec name

### Step 12: Completion Summary

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
- requirements.md (from discovery conversation)
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

---

**Design Notes (do not display to user):**

- The discovery conversation runs IN MAIN CONTEXT (not delegated to a subagent). This is the architectural reason: AskUserQuestion only works in main context, enabling structured options the user can click.
- The researcher agent (sonnet) does the codebase scan. Its findings inform the discovery questions. This replaces the spec-shaper's codebase scan for new specs.
- The spec-shaper agent is ONLY used for `--amend` mode. For new specs, the command itself handles discovery. Amend mode is different (review existing → ask what changed) and the agent relay pattern works fine there.
- AskUserQuestion questions MUST reference specific codebase findings (file paths, component names) when relevant. Generic questions without codebase context are lazy and unhelpful.
- The convergence check prevents both premature spec writing (too few rounds) and interview fatigue (too many). 2-5 rounds is the sweet spot.
- requirements.md is written by the command directly (it has all the Q&A data). No need to relay to an agent.
- The requirements.md template and spec-writer agent are unchanged -- the output format is the same, only the gathering method changed.
- `$ARGUMENTS` can now contain a feature description directly (e.g., `/bee:new-spec user management with roles`) which skips the "what feature?" prompt and goes straight to folder creation.
