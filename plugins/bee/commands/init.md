---
description: Initialize BeeDev for a project -- detect stack, create .bee/, configure workflow
argument-hint: ""
---

## Project Detection (load before proceeding)

Read these files using the Read tool:
- `package.json` — if not found: NO_PACKAGE_JSON
- `composer.json` — if not found: NO_COMPOSER_JSON
- `.bee/config.json` — if not found: NO_EXISTING_CONFIG

Use Glob to scan for manifest files in first-level subdirectories:
- `*/package.json` — collect all matches
- `*/composer.json` — collect all matches

For each subdirectory manifest found, Read the file contents for stack analysis in Step 2.

Use Glob to check for `.github/workflows/*.yml`:
- If no matches: NO_CI_CONFIG

## Instructions

You are running `/bee:init` -- the first-time setup command for BeeDev. Follow these steps in order. Ask the user for confirmation at each decision point. Never make assumptions -- detect and confirm.

### Step 1: Check for Existing Project (Re-init Handling)

If the dynamic context above does NOT contain `NO_EXISTING_CONFIG` (meaning `.bee/config.json` already exists), this is a **re-initialization**:

- Inform the user: "Existing BeeDev project detected. I'll update your config without touching existing specs or state."

**v2-to-v3 migration check:** Inspect the loaded `.bee/config.json`:
- If the config has a `stack` key whose value is a **string** (not an array), it is **v2 format** -- run the migration:
  1. Read the current `stack` string value (e.g. `"nextjs"`).
  2. Replace the `stack` key with `stacks: [{ "name": "<value>", "path": "." }]`.
  3. Add `"implementation_mode": "quality"` as a top-level field if not already present. Valid values are `"economy"`, `"quality"`, and `"premium"`.
  4. Write the updated config back to `.bee/config.json`.
  6. Show the user a migration summary:
     ```
     Migrated config from v2 to v3:
     - Converted "stack": "<value>" to "stacks": [{ "name": "<value>", "path": "." }]
     - Added "implementation_mode": "quality"
     - Added "quick.agents": true
     ```
  7. Do NOT touch `.bee/STATE.md`, `.bee/specs/`, or any other state files during migration.
- If the config already has a `stacks` key that is an **array**, it is already v3 format -- skip migration silently.

- Proceed through detection steps below but only update `.bee/config.json` values (stacks, linter, testRunner, ci).
- Do NOT overwrite `.bee/STATE.md`, `.bee/specs/`, or any other existing state files.
- Verify the global statusline is installed (Step 5) and clean up any legacy local copies.
- Skip the CLAUDE.md and .gitignore steps (those were handled on first init).

If `NO_EXISTING_CONFIG` appears, this is a fresh init -- proceed with all steps.

### Step 2: Stack Detection

Detect stacks at the project root AND in first-level subdirectories. For each location that has a `package.json` or `composer.json`, apply the detection rules below to identify the stack type.

**Detection rules (apply to each manifest location):**

| Condition | Stack Identifier |
|-----------|-----------------|
| `composer.json` has `laravel/framework` AND `package.json` has `vue` | `laravel-inertia-vue` |
| `composer.json` has `laravel/framework` AND `package.json` has `react` | `laravel-inertia-react` |
| `package.json` has `react` (but NOT `next` and NOT `expo`) | `react` |
| `package.json` has `next` | `nextjs` |
| `package.json` has `@nestjs/core` | `nestjs` |
| `package.json` has `expo` AND `react-native` | `react-native-expo` |

**Multi-stack scanning procedure:**

1. **Root manifests:** Apply the detection rules to the root `package.json` and `composer.json` (loaded in Project Detection). If a stack is detected, record it as a stack-path pair with path `"."`.

2. **Subdirectory manifests:** For each `*/package.json` and `*/composer.json` found by Glob in the Project Detection step, apply the same detection rules. If a stack is detected, record it as a stack-path pair with the subdirectory name as path (e.g. `"api"`, `"frontend"`).

3. **Present all detected stack-path pairs** to the developer. Format:
   ```
   Detected stacks:
   - [laravel-inertia-vue at '.']
   - [nestjs at 'api']
   ```
   If only one stack is detected at root, show it the same way with path `"."`.

4. **Ask the developer to confirm, adjust, or remove** any entries:
   - "Does this look right? You can confirm, adjust any stack type, remove entries you don't want, or manually add stacks not auto-detected."

5. The developer can **manually add** stacks not auto-detected by specifying a stack name and path (e.g. "add react at 'client'").

**Single-stack case:** When only one manifest is found at root with a single detected stack, the flow is the same -- one stack-path pair with path `"."` is shown for confirmation. This preserves backward compatibility.

If nothing is detected (no manifests found or no matching patterns), present the full list of supported stacks and ask the user to choose:
- `laravel-inertia-vue`
- `laravel-inertia-react`
- `react`
- `nextjs`
- `nestjs`
- `react-native-expo`

Ask: "No stacks were auto-detected. Which stack(s) does this project use? You can specify multiple with their paths."

### Step 2.5: Validate Stack Skills

After the developer confirms the stack list, validate that each stack has a matching skill file.

For each confirmed stack in the stacks list:
1. Check if `skills/stacks/{stack.name}/SKILL.md` exists using Glob
2. If it exists: mark as supported (✓)
3. If it does NOT exist:
   - Display warning: "Stack '{name}' does not have a built-in skill. Agents will work without stack-specific guidance."
   - Ask: "Would you like to create a custom stack skill for '{name}'? You can run `/bee:create-skill` after init completes."

Track the skill status for each stack (used in Step 10 completion summary).

**Available built-in stack skills:**
- `laravel-inertia-vue`
- `laravel-inertia-react`
- `react`
- `nextjs`
- `nestjs`
- `react-native-expo`
- `claude-code-plugin`

### Step 3: Test Runner and Linter Detection

Scan for test runners and linters. Present detected values and confirm with the user.

**Test runners (check in order, use first match):**

| Indicator | Test Runner |
|-----------|------------|
| `vendor/bin/pest` exists or `pestphp/pest` in composer.json | `pest` |
| `node_modules/.bin/vitest` exists or `vitest` in package.json | `vitest` |
| `node_modules/.bin/jest` exists or `jest` in package.json | `jest` |
| None found | `none` |

**Linters (check in order, use first match):**

| Indicator | Linter |
|-----------|--------|
| `vendor/bin/pint` exists or `laravel/pint` in composer.json | `pint` |
| `.eslintrc*` or `eslint.config.*` exists | `eslint` |
| `.prettierrc*` exists | `prettier` |
| `biome.json` exists | `biome` |
| None found | `none` |

**CI detection:**

| Indicator | CI |
|-----------|-----|
| `.github/workflows/` directory has `.yml` files (from dynamic context) | `github-actions` |
| None found | `none` |

Present the detected values:
```
Detected configuration:
- Test runner: {detected or "none"}
- Linter: {detected or "none"}
- CI: {detected or "none"}
```

Ask: "Does this look right? (yes/no, or tell me what to change)"

### Step 4: Create .bee/ Directory and config.json

Create the `.bee/` directory and write `.bee/config.json` with the confirmed values.

The `stacks` array contains one entry per each confirmed stack-path pair from Step 2. For single-stack projects, this is a one-element array with `"path": "."`.

**Single-stack example:**
```json
{
  "version": "0.1.0",
  "stacks": [
    { "name": "{STACK}", "path": "." }
  ],
  "implementation_mode": "quality",
  "linter": "{LINTER}",
  "testRunner": "{TEST_RUNNER}",
  "ci": "{CI}",
  "context7": true,
  "review": {
    "against_spec": true,
    "against_standards": true,
    "dead_code": true,
    "loop": false,
    "max_loop_iterations": 3
  },
  "phases": {
    "require_review_before_next": true
  },
  "quick": {
    "review": false,
    "fast": false
  }
}
```

**Multi-stack example:**
```json
{
  "version": "0.1.0",
  "stacks": [
    { "name": "laravel-inertia-vue", "path": "." },
    { "name": "nestjs", "path": "api" }
  ],
  "implementation_mode": "quality",
  "linter": "{LINTER}",
  "testRunner": "{TEST_RUNNER}",
  "ci": "{CI}",
  "context7": true,
  "review": {
    "against_spec": true,
    "against_standards": true,
    "dead_code": true,
    "loop": false,
    "max_loop_iterations": 3
  },
  "phases": {
    "require_review_before_next": true
  },
  "quick": {
    "review": false,
    "fast": false
  }
}
```

Replace `{STACK}`, `{LINTER}`, `{TEST_RUNNER}`, and `{CI}` with the confirmed values from Steps 2-3. For multi-stack projects, populate the `stacks` array with all confirmed stack-path pairs.

### Step 5: Verify Statusline

The bee statusline is managed globally by the plugin's SessionStart hook (`setup-statusline.js`). It auto-copies `bee-statusline.js` to `~/.claude/hooks/` and configures `~/.claude/settings.json` on every session start. No local copy is needed.

1. **Check if `~/.claude/hooks/bee-statusline.js` exists** (use Bash: `test -f ~/.claude/hooks/bee-statusline.js && echo "exists" || echo "missing"`):
   - If exists: inform the user "Statusline is installed globally (managed by plugin SessionStart hook)."
   - If missing: run `node ${CLAUDE_PLUGIN_ROOT}/scripts/setup-statusline.js` via Bash to install it now.

2. **Clean up legacy local copies** (from older bee versions):
   - If `.bee/statusline.js` exists: delete it via Bash (`rm .bee/statusline.js`) and inform the user "Removed legacy local statusline copy."
   - If `.claude/settings.json` exists: read it and check if `statusLine.command` contains `.bee/statusline.js`. If so, remove the `statusLine` key (or delete the file if it has no other settings) and inform the user "Removed legacy local statusline config (global config handles this)."

Do NOT create `.bee/statusline.js` or local `.claude/settings.json` statusLine config.

### Step 6: Project Scan

Scan the project to build `.bee/PROJECT.md` -- a codebase index that gives agents instant project awareness without rescanning.

**6a. Directory tree (top 3 levels, filtered)**

Use the Glob tool with patterns like `*`, `*/*`, `*/*/*` to discover the directory structure. Filter out:
- `node_modules/`, `vendor/`, `.git/`, `dist/`, `build/`, `.next/`, `.nuxt/`, `storage/`, `cache/`
- Any directory starting with `.` except `.github/`

**6b. Entry points and key files**

Use Glob to find:
- Entry points: `src/index.*`, `src/main.*`, `src/app.*`, `app/Http/Kernel.php`, `bootstrap/app.php`, `pages/_app.*`, `app/layout.*`
- Route files: `routes/*.php`, `src/routes.*`, `app/**/route.*`, `pages/**/*.tsx`
- Config files: `*.config.*`, `config/*.php`, `config/*.ts`, `.env.example`
- Schema/model files: `app/Models/*.php`, `src/models/*`, `prisma/schema.prisma`, `database/migrations/*`
- Test directories: `tests/**`, `__tests__/**`, `*.test.*`, `*.spec.*`

**6c. Dependencies summary**

From `package.json` (if exists): list top-level dependencies and devDependencies (names only, no versions).
From `composer.json` (if exists): list require and require-dev (names only).

**6d. File statistics**

Run via Bash: `find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/vendor/*' -not -path '*/dist/*' | wc -l` for total file count.
Count files per top-level directory for a size overview.

**6e. Write `.bee/PROJECT.md`**

```markdown
# Project Index

> Auto-generated by `/bee:init`. Re-run init to refresh.

## Structure
{directory tree, indented, top 3 levels}

## Entry Points
{list of detected entry points with paths}

## Routes
{list of route files}

## Config Files
{list of config/env files}

## Models / Schema
{list of model/schema files}

## Tests
{test directory structure, test file patterns detected}

## Dependencies
### Runtime
{dependency names, grouped by source (npm/composer)}

### Dev
{dev dependency names}

## Stats
- Total files: {count}
- {top-dir}: {count} files
- {top-dir}: {count} files
- ...
```

Keep it concise -- paths only, no file contents. This is an index, not documentation.

On **re-init**: always regenerate PROJECT.md (overwrite the previous version).

### Step 7: Create STATE.md

Create `.bee/STATE.md` with the initial state:

```markdown
# Bee Project State

## Current Spec
- Name: (none)
- Path: (none)
- Status: NO_SPEC

<!-- Valid Status values:
  NO_SPEC       — No active spec; project is idle or between features.
  SPEC_CREATED  — Spec document exists but no phases have been executed yet.
  IN_PROGRESS   — At least one phase has moved past the planned stage.
  COMPLETED     — All phases committed and review-implementation is done.
  ARCHIVED      — Developer ran archive-spec; spec is stored in history.
-->

## Phases
| # | Name | Status | Plan | Plan Review | Executed | Reviewed | Tested | Committed |
|---|------|--------|------|-------------|----------|----------|--------|-----------|

## Quick Tasks

| # | Description | Date | Commit |
|---|-------------|------|--------|

## Decisions Log

## Last Action
- Command: /bee:init
- Timestamp: {TIMESTAMP}
- Result: Project initialized
```

Replace `{TIMESTAMP}` with the current ISO 8601 timestamp (e.g., `2026-02-20T14:30:00Z`).

### Step 8: Optional CLAUDE.md Update

Ask the user: "Should I add BeeDev instructions to your CLAUDE.md?"

If the user agrees:
- If `CLAUDE.md` exists, **append** (do not overwrite) the following section:
- If `CLAUDE.md` does not exist, create it with just this content:

```markdown
# BeeDev
Stack: {selected-stacks}
Use /bee:new-spec to start a new feature.
Use /bee:progress to see current state.
Always use Context7 MCP for framework documentation lookups.
```

Replace `{selected-stacks}` with the confirmed stack names from Step 2, comma-separated (e.g., `laravel-inertia-vue, nestjs`). For single-stack projects, use just the stack name (e.g., `nextjs`).

If the user declines, skip this step.

### Step 9: Optional .gitignore Update

Ask the user: "Should I add the `.bee/` directory to .gitignore? This keeps all bee state, reports, and config local to your machine."

If the user agrees:
- Add `.bee/` to `.gitignore` (the entire directory).
- If `.gitignore` exists, append the entry (avoid duplicates).
- If `.gitignore` does not exist, create it with `.bee/`.

If the user declines, skip this step.

### Step 10: Completion Summary

Display a summary of everything that was created or updated:

```
BeeDev initialized!

Stacks:
- {name} at '{path}' {✓ skill | ⚠ no skill}
- {name} at '{path}' {✓ skill | ⚠ no skill}
{...repeat for each stack}

Linter: {linter}
Test runner: {testRunner}
CI: {ci}
Implementation mode: {implementation_mode}

Created:
- .bee/config.json
- .bee/PROJECT.md
- .bee/STATE.md
- ~/.claude/hooks/bee-statusline.js (global, if missing)
{- CLAUDE.md (if updated)}
{- .gitignore (if updated)}

{If any stack has ⚠ no skill:}
Tip: Run /bee:create-skill to create custom stack skills for unsupported stacks.

Next step:
  /clear
  /bee:new-spec
```

### Step 11: Codebase Context Extraction

Extract codebase patterns and conventions into `.bee/CONTEXT.md` so that agents have instant project awareness.

**Fresh init** (`NO_EXISTING_CONFIG` was detected in Project Detection): always run context extraction.

**Re-init** (`.bee/config.json` already existed): check if `.bee/CONTEXT.md` already exists.
- If `.bee/CONTEXT.md` exists: skip this step. Display: "Codebase context already exists. Run `/bee:refresh-context` to regenerate."
- If `.bee/CONTEXT.md` does not exist: proceed with extraction.

**Extraction procedure:**

1. Display: "Extracting codebase context..."
2. Read `implementation_mode` from `.bee/config.json` to determine model selection:
   - `"economy"` or `"quality"` → spawn the `context-builder` agent via the Task tool with `model: "sonnet"`.
   - `"premium"` → spawn the `context-builder` agent via the Task tool without specifying a model (omit the `model` parameter to use the default).
   No additional context is needed -- the agent reads `.bee/config.json` and scans the codebase on its own.
3. Wait for the agent to complete.
4. Display: "Codebase context extracted to `.bee/CONTEXT.md`."

### Step 12: Extensions Loading

Detect and load local extensions from the `.claude/bee-extensions/` directory. Extensions are custom agents and skills created via `/bee:create-agent` and `/bee:create-skill`.

**Check if extensions directory exists:**

Use Bash to check: `test -d .claude/bee-extensions && echo "exists" || echo "missing"`

- If the directory does not exist: display "No local extensions found." and skip the rest of this step.

**Scan for extensions:**

Use Glob to find extension files:
- `.claude/bee-extensions/agents/*.md` -- custom agent definitions
- `.claude/bee-extensions/skills/*.md` -- custom skill definitions

If both Glob results are empty (no `.md` files found in either subdirectory): display "Extensions directory exists but contains no extensions yet." and skip the rest of this step.

**Load each extension:**

For each `.md` file found, read the file and extract the `name:` field from the YAML frontmatter. Display a message for each loaded extension:

- For agent extensions: "Extension agent loaded: {name}"
- For skill extensions: "Extension skill loaded: {name}"

**Summary line:**

After processing all extensions, display a summary:

"Extensions loaded: {N} agents, {M} skills from .claude/bee-extensions/"

Where `{N}` is the count of agent `.md` files found and `{M}` is the count of skill `.md` files found.
