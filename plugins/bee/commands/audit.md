---
description: Run a comprehensive code audit with specialized agents -- security, errors, database, architecture, API, frontend, performance, testing, and end-to-end bug detection
argument-hint: "[--only security,database,...] [--skip-validation] [--severity critical,high]"
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`
- `.bee/PROJECT.md` — if not found: skip

Read `config.implementation_mode` and store as `$IMPL_MODE`. If not set, defaults to `"quality"`.

## Instructions

You are running `/bee:audit` -- the comprehensive code audit pipeline for BeeDev. This command orchestrates multiple specialized audit agents that scan the entire codebase, validates their findings to eliminate hallucinations, and produces a structured audit report.

### Step 1: Validation Guard

**NOT_INITIALIZED guard:** If `.bee/STATE.md` does not exist, tell the user:
"BeeDev is not initialized. Run `/bee:init` first."
Do NOT proceed.

### Step 2: Parse Arguments

Check `$ARGUMENTS` for flags:

1. **`--only` flag:** Comma-separated list of audit agents to run. Valid values: `security`, `errors`, `database`, `architecture`, `api`, `frontend`, `performance`, `testing`, `bugs`. If present, only run the specified agents. If not present, run ALL agents.

2. **`--skip-validation` flag:** If present, skip the validation step (Step 5). Findings go directly to the report as UNVALIDATED. Useful for speed when you trust the results and plan to manually review.

3. **`--severity` flag:** Comma-separated severity filter for the final report. Valid values: `critical`, `high`, `medium`, `low`. If present, only include findings of the specified severities in the report. If not present, include all severities.

### Step 3: Detect Stack & Project Scope

Read `.bee/config.json` to determine:
- Stack(s): check `.stacks` array first, fall back to `.stack`
- Project root and source directories
- Any audit-specific configuration in `config.audit` (if present)

Count total source files using Bash to include in the report metadata:
```bash
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.vue" -o -name "*.php" -o -name "*.py" \) -not -path "*/node_modules/*" -not -path "*/vendor/*" -not -path "*/.next/*" -not -path "*/dist/*" | wc -l
```

Tell the user what you're about to do:
```
Starting comprehensive audit...
Stack: {detected stack}
Files in scope: {count}
Agents: {list of agents to run}
Estimated time: {rough estimate based on file count}
```

### Step 3.5: Context Cache and Dependency Scan

**Context Cache (read once, pass to all agents):**

Before spawning any agents, read these files once and include their content in every agent's context packet:
1. Stack skill: `plugins/bee/skills/stacks/{stack}/SKILL.md`
2. Project context: `.bee/CONTEXT.md`
3. False positives: `.bee/false-positives.md`
4. User preferences: `.bee/user.md`

Pass these as part of the agent's prompt context — agents should NOT re-read these files themselves.

**Dependency Scan:**

Before spawning review agents, expand the file scope:

1. For each modified file, grep for `import`/`require`/`use` statements to find its **dependencies** (files it imports)
2. Grep the project for files that `import`/`require` any modified file to find its **consumers** (files that import it)
3. Scan depth: direct imports only (not transitive)
4. **Test file discovery:** For each modified file, look for corresponding test files using common patterns: `{name}.test.{ext}`, `{name}.spec.{ext}`, `tests/{name}.{ext}`, `__tests__/{name}.{ext}`. Include discovered test file paths in the context packet.
5. Limit: max 20 extra files (dependencies + consumers + test files combined) per agent context packet — if more than 20, prioritize consumers over dependencies
6. Include all expanded file paths in the agent's context packet alongside the modified files
7. Instruct agents: "Also verify that modifications don't break consumer files. Check import compatibility, return type changes, and side effect changes. Verify test files cover the modified behavior."

### Step 4: Run Audit Agents

Spawn audit agents in parallel batches. The order and grouping depends on `$IMPL_MODE`:

**Economy mode:** Run agents sequentially (one at a time) to minimize token usage. Use sonnet for all agents.

**Quality mode (default):** Run agents in two parallel batches:
- **Batch 1** (spawn all 8 at once): `security-auditor`, `database-auditor`, `error-handling-auditor`, `architecture-auditor`, `api-auditor`, `frontend-auditor`, `performance-auditor`, `testing-auditor`
- **Batch 2** (after batch 1 completes): `audit-bug-detector` (runs last because it benefits from understanding the full codebase)

**Premium mode:** Run ALL agents in parallel (single batch), including `audit-bug-detector`.

For each agent spawn, provide this context:
```
You are running as part of a comprehensive BeeDev audit.
Project root: {root}
Stack: {stack}
Config: {relevant config}

Audit the ENTIRE codebase. The audit skill (finding format, severity definitions) is already loaded via your frontmatter.

Focus on your domain. Use the finding format with your agent prefix. Be thorough but avoid duplicating other agents' work.
```

As agents complete, collect their findings. Track progress and notify the user:
```
[2/9] security-auditor complete: 12 findings (2 CRITICAL, 4 HIGH, 3 MEDIUM, 3 LOW)
```

### Step 5: Validate Findings

Unless `--skip-validation` was specified:

Collect ALL findings from all completed audit agents. Group them into validation batches of 10-15 findings each.

Spawn `audit-finding-validator` agents in parallel for each batch. Provide each validator with:
- The batch of findings to validate
- The project stack and config

Wait for all validators to complete. Collect classifications:
- **CONFIRMED** findings proceed to the report
- **FALSE POSITIVE** findings go to the false positives log
- **NEEDS CONTEXT** findings go to a separate section for human review

Report validation results to the user:
```
Validation complete:
- CONFIRMED: {N} findings
- FALSE POSITIVE: {N} findings (filtered out)
- NEEDS CONTEXT: {N} findings (flagged for review)
- False positive rate: {percentage}%
```

### Step 6: Generate Report

Spawn the `audit-report-generator` agent with:
- Project name (from config or directory name)
- Stack
- List of agents that ran
- All CONFIRMED findings
- All NEEDS CONTEXT findings
- False positives summary
- Total file count

The report generator produces:
- `.bee/AUDIT-REPORT.md` — Human-readable report
- `.bee/audit-findings.json` — Machine-readable findings for `bee:audit-to-spec`

### Step 7: Present Results

After the report is generated, present a summary to the user:

```
## Audit Complete

**Risk Level:** {CRITICAL / HIGH / MODERATE / LOW / CLEAN}

| Severity | Confirmed | Needs Context |
|----------|-----------|---------------|
| CRITICAL | {n} | {n} |
| HIGH | {n} | {n} |
| MEDIUM | {n} | {n} |
| LOW | {n} | {n} |

**False positive rate:** {percentage}%

**Top concerns:**
1. {Most critical finding title}
2. {Second most critical}
3. {Third most critical}

Full report: `.bee/AUDIT-REPORT.md`

**Next steps:**
- Review the report, especially NEEDS CONTEXT findings
- Run `/bee:audit-to-spec` to convert findings into actionable specs
- Run `/bee:audit-to-spec --critical` for immediate critical fixes only
```

### Step 8: Update STATE.md

Read `.bee/STATE.md` from disk (fresh read).

1. Find or create the `## Audit History` section. If it doesn't exist, add it after the Quick Tasks section:

```markdown
## Audit History

| Date | Risk Level | Critical | High | Medium | Low | Specs Generated |
|------|-----------|----------|------|--------|-----|----------------|
```

2. Add a new row for this audit:

```markdown
| {YYYY-MM-DD} | {risk_level} | {critical_count} | {high_count} | {medium_count} | {low_count} | - |
```

3. Update Last Action:

```markdown
## Last Action
- Command: /bee:audit
- Timestamp: {ISO 8601}
- Result: Audit complete — risk level {risk_level}, {total_confirmed} confirmed findings ({critical} critical, {high} high, {medium} medium, {low} low), {false_positive_rate}% false positive rate
```

4. Write updated STATE.md to disk.

### Step 9: Interactive Menu

Present the results summary from Step 7, then ask the user:

```
AskUserQuestion(
  question: "Audit complet. [X] findings ([C] critical, [H] high, [M] medium). Report: [path]",
  options: ["Audit-to-spec", "Re-audit", "Accept", "Custom"]
)
```

- **Audit-to-spec**: Execute `/bee:audit-to-spec` on the generated report
- **Re-audit**: Re-run the full audit pipeline from Step 1 (fresh agent spawns)
- **Accept**: End command, no further action
- **Custom**: User types what they want, conductor interprets and executes

---

### Implementation Mode Delegation

The `$IMPL_MODE` affects which model tier each agent uses:

| Agent | Economy | Quality | Premium |
|-------|---------|---------|---------|
| security-auditor | sonnet | opus | opus |
| error-handling-auditor | sonnet | sonnet | opus |
| database-auditor | sonnet | opus | opus |
| architecture-auditor | sonnet | sonnet | opus |
| api-auditor | sonnet | sonnet | opus |
| frontend-auditor | sonnet | sonnet | opus |
| performance-auditor | sonnet | sonnet | opus |
| testing-auditor | sonnet | sonnet | opus |
| audit-bug-detector | sonnet | opus | opus |
| audit-finding-validator | sonnet | opus | opus |
| audit-report-generator | sonnet | sonnet | sonnet |

Security, database, bug-detector, and the validator get the best models in quality mode because their accuracy matters most.

---

### Handling Multi-Stack Projects

If `.bee/config.json` contains multiple stacks in the `.stacks` array:

1. Run one pass per stack, scoping each audit agent to the stack's `path` directory.
2. Each agent receives the specific stack name and path for its pass.
3. The report generator merges findings from all stack passes, tagging each finding with its stack.
4. Agents that are stack-agnostic (architecture, testing) run once across the full project.

---

### Error Recovery

**Single agent crash/timeout:**
- Log the failure: `[FAILED] {agent-name}: {error}`
- Continue with remaining agents -- do NOT abort the entire audit
- Note the failed agent in the report metadata under `## Audit Metadata`
- Suggest the user re-run with `--only {failed-agent}` to retry just that agent
- If the failed agent had partial output before crashing, attempt to extract any complete findings from it

**Multiple agents crash (2+ in same batch):**
- Log each failure individually
- If ALL agents in a batch fail, warn the user: "Batch {N} failed completely. Possible environment issue (disk space, memory, permissions). Check and retry."
- Continue with subsequent batches -- partial results are better than no results
- If >50% of all agents fail, suggest the user check project readability: "Multiple agents failed. Verify the project builds and files are accessible."

**Validator crash:**
- Fall back to including all findings as UNVALIDATED
- Add a prominent warning at the top of the report: "⚠ Validation was incomplete — findings below have NOT been verified against actual code. Review manually."
- Note in the report which findings are UNVALIDATED vs CONFIRMED
- Suggest the user re-run: `/bee:audit` (full) or manually review UNVALIDATED findings

**Report generator crash:**
- Output a raw findings dump to `.bee/AUDIT-RAW.md` as a fallback
- The raw dump uses a simplified format: one finding per section with all available fields
- Also write `.bee/audit-findings.json` directly from the collected findings if possible
- Tell the user: "Report generation failed. Raw findings saved to `.bee/AUDIT-RAW.md`. You can still use `/bee:audit-to-spec` if `audit-findings.json` was generated."

**Session loss mid-audit:**
- If the user loses the session during an audit, progress is lost (agents run in-memory)
- On `/bee:resume`, check for `.bee/AUDIT-REPORT.md` — if it exists, the audit completed before the session was lost
- If no report exists but `.bee/AUDIT-RAW.md` exists, a partial audit was saved
- Suggest: "Previous audit did not complete. Run `/bee:audit` to start fresh, or `/bee:audit --only {missing-agents}` if you know which agents still need to run."

**Context7 unavailable:**
- If Context7 MCP tools are not available, agents that use them (security-auditor, api-auditor, audit-bug-detector) fall back to stack skill rules only
- Do NOT fail the agent — proceed without documentation verification
- Note in the agent's summary: "Context7 unavailable — documentation verification skipped"
