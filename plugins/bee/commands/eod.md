---
description: Run end-of-day integrity check with 4 parallel audits
argument-hint: ""
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`

## Git Status (load before proceeding)

Run these via Bash tool:
- `git diff --stat` — if fails: NO_GIT
- `git status --short` — if fails: NO_GIT

## Instructions

You are running `/bee:eod` -- the end-of-day audit orchestrator for BeeDev. This command spawns 4 parallel audit agents (state integrity, code quality, test health, spec compliance), aggregates their results into an actionable report, and saves it to `.bee/eod-reports/`. Follow these steps in order.

### Step 1: Validation Guards

Check these guards in order. Stop immediately if any fails:

1. **NOT_INITIALIZED guard:** If the dynamic context above contains "NOT_INITIALIZED" (meaning `.bee/STATE.md` does not exist), tell the user:
   "BeeDev is not initialized. Run `/bee:init` first."
   Do NOT proceed.

2. **NO_SPEC guard:** Read STATE.md from the dynamic context above. If no Current Spec Path exists or it shows "(none)", tell the user:
   "No spec found. Run `/bee:new-spec` first."
   Do NOT proceed.

### Step 2: Load Context

From STATE.md in the dynamic context above, extract:
- Current spec path
- All phase directories and their statuses (from the Phases table)
- Latest phase number

Read the spec path to confirm it exists. If it does not exist, tell the user:
"Spec directory not found at {path}. STATE.md may be stale."
Do NOT proceed.

Create the reports directory if it does not exist:
```bash
mkdir -p .bee/eod-reports
```

### Step 3: Spawn 4 Audit Agents in Parallel

Spawn ALL 4 agents simultaneously using the Task tool. Do NOT wait for one to finish before spawning the next. All 4 audits are independent.

**Agent 1: integrity-auditor**
Use the Task tool to spawn the `integrity-auditor` agent. Provide context:
- "Check .bee/STATE.md against disk reality. Verify all referenced files exist, phase statuses are consistent, and no orphaned directories exist. Report findings in your final message."
- Include the spec path and all phase directory paths from STATE.md.

**Agent 2: reviewer (existing agent, reused)**
Use the Task tool to spawn the `reviewer` agent. Provide context that OVERRIDES its default scope:
- "EOD audit mode: Review ONLY the files shown in the git diff below (uncommitted changes). Do NOT write REVIEW.md to disk. Report findings in your final message as a brief summary. Focus on: standards violations, dead code, security concerns."
- Include the list of changed files from the Git Status section above.
- If no uncommitted changes exist, skip this agent and record Code Quality as "CLEAN -- no uncommitted changes".

**Agent 3: test-auditor**
Use the Task tool to spawn the `test-auditor` agent. Provide context:
- "Run the test suite once. Cross-reference acceptance criteria from all TASKS.md files. Report test health (pass/fail counts, stale tests, coverage gaps) in your final message."
- Include the spec path and all phase directory paths.

**Agent 4: project-reviewer**
Use the Task tool to spawn the `project-reviewer` agent. Provide context:
- "EOD audit mode: Provide a spec compliance SUMMARY in your final message. Do NOT write REVIEW-PROJECT.md to disk. Report per-phase compliance status and overall percentage."
- Include the spec path and all phase directory paths.

### Step 4: Aggregate Results

After ALL 4 agents complete, extract findings from each agent's final message.

Read the EOD report template from `skills/core/templates/eod-report.md`.

Build the report by replacing template placeholders:
- `{DATE}` -> today's date (YYYY-MM-DD format)
- `{INTEGRITY_STATUS}` -> CLEAN or ISSUES (from integrity-auditor's Overall status)
- `{INTEGRITY_FINDINGS}` -> bullet list of integrity-auditor's check results
- `{CODE_STATUS}` -> CLEAN or N FINDINGS (from reviewer's finding count)
- `{CODE_FINDINGS}` -> bullet list of reviewer's findings (or "No findings" if clean)
- `{TEST_STATUS}` -> HEALTHY or ISSUES (from test-auditor's Overall status)
- `{PASS_COUNT}` -> passing test count from test-auditor
- `{FAIL_COUNT}` -> failing test count from test-auditor
- `{STALE_COUNT}` -> stale test count from test-auditor
- `{GAP_COUNT}` -> coverage gap count from test-auditor
- `{GAP_DETAILS}` -> bullet list of specific coverage gaps (or empty if none)
- `{COMPLIANCE_STATUS}` -> ON TRACK or GAPS (from project-reviewer's Overall status)
- `{COMPLIANCE_SUMMARY}` -> per-phase compliance summary from project-reviewer
- `{FILE_COUNT}` -> count of uncommitted files from Git Status above
- `{UNCOMMITTED_FILE_LIST}` -> bullet list of uncommitted file paths from Git Status (or "No uncommitted changes" if clean)
- `{ACTION_ITEMS}` -> derive numbered action items from ALL findings across all 4 audits

Action items should be specific and actionable, for example:
1. "Fix 2 code quality findings in src/auth.ts"
2. "Add tests for 3 uncovered acceptance criteria"
3. "Commit 14 modified files"
4. "Resolve state inconsistency: Phase 2 shows EXECUTED but TASKS.md has unchecked tasks"

If all audits are clean, the single action item is: "1. No action needed -- all audits passed."

### Step 5: Write Report

Write the completed report to `.bee/eod-reports/{YYYY-MM-DD}.md` where the date is today's date. If the file already exists (second run same day), overwrite it.

### Step 6: Present Summary

Show the user a condensed summary:

```
EOD Audit Complete

State Integrity: {CLEAN or ISSUES}
Code Quality:    {CLEAN or N findings}
Test Health:     {HEALTHY or ISSUES}
Spec Compliance: {ON TRACK or GAPS}

Action Items:
{numbered action items list}

Full report: .bee/eod-reports/{YYYY-MM-DD}.md
```

Update `.bee/STATE.md` Last Action:
- Command: `/bee:eod`
- Timestamp: current ISO 8601 timestamp
- Result: "EOD audit: {integrity_status}, {code_status}, {test_status}, {compliance_status}"

---

**Design Notes (do not display to user):**

- The 4 audit agents are spawned in parallel via simultaneous Task tool calls. This is the fastest execution pattern -- all audits are fully independent.
- The reviewer agent is reused from Phase 5 with an overridden scope (EOD mode reviews only uncommitted changes, not a full phase). If there are no uncommitted changes, the reviewer is skipped entirely.
- The EOD report template in `skills/core/templates/eod-report.md` defines the report structure. The command fills in the placeholders from agent results.
- Running `/bee:eod` twice on the same day overwrites the previous report (same date-based filename).
- The report is saved to `.bee/eod-reports/` which is outside the spec directory. EOD reports are project-level, not spec-level.
- Always re-read STATE.md from disk before writing updates (Read-Modify-Write pattern).
- The Git Status section is injected via dynamic context (same pattern as the commit command) to capture uncommitted changes without needing an agent.
