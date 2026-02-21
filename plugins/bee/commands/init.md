---
description: Initialize BeeDev for a project -- detect stack, create .bee/, configure workflow
argument-hint: ""
---

## Project Detection (load before proceeding)

Read these files using the Read tool:
- `package.json` — if not found: NO_PACKAGE_JSON
- `composer.json` — if not found: NO_COMPOSER_JSON
- `.bee/config.json` — if not found: NO_EXISTING_CONFIG

Use Glob to check for `.github/workflows/*.yml`:
- If no matches: NO_CI_CONFIG

## Instructions

You are running `/bee:init` -- the first-time setup command for BeeDev. Follow these steps in order. Ask the user for confirmation at each decision point. Never make assumptions -- detect and confirm.

### Step 1: Check for Existing Project (Re-init Handling)

If the dynamic context above does NOT contain `NO_EXISTING_CONFIG` (meaning `.bee/config.json` already exists), this is a **re-initialization**:

- Inform the user: "Existing BeeDev project detected. I'll update your config without touching existing specs or state."
- Proceed through detection steps below but only update `.bee/config.json` values (stack, linter, testRunner, ci).
- Do NOT overwrite `.bee/STATE.md`, `.bee/specs/`, or any other existing state files.
- Skip the CLAUDE.md and .gitignore steps (those were handled on first init).

If `NO_EXISTING_CONFIG` appears, this is a fresh init -- proceed with all steps.

### Step 2: Stack Detection

Parse the injected `package.json` and `composer.json` to detect the project's technology stack. Apply these detection rules:

| Condition | Stack Identifier |
|-----------|-----------------|
| `composer.json` has `laravel/framework` AND `package.json` has `vue` | `laravel-inertia-vue` |
| `composer.json` has `laravel/framework` AND `package.json` has `react` | `laravel-inertia-react` |
| `package.json` has `react` (but NOT `next` and NOT `expo`) | `react` |
| `package.json` has `next` | `nextjs` |
| `package.json` has `@nestjs/core` | `nestjs` |
| `package.json` has `expo` AND `react-native` | `react-native-expo` |

**Important:** Show ALL detected possibilities and let the user pick one. Do not guess or auto-select.

If nothing is detected (both files missing or no matching patterns), present the full list of supported stacks and ask the user to choose:
- `laravel-inertia-vue`
- `laravel-inertia-react`
- `react`
- `nextjs`
- `nestjs`
- `react-native-expo`

Ask: "I detected the following stack(s): [list]. Which one should I use for this project?"

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

Create the `.bee/` directory and write `.bee/config.json` with the confirmed values:

```json
{
  "version": "0.1.0",
  "stack": "{STACK}",
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
  }
}
```

Replace `{STACK}`, `{LINTER}`, `{TEST_RUNNER}`, and `{CI}` with the confirmed values from Steps 2-3.

### Step 5: Create STATE.md

Create `.bee/STATE.md` with the initial state:

```markdown
# Bee Project State

## Current Spec
- Name: (none)
- Path: (none)
- Status: NO_SPEC

## Phases
| # | Name | Status | Plan | Executed | Reviewed | Tested | Committed |
|---|------|--------|------|----------|----------|--------|-----------|

## Decisions Log

## Last Action
- Command: /bee:init
- Timestamp: {TIMESTAMP}
- Result: Project initialized
```

Replace `{TIMESTAMP}` with the current ISO 8601 timestamp (e.g., `2026-02-20T14:30:00Z`).

### Step 6: Optional CLAUDE.md Update

Ask the user: "Should I add BeeDev instructions to your CLAUDE.md?"

If the user agrees:
- If `CLAUDE.md` exists, **append** (do not overwrite) the following section:
- If `CLAUDE.md` does not exist, create it with just this content:

```markdown
# BeeDev
Stack: {selected-stack}
Use /bee:new-spec to start a new feature.
Use /bee:progress to see current state.
Always use Context7 MCP for framework documentation lookups.
```

Replace `{selected-stack}` with the stack chosen in Step 2.

If the user declines, skip this step.

### Step 7: Optional .gitignore Update

Ask the user: "Should I add .bee transient files to .gitignore?"

Show what would be ignored:
```
.bee/STATE.md
.bee/SESSION-CONTEXT.md
.bee/eod-reports/
```

If the user agrees:
- If `.gitignore` exists, append these entries (avoid duplicates).
- If `.gitignore` does not exist, create it with these entries.

If the user declines, skip this step.

### Step 8: Completion Summary

Display a summary of everything that was created or updated:

```
BeeDev initialized!

Stack: {stack}
Linter: {linter}
Test runner: {testRunner}
CI: {ci}

Created:
- .bee/config.json
- .bee/STATE.md
{- CLAUDE.md (if updated)}
{- .gitignore (if updated)}

Next step:
  /clear
  /bee:new-spec
```
