---
description: Re-run codebase context extraction, overwriting CONTEXT.md with fresh analysis
argument-hint: ""
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`

## Instructions

You are running `/bee:refresh-context` -- a command that re-runs the context-builder agent to extract fresh codebase patterns and conventions into `.bee/CONTEXT.md`. This is useful after significant code changes or when starting a new spec on an existing codebase. This command does not commit any changes. Follow these steps in order.

### Step 1: Validation Guard

If the dynamic context above contains `NOT_INITIALIZED` (meaning `.bee/STATE.md` does not exist), tell the user:

"BeeDev is not initialized. Run `/bee:init` first."

Do NOT proceed. Stop immediately.

### Step 2: Inform User

Display the following message to the user:

"Re-extracting codebase context. This will overwrite `.bee/CONTEXT.md` if it exists."

Proceed immediately -- do not ask for confirmation or wait for user input.

### Step 3: Spawn Context-Builder Agent

Use the Task tool to spawn the `context-builder` agent with `model: "sonnet"`. Context-building is structured scanning work -- it reads files, classifies patterns, and writes a single output file. This does not require deep reasoning.

Provide the following context packet to the agent:
- The project root directory path
- The stack name from config.json (e.g., the value of `stacks[0].name` or `.stack`)
- Any additional config details that help the agent understand the codebase (e.g., test runner, linter)

The agent will scan the codebase using Glob, Grep, and Read, then write `.bee/CONTEXT.md` with observed patterns across 4 sections: Naming Conventions, File Organization, Design Patterns, and Domain Vocabulary.

### Step 4: Display Completion

After the context-builder agent completes, display its completion message to the user. The agent outputs a summary in the format:

"Context extracted: CONTEXT.md written to .bee/ with {N} observations across {M} sections."

Then display:

"CONTEXT.md updated. Run `/bee:resume` to start a session with full codebase context."

### Step 5: Update STATE.md Last Action

Re-read `.bee/STATE.md` from disk (Read-Modify-Write pattern -- always read the current version before writing to avoid stale overwrites).

Update the Last Action section:
- **Command:** `/bee:refresh-context`
- **Timestamp:** current ISO 8601 timestamp
- **Result:** "Codebase context re-extracted to .bee/CONTEXT.md"

Write the updated STATE.md back to disk.

---

**Design Notes (do not display to user):**

- The context-builder agent is spawned with `model: "sonnet"` because it performs structured scanning (Glob/Grep/Read) and template-based output. It does not write production code or make architectural decisions.
- No user confirmation is needed because the only side effect is overwriting `.bee/CONTEXT.md`, which is a derived artifact that can always be regenerated.
- The command does not auto-commit. The user decides when to commit via `/bee:commit`.
- The `/bee:resume` suggestion is important because resume reads CONTEXT.md and presents it as part of the briefing -- this closes the loop for the user.
- The context packet includes the project root and stack config so the agent knows where to scan and what framework conventions to expect. The agent reads config.json itself, but passing the stack name upfront helps it prioritize scanning patterns.
- This command is idempotent -- running it multiple times simply overwrites CONTEXT.md with fresh observations each time.
