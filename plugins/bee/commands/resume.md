---
name: resume
description: Resume BeeDev work from where you left off with full context restoration
argument-hint: ""
---

## Saved State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`
- `.bee/SESSION-CONTEXT.md` — if not found: NO_SESSION_CONTEXT

## Instructions

You are running `/bee:resume` -- a context restoration command for developers returning to work after a break. Read the injected state above and provide a full briefing so the developer can pick up exactly where they left off.

### Not Initialized

If the state above contains `NOT_INITIALIZED`, respond:

"BeeDev is not initialized for this project. Run `/bee:init` to get started."

Stop here -- do not proceed with the rest of the instructions.

### Context Restoration Briefing

Think of yourself as an assistant who remembers everything about the project. Provide a structured briefing:

**1. Where You Left Off**

Read the Last Action section from STATE.md:
- What command was last run
- When it was run (timestamp)
- What was its result

Present this as a natural sentence: "Last time, you ran `/bee:{command}` on {date} and {result}."

**2. Current Position**

Summarize the project state:
- **Spec:** Name and status (or "No spec defined yet")
- **Stack:** From config.json
- **Active phase:** Which phase is currently in progress (if any)
- **Phase status:** What stage the active phase is in (planned / executing / executed / reviewing / reviewed / testing / tested / ready to commit)

If there are multiple phases, show which ones are complete and which remain.

**3. Session Context (if available)**

If `NO_SESSION_CONTEXT` does NOT appear in the injected context (meaning `.bee/SESSION-CONTEXT.md` exists), this contains a snapshot of the working state from the last session. Present:
- What was actively being worked on
- Any pending decisions or choices the developer needs to make
- Wave progress (if mid-execution): which tasks are complete, which remain
- Any warnings or blockers noted in the session context

If `NO_SESSION_CONTEXT` appears, note: "No session context saved from last time." and skip this section.

**4. Phase Details (if mid-execution)**

If a phase is currently being executed (status shows partial completion), provide details:
- How many tasks/waves are complete vs remaining
- Which specific task or wave is next
- Any notes about what was in progress

Read this from the Phases table and any additional state information.

**5. What To Do Next**

Suggest the specific next command based on state analysis. Use the same logic as `/bee:progress` but provide more context about *why* this is the right next step:

| Current State | Suggested Command | Context |
|--------------|-------------------|---------|
| `NO_SPEC` | `/bee:new-spec` | "You haven't defined a spec yet. Start by describing what you want to build." |
| Spec exists, no phases planned | `/bee:plan-phase 1` | "Your spec '{name}' is ready. The next step is to break it into executable phases." |
| Phase planned, not executed | `/bee:execute-phase N` | "Phase N ('{name}') has a plan ready. Execute it to generate the implementation." |
| Phase executed, not reviewed | `/bee:review` | "Phase N is implemented. Review it to catch issues before moving on." |
| Phase reviewed, not tested | `/bee:test` | "Review is complete. Generate test scenarios to verify the implementation." |
| Phase tested, not committed | `/bee:commit` | "Everything looks good. Commit this phase's work." |
| All phases done | `/bee:review-project` | "All phases are complete. A final project review will check overall quality." |

### Output Format

The resume briefing should feel like a colleague catching you up after a break. Be thorough but structured -- use headers and short paragraphs, not walls of text. The developer should be able to read it in 30 seconds and know exactly where they are and what to do next.
