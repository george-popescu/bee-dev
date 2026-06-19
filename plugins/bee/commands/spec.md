---
description: List active specs, switch focus, show spec status, or promote a spec to a worktree (multi-spec registry)
argument-hint: "[list|use <slug>|status|promote <slug>]"
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

Parse `$ARGUMENTS` for the first word. If empty, default to `list`. Recognized subcommands: `list`, `use`, `status`, `promote`.

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

### Subcommand: promote <slug>

Promote a spec to its own git worktree so it can be built in parallel with another in-place spec. Reuses the `/bee:workspace` engine, spec-first.

1. **Must run from the main worktree.** Resolve the main project path (as `/bee:workspace` Step 3b does: parse `git worktree list --porcelain`, first entry is main). If the current directory is a workspace/worktree (not the main path), tell the user: "Run `/bee:spec promote` from the main project, not inside a worktree." Stop.

2. **Resolve `<slug>`** via `node ${CLAUDE_PLUGIN_ROOT}/scripts/specs-cli.js resolve --bee .bee` (or accept the explicit `<slug>` argument). Read the registry row: `node ${CLAUDE_PLUGIN_ROOT}/scripts/specs-cli.js list --bee .bee --json`.
   - If the spec is unknown or terminal (`shipped`/`archived`): "Cannot promote `<slug>` — it is not an active spec." Stop.
   - If its `location` is already a worktree path (not `in-place`): "Spec `<slug>` is already in a worktree at `<path>`. `cd` there to work on it." Stop.

3. **Derive the worktree path** (same scheme as workspaces, distinct namespace):
   ```bash
   PROJECT_NAME=$(basename "$MAIN_PROJECT_PATH")
   WORKTREE_BASE="$(dirname "$MAIN_PROJECT_PATH")/${PROJECT_NAME}-bee-workspaces"
   WORKTREE_PATH="${WORKTREE_BASE}/spec-{slug}"
   ```
   If `bee/spec/{slug}` branch already exists (`git rev-parse --verify bee/spec/{slug}`) or `$WORKTREE_PATH` exists, tell the user and stop.

4. **Create the worktree + branch:**
   ```bash
   mkdir -p "$WORKTREE_BASE"
   git worktree add -b bee/spec/{slug} "$WORKTREE_PATH" HEAD
   ```
   If it fails, display the error and stop (nothing registered yet).

5. **Seed the worktree `.bee/` and write the marker:**
   ```bash
   cp -r "$MAIN_PROJECT_PATH/.bee/" "$WORKTREE_PATH/.bee/"
   rm -f "$WORKTREE_PATH/.bee/workspaces.json"
   printf '%s\n' "{slug}" > "$WORKTREE_PATH/.bee/worktree-spec"
   ```
   If the copy fails, roll back: `git worktree remove "$WORKTREE_PATH"`, display the error, stop.

6. **Register the workspace** in `$MAIN_PROJECT_PATH/.bee/workspaces.json` (reuse `/bee:workspace` Step 4l), adding a `spec_slug` field:
   ```json
   {
     "name": "spec-{slug}",
     "branch": "bee/spec/{slug}",
     "path": "{WORKTREE_PATH}",
     "created": "{ISO-8601}",
     "status": "active",
     "source_branch": "{current branch}",
     "spec_slug": "{slug}",
     "depends_on": [], "files_changed": [], "conflicts_with": [], "last_conflict_check": null
   }
   ```

7. **Flip `location` in the main registry:**
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/specs-cli.js set-location --bee .bee --slug {slug} --location "$WORKTREE_PATH"
   ```

8. **Tell the user:**
   ```
   Spec '{slug}' promoted to a worktree:
     path:   {WORKTREE_PATH}
     branch: bee/spec/{slug}
   Open a new chat there:  cd {WORKTREE_PATH}
   Execute it in isolation: /bee:execute-phase   (the worktree is bound to this spec)
   Merge back when done:    /bee:workspace complete spec-{slug}
   ```
