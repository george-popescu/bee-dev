---
description: Auto-detect workflow state and dispatch the next logical command
argument-hint: ""
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` -- if not found: NOT_INITIALIZED
- `.bee/config.json` -- if not found: use `{}`

## Instructions

You are running `/bee:next` -- auto-dispatch that reads your current workflow state and suggests the next logical command. Zero arguments needed. Follow these steps in order.

### Not Initialized

If `.bee/STATE.md` does not exist (NOT_INITIALIZED), tell the user:
"BeeDev is not initialized. Run `/bee:init` first."
Do NOT proceed.

### Step 1: Gather State

From STATE.md, extract:
- Spec status (NO_SPEC, SPEC_CREATED, IN_PROGRESS, COMPLETED, ARCHIVED)
- Active phase number and status from the Phases table
- Which phases are planned, executed, reviewed, tested, committed

Also check for uncommitted changes:
```bash
git diff --stat
git status --short
```

Also read the multi-spec registry to detect queued specs:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/specs-cli.js list --bee .bee --active
```

Parse the output (tab-separated: slug, stage, location, title). If more than ONE active spec appears in the list, record the other slugs for a visibility note in Step 4.

### Step 2: Determine Next Command

Apply the next-action table below. Check conditions top to bottom -- use the FIRST match:

| Current State | Suggested Command | Reason |
|--------------|-------------------|--------|
| No spec but uncommitted changes exist | `/bee:review-implementation` | "Uncommitted changes found. Review them first." |
| Status is `NO_SPEC` (no uncommitted changes) | `/bee:new-spec` | "Start by defining what you want to build." |
| Status is `SPEC_CREATED` | `/bee:plan-phase 1` | "Spec ready. Plan the first phase." |
| Status is `IN_PROGRESS`, next phase is PENDING (not yet planned) | `/bee:plan-phase N` | "Phase N needs planning before execution." |
| Status is `IN_PROGRESS`, phase is EXECUTING (mid-execution) | `/bee:execute-phase N` | "Phase N was interrupted mid-execution. Resume it." |
| Status is `IN_PROGRESS`, phase planned not executed | `/bee:execute-phase N` | "Phase N is planned and ready to execute." |
| Status is `IN_PROGRESS`, phase executed not reviewed | `/bee:review` | "Phase N is implemented. Time to review." |
| Status is `IN_PROGRESS`, phase reviewed not tested | `/bee:test` | "Review done. Generate test scenarios." |
| Status is `IN_PROGRESS`, phase tested not committed | `/bee:commit` | "Tests pass. Ready to commit this phase." |
| Status is `COMPLETED` | `/bee:complete-spec` | "All phases complete. Run the spec completion ceremony (audit, changelog, tag, archive)." |
| Status is `ARCHIVED` | `/bee:new-spec` | "Spec archived. Start a new one." |

> **Note:** For a quick archive without the ceremony, use `/bee:archive-spec` directly.

Replace `N` with the actual phase number from the Phases table.

### Step 3: Handle Ambiguity

If the state is ambiguous (e.g., multiple incomplete phases at different stages), present all valid options:

```
AskUserQuestion(
  question: "Multiple options detected:",
  options: ["/bee:{command1} -- {reason1}", "/bee:{command2} -- {reason2}", "Custom"]
)
```

For the selected option, display "Run `/bee:{command}` now." Do NOT auto-invoke.

### Step 4: Present Suggestion

For the normal (non-ambiguous) case:

If more than one active spec was found in Step 1, prepend a visibility note before the menu:

```
Note: {N} specs are active — this 'next' is for {focused-slug}. Others: {other-slugs}. Use `/bee:spec use <slug>` to switch.
```

When only one (or zero) active specs exist, omit this note entirely — no extra noise.

```
AskUserQuestion(
  question: "Next: /bee:{command} -- {reason}",
  options: ["Run /bee:{command}", "Show context", "Custom"]
)
```

### Step 5: Handle Choice

- **Run /bee:{command}**: Display "Run `/bee:{command}` now." Do NOT auto-invoke the command.
- **Show context**: Display a brief state summary:
  ```
  Spec: {name} ({status})
  Phase: {N} -- {phase name} ({phase status})
  Uncommitted files: {count}
  ```
  Then re-present the suggestion menu from Step 4.
- **Custom**: Wait for free-text input from the user.

---

**Design Notes (do not display to user):**

- The next-action table is shared with `/bee:progress`, `/bee:pause`, `/bee:resume`, and `/bee:complete-spec`. Keep all 5 files in sync when updating.
- Search: "Suggested Command" table in progress.md, next.md, pause.md, resume.md, complete-spec.md.
- /bee:next does NOT auto-invoke commands -- it suggests and confirms. This is consistent with Bee's developer control philosophy.
- No agents needed. No Task tool. Pure command logic with Read, Bash, and AskUserQuestion.
