---
name: claude-code-plugin
description: Claude Code plugin (bee) development conventions and patterns
---

# Claude Code Plugin Standards

These standards apply when the project stack is `claude-code-plugin`. All agents and implementations must follow these conventions. This stack governs the development of Claude Code plugins -- collections of commands, agents, skills, hooks, and scripts that extend the Claude Code CLI.

## Architecture

A Claude Code plugin is a directory-based package with a well-defined structure. The plugin manifest at `.claude-plugin/plugin.json` declares metadata (name, version, description, author, repository). The functional components are organized into five categories:

- **Commands** (`commands/*.md`): User-facing slash commands. Each file defines one command. Commands orchestrate workflows by spawning agents, reading state files, and coordinating multi-step pipelines. Commands are the conductors -- they make decisions, interact with the user, and delegate work to agents.
- **Agents** (`agents/*.md`): Specialized workers spawned by commands via the Task tool. Each agent has a single responsibility (research, implement, review, fix). Agents receive context packets from the conductor and return structured output. Some agents are read-only (reviewers, detectors) and some are write-capable (implementer, fixer).
- **Skills** (`skills/**/*.md`): Knowledge documents loaded into agent context via the `skills:` frontmatter list. Skills define conventions, patterns, and standards. They are organized into `core/`, `standards/`, `stacks/`, `context7/`, and `review/` directories.
- **Hooks** (`hooks/hooks.json`): Event-driven automation. Hooks fire on lifecycle events (SessionStart, SubagentStart, SubagentStop, PreToolUse, PostToolUse, Stop, PreCompact, SessionEnd). Each hook entry has a matcher (regex pattern matching agent names or tool names) and an array of hook actions (command scripts or prompt injections).
- **Scripts** (`scripts/*.sh`, `scripts/*.js`): Shell and Node.js scripts invoked by hooks or commands. Scripts handle tasks that need filesystem access, JSON processing, or external tool integration (linting, memory injection, statusline updates).

State is tracked on disk in the `.bee/` directory within the user's project:
- `STATE.md` -- current spec, phase progress, decisions log, last action
- `TASKS.md` -- per-phase execution contract with tasks, waves, acceptance criteria, research notes, agent notes
- `config.json` -- project configuration (stacks, linter, test runner, CI, review settings)
- `memory/` -- per-agent persistent knowledge files
- `PROJECT.md` -- auto-generated codebase index

## Commands

Commands are Markdown files in `commands/` with YAML frontmatter and prose instructions.

### Frontmatter fields

- `description:` -- one-line summary of what the command does (required)
- `argument-hint:` -- usage hint shown in autocomplete, e.g. `"[phase-number]"` or `"[--loop]"` (optional)

### Conventions

- Commands begin with a dynamic context section that reads state files (STATE.md, config.json) before proceeding.
- Validation guards run first: check initialization, spec existence, phase status. Stop immediately if any guard fails.
- Commands never write production code directly. They orchestrate by spawning agents, collecting results, and updating state files.
- Commands never auto-commit. The user decides when to commit via `/bee:commit`.
- Commands handle user interaction (confirmations, choices, option menus). Agents handle work.
- Steps are numbered sequentially within the Instructions section.
- Design Notes at the bottom (after the `---` rule) capture rationale for the conductor but are not displayed to the user.

## Agents

Agents are Markdown files in `agents/` with YAML frontmatter and structured instructions.

### Frontmatter fields

- `name:` -- agent identifier, kebab-case (required)
- `description:` -- one-line summary (required)
- `tools:` -- comma-separated list of tools the agent can use (required)
- `color:` -- terminal color for the agent's output (required)
- `model:` -- always `inherit` (the conductor overrides at spawn time) (required)
- `skills:` -- YAML block sequence of skill names to load (required)

### Read-only vs write-capable agents

Read-only agents (bug-detector, pattern-reviewer, stack-reviewer, plan-compliance-reviewer, finding-validator, integrity-auditor, test-auditor, plan-reviewer, project-reviewer) only have `Read, Glob, Grep` and optionally MCP tools. They analyze code but never create or modify files. Their output is structured findings in a defined format.

Write-capable agents (implementer, fixer, researcher, spec-writer, phase-planner, spec-shaper, test-planner) have `Read, Write, Edit, Bash, Grep, Glob` and produce file changes or state updates.

### Conventions

- Every agent begins with a "Read Stack Skill" step that reads config.json and the matching stack skill.
- Agents that persist knowledge have a "Project Memory" section describing what to write to `.bee/memory/{agent-name}.md`.
- Instructions use numbered steps for the workflow.
- Each agent ends with IMPORTANT notices (block capital) that enforce constraints. Read-only agents always end with notices like "You do NOT modify code. You are read-only."
- Agents report structured output in their final message (task notes, fix reports, findings sections) that the conductor parses.
- The `skills:` list uses YAML block sequence format with each skill on its own line prefixed by `  - `.
- Agents receive context from the conductor via the Task tool prompt. Context packets include file paths (not contents), acceptance criteria, research notes, and dependency notes.
- The SubagentStop hook validates agent output format and compliance when the agent completes.

## Skills

Skills are Markdown files in `skills/` subdirectories with YAML frontmatter. They provide domain knowledge to agents.

### Frontmatter fields

- `name:` -- skill identifier, kebab-case (required)
- `description:` -- one-line summary (required)

### Directory structure

- `core/SKILL.md` -- workflow rules, file format references, TDD mandate, agent memory system
- `core/templates/` -- Markdown and JSON templates for state files, reports, task lists
- `standards/global/SKILL.md` -- universal coding standards (naming, DRY, KISS, error handling, git)
- `standards/testing/SKILL.md` -- TDD standards, test naming, mocking strategy, gap analysis
- `standards/backend/SKILL.md` -- backend-specific standards
- `standards/frontend/SKILL.md` -- frontend-specific standards
- `stacks/{stack-name}/SKILL.md` -- framework-specific conventions for each supported stack
- `context7/SKILL.md` -- Context7 MCP usage patterns and library ID lookup table
- `review/SKILL.md` -- review pipeline knowledge for review agents

### Conventions

- Stack skills follow a consistent structure: title, intro paragraph, then domain sections, then the five enrichment sections (Must-Haves, Good Practices, Common Bugs, Anti-Patterns, Standards), then Context7 Instructions as the final section.
- Skills use progressive disclosure: start with the most important conventions, then detail patterns, then edge cases and gotchas.
- Skills contain prose instructions and examples, not pseudocode. Code examples are concrete and copy-ready.
- New stack skills are added by creating `skills/stacks/{stack-name}/SKILL.md` and adding the stack identifier to the init command's detection table.

## Hook Script Patterns

### Command hooks (shell/JS scripts)

Hook scripts receive data via stdin and output JSON to stdout. Exit 0 always — non-zero blocks the lifecycle event.

```bash
#!/bin/bash
# Pattern: SubagentStart hook script
INPUT=$(cat)  # Read stdin JSON
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty' | sed 's/^bee://')

# Do work (inject context, validate, etc.)
CONTEXT="Additional context for agent"

# Output JSON with hookSpecificOutput
printf '%s' "$CONTEXT" | jq -Rs '{
  hookSpecificOutput: {
    hookEventName: "SubagentStart",
    additionalContext: .
  }
}'
exit 0
```

### Prompt hooks (SubagentStop validators)

SubagentStop hooks use `type: "prompt"` to validate agent output. The prompt receives `$ARGUMENTS` (JSON with agent metadata and `last_assistant_message`). Must respond with `{"ok": true}` or `{"ok": false, "reason": "..."}`.

```json
{
  "matcher": "^agent-name$",
  "hooks": [{
    "type": "prompt",
    "prompt": "Validate agent output. $ARGUMENTS\n\nCheck: 1) Has required heading 2) Has structured data 3) No unauthorized modifications.\n\nRespond {\"ok\": true} or {\"ok\": false, \"reason\": \"...\"}.",
    "timeout": 30
  }]
}
```

Key validator checks per agent type:
- **Implementer:** TDD red-green verified, test output evidence pasted, deviations section present, completion signal
- **Reviewers (read-only):** Finding format correct (ID, severity, file:line, evidence, impact), no files modified
- **Fixer:** Fix report with finding ID, status, files changed, root cause, test results

### Matcher patterns

Matchers are JavaScript regex. Use suffix patterns for stack-variant coverage:
- `(?<!quick-)implementer$` — matches `implementer` and `laravel-inertia-vue-implementer` but NOT `quick-implementer`
- `(?<!audit-)bug-detector$` — matches `bug-detector` and stack variants but NOT `audit-bug-detector`
- `^fixer$` — exact match only

## Agent Context Packets

When a conductor spawns an agent via the Task tool, it assembles a context packet in the prompt. The packet structure varies by agent type:

### Implementer context packet

```
Task: {task_id} — {task_description}
Phase: {phase_number} — {phase_name}
Acceptance Criteria: {criteria from TASKS.md}
Research Notes: {research section from TASKS.md}
Context Files: {list of file paths to read}
Stack: {stack_name} — read skills/stacks/{stack}/SKILL.md
Dependency Notes (Wave 2+ only): {task notes from dependency tasks}
```

### Review agent context packet

```
Phase: {phase_number} — {phase_name}
Files to Review: {list of created/modified file paths from TASKS.md}
Spec: {spec path}
Stack: {stack_name}
Context Cache: {stack skill path, CONTEXT.md path, false-positives.md path, user.md path}
```

Conductors pass file PATHS, not contents. Agents read files in their own context window at runtime.

## Test Patterns

Plugin tests are plain Node.js scripts with no test runner dependency:

```js
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;

function assert(condition, name) {
  if (condition) { passed++; console.log(`  PASS: ${name}`); }
  else { failed++; console.log(`  FAIL: ${name}`); }
}

// Read the file under test
const content = fs.readFileSync(path.join(__dirname, '../../commands/my-command.md'), 'utf8');

// Assertions
assert(content.includes('## Instructions'), 'Has Instructions section');
assert(content.includes('AskUserQuestion'), 'Uses interactive menu');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

Test files live in `scripts/tests/`. Run all: `find scripts/tests -name "*.test.js" -exec node {} \;`

## Must-Haves

- Read-only agents (reviewers, detectors, validators, auditors) must not write code -- their tools list excludes Write, Edit, and Bash (except when Bash is needed for read-only operations). Agents must not create or modify source files.
- Read-only agents must end with IMPORTANT notices that explicitly state "You do NOT modify code. You are read-only. Report findings only." or equivalent constraint language.
- Commands must not auto-commit. No command or agent may run `git commit` or `git add` automatically. The user controls commits exclusively via `/bee:commit`.
- When a new agent is added, it must be registered in two places: the SubagentStart matcher in `hooks/hooks.json` (so inject-memory.sh fires for it) and the case statement in `scripts/inject-memory.sh` (so it receives memory context).
- The SubagentStop hook validates every agent's structured output. Each agent type has a dedicated SubagentStop matcher entry in hooks.json with a prompt that checks format compliance, output structure, and constraint adherence.
- Never hardcode framework-specific rules in agents. Framework conventions belong in stack skills (`skills/stacks/{stack}/SKILL.md`). Agents read the stack skill at runtime based on config.json. This keeps agents stack-agnostic and reusable.
- All state lives on disk. Agents and commands must read STATE.md, TASKS.md, and config.json from disk before acting. Never rely on conversation memory for project state.
- The conductor (parent command) is the sole writer to TASKS.md during execution. Agents report notes in their final message; the conductor extracts and writes them. This prevents parallel write conflicts.

## Good Practices

- Maintain consistent frontmatter format across all commands, agents, and skills. Commands use `description:` and `argument-hint:`. Agents use `name:`, `description:`, `tools:`, `color:`, `model:`, `skills:`. Skills use `name:`, `description:`.
- Use numbered steps in agent instructions for clear workflow sequencing. Steps like "1. Read Stack Skill", "2. Understand Your Task", "3. TDD Cycle" give agents a deterministic path to follow.
- Context packets assembled by conductors include file paths, not file contents. Agents read files within their own context window at runtime. This keeps conductor context lean (~30% of agent window per task).
- Apply progressive disclosure in skills: most important conventions first, detailed patterns next, edge cases and gotchas last. This mirrors how agents consume information -- they need the rules before the examples.
- Use the hand-rolled assert pattern for plugin tests (no test runner dependency). Tests are Node.js scripts with a simple `assert(condition, name)` function, a pass/fail counter, and `process.exit(failed > 0 ? 1 : 0)`.
- Use the Read-Modify-Write pattern when updating shared state files (STATE.md, TASKS.md, REVIEW.md). Always re-read from disk before each write to avoid stale overwrites, especially during parallel agent execution.
- Document design rationale in Design Notes sections (after `---` at the bottom of commands). These notes explain why the pipeline works the way it does without cluttering the user-facing instructions.
- Spawn agents with explicit model selection. Structured/scanning work gets `model: "sonnet"`. Code-writing and deep reasoning work inherits the parent model. This balances cost and quality.

## Common Bugs

- SubagentStart matcher in hooks.json missing a newly added agent. When adding a new agent file to `agents/`, the matcher regex in the SubagentStart hook entry must be updated to include the new agent name. If omitted, inject-memory.sh will not fire and the agent will not receive project memory.
- Step renumbering in agents breaking internal cross-references. When inserting or removing a step in an agent's numbered workflow, other steps that reference "Step N" by number become stale. Always search for internal references before renumbering.
- hooks.json trailing commas causing JSON parse errors. JSON does not allow trailing commas after the last element in arrays or objects. Adding a new hook entry and leaving a trailing comma after it will silently break hook loading.
- Stale research notes referencing outputs from parallel tasks that have not yet completed. In Wave N+1, a task's `needs:` field points to Wave N tasks. If research notes reference a file that a dependency task is expected to create but the dependency failed, the implementer will encounter missing files.
- Test files placed in subdirectories instead of being colocated with the test runner's expected location. Plugin tests live in `scripts/tests/` and are plain Node.js scripts. Placing them elsewhere (e.g., a `__tests__/` directory) means the existing test patterns will not find them.
- Missing `exit 0` at the end of hook scripts. SubagentStart hooks must always exit 0 -- a non-zero exit code blocks subagent creation. Even when a script has nothing to output, it must exit cleanly.
- Forgetting to update the `case` statement in inject-memory.sh AND the SubagentStart matcher in hooks.json when adding a new agent. Both must be updated; updating only one leaves the agent partially registered.

## Anti-Patterns

- Spawning fixer agents in parallel. Fixers modify source files and must run sequentially (one at a time). Parallel fixer spawning causes file conflicts where one fixer's changes overwrite another's. The review command enforces sequential fixer execution.
- Auto-approving plans without user confirmation. The user must review and confirm the phase plan before execution begins. Commands that skip user confirmation violate the "user stays in control" principle.
- Writing production code in command files. Commands are orchestrators -- they spawn agents, read state, update state, and interact with the user. Implementation logic belongs in agents (implementer, fixer). Commands should never use Write or Edit tools on source files.
- Agents reading full file contents into context packets instead of file paths. Context packets should contain paths that agents read at runtime. Embedding file contents bloats the conductor's context and leaves agents with stale snapshots if files change between conductor assembly and agent execution.
- Spawning agents without proper context packets. Each agent needs enough context to work independently (task description, acceptance criteria, research notes, file paths). Under-specified context leads to agents guessing or producing incorrect output.
- Hardcoding stack-specific conventions in agent instructions. An agent that says "use Vue Composition API" or "use Laravel FormRequest" is stack-coupled. Stack conventions belong in stack skills, loaded via the `skills:` frontmatter list.
- Using conversation memory instead of disk state. Relying on what was "discussed earlier" rather than reading STATE.md or TASKS.md from disk leads to drift, especially after context compaction or session restart.

## Standards

- Use kebab-case for all file names: `bug-detector.md`, `inject-memory.sh`, `execute-phase.md`, `project-config.json`. Exceptions: `SKILL.md` (convention for skill entry points), `STATE.md`, `TASKS.md`, `REVIEW.md`, `PROJECT.md` (all-caps state files).
- Use YAML block sequence format for the `skills:` list in agent frontmatter. Each skill is on its own indented line prefixed with `- `:
  ```yaml
  skills:
    - core
    - testing
    - context7
  ```
- Write agent and command instructions as markdown prose, not pseudocode. Instructions describe what to do in natural language with numbered steps. Code examples in skills are concrete and framework-specific, not abstract pseudocode.
- The Context7 Instructions section must be the last H2 section in every stack skill. This is a structural convention so agents know where to find Context7 library identifiers.
- Follow the five enrichment sections pattern in all stack skills: Must-Haves, Good Practices, Common Bugs, Anti-Patterns, Standards. These sections appear after the domain-specific content and before Context7 Instructions.
- Agent frontmatter uses `model: inherit` -- the conductor decides the model at spawn time based on work complexity. Never hardcode a specific model in agent frontmatter.
- Hook scripts use `${CLAUDE_PLUGIN_ROOT}` for plugin-relative paths. Never hardcode absolute paths to plugin files in hooks.json.
- State files use a consistent naming convention: all-caps with `.md` extension for tracking files (STATE.md, TASKS.md, REVIEW.md), lowercase kebab-case for config (config.json, false-positives.md).

## Context7 Instructions

This stack does not use external framework libraries that require Context7 documentation lookups. The Claude Code plugin is a self-contained system of Markdown files, shell scripts, and Node.js scripts.

If Context7 is enabled in the project config, it can be used for:

- **Node.js APIs:** `nodejs/node` -- for fs, path, child_process, and other built-in module usage in hook scripts
- **Bash scripting:** reference standard POSIX shell patterns for hook scripts
- **JSON schema:** when working with hooks.json structure or plugin.json manifest

Since the plugin primarily consists of Markdown prose and simple scripts, Context7 lookups are rarely needed. Prefer reading existing plugin files as pattern references over querying external documentation.
