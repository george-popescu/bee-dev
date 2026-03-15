---
description: Create a new feature specification through conversational discovery
argument-hint: "[--amend] [--from-discussion PATH] [feature description]"
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

### Step 2: Check for --amend and --from-discussion Flags

First, check if `$ARGUMENTS` contains `--from-discussion {path}`. If it does:
1. Extract the path immediately following `--from-discussion` and store it as `$DISCUSSION_PATH`
2. Set `$USE_DISCUSSION = true`
3. Strip `--from-discussion {path}` (both the flag and its path argument) from `$ARGUMENTS` so that Step 3 derives the spec name from the remaining text only

Then, check the (potentially stripped) `$ARGUMENTS` for `--amend`. If it contains `--amend`, skip to **Step 10: Amend Flow**. Otherwise, continue with the standard new spec flow below.

### Step 2.5: Load Discussion Notes

When `$USE_DISCUSSION` is true, read the discussion notes file at `$DISCUSSION_PATH` using the Read tool. Store its content as `$DISCUSSION_NOTES`.

If the file is not found or does not exist, stop immediately with a clear message:

"Discussion notes file not found at {$DISCUSSION_PATH}. Check the path and try again."

Do NOT proceed with any further steps if the file cannot be read.

If `$USE_DISCUSSION` is not set, skip this step entirely.

### Step 3: Get Spec Name

Check `$ARGUMENTS` for a feature description (the text remaining after flag removal).

If a description is provided, use it as the initial description AND derive the spec name from it (slugify the first 3-4 words).

If no description is provided, ask the user:

"What feature would you like to spec? Describe it briefly (e.g., 'user management with roles and permissions')."

Wait for the user's response. Extract a short name for the spec folder and store the full description as `$INITIAL_DESCRIPTION`.

### Step 3.5: Archive Previous Spec Memory

If STATE.md shows an existing spec (Status is NOT `NO_SPEC`), archive the memory from the previous spec before starting fresh:

1. Get the previous spec name from STATE.md (Current Spec Name field)
2. Run: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/archive-memory.sh "{previous-spec-name}"`

This archives agent memory to `.bee/memory-archive/{spec-name}/`, keeps only project-level shared entries (patterns, conventions, preferences), and clears agent-specific memory so agents start clean for the new spec.

If there is no previous spec (Status is `NO_SPEC`), skip this step.

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

Read `config.implementation_mode` from config.json (defaults to `"quality"` if absent).

**Premium mode** (`implementation_mode: "premium"`): Omit the model parameter (inherit parent model) -- premium uses the strongest model for all work.

**Economy or Quality mode** (default): Pass `model: "sonnet"` -- scanning/planning work is structured and does not require deep reasoning.

Spawn the `researcher` agent via Task tool with the model determined above. Provide this context:

```
Task(
  subagent_type="bee:researcher",
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

When `$USE_DISCUSSION` is true, add the following line to the researcher's prompt (inside the context packet, after the stack line):

```
Discussion notes are available as a starting point -- use them to inform your research focus: {$DISCUSSION_NOTES}
```

Store the researcher's output as `$RESEARCH`. Display a brief summary to the user:

```
Codebase scanned. Found:
- {N} existing patterns/components
- {M} reusable code opportunities
- Stack: {stack}

Starting discovery conversation...
```

### Step 6: Discovery Conversation (Brainstorming-Style)

This is the core of the command. Use `AskUserQuestion` to run an adaptive conversational discovery loop directly in main context. The questions are informed by `$RESEARCH` findings and adapt based on previous answers.

Store all questions and answers in `$DISCOVERY_LOG` (accumulate across rounds).

**Core principles (from brainstorming methodology):**
- **One question per message** — never batch multiple questions. Each AskUserQuestion call contains exactly ONE question.
- **Multiple choice preferred** — present 2-4 clickable options when possible. Open-ended is fine when options don't make sense.
- **No fixed round limit** — ask until you truly understand the feature. Don't rush to convergence.
- **Reference codebase** — every question MUST reference specific findings from `$RESEARCH` when relevant (file paths, component names, patterns).
- **YAGNI** — actively identify and remove unnecessary complexity. If the user describes something beyond what's needed, ask: "Do we really need X, or would Y be simpler?"

#### Phase 1: Load Discussion Context (if applicable)

**When `$USE_DISCUSSION` is true:** Before asking any questions, present a summary of the discussion notes to the user:

"I found discussion notes for this topic. Here's what was already explored:"

Then display the `## Discussion Summary` and `## Notes for Spec Creation` sections from `$DISCUSSION_NOTES`.

Use AskUserQuestion to ask: "Should we start from these conclusions?" with 3 options:
- "Yes, use these as our starting point (Recommended)" -- Skip questions already answered in discussion notes; proceed by asking only clarifying or gap-filling questions
- "Review and adjust first" -- Present the conclusions one by one and let the user modify each
- "Start fresh (ignore discussion notes)" -- Proceed with Phase 2 as if `$USE_DISCUSSION` were false

#### Phase 2: Decomposition Check

Before diving into details, assess the scope. If `$INITIAL_DESCRIPTION` describes multiple independent subsystems or unrelated concerns, flag this immediately:

"This sounds like it covers {N} independent pieces:
1. {subsystem A}
2. {subsystem B}
3. {subsystem C}

Should we spec the first one and handle the rest as separate specs later? Or tackle all together?"

Use AskUserQuestion with options:
- "{subsystem A} first (Recommended — smaller, focused spec)"
- "All together (larger spec, more phases)"
- "Let me clarify the scope"

If the user chooses to focus on one, narrow `$INITIAL_DESCRIPTION` accordingly and note the others for future specs.

If the description is focused (single concern), skip this and proceed directly to Phase 3.

#### Phase 3: Understanding

Ask questions ONE AT A TIME to understand the feature. Each question is its own AskUserQuestion call with 2-4 options when possible.

**Start with the most important unknowns.** Adapt the order based on what matters most for this feature. Typical progression:

1. **Feature type** — What kind of feature is this?
   - Options derived from description + research (e.g., CRUD management, dashboard/reporting, integration/API, workflow/process)

2. **Pattern to follow** — Reference a specific finding from `$RESEARCH`:
   - "I found {pattern/component} at {file path}. Should we follow this pattern?"
   - Options: "Yes, follow this pattern (Recommended)" / "Use a different approach" / "This is unique, design from scratch"

3. **Scope/Access** — Who uses this feature?
   - Options derived from auth/role patterns found in codebase

4. **Data model** (if relevant) — What data is involved?
   - Reference existing models found in research

5. Continue with behavior questions as needed:
   - UI approach (reference existing pages/components from research)
   - Edge cases ("What happens when {X}?" with common options)
   - Integration points (how does it touch existing systems)
   - Data relationships (relationships to existing models)

**Self-check every 3 questions:** After every 3 questions answered, pause and assess: "Do I understand this feature well enough to propose approaches?" If yes, move to Phase 4. If no, continue asking.

Skip questions that are already answered by discussion notes (when `$USE_DISCUSSION` is true).

#### Phase 4: Approaches

Present 2-3 approaches with trade-offs from the research findings. Lead with your recommendation:

```
Based on what we've discussed and the codebase patterns, here are the approaches I see:

**A. {approach name} (Recommended)**
{description} — follows {existing pattern at file path}
Pros: {benefits}
Cons: {drawbacks}

**B. {approach name}**
{description}
Pros: {benefits}
Cons: {drawbacks}

**C. {approach name}** (optional, only if a third viable option exists)
{description}
Pros: {benefits}
Cons: {drawbacks}
```

Use AskUserQuestion: "Which approach do you prefer? You can also combine elements."

After the user picks, ask 1-2 follow-up questions (one per message) to clarify approach-specific details.

#### Phase 5: Implementation Mode

Use AskUserQuestion to ask about implementation mode. Store the user's choice as `$IMPLEMENTATION_MODE`.

```
question: "How should this feature be implemented?"
header: "Implementation Mode"
options:
  - "Quality mode (default) -- opus for implementation and review, sonnet for scanning" → $IMPLEMENTATION_MODE = "quality"
  - "Economy mode -- sonnet for everything (faster, lower cost)" → $IMPLEMENTATION_MODE = "economy"
  - "Premium mode -- opus for everything (maximum quality)" → $IMPLEMENTATION_MODE = "premium"
```

#### Phase 6: Convergence

When you believe you understand the feature well enough, present a structured summary:

```
Here's what I understand:

Feature: {name}
Type: {type}
Approach: {chosen approach with key details}
Access: {who uses it}
Key behaviors:
- {behavior 1}
- {behavior 2}
- {behavior 3}
Reusable code: {components/patterns to leverage with file paths}
Implementation mode: {quality | economy | premium}
```

Then use AskUserQuestion with a convergence check:

```
question: "Is this understanding complete? Ready to write the spec?"
header: "Status"
options:
  - "Yes, write the spec (Recommended)" — Proceed to Step 7
  - "I need to add more details" — Continue exploring
  - "Something needs to change" — Revisit a decision
```

**If "add more":** Ask what's missing (one question). Then ask targeted follow-up questions (one at a time) until they're satisfied. Return to convergence check.

**If "change":** Ask what needs changing (one question). Update understanding. Return to convergence check.

**If "yes":** Proceed to Step 7.

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
- **Implementation Mode:** `$IMPLEMENTATION_MODE` (quality, economy, or premium)
- **Requirements Summary:**
  - Functional Requirements: Concrete, testable requirements derived from the discovery conversation
  - Non-Functional Requirements: Performance, security, accessibility if discussed
  - Reusability Opportunities: Existing code to leverage with file paths
  - Scope Boundaries: In scope vs. out of scope
  - Technical Considerations: Integration points, constraints, dependencies

Display to user: "Requirements written to `{spec_folder}/requirements.md`"

### Step 9: Spawn spec-writer Agent

Read `config.implementation_mode` from config.json (defaults to `"quality"` if absent).

**Premium mode** (`implementation_mode: "premium"`): Omit the model parameter (inherit parent model) -- premium uses the strongest model for all work.

**Economy or Quality mode** (default): Pass `model: "sonnet"` -- scanning/planning work is structured and does not require deep reasoning.

Spawn the `spec-writer` agent as a subagent with the model determined above. Provide the following context:

- The spec folder path
- Instruction: "Read requirements.md from the spec folder, then write spec.md and phases.md following the templates in skills/core/templates/"

The spec-writer agent will:
1. Read `requirements.md` and any visuals
2. Search the codebase for reusable code referenced in requirements
3. Write `spec.md` (descriptions only -- NO code)
4. Write `phases.md` (2-5 implementation phases)

This step is NOT interactive -- the spec-writer works from the gathered requirements without additional user input. Wait for it to complete.

After the spec-writer finishes, proceed to **Step 9.5: Spec Review Loop**.

### Step 9.5: Spec Review Loop

After the spec-writer completes, validate the generated spec for completeness and quality before presenting it to the user.

#### 9.5.1: Spawn spec-reviewer

Read `config.implementation_mode` from config.json (defaults to `"quality"` if absent).

**Premium mode** (`implementation_mode: "premium"`): Omit the model parameter (inherit parent model) -- premium uses the strongest model for all work.

**Economy or Quality mode** (default): Pass `model: "sonnet"` -- scanning/planning work is structured and does not require deep reasoning.

Spawn the `spec-reviewer` agent via Task tool with the model determined above. Provide the following context:

```
Task(
  subagent_type="bee:spec-reviewer",
  description="Review spec: {spec name}",
  prompt="
    Review this spec for completeness, consistency, and clarity.

    Spec file: {spec_folder}/spec.md
    Requirements file: {spec_folder}/requirements.md

    Read both files completely, then check for: completeness (TODOs, placeholders, incomplete sections), coverage (missing edge cases, error handling), consistency (contradictions), clarity (ambiguous requirements), YAGNI (unrequested features), scope (focused for phased planning), architecture (clear unit boundaries).
  "
)
```

#### 9.5.2: Handle review result

Parse the reviewer's output for the `## Spec Review` section:

**If Status is "Approved":**
- Display: "Spec review: approved"
- Proceed to Step 9.7 (Write Implementation Mode to Config)

**If Status is "Issues Found":**
- Read the issues list from the reviewer's output
- Fix each issue directly in `spec.md` (and `phases.md` if affected) using Edit tool
- After fixing, re-spawn the spec-reviewer with the same context (fresh read of the updated files)
- Repeat until Status is "Approved"

#### 9.5.3: Iteration limit

Track the review iteration count. If 5 iterations are reached without approval, stop the loop and present the remaining issues to the user:

"Spec review found persistent issues after 5 iterations:
{remaining issues}

You can fix these manually in `{spec_folder}/spec.md` and run `/bee:new-spec --amend` later."

Proceed to Step 9.7 regardless (don't block the workflow).

Display spec review summary: "Spec review: {approved | X issues fixed in Y iterations | issues surfaced after 5 iterations}"

### Step 9.7: Write Implementation Mode to Config (was Step 9.5)

This step runs only for the new spec flow. Skip this step entirely if running the amend flow (Step 10).

Write the user's implementation mode choice to `.bee/config.json` using a Read-Modify-Write pattern:

1. Read the current `.bee/config.json` using the Read tool
2. Parse the JSON content
3. Set (or update) the `implementation_mode` field to the value of `$IMPLEMENTATION_MODE` (`"quality"`, `"economy"`, or `"premium"`)
4. Write the updated JSON back to `.bee/config.json` using the Write tool, preserving all other existing fields

After writing, proceed to **Step 11: Update STATE.md**.

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
5. Populate the **Phases** table with one row per phase, all with Status `PENDING` and all other columns (Plan, Plan Review, Executed, Reviewed, Tested, Committed) empty
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

- The discovery conversation runs IN MAIN CONTEXT (not delegated to a subagent). AskUserQuestion only works in main context, enabling structured options the user can click.
- The brainstorming-style adaptive flow replaces the old fixed 2-5 round structure. Key principles ported from the superpowers brainstorming skill: one question per message, multiple choice preferred, no fixed round limit, decomposition check for multi-subsystem features, 2-3 approaches with trade-offs and recommendation, YAGNI principle.
- The self-check every 3 questions prevents both premature convergence and interview fatigue without imposing a hard limit.
- The decomposition check (Phase 2) catches multi-subsystem features early, preventing oversized specs that should be separate specs with their own lifecycle.
- The approaches phase (Phase 4) uses research findings to present concrete options with codebase-informed trade-offs and a recommendation, not generic alternatives.
- The spec review loop (Step 9.5) dispatches a spec-reviewer agent after spec-writer completes. This catches completeness, consistency, clarity, YAGNI, and scope issues before the user sees the spec. Issues are auto-fixed and re-reviewed (max 5 iterations). This pattern is adapted from the superpowers brainstorming skill's spec-document-reviewer loop.
- The researcher agent (sonnet) does the codebase scan. Its findings inform the discovery questions.
- The spec-shaper agent is ONLY used for `--amend` mode. For new specs, the command itself handles discovery.
- requirements.md is written by the command directly (it has all the Q&A data).
- `$ARGUMENTS` can now contain a feature description directly (e.g., `/bee:new-spec user management with roles`).
