---
description: Launch a guided codebase-grounded discussion to clarify requirements before creating a spec
argument-hint: "[topic description]"
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`

## Instructions

You are running `/bee:discuss` -- a command that facilitates a guided conversation about a feature or topic, gathering codebase context and structured insights before committing to a formal spec. This command does not commit any changes. It only writes discussion notes to `.bee/discussions/` and updates STATE.md. Follow these steps in order.

### Step 1: Initialization Guard

If the dynamic context above contains "NOT_INITIALIZED" (meaning `.bee/STATE.md` does not exist), stop immediately. Tell the user:

"BeeDev is not initialized for this project. Run `/bee:init` first to set up your project."

Do NOT proceed with any further steps.

### Step 2: Get Topic

Check `$ARGUMENTS` for a topic description.

If a topic description is provided, use it as the discussion topic. Store it as `$TOPIC`.

If no arguments are provided, use AskUserQuestion to ask the user:

"What would you like to discuss? Describe the topic or feature you want to explore (e.g., 'adding real-time notifications' or 'refactoring the auth module')."

Wait for the user's response. Store their answer as `$TOPIC`.

Derive a slug from the topic for later use: slugify the first 3-4 words (lowercase, hyphens, no spaces or special characters).

### Step 3: Spawn Discuss-Partner Scan Mode

Read `config.implementation_mode` from config.json (defaults to `"quality"` if absent).

**Premium mode** (`implementation_mode: "premium"`): Omit the model parameter (inherit parent model) -- premium uses the strongest model for all work.

**Economy or Quality mode** (default): Pass `model: "sonnet"` -- scanning/planning work is structured and does not require deep reasoning.

Spawn the `discuss-partner` agent via the Task tool with the model determined above. Provide the following context:

```
Task(
  subagent_type="bee:discuss-partner",
  description="Scan: {$TOPIC}",
  prompt="
    $MODE = \"scan\"

    Discussion topic: {$TOPIC}

    Project stack: {stack from config.json}

    Scan the codebase for context relevant to this discussion topic.
    Output your findings with ## Relevant Files, ## Existing Patterns,
    and ## Suggested Approaches sections.
  "
)
```

When the agent completes, store its output as `$SCAN_RESULT`. Display the scan results summary to the user:

```
Codebase scanned for discussion context.

Relevant files found: {from ## Relevant Files section}
Existing patterns identified: {from ## Existing Patterns section}
Suggested approaches: {from ## Suggested Approaches section}

Starting guided discussion...
```

Present the key findings so the user has codebase context before the conversation begins.

### Step 4: Adaptive Discussion (Brainstorming-Style)

Run an adaptive, open-ended discussion directly in main context using AskUserQuestion. The discussion is informed by `$SCAN_RESULT` from the codebase scan. Accumulate all questions and answers in `$DISCUSSION_LOG`.

**Core principles (from brainstorming methodology):**
- **One question per message** — never batch multiple questions. If a topic needs more exploration, break it into multiple questions.
- **Multiple choice preferred** — when possible, present 2-4 options the user can click. Open-ended is fine when options don't make sense.
- **No fixed round limit** — ask until you truly understand. Don't rush to convergence.
- **Reference codebase** — every question should reference specific findings from `$SCAN_RESULT` when relevant (file paths, component names, patterns).

#### Phase 1: Decomposition Check

Before diving into details, assess the scope of the topic. If it describes multiple independent subsystems or unrelated concerns, flag this immediately:

"This sounds like it covers {N} independent pieces:
1. {subsystem A}
2. {subsystem B}
3. {subsystem C}

Should we focus on one of these first, or explore all of them together?"

If the user chooses to focus on one, narrow `$TOPIC` accordingly and note the others for later.

If the topic is focused (single concern), skip this and proceed directly to Phase 2.

#### Phase 2: Understanding

Ask questions ONE AT A TIME to understand the problem space. Each question is its own AskUserQuestion call.

Start with the most important unknown. Use multiple choice options when possible, with your recommended option marked.

Example progression (adapt based on context):
1. "What problem does this solve?" — with options derived from topic + scan context
2. "Who is affected by this?" — with options from auth/role patterns in codebase
3. "What triggers this?" — with options based on existing event/workflow patterns
4. Continue asking until the problem space is clear

**Self-check every 3 questions:** After every 3 questions answered, pause and assess: "Do I understand the problem space well enough to discuss approaches?" If yes, move to Phase 3. If no, continue asking.

Continue asking clarifying questions one at a time using AskUserQuestion with options. Stop when you have sufficient context to produce useful discussion notes. The user can always choose to move forward. No hardcoded question limit.

#### Phase 3: Approaches

Present 2-3 approaches with trade-offs from the scan results. Lead with your recommendation:

```
Based on what we've discussed and the codebase patterns, here are the approaches I see:

**A. {approach name} (Recommended)**
{description} — uses {existing pattern at file path}
Pros: {benefits}
Cons: {drawbacks}

**B. {approach name}**
{description}
Pros: {benefits}
Cons: {drawbacks}

**C. {approach name}** (optional, if relevant)
{description}
Pros: {benefits}
Cons: {drawbacks}
```

Use AskUserQuestion: "Which approach do you prefer? You can also combine elements from multiple approaches."

After the user picks an approach, ask 1-2 follow-up questions to clarify details specific to that approach (one question per message).

#### Phase 4: Convergence

When you believe you understand the topic well enough, present a structured summary:

```
Here's what we've explored:

Topic: {$TOPIC}
Problem: {what we're solving and why}
Approach: {chosen direction with key details}
Key insights:
- {insight 1}
- {insight 2}
- {insight 3}
Codebase context: {relevant patterns/files that inform the approach}
Open questions: {anything still unresolved, if any}
```

Use AskUserQuestion with a convergence check:

```
question: "How would you like to proceed?"
options:
  - "Ready to wrap up -- write discussion notes" — Proceed to Step 5
  - "I want to add more details" — Continue exploring
  - "I want to change direction on something" — Revisit a decision
```

**If "add more":** Ask what they want to explore (one question). Then ask targeted follow-up questions (one at a time) until they're satisfied. Return to convergence check.

**If "change":** Ask what needs changing (one question). Update understanding. Return to convergence check.

**If "ready":** Proceed to Step 5.

### Step 5: Spawn Discuss-Partner Write-Notes Mode

Derive the output path for the discussion notes:

1. Get today's date: `date +%Y-%m-%d` (format: `{YYYY-MM-DD}`)
2. Use the slug derived in Step 2
3. Output path: `.bee/discussions/{YYYY-MM-DD}-{slug}.md`

Ensure the `.bee/discussions/` directory exists (create it if needed using Bash `mkdir -p`).

Spawn the `discuss-partner` agent via the Task tool. Omit the model parameter (inherit parent model -- write-notes requires deeper reasoning to distill conversation into structured notes). Provide the following context:

```
Task(
  subagent_type="bee:discuss-partner",
  description="Write notes: {$TOPIC}",
  prompt="
    $MODE = \"write-notes\"

    Discussion topic: {$TOPIC}
    Output path: {output path from above}
    Date: {today's date}

    Full conversation log:
    {$DISCUSSION_LOG — all rounds of Q&A accumulated during Step 4}

    Scan results:
    {$SCAN_RESULT — codebase context from Step 3}

    Write structured discussion notes to the output path.
  "
)
```

When the agent completes, verify the notes file was written by reading it. Store the output path as `$NOTES_PATH`.

### Step 6: Update STATE.md Last Action

Re-read `.bee/STATE.md` from disk (Read-Modify-Write pattern -- always read the current version before writing to avoid stale overwrites).

Update the Last Action section:
- **Command:** `/bee:discuss`
- **Timestamp:** current ISO 8601 timestamp
- **Result:** "Discussion notes written to {$NOTES_PATH}"

Write the updated STATE.md back to disk.

### Step 7: Completion Message

Display the following summary to the user:

```
Discussion complete!

Topic: {$TOPIC}
Notes: {$NOTES_PATH}
Rounds: {number of rounds completed}

The discussion notes capture the problem space, approaches considered,
and insights for spec creation.
```

Then use AskUserQuestion for the next step:

```
AskUserQuestion(
  question: "Discussion notes scrise: {$NOTES_PATH}",
  options: ["Accept", "Continue discussing", "New Spec", "Custom"]
)
```

- **Accept**: Notes are complete, show path and end
- **Continue discussing**: Re-enter discussion loop for more detail, then regenerate notes
- **New Spec**: Execute `/bee:new-spec --from-discussion {$NOTES_PATH}`
- **Custom**: Free text

---

**Design Notes (do not display to user):**

- The discussion runs IN MAIN CONTEXT (not delegated to a subagent). AskUserQuestion only works in main context, enabling structured options the user can click.
- The brainstorming-style adaptive flow replaces the old fixed 2-5 round structure. Key principles ported from the superpowers brainstorming skill: one question per message, multiple choice preferred, no fixed round limit, decomposition check for complex topics, 2-3 approaches with trade-offs and recommendation.
- The self-check every 3 questions prevents both premature convergence (too few questions) and interview fatigue (too many without progress).
- The decomposition check (Phase 1) catches multi-subsystem topics early, preventing unfocused discussions that try to cover too much ground.
- The approaches phase (Phase 3) uses scan results to present concrete options with codebase-informed trade-offs, not generic alternatives.
- The scan spawn uses `model: "sonnet"` for economy/quality mode (structured codebase scanning) and omits the model for premium mode. The write-notes spawn always omits the model (inherits parent -- deeper reasoning for distillation).
- The output path `.bee/discussions/{YYYY-MM-DD}-{slug}.md` follows the same dating convention as specs.
- This command never auto-commits. The user decides when to commit via `/bee:commit`.
