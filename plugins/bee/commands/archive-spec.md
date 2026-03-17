---
description: Archive the current spec to .bee/archive/, reset STATE.md, and bump plugin version
argument-hint: ""
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`

## Instructions

You are running `/bee:archive-spec` -- the spec archival command for BeeDev. This command moves the completed spec to the archive directory, resets STATE.md, and bumps the plugin patch version. Follow these steps in order. This command never auto-commits -- the user decides when to commit via `/bee:commit`.

### Step 1: Validation Guards

Check these guards in order. Stop immediately if any fails:

1. **NOT_INITIALIZED guard:** If the dynamic context above contains "NOT_INITIALIZED" (meaning `.bee/STATE.md` does not exist), tell the user:
   "BeeDev is not initialized. Run `/bee:init` first."
   Do NOT proceed.

2. **NO_SPEC guard:** Read STATE.md from the dynamic context above. If Current Spec Status is `NO_SPEC` or Current Spec Path shows "(none)", tell the user:
   "No active spec found. Run `/bee:new-spec` first."
   Do NOT proceed.

3. **Spec directory guard:** Read the Current Spec Path from STATE.md. Check that the spec directory exists on disk using Bash (`test -d {spec-path}`). If the directory does not exist, tell the user:
   "Spec directory not found at `{spec-path}`. STATE.md may be stale."
   Do NOT proceed.

### Step 2: Pre-archive Checklist

Read the Phases table from STATE.md. Check each phase row:

1. For each phase where the Status column is NOT `COMMITTED`, collect its phase number and name.
2. If any phases are not COMMITTED, display a warning:
   ```
   Warning: The following phases are not COMMITTED:
   - Phase {N}: {name} (Status: {status})
   - Phase {M}: {name} (Status: {status})
   ...
   ```
   Ask the user: "Archive anyway? Some phases have not been committed. (yes/no)"
   If the user says no, display "Archive cancelled." and stop.
3. If all phases are COMMITTED (or no phases exist), proceed without warning.

### Step 3: Confirm Archive

Display the spec name and path to the user:

```
Ready to archive:
- Spec: {spec-name}
- Path: {spec-path}
- Archive destination: .bee/archive/{spec-folder-name}/
```

Ask the user: "Proceed with archive? (yes/no)"

If the user says no, display "Archive cancelled." and stop.

### Step 4: Move Spec to Archive

1. Create the archive directory: `mkdir -p .bee/archive/`
2. Move the spec directory to the archive: `mv {spec-path} .bee/archive/{spec-folder-name}/`
   - The spec folder name is the last path component of the Current Spec Path (e.g., `2026-02-20-user-management` from `.bee/specs/2026-02-20-user-management/`).
3. Verify the move succeeded:
   - Check that the archive destination exists: `test -d .bee/archive/{spec-folder-name}/`
   - Check that the original location no longer exists: `test ! -d {spec-path}`
   - If verification fails, tell the user: "Archive move failed. The spec directory may be in an inconsistent state. Check `.bee/archive/` and `.bee/specs/` manually." Stop.

### Step 5: Reset STATE.md

Perform a double-write to STATE.md to record the transition through ARCHIVED status:

**First write -- set ARCHIVED:**
1. Read current `.bee/STATE.md` from disk (fresh read -- Read-Modify-Write pattern).
2. Set Current Spec Status to `ARCHIVED`.
3. Keep the Current Spec Name and Path as they were (for the audit trail).
4. Leave the Phases table as-is.
5. Update Last Action:
   - Command: `/bee:archive-spec`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Spec archived: {spec-name}"
6. Write STATE.md to disk.

**Second write -- set NO_SPEC:**
1. Read current `.bee/STATE.md` from disk again (fresh read).
2. Set Current Spec Status to `NO_SPEC`.
3. Clear Current Spec Name to `(none)`.
4. Clear Current Spec Path to `(none)`.
5. Leave the Phases table as-is (preserving the record of what was done).
6. Keep the Last Action from the first write unchanged.
7. Write STATE.md to disk.

### Step 6: Bump Plugin Version

1. Read the plugin manifest at `plugins/bee/.claude-plugin/plugin.json` (use the Read tool -- adjust the path relative to the project root, which for the bee plugin itself is the repo root).
   - If running within a project that uses the bee plugin, the plugin.json path is at the plugin's installed location. Use `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` via Bash to resolve the correct path.
2. Parse the `version` field (semver format: `MAJOR.MINOR.PATCH`).
3. Increment the PATCH number by 1 (e.g., `2.1.0` becomes `2.1.1`, `1.0.9` becomes `1.0.10`).
4. Write the updated plugin.json back to disk with the new version, preserving all other fields.
5. Display: "Plugin version bumped: {old-version} -> {new-version}"

### Step 7: Summary

Display the archive summary:

```
Spec archived!

- Archived to: .bee/archive/{spec-folder-name}/
- State: NO_SPEC
- Plugin version: {new-version}

Next step: /bee:new-spec (/clear first if context is long) -- start a new feature
```

---

**Design Notes (do not display to user):**

- This command does not commit anything. The user runs `/bee:commit` separately if they want to commit the state changes.
- The double-write pattern for STATE.md (ARCHIVED then NO_SPEC) creates a clean transition record. The ARCHIVED status is set first to mark the spec as archived in the audit trail, then NO_SPEC is set to indicate the project is ready for a new spec. Both writes use Read-Modify-Write to avoid stale overwrites.
- The Phases table is intentionally left intact through both writes. This preserves the historical record of phase progress. When a new spec is created via `/bee:new-spec`, the Phases table is replaced with the new spec's phases.
- The spec folder name is extracted as the last path component (e.g., `2026-02-20-user-management` from `.bee/specs/2026-02-20-user-management/`). This keeps archive paths predictable and avoids nested directory issues.
- Move verification uses two checks: the archive destination must exist AND the original location must not exist. This catches partial moves and permission errors.
- Plugin version bump is the last mutation step (after STATE.md reset). If the version bump fails, the spec is already archived and STATE.md is already reset -- the user can manually bump the version without re-archiving.
- The `mkdir -p .bee/archive/` is safe to run even if the directory already exists (idempotent).
- This command does not use any agents -- it operates entirely within the main Claude context.
