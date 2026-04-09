---
name: guide
description: Bee workflow intelligence -- decision trees, command routing by intent, smart feature suggestions, anti-patterns. Teaches Claude HOW to use Bee, not just which commands exist.
---

# Bee Mastery Guide

This guide teaches you to use Bee intelligently -- when to suggest commands, what to recommend proactively, and what to never do. Complements `do.md` (keyword matching) and `help.md` (command reference) with workflow intelligence.

## 1. Workflow Decision Tree

### Spec-Level States

| Spec Status | Condition | Suggest | Why |
|-------------|-----------|---------|-----|
| NO_SPEC | No uncommitted changes | `/bee:new-spec` | Start a new feature |
| NO_SPEC | Uncommitted changes | `/bee:review-implementation` | Review existing work first |
| SPEC_CREATED | -- | `/bee:plan-phase 1` | Plan the first phase |
| IN_PROGRESS | See phase table below | (varies) | Phase-dependent |
| COMPLETED | -- | `/bee:complete-spec` | Run completion ceremony |
| ARCHIVED | -- | `/bee:new-spec` | Start fresh |

### Phase-Level Substates (within IN_PROGRESS)

| Phase Status | Suggest | Notes |
|--------------|---------|-------|
| PENDING | `/bee:plan-phase N` | Must plan before execute |
| PLANNED | `/bee:plan-review` | Review plan quality first |
| PLAN_REVIEWED | `/bee:execute-phase N` | Ready to build |
| EXECUTING | `/bee:execute-phase N` | Resume interrupted execution |
| EXECUTED | `/bee:review` | Per-phase review (NOT review-implementation) |
| REVIEWING | `/bee:review` | Resume interrupted review |
| REVIEWED | `/bee:test` | Generate test scenarios |
| TESTING | `/bee:test` | Resume testing |
| TESTED | `/bee:commit` | All verified, safe to commit |
| COMMITTED | `/bee:plan-phase N+1` | Next phase, or complete-spec if last |

### Multi-Phase Intelligence

| Condition | Suggest | Why |
|-----------|---------|-----|
| 3+ phases remain unplanned | `/bee:plan-all` | Batch plan saves time |
| All phases PLAN_REVIEWED | `/bee:autonomous` or `/bee:ship` | Batch execute with review loops |
| Urgent bug mid-execution | `/bee:insert-phase N.1` | Decimal phase insertion |
| Multiple independent features | `/bee:workspace new` | Parallel worktrees |
| All phases COMMITTED | `/bee:complete-spec` | Full ceremony (audit + changelog + tag + archive) |

## 2. Command Reference by Intent

### Start Something
| Intent | Command | When |
|--------|---------|------|
| New feature (vague idea) | `/bee:discuss` then `/bee:new-spec` | Explore before defining |
| New feature (clear requirements) | `/bee:new-spec` | Requirements already known |
| Quick bug fix or small change | `/bee:quick` | Single-phase fast loop |
| Defer an idea for later | `/bee:seed` | Capture with trigger conditions |

### Plan Work
| Intent | Command |
|--------|---------|
| Break phase into tasks | `/bee:plan-phase N` |
| Review plan quality | `/bee:plan-review` |
| Plan all remaining phases | `/bee:plan-all` |
| Add phase to spec | `/bee:add-phase` |
| Insert urgent phase mid-spec | `/bee:insert-phase N.1` |
| UI design contract | `/bee:ui-spec` |

### Build
| Intent | Command |
|--------|---------|
| Execute planned phase | `/bee:execute-phase N` |
| Run everything hands-free | `/bee:autonomous` (plan+execute+review per phase) |
| Execute + review + commit all | `/bee:ship` (for PLAN_REVIEWED phases) |
| Work on two features at once | `/bee:workspace new {name}` |

### Review and Fix
| Intent | Command | Scope |
|--------|---------|-------|
| Per-phase code review | `/bee:review` | Single phase |
| Multi-agent deep review | `/bee:swarm-review` | Segmented parallel |
| Cross-phase compliance | `/bee:review-implementation` | All executed phases |
| Fix confirmed findings | `/bee:fix-implementation` | Apply fixes |
| Visual/UI audit | `/bee:ui-review` | 6-pillar visual |

### Test
| Intent | Command |
|--------|---------|
| Manual test scenarios | `/bee:test` |
| Generate tests from requirements | `/bee:test-gen` |
| E2E Playwright tests | `/bee:test-e2e` |

### Audit
| Intent | Command |
|--------|---------|
| Full 10-agent codebase audit | `/bee:audit` |
| Convert audit to spec | `/bee:audit-to-spec` |
| Spec traceability matrix | `/bee:audit-spec` |

### Debug and Diagnose
| Intent | Command | Use When |
|--------|---------|----------|
| Systematic bug investigation | `/bee:debug` | Complex, multi-symptom bug |
| Stuck/failed workflow diagnosis | `/bee:forensics` | Workflow anomaly, not code bug |
| Project health diagnostics | `/bee:health` | 13-check structural validation |
| Forensics found root cause | Forensics handoff | Transitions to debug with pre-populated symptoms |

### Session Management
| Intent | Command |
|--------|---------|
| Check progress | `/bee:progress` |
| Auto-suggest next step | `/bee:next` |
| Pause work for later | `/bee:pause` |
| Resume after break | `/bee:resume` |
| Quick note capture | `/bee:note` |
| Cross-session knowledge | `/bee:thread` |
| Save context before compact | `/bee:compact` |
| End of day integrity check | `/bee:eod` |
| View preferences | `/bee:memory` |
| Commit changes | `/bee:commit` |
| Full spec completion ceremony | `/bee:complete-spec` |
| Quick archive (skip ceremony) | `/bee:archive-spec` |
| Manage seed backlog | `/bee:backlog` |

### Setup and Maintenance
| Intent | Command |
|--------|---------|
| Initialize Bee for project | `/bee:init` |
| Update Bee plugin | `/bee:update` |
| View/edit user profile | `/bee:profile` |
| Rebuild codebase context | `/bee:refresh-context` |
| Get help and command list | `/bee:help` |
| Natural language intent routing | `/bee:do` |
| Create custom agent | `/bee:create-agent` |
| Create custom skill | `/bee:create-skill` |

## 3. Smart Feature Suggestions

Proactively suggest these when conditions are met -- don't wait for the user to ask.

### Metrics and Performance
- IF 3+ phases completed: mention bottleneck detection in `/bee:progress`
- IF review iterations > 2 on recent phase: suggest checking metrics for workflow health
- IF execution taking long: mention predictive complexity scoring in plan-phase

### Testing Intelligence
- IF phase reviewed with findings + test coverage unclear: suggest `/bee:test-gen`
- IF building UI phase: suggest `/bee:test-e2e` for Playwright tests
- IF requirements.md shows low test mapping: mention test-gen maps criteria to tests

### Debugging Intelligence
- IF user says "stuck" or "something failed": suggest `/bee:forensics` first (read-only), then `/bee:debug`
- IF debug session resolved root cause: mention pattern extraction (patterns auto-suggested in future)
- IF forensics found CRITICAL/HIGH anomaly: mention handoff to `/bee:debug`

### Workflow Efficiency
- IF all phases planned: suggest `/bee:ship` or `/bee:autonomous` over manual per-phase
- IF multiple unrelated tasks: suggest `/bee:workspace` for parallel worktrees
- IF long session with growing context: mention `/bee:compact` preserves bee state
- IF end of day: suggest `/bee:eod` for integrity check
- IF spec complete: suggest `/bee:complete-spec` (full ceremony) over bare `/bee:archive-spec`

### Idea Capture
- IF user mentions "later" or a tangent: suggest `/bee:seed` with trigger conditions
- IF quick thought: suggest `/bee:note` for zero-friction capture
- IF starting new spec: `/bee:new-spec` auto-surfaces matching seeds

### Review Escalation
- IF single-phase review found many issues: suggest `/bee:swarm-review` for deeper analysis
- IF multiple phases done without cross-phase review: suggest `/bee:review-implementation`

## 4. Anti-Patterns

1. NEVER auto-commit. User commits via `/bee:commit` only.
2. NEVER suggest `/bee:review-implementation` after a single phase. Use `/bee:review` per phase.
3. NEVER skip review between execute and test. Cycle: execute -> review -> test -> commit.
4. NEVER skip plan-review. Phases should be PLAN_REVIEWED before execute-phase.
5. NEVER write production code without a failing test first. TDD is non-negotiable.
6. NEVER trust conversation memory for state. Read STATE.md and TASKS.md from disk.
7. NEVER auto-approve decision checkpoints. Present options; "Custom" always last.
8. NEVER accumulate context in autonomous. Each phase: fresh subagent, only SUMMARY.md carries forward.
9. NEVER expect LEARNINGS.md in fresh autonomous runs. It requires prior manual reviews.
10. NEVER sort decimal phases lexicographically. Sort numerically: 2, 2.1, 2.2, 3 (not 2, 2.1, 3, 2.2).
11. NEVER run `/bee:ship` on unplanned phases. All must be PLAN_REVIEWED first.
12. NEVER suggest `/bee:compact` or `/clear` as blockers. Execute directly with available context.
13. NEVER run full test suite, linter, or static analysis inside parallel agents. Agents test ONLY their files; conductor validates ONCE per wave (~70% time savings).

## 5. Ecosystem Model

**Commands -> Agents:** Commands are orchestrators. They read state from disk, validate guards, spawn specialized agents via Task tool. 49 commands orchestrate 36 agents. Agents inherit the parent model unless the conductor explicitly passes `model: "sonnet"` for structured/economy tasks.

**Hooks -> Scripts:** 8 lifecycle events drive 8 scripts. SessionStart loads project state (load-context.sh) and configures statusline (setup-statusline.js). PostToolUse auto-lints (auto-lint.sh). SubagentStart injects user preferences (inject-memory.sh). SubagentStop validates agent output (per-agent prompts in hooks.json). PreToolUse gates commits (pre-commit-gate.sh). PreCompact saves session context. Stop reminds about unreviewed work. SessionEnd writes session metrics.

**Skills -> Knowledge:** Skills are composable knowledge packs. Core skill provides workflow rules (TDD, disk-is-truth). Stack skills (10 stacks) provide framework conventions. Standards skills (global, frontend, backend, testing) provide universal practices. This guide provides workflow intelligence. Skills load into agent context via frontmatter `skills:` arrays.

## 6. When to Read This Guide

Read this guide when:
- **Session start:** The compact excerpt in load-context.sh gives basic awareness. Read the full guide for decision logic.
- **User seems unsure:** Consult the decision tree (Section 1) to suggest the right next step.
- **User describes intent without naming a command:** Consult the intent map (Section 2).
- **Phase just completed:** Consult the decision tree to know what comes next.
- **Contextual trigger detected:** Check smart suggestions (Section 3) for proactive recommendations.
- **About to take an action:** Check anti-patterns (Section 4) to avoid workflow violations.
- **User asks "what can Bee do?":** The intent map (Section 2) is the comprehensive capability reference.
