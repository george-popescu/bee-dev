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
     ```
  7. Do NOT touch `.bee/STATE.md`, `.bee/specs/`, or any other state files during migration.
- If the config already has a `stacks` key that is an **array**, it is already v3 format -- skip migration silently.

- If the config has root-level `linter` or `testRunner` keys AND the `stacks` entries do NOT have `linter`/`testRunner` fields, run per-stack migration:
  1. For single-stack projects (stacks array has 1 entry): move root `linter` value into `stacks[0].linter` and root `testRunner` into `stacks[0].testRunner`.
  2. For multi-stack projects: set each stack entry's `linter` and `testRunner` to `"none"` (will be re-detected in Step 3).
  3. Remove the root-level `linter` and `testRunner` keys.
  4. Add to migration summary: "Moved linter/testRunner into per-stack configuration"

- Proceed through detection steps below but only update `.bee/config.json` values (stacks, per-stack linter/testRunner, ci).
- Do NOT overwrite `.bee/STATE.md`, `.bee/specs/`, or any other existing state files.
- Verify the global statusline is installed (Step 5) and clean up any legacy local copies.
- Skip the CLAUDE.md, .gitignore, and user.md steps (those were handled on first init -- user.md is user-authored and must not be overwritten).

If `NO_EXISTING_CONFIG` appears, this is a fresh init -- proceed with all steps.

### Step 2: Stack Detection

Detect stacks at the project root AND in first-level subdirectories. For each location that has a `package.json`, `composer.json`, or `build.gradle.kts`, apply the detection rules below to identify the stack type.

**Detection rules (apply to each manifest location):**

| Condition | Stack Identifier |
|-----------|-----------------|
| `composer.json` has `laravel/framework` AND `package.json` has `vue` | `laravel-inertia-vue` |
| `composer.json` has `laravel/framework` AND `package.json` has `react` | `laravel-inertia-react` |
| `package.json` has `vue` (but NOT `laravel/framework` in `composer.json`) | `vue` |
| `package.json` has `react` (but NOT `next` and NOT `expo`) | `react` |
| `package.json` has `next` | `nextjs` |
| `package.json` has `@nestjs/core` | `nestjs` |
| `package.json` has `expo` AND `react-native` | `react-native-expo` |
| `package.json` has `@angular/core` | `angular` |
| `build.gradle.kts` has `kotlin("multiplatform")` or `multiplatform` plugin | `kmp-compose` |

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

   AskUserQuestion(
     question: "Detected stack: [stack]. Linter: [linter]. Tests: [runner].",
     options: ["Confirm", "Adjust", "Custom"]
   )

5. The developer can **manually add** stacks not auto-detected by specifying a stack name and path (e.g. "add react at 'client'").

**Single-stack case:** When only one manifest is found at root with a single detected stack, the flow is the same -- one stack-path pair with path `"."` is shown for confirmation. This preserves backward compatibility.

If nothing is detected (no manifests found or no matching patterns), present the full list of supported stacks and ask the user to choose:
- `laravel-inertia-vue`
- `laravel-inertia-react`
- `vue`
- `react`
- `nextjs`
- `nestjs`
- `angular`
- `react-native-expo`
- `kmp-compose`

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
- `vue`
- `react`
- `nextjs`
- `nestjs`
- `angular`
- `react-native-expo`
- `kmp-compose`
- `claude-code-plugin`

### Step 3: Per-Stack Test Runner and Linter Detection

For EACH confirmed stack from Step 2, detect the linter and test runner scoped to that stack's path and ecosystem.

**Ecosystem mapping:**

| Stack name contains | Ecosystem | Check for linters | Check for test runners |
|---------------------|-----------|-------------------|----------------------|
| `laravel` | PHP | `{path}/vendor/bin/pint`, `{path}/vendor/bin/phpstan` | `{path}/vendor/bin/pest`, `{path}/vendor/bin/phpunit` |
| `react`, `vue`, `nextjs`, `angular`, `nestjs` | JS/TS | `{path}/node_modules/.bin/eslint`, `{path}/node_modules/.bin/prettier`, `{path}/node_modules/.bin/biome` | `{path}/node_modules/.bin/vitest`, `{path}/node_modules/.bin/jest` |
| `react-native-expo` | JS/TS | `{path}/node_modules/.bin/eslint` | `{path}/node_modules/.bin/jest` |
| `kmp-compose` | Kotlin | `{path}/gradlew` (ktlint task) | `{path}/gradlew` (test task) |

Where `{path}` is the stack's configured path (`.` = project root).

For each stack:
1. Determine ecosystem from the stack name
2. Check for linter binaries at the stack's path. First match wins: pint > eslint > prettier > biome (within the relevant ecosystem)
3. Check for test runner binaries at the stack's path. First match wins: pest > vitest > jest > phpunit (within the relevant ecosystem)
4. Store detected values in the stack entry

**CI detection** stays global: check for `.github/workflows/*.yml` at project root.

| Indicator | CI |
|-----------|-----|
| `.github/workflows/` directory has `.yml` files (from dynamic context) | `github-actions` |
| None found | `none` |

Present all detected values and confirm:
```
Detected configuration:
- {stack1} at '{path1}': linter={linter1}, testRunner={runner1}
- {stack2} at '{path2}': linter={linter2}, testRunner={runner2}
CI: {ci} (project-wide)

Does this look right? You can adjust any values.
```

### Step 4: Create .bee/ Directory and config.json

Create the `.bee/` directory and write `.bee/config.json` with the confirmed values.

The `stacks` array contains one entry per each confirmed stack-path pair from Step 2. For single-stack projects, this is a one-element array with `"path": "."`.

**Single-stack example:**
```json
{
  "stacks": [
    { "name": "{detected_stack}", "path": ".", "linter": "{detected_linter}", "testRunner": "{detected_runner}" }
  ],
  "implementation_mode": "quality",
  "ci": "{detected_ci}",
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
  "ship": {
    "max_review_iterations": 3,
    "final_review": true
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
  "stacks": [
    { "name": "laravel-inertia-vue", "path": ".", "linter": "pint", "testRunner": "pest" },
    { "name": "nestjs", "path": "api", "linter": "eslint", "testRunner": "jest" }
  ],
  "implementation_mode": "quality",
  "ci": "github-actions",
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
  "ship": {
    "max_review_iterations": 3,
    "final_review": true
  },
  "quick": {
    "review": false,
    "fast": false
  }
}
```

Replace `{detected_stack}`, `{detected_linter}`, `{detected_runner}`, and `{detected_ci}` with the confirmed values from Steps 2-3. For multi-stack projects, populate the `stacks` array with all confirmed stack-path pairs, each with their own `linter` and `testRunner`.

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

<!-- Valid Phase Status values:
  PENDING       — Phase exists but planning has not started.
  PLANNED       — Phase has been planned; TASKS.md created with task breakdown and waves.
  PLAN_REVIEWED — Phase plan has been reviewed and approved; ready for execution.
  EXECUTING     — Phase is currently being executed; wave-based task implementation in progress.
  EXECUTED      — All tasks in the phase completed; implementation is done.
  REVIEWING     — Code review is in progress for this phase.
  REVIEWED      — Code review complete; all findings resolved or accepted.
  TESTING       — Manual test scenarios are being verified for this phase.
  TESTED        — All test scenarios passed; phase is ready to commit.
  COMMITTED     — Phase changes have been committed to version control.
-->

## Quick Tasks

| # | Description | Date | Commit |
|---|-------------|------|--------|

## Decisions Log

<!-- Structured decision entry format:
  Each entry records an autonomous decision made during ship or plan-all execution.

  Format:
  - **[WHAT]:** Brief description of the decision made.
  - **Why:** Reasoning behind the choice.
  - **Alternative rejected:** What option was considered but not chosen, and why.

  Example:
  - **[Review finding auto-fixed]:** Applied null-check fix to UserService.getProfile return value.
  - **Why:** Bug-detector flagged potential null dereference; fix is mechanical and safe.
  - **Alternative rejected:** Deferring to next phase — finding is in current phase scope and trivial to fix now.
-->

## Last Action
- Command: /bee:init
- Timestamp: {TIMESTAMP}
- Result: Project initialized
```

Replace `{TIMESTAMP}` with the current ISO 8601 timestamp (e.g., `2026-02-20T14:30:00Z`).

### Step 8: Optional CLAUDE.md Update

AskUserQuestion(
  question: "Add BeeDev instructions to CLAUDE.md?",
  options: ["Yes", "No", "Custom"]
)

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

AskUserQuestion(
  question: "Add .bee/ to .gitignore?",
  options: ["Yes", "No", "Custom"]
)

If the user agrees:
- Add `.bee/` to `.gitignore` (the entire directory).
- If `.gitignore` exists, append the entry (avoid duplicates).
- If `.gitignore` does not exist, create it with `.bee/`.

If the user declines, skip this step.

### Step 9.5: Optional User Preferences File

AskUserQuestion(
  question: "Create .bee/user.md for user preferences?",
  options: ["Yes", "No", "Custom"]
)

If the user agrees, create `.bee/user.md` with this minimal template:

```markdown
# User Preferences

> Freeform notes about how you like to work. Loaded into every session and agent context.

## Working Style
<!-- e.g., "I prefer small incremental changes over large refactors" -->

## Communication Preferences
<!-- e.g., "Be concise, skip preambles, use bullet points" -->

## Workflow Overrides
<!-- e.g., "Always run linter before committing", "Skip plan review for quick tasks" -->
```

If the user declines, skip this step.

**Re-init:** If `.bee/user.md` already exists, leave it untouched -- it contains user-authored content. Do not overwrite or modify it. Skip this step silently during re-initialization.

### Step 10: Completion Summary

Display a summary of everything that was created or updated:

```
BeeDev initialized!

Stacks:
- {name} at '{path}' {✓ skill | ⚠ no skill} — linter: {linter}, tests: {testRunner}
- {name} at '{path}' {✓ skill | ⚠ no skill} — linter: {linter}, tests: {testRunner}
{...repeat for each stack}

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

```

AskUserQuestion(
  question: "Bee initialized for [project].",
  options: ["New Spec", "Discuss", "Quick Task", "Custom"]
)

### Step 10.5: Notification Setup

Ask the user: "Would you like to enable push notifications? You'll get notified when long operations finish (phase execution, reviews, background agents)."

Use AskUserQuestion with options:
- "Yes, enable notifications (Recommended)" → proceed with setup
- "No thanks" → skip this step entirely

**If the user declines:** Skip silently. Do not ask again.

**If the user accepts:**

1. **Check if already configured.** Read `~/.claude/settings.json` using Bash (`cat ~/.claude/settings.json 2>/dev/null`). If the file exists AND contains `"Stop"` hooks with `notify` or `osascript` or `notify-send` in any hook command, display: "Notifications already configured!" and skip the rest of this step.

2. **Detect platform and test notification tool:**
   - macOS: run `osascript -e 'display notification "test" with title "Bee"'` — if exit 0, platform supported
   - Linux: run `command -v notify-send` — if found, platform supported. If not found, display: "Install libnotify for notifications: `sudo apt install libnotify-bin` (Ubuntu/Debian) or `sudo dnf install libnotify` (Fedora). Skipping notifications for now." Skip rest of step.
   - Windows (MINGW/MSYS/CYGWIN): run `powershell.exe -Command "echo test"` — if works, platform supported. If not, display: "Windows notifications require PowerShell 5+. Skipping." Skip rest of step.

3. **Resolve the absolute path to notify.sh.** Run via Bash: `echo "${CLAUDE_PLUGIN_ROOT}/scripts/notify.sh"` and store the resolved absolute path as `$NOTIFY_SCRIPT`. This is critical — `$CLAUDE_PLUGIN_ROOT` is only available during plugin execution, not in global user hooks. The absolute path must be embedded in settings.json.

4. **Update `~/.claude/settings.json`.** Read the current file (or start with `{}` if missing). Parse the JSON. Merge these hooks into the `hooks` object WITHOUT overwriting any existing hooks (append to arrays if hooks already exist for these events). Use the resolved `$NOTIFY_SCRIPT` path (NOT the `${CLAUDE_PLUGIN_ROOT}` variable):

   ```json
   {
     "hooks": {
       "Stop": [
         {
           "matcher": "",
           "hooks": [
             {
               "type": "command",
               "command": "{$NOTIFY_SCRIPT} 'Claude Code' 'Task completed'",
               "timeout": 10
             }
           ]
         }
       ],
       "Notification": [
         {
           "matcher": "",
           "hooks": [
             {
               "type": "command",
               "command": "{$NOTIFY_SCRIPT} 'Claude Code' 'Background agent finished'",
               "timeout": 10
             }
           ]
         }
       ],
       "PermissionRequest": [
         {
           "matcher": "",
           "hooks": [
             {
               "type": "command",
               "command": "{$NOTIFY_SCRIPT} 'Claude Code' 'Permission needed'",
               "timeout": 10
             }
           ]
         }
       ]
     }
   }
   ```

   Write the merged JSON back to `~/.claude/settings.json`.

5. **Send test notification.** Run: `bash {$NOTIFY_SCRIPT} "Bee" "Notifications enabled!"` via Bash.

6. **Display:** "Notifications enabled. You'll be notified when tasks complete, agents finish, and permissions are needed."

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
