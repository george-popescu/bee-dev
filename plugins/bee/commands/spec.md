---
description: List active specs, switch focus, or show spec status (multi-spec registry)
argument-hint: "[list|use <slug>|status]"
---

## Current State (load before proceeding)

Read these files using the Read tool (note missing files as evidence):
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`

## Instructions

You are running `/bee:spec` — the multi-spec registry surface. It never auto-commits.

### Step 1: Guard

If the state above contains `NOT_INITIALIZED`, respond: "BeeDev is not initialized for this project. Run `/bee:init` to get started." Stop.

### Step 2: Parse subcommand

Parse `$ARGUMENTS` for the first word. If empty, default to `list`.

### Subcommand: list

Run and display the table verbatim:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/specs-cli.js list --bee .bee --active
```

If output is `No specs.`, tell the user: "No active specs. Run `/bee:new-spec` to create one." Then stop.

### Subcommand: use <slug>

Set this chat's focus to `<slug>` by touching it (also refreshes the global mirror):

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/specs-cli.js touch --bee .bee --slug <slug>
```

Confirm: "Focused spec: <slug>. Spec commands in this chat will target it until you pick another."

### Subcommand: status

Run the resolver and report the current binding:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/specs-cli.js resolve --bee .bee
```

- `mode: auto` → "One active spec: <slug>."
- `mode: pick` → list the candidates and tell the user spec commands will show a picker.
- `mode: create` → "No active specs yet. Run `/bee:new-spec`."
