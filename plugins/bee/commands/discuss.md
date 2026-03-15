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

Spawn the `discuss-partner` agent via the Task tool with `model: "sonnet"` (structured codebase scanning). Provide the following context:

```
Task(
  subagent_type="bee:discuss-partner",
  model="sonnet",
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

### Step 4: Adaptive Discussion Rounds

Run 2-5 adaptive rounds of discussion directly in main context using AskUserQuestion. The discussion is informed by `$SCAN_RESULT` from the codebase scan. Accumulate all questions and answers in `$DISCUSSION_LOG`.

#### Round 1: Problem Space

Use AskUserQuestion to explore the problem space. Ask 1-2 questions about what the user is trying to solve, why it matters, and what the constraints are. Reference relevant files and existing patterns from the scan results when applicable.

Example question structure:
- "What problem does this solve?" with options derived from the topic and scan context
- "Who is affected?" or "What triggers this?" with codebase-informed options

#### Round 2: Approach

Use AskUserQuestion to discuss the approach. Present the suggested approaches from the scan results and their trade-offs. Ask the user which direction they lean toward.

Reference the `## Suggested Approaches` section from the scan results. Present trade-offs for each approach. Ask the user to pick or combine approaches.

#### Round 3+: Convergence

After Round 2, present a summary of the discussion so far:

```
Here's what we've explored:

Topic: {$TOPIC}
Problem: {summary from Round 1}
Approach: {preference from Round 2}
Key insights:
- {insight 1}
- {insight 2}
Codebase context: {relevant patterns/files}
```

Use AskUserQuestion with a convergence check:

```
question: "How would you like to proceed?"
options:
  - "Ready to wrap up -- write discussion notes" — Proceed to Step 5
  - "I want to add more details" — Ask follow-up questions, then return to convergence
  - "I want to change direction on something" — Ask what to change, update understanding, return to convergence
```

**If "add more":** Ask the user what they want to explore further (free text), then ask 1-2 targeted follow-up questions with AskUserQuestion. Return to convergence check.

**If "change":** Ask what needs changing (free text), update the discussion understanding, return to convergence check.

**If "ready":** Proceed to Step 5.

**Maximum 5 rounds total.** If 5 rounds are reached without convergence, present current understanding and proceed with a note: "Proceeding with current discussion state. You can always run `/bee:discuss` again to explore further."

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

Next step:
  /bee:new-spec --from-discussion {$NOTES_PATH} {$TOPIC}
```

---

**Design Notes (do not display to user):**

- The discussion rounds run IN MAIN CONTEXT (not delegated to a subagent). This is the architectural reason: AskUserQuestion only works in main context, enabling structured options the user can click.
- The scan spawn uses `model: "sonnet"` because it is structured codebase scanning (Glob/Grep/Read). The write-notes spawn omits the model (inherits parent) because distilling a conversation into structured notes requires deeper reasoning.
- The output path `.bee/discussions/{YYYY-MM-DD}-{slug}.md` follows the same dating convention as specs but uses a separate directory to keep discussions distinct from formal specs.
- This command never auto-commits. It only writes discussion notes to `.bee/discussions/` and updates STATE.md. The user decides when to commit via `/bee:commit`.
- The 2-5 round adaptive structure mirrors the new-spec discovery conversation but is lighter weight. Round 1 explores the problem, Round 2 discusses approaches informed by scan trade-offs, and Round 3+ converges toward actionable insights.
- The `/bee:new-spec --from-discussion {path} {topic}` suggestion in the completion message gives the user a clear path from discussion to formal spec creation, with the discussion notes pre-loaded into the spec workflow.
- The discuss-partner agent in scan mode uses the same structured scanning pattern as the researcher agent but scoped to a discussion topic rather than a full spec. This keeps scanning fast and focused.
- The slug derivation in Step 2 follows the same pattern used by new-spec for consistency: slugify first 3-4 words, lowercase, hyphens, no special characters.
