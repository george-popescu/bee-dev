# Bee - Spec-Driven Development Workflow

A Claude Code plugin that enforces disciplined, spec-driven development with TDD, parallel agent execution, persistent agent memory, multi-stack support, and review gates.

## What Bee Does

Bee structures your development workflow into a lifecycle: **Spec > Plan > Execute > Review > Test > Commit**. Each step produces artifacts on disk, every feature goes through review gates, and 22 specialized agents handle different aspects of the work.

## Commands (24)

### Setup & Navigation
| Command | Args | Description |
|---------|------|-------------|
| `/bee:init` | | Initialize Bee for a project — detect stack, create `.bee/`, configure workflow, enable notifications |
| `/bee:progress` | | Show project state, phase progress, and suggest next action |
| `/bee:resume` | | Resume work from previous session with full context restoration |
| `/bee:compact` | | Smart compact — preserve bee context, then compress conversation |
| `/bee:memory` | | View accumulated agent memories for the current project |
| `/bee:refresh-context` | | Re-run codebase context extraction, overwriting CONTEXT.md with fresh analysis |
| `/bee:create-agent` | `[agent-name]` | Create a custom project-local agent extension for bee |
| `/bee:create-skill` | `[skill-name]` | Create a custom project-local skill extension for bee |
| `/bee:update` | | Update bee statusline and clean up legacy local copies |

### Specification
| Command | Args | Description |
|---------|------|-------------|
| `/bee:new-spec` | `[--amend] [--from-discussion PATH] [description]` | Create or amend a feature spec through brainstorming-style adaptive discovery (no fixed round limit) with spec review loop |
| `/bee:plan-phase` | `[phase-number]` | Plan a phase with tasks, acceptance criteria, research, wave grouping, and auto-fix review loop |
| `/bee:plan-review` | `[phase-number]` | Standalone plan review — find gaps, auto-fix, re-review |
| `/bee:add-phase` | | Append a new phase to the current spec |
| `/bee:discuss` | `[topic description]` | Guided brainstorming-style codebase-grounded discussion before creating a spec |

### Execution
| Command | Args | Description |
|---------|------|-------------|
| `/bee:execute-phase` | `[phase-number]` | Execute a phase with wave-based parallel TDD agents |
| `/bee:quick` | `[--fast] [--amend N] [--review] [description]` | Fast-track task — TDD default, `--fast` for direct, `--amend` to modify existing, `--review` for 4-agent review |

### Quality
| Command | Args | Description |
|---------|------|-------------|
| `/bee:review` | `[--loop]` | Multi-agent parallel review (4 specialists) with finding validation, escalation, and auto-fix |
| `/bee:review-implementation` | | Context-aware review — full spec mode (4 agents per stack) or ad-hoc mode (3 agents) |
| `/bee:fix-implementation` | `[path/to/REVIEW.md]` | Standalone fix — reads review output and fixes confirmed findings sequentially |
| `/bee:test` | | Generate manual test scenarios and verify with developer |
| `/bee:test-e2e` | `[description] [--run]` | Generate and run Playwright E2E tests with Page Object Model |

### Finalization
| Command | Args | Description |
|---------|------|-------------|
| `/bee:commit` | | Show diff summary and create a commit with user approval |
| `/bee:archive-spec` | | Archive completed spec, reset STATE.md, bump plugin version |
| `/bee:eod` | | End-of-day integrity check with 4 parallel audits |

## Workflows

### Full Feature Workflow (Spec to Done)

```
1. /bee:init                    # One-time project setup (stack detection, notifications, context extraction)
2. /bee:discuss                 # Optional: brainstorm ideas before formal spec
3. /bee:new-spec                # Adaptive discovery, spec-writer, spec-review loop
4. /bee:plan-phase 1            # 3-pass planning (decompose → research → waves) + auto-fix review loop
5. /bee:execute-phase 1         # Parallel TDD implementation (wave-based)
6. /bee:review                  # 4-agent review + validate + auto-fix
7. /bee:test                    # Manual test scenarios
8. /bee:test-e2e                # Optional: Playwright E2E tests
9. /bee:commit                  # Reviewed commit
   --- repeat steps 4-9 for each phase ---
10. /bee:review-implementation  # Final spec compliance check
11. /bee:archive-spec           # Archive and reset
```

### Quick Task Workflow (No Spec)

```
/bee:quick fix the login button alignment     # TDD default (researcher + implementer agents)
/bee:quick --fast fix the button color         # Direct mode (inline, no agents)
/bee:quick --amend 3                           # Modify existing quick task plan #3
/bee:quick --review refactor auth middleware    # Execute + 4-agent review before commit
```

## Agents (22)

### Core Agents
| Agent | Role | Model |
|-------|------|-------|
| **implementer** | TDD full-stack implementation with defense-in-depth | inherit |
| **quick-implementer** | TDD-enforced implementer for quick tasks | inherit |
| **fixer** | Minimal targeted fixes with root cause investigation | inherit |
| **researcher** | Codebase patterns, Context7 docs, reusable code | inherit |
| **spec-writer** | Write spec and phase breakdown from requirements | inherit |
| **spec-shaper** | Interactive requirements gathering (amend mode) | inherit |
| **spec-reviewer** | Validate spec completeness, consistency, clarity, YAGNI | inherit |
| **phase-planner** | Decompose phases into tasks and waves | inherit |
| **plan-reviewer** | Review plan coverage against spec | inherit |
| **discuss-partner** | Codebase-grounded brainstorming (scan + write-notes modes) | inherit |
| **context-builder** | Scan codebase, extract patterns into CONTEXT.md | inherit |

### Review Agents (4 Specialists)
| Agent | Role | Model |
|-------|------|-------|
| **bug-detector** | Bugs, logic errors, security vulnerabilities | inherit |
| **pattern-reviewer** | Deviations from established project patterns | inherit |
| **plan-compliance-reviewer** | Spec compliance, cross-phase integration, requirements tracking | inherit |
| **stack-reviewer** | Stack-specific best practice violations (dynamically loaded skill) | inherit |
| **finding-validator** | Classify findings as real bug / false positive / stylistic | inherit |

### Audit Agents
| Agent | Role | Model |
|-------|------|-------|
| **test-planner** | Generate manual test scenarios | inherit |
| **test-auditor** | Audit test suite health | inherit |
| **integrity-auditor** | Verify STATE.md matches disk reality | inherit |

### Stack-Specific Agents
| Agent | Stack | Role |
|-------|-------|------|
| **laravel-inertia-vue-bug-detector** | laravel-inertia-vue | Stack-specific bug detection |
| **laravel-inertia-vue-pattern-reviewer** | laravel-inertia-vue | Stack-specific pattern review |
| **laravel-inertia-vue-implementer** | laravel-inertia-vue | Stack-specific TDD implementation |

## Implementation Modes

Three modes control which model tier each agent uses:

| Agent Role | Economy | Quality (default) | Premium |
|-----------|---------|-------------------|---------|
| Scanning/planning (researcher, planner, spec-writer, etc.) | sonnet | sonnet | opus |
| Critical (implementer, review agents, fixer, finding-validator) | sonnet | opus | opus |

Set via `config.implementation_mode` in `.bee/config.json` or during `/bee:new-spec` discovery.

## Stack Skills (10)

| Stack | Detection | Words | Notes |
|-------|-----------|-------|-------|
| **laravel-inertia-vue** | composer.json + vue | 5,428 | Gold standard. 3 stack-specific agents |
| **laravel-inertia-react** | composer.json + react | 5,162 | React 19, useForm, Inertia deep dive |
| **nestjs** | @nestjs/core | 4,320 | Custom decorators, Prisma/TypeORM, GraphQL, Swagger |
| **vue** | package.json has vue (no Laravel) | 4,146 | Composition API, Pinia, Vue Router 4, VeeValidate+Zod |
| **nextjs** | package.json has next | 3,597 | App Router, Server Actions, Next.js 15 caching |
| **react** | package.json has react (no next/expo) | 3,311 | React 19 hooks, Router v7, Suspense, state detection |
| **angular** | @angular/core | 2,416 | Signals, standalone, OnPush, inject(), modern control flow |
| **react-native-expo** | expo + react-native | 2,308 | Expo Router, native modules, platform-specific patterns |
| **kmp-compose** | build.gradle.kts multiplatform | 2,227 | Compose Multiplatform, Voyager, Koin, Ktor |
| **claude-code-plugin** | manual | 2,366 | Meta-stack for developing bee itself |

### Library Skills (Auto-Detected)

| Library | Detection | Notes |
|---------|-----------|-------|
| **shadcn-ui** | `components.json` or `@/components/ui/` | Component patterns, theming, cn() utility, composition |
| **nestjs-rabbitmq** | `@nestjs/microservices` + `amqplib` | Transport config, message patterns, ACK, DLQ, CQRS |
| **playwright** | Invoked by `/bee:test-e2e` | POM, fixtures, selectors, assertions, auth, network mocking |

### Standard Skills (Always Active)

| Skill | Scope | Notes |
|-------|-------|-------|
| **frontend-standards** | All frontend stacks | Component architecture, a11y, responsive, design quality, CSS methodology |
| **core** | All agents | TDD Iron Law, disk-is-truth, no auto-commit, agent memory, model delegation |

## Hooks

| Event | Purpose |
|-------|---------|
| **SessionStart** | Load project context (STATE.md, config) + configure statusline |
| **PostToolUse** | Auto-lint modified files after Write/Edit |
| **PreToolUse** | Pre-commit validation gate — linter + test checks |
| **PreCompact** | Snapshot session context before compaction |
| **SubagentStart** | Inject agent memory (cross-platform, strips `bee:` prefix) |
| **SubagentStop** | Validate agent output — 13 role-specific validators (TDD red-green cycle, output format, completeness) |
| **Stop** | Check for unreviewed executed phases |
| **SessionEnd** | Warn about memory files approaching limits |

## Notifications (Optional)

`/bee:init` offers to enable native push notifications:
- **macOS**: osascript (built-in)
- **Linux**: notify-send (requires libnotify)
- **Windows**: PowerShell toast notifications

Events: task completed (Stop), background agent finished (Notification), permission needed (PermissionRequest).

## Configuration

```json
{
  "version": "0.1.0",
  "stacks": [
    { "name": "laravel-inertia-vue", "path": "." },
    { "name": "nestjs", "path": "api" }
  ],
  "implementation_mode": "quality",
  "linter": "pint",
  "testRunner": "pest",
  "ci": "github-actions",
  "context7": true,
  "review": {
    "against_spec": true,
    "against_standards": true,
    "dead_code": true,
    "loop": false,
    "max_loop_iterations": 3
  },
  "phases": { "require_review_before_next": true },
  "quick": { "review": false, "fast": false }
}
```

## License

MIT
