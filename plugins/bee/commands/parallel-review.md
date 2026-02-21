---
description: Run parallel code review with 4 specialized reviewer teammates (experimental, requires agent teams)
argument-hint: "[--loop]"
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`

## Instructions

You are running `/bee:parallel-review` -- the experimental parallel code review command for BeeDev. This command uses Claude Code agent teams to create 4 specialized reviewer teammates, synthesizes their findings into a single REVIEW.md, and feeds the result into the existing validate-fix pipeline. Follow these steps in order.

### Step 1: Validation Guards

Check these guards in order. Stop immediately if any fails:

1. **NOT_INITIALIZED guard:** If the dynamic context above contains "NOT_INITIALIZED" (meaning `.bee/STATE.md` does not exist), tell the user:
   "BeeDev is not initialized. Run `/bee:init` first."
   Do NOT proceed.

2. **NO_SPEC guard:** Read STATE.md from the dynamic context above. If no Current Spec Path exists or it shows "(none)", tell the user:
   "No spec found. Run `/bee:new-spec` first."
   Do NOT proceed.

3. **Phase detection:** Read the Phases table from STATE.md. Find the first phase where: Status is "EXECUTED" AND the Reviewed column is NOT "Yes" (or not "Yes (N)" for any N). This is the phase to review. If no such phase exists, tell the user:
   "No executed phases waiting for review. Run `/bee:execute-phase N` first."
   Do NOT proceed.

4. **Already reviewing guard:** If the Status column for the detected phase shows "REVIEWING", warn the user:
   "Phase {N} review is in progress. Continue from where it left off?"
   Wait for explicit confirmation before proceeding. If the user declines, stop.

5. **Agent teams prerequisite guard:** Attempt to use TeamCreate to create a team. If TeamCreate fails or the tool is not available, tell the user:
   "Agent teams are not enabled. To use parallel review, add to your settings.json: {\"env\": {\"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": \"1\"}}. Use `/bee:review` for standard single-agent review."
   Do NOT proceed.

### Step 2: Load Phase Context

1. Read STATE.md to find the Current Spec Path
2. Determine the phase number and slug from the Phases table
3. Construct paths:
   - Phase directory: `{spec-path}/phases/{NN}-{slug}/`
   - TASKS.md: `{phase_directory}/TASKS.md`
   - spec.md: `{spec-path}/spec.md`
4. Read TASKS.md to identify files created/modified by the phase
5. Read `.bee/false-positives.md` if it exists (pass path to reviewers)
6. Check `$ARGUMENTS` for `--loop` flag
7. Read `config.json` from dynamic context for `review.loop` and `review.max_loop_iterations` settings
8. Determine loop mode: enabled if `--loop` in arguments OR `config.review.loop` is true
9. Set max iterations: from `config.review.max_loop_iterations` (default: 3)
10. Initialize iteration counter to 1

### Step 3: Update STATE.md to REVIEWING

Read current `.bee/STATE.md` from disk (fresh read, not cached dynamic context). Update the detected phase:

1. Set the phase row's Status to `REVIEWING`
2. Set Last Action to:
   - Command: `/bee:parallel-review`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Starting parallel review of phase {N}"
3. Write updated STATE.md to disk

Display to user: "Starting parallel review of Phase {N}: {phase-name} with 4 specialized reviewers..."

### Step 4: Create Agent Team and Spawn 4 Reviewer Teammates

1. Use TeamCreate with team_name: "bee-review-phase-{N}" and description: "Parallel review of Phase {N} with 4 specialized reviewers"
2. If TeamCreate fails, display the agent teams prerequisite error message from Step 1.5 and stop.
3. Create 4 tasks via TaskCreate (one per reviewer domain):
   - "Review Phase {N} for plan compliance"
   - "Review Phase {N} for standards and patterns"
   - "Review Phase {N} for bugs and security"
   - "Review Phase {N} for dead code and performance"
4. Spawn ALL 4 reviewer teammates SIMULTANEOUSLY via Task tool (do NOT wait for one before spawning the next). Each teammate uses the existing `reviewer` agent with a specialized context packet.

**Teammate 1: Plan Compliance Reviewer**
```
You are the PLAN COMPLIANCE reviewer for Phase {N}.
Your ONLY focus is spec compliance and acceptance criteria.

Spec: {spec.md path}
TASKS.md: {TASKS.md path}
Phase directory: {phase_directory}
False positives: {false-positives.md path or 'none'}

Check EVERY acceptance criterion in TASKS.md against the implementation.
Flag: missing features, incorrect behavior, extra features not in spec.
Do NOT check: code quality, naming, security, dead code.

Report your findings in your final message with this format:
### Findings
For each finding:
- File: {path}
- Lines: {start}-{end}
- Severity: Critical|High|Medium
- Category: Spec Gap
- Description: {what is wrong}
- Suggested Fix: {what to change}

If you find 0 issues, report: "### Findings\nNo findings."
```

**Teammate 2: Standards & Patterns Reviewer**
```
You are the STANDARDS & PATTERNS reviewer for Phase {N}.
Your ONLY focus is stack standards, naming, structure, and pattern consistency.

Spec: {spec.md path}
TASKS.md: {TASKS.md path}
Phase directory: {phase_directory}
False positives: {false-positives.md path or 'none'}

Read `.bee/config.json` to find the stack, then read the matching stack skill at `skills/stacks/{stack}/SKILL.md` for conventions.

Check: naming conventions, directory structure, import patterns, framework best practices, pattern consistency with existing codebase.
Flag: violations of stack conventions, inconsistent patterns, structural issues.
Do NOT check: spec compliance, security, dead code.

Report your findings in your final message with this format:
### Findings
For each finding:
- File: {path}
- Lines: {start}-{end}
- Severity: Critical|High|Medium
- Category: Standards or Pattern
- Description: {what is wrong}
- Suggested Fix: {what to change}

If you find 0 issues, report: "### Findings\nNo findings."
```

**Teammate 3: Bug & Security Reviewer**
```
You are the BUG & SECURITY reviewer for Phase {N}.
Your ONLY focus is logic errors, security vulnerabilities, and error handling.

Spec: {spec.md path}
TASKS.md: {TASKS.md path}
Phase directory: {phase_directory}
False positives: {false-positives.md path or 'none'}

Check: logic errors, null handling, edge cases, OWASP basics, auth checks, input validation, error handling, data exposure, injection vulnerabilities.
Flag: bugs that cause incorrect behavior, security flaws, missing error handling.
Do NOT check: naming, spec compliance, dead code.

Report your findings in your final message with this format:
### Findings
For each finding:
- File: {path}
- Lines: {start}-{end}
- Severity: Critical|High|Medium
- Category: Bug or Security
- Description: {what is wrong}
- Suggested Fix: {what to change}

If you find 0 issues, report: "### Findings\nNo findings."
```

**Teammate 4: Dead Code & Performance Reviewer**
```
You are the DEAD CODE & PERFORMANCE reviewer for Phase {N}.
Your ONLY focus is unused code, unreachable paths, and performance issues.

Spec: {spec.md path}
TASKS.md: {TASKS.md path}
Phase directory: {phase_directory}
False positives: {false-positives.md path or 'none'}

Check: unused imports, unreachable code paths, orphaned functions, N+1 queries, expensive operations in loops, unnecessary re-renders, oversized payloads.
Flag: dead code that should be removed, performance issues that impact user experience.
Do NOT check: spec compliance, standards, security.

Report your findings in your final message with this format:
### Findings
For each finding:
- File: {path}
- Lines: {start}-{end}
- Severity: Critical|High|Medium
- Category: Dead Code or TDD
- Description: {what is wrong}
- Suggested Fix: {what to change}

If you find 0 issues, report: "### Findings\nNo findings."
```

### Step 5: Wait for Teammates and Collect Findings

1. Monitor task completion via TaskList. Wait for all 4 reviewers to complete.
2. As each teammate completes, read their findings from their final message.
3. After all 4 complete, send shutdown_request to each teammate via SendMessage.
4. Wait for shutdown approvals.
5. Run TeamDelete to clean up team resources.
6. If fewer than 3 of 4 reviewers complete (timeout or failure), fall back: display "Fewer than 3 reviewers completed. Falling back to standard review." Then spawn a single `reviewer` agent via Task tool (same as `/bee:review` Step 4) and proceed with its findings instead.

### Step 6: Synthesize Findings into REVIEW.md

1. Combine findings from all completed reviewers into one list.
2. Deduplicate: for each pair of findings from different reviewers, if they reference the same file AND line ranges overlap (within 5 lines), merge into one finding. Use the higher severity. Combine categories (e.g., "Bug, Spec Gap"). Combine descriptions.
3. Assign sequential IDs: F-001, F-002, ...
4. Write merged REVIEW.md to `{phase_directory}/REVIEW.md` using the review-report template (`skills/core/templates/review-report.md`).
5. Set all findings to Validation: pending.

If 0 findings after synthesis:
- Update STATE.md: Reviewed = "Yes (0)", Status = REVIEWED
- Display: "Parallel review complete -- clean code! No findings. Next step: Run `/bee:test`."
- Stop.

Display findings summary: "{N} findings from {M} reviewers: {critical} critical, {high} high, {medium} medium"

If more than 15 findings after deduplication, present the list to user before proceeding:
"The parallel review found {N} findings (above typical range). Review the list in REVIEW.md and confirm you want to proceed with validation."
Wait for user confirmation. If user declines, stop.

### Step 7: Validate Each Finding

1. For each finding in REVIEW.md (parsed from the `### F-NNN` sections):
   - Build validation context: finding ID, summary, severity, category, file path, line range, description, suggested fix
   - Spawn `finding-validator` agent via Task tool with the finding context
   - Multiple validators CAN be spawned in parallel (they are read-only and independent)
   - Batch up to 5 validators at a time to avoid overwhelming the system
2. Collect classifications from each validator's final message (the `## Classification` section with Finding, Verdict, Confidence, Reason fields)
3. Read current REVIEW.md from disk (fresh read -- another validator batch may have been processed). Update REVIEW.md:
   - Set each finding's Validation field to the classification (REAL BUG / FALSE POSITIVE / STYLISTIC)
   - Update the Counts table with classification breakdown
4. Handle FALSE POSITIVE findings:
   - If `.bee/false-positives.md` does not exist, create it with a `# False Positives` header
   - For each FALSE POSITIVE finding, append an entry:
     ```
     ## FP-{NNN}: {one-line summary}
     - **Finding:** {original finding description from REVIEW.md}
     - **Reason:** {validator's reason for FALSE POSITIVE classification}
     - **Phase:** {phase number}
     - **Date:** {current ISO 8601 date}
     ```
   - Update REVIEW.md: set the finding's Fix Status to "False Positive"

5. Handle STYLISTIC findings (user interaction):
   - For each STYLISTIC finding, present to user:
     "STYLISTIC finding: F-{NNN} -- '{summary}'. Options: (a) Fix it, (b) Ignore, (c) False Positive (won't be flagged again)"
   - Wait for user response for each STYLISTIC finding
   - If user chooses (a): add finding to the confirmed fix list
   - If user chooses (b): mark as "Skipped (user ignored)" in REVIEW.md Fix Status
   - If user chooses (c): append to `.bee/false-positives.md` (same format as step 4) and mark as "False Positive" in REVIEW.md

6. Build confirmed fix list: all REAL BUG findings + user-approved STYLISTIC findings (those where user chose option a)
7. Display validation summary: "{real_bug} real bugs, {false_positive} false positives, {stylistic} stylistic ({user_fix} to fix, {user_ignore} ignored)"

### Step 8: Fix Confirmed Issues

1. Sort confirmed findings by priority order:
   - Priority 1: Critical severity
   - Priority 2: High severity
   - Priority 3: Standards category (Medium)
   - Priority 4: Dead Code category (Medium)
   - Priority 5: Other Medium severity
2. If no confirmed findings (all were false positives, ignored, or skipped): display "No confirmed findings to fix -- all findings were classified as false positives or stylistic (ignored)." Update STATE.md and skip to Step 10.
3. For EACH confirmed finding in priority order (SEQUENTIAL -- one at a time, never parallel):
   - Build fixer context packet:
     - Finding details: ID, summary, severity, category, file path, line range, description, suggested fix
     - Validation classification: REAL BUG or STYLISTIC (user-approved)
     - Stack info: stack name from config.json for the fixer to load the stack skill
   - Spawn `fixer` agent via Task tool with the context packet
   - WAIT for the fixer to complete before spawning the next fixer
   - Read the fixer's fix report from its final message (## Fix Report section)
   - Read current REVIEW.md from disk (fresh read -- Read-Modify-Write pattern)
   - Update REVIEW.md: set Fix Status for this finding to the fixer's reported status (Fixed / Reverted / Failed)
   - Write updated REVIEW.md to disk
   - If fixer reports "Reverted" or "Failed" (tests broke and changes were reverted):
     - Display failure to user: "Fix for F-{NNN} failed -- tests broke after fix. Changes reverted. Skipping this finding."
     - Update REVIEW.md Fix Status to "Skipped (tests failed)"

CRITICAL: Spawn fixers SEQUENTIALLY, one at a time. Never spawn multiple fixers in parallel. One fix may change the context for the next finding. Sequential execution prevents file conflicts and ensures each fixer sees the latest code state.

4. After all confirmed findings have been processed, display fix summary:
   "{fixed} fixed, {skipped} skipped, {failed} failed out of {total} confirmed findings"

### Step 9: Re-Review (if loop mode enabled)

1. If loop mode is NOT enabled: skip to Step 10 (completion)
2. Increment iteration counter
3. If iteration counter > max iterations:
   - Display: "Max review iterations ({max}) reached. Review complete."
   - Skip to Step 10
4. Display: "Starting re-review iteration {counter} of {max}..."
5. Re-spawn the `reviewer` agent with the same context as a standard review:
   - The reviewer reads the updated code (including fixes applied in previous iteration)
   - The reviewer reads the updated `.bee/false-positives.md` (which now includes FPs from the previous iteration)
   - The reviewer produces a fresh REVIEW.md (overwrites the previous one)
6. Read the new REVIEW.md
7. If 0 new findings: display "Re-review clean -- no new findings after iteration {counter}." Skip to Step 10.
8. If new findings found:
   - Display: "Re-review found {N} new findings. Validating and fixing..."
   - Repeat from Step 7 (validate findings -> fix confirmed -> check for another loop iteration)

### Step 10: Completion

After all steps complete (or early exit from clean review):

1. Update STATE.md:
   - Reviewed column: "Yes ({N})" where N = total confirmed findings fixed across all iterations
   - Status: `REVIEWED`
   - Last Action:
     - Command: `/bee:parallel-review`
     - Timestamp: current ISO 8601 timestamp
     - Result: "Phase {N} parallel-reviewed: {total_findings} findings, {confirmed} confirmed, {fixed} fixed, {false_positives} false positives"
2. Write updated STATE.md to disk
3. Display completion summary:

```
Phase {N} parallel-reviewed!

Phase: {phase-name}
Reviewers: 4 specialized teammates (plan compliance, standards, bugs/security, dead code/performance)
Findings: {total} total
- Real bugs: {confirmed} ({fixed} fixed, {failed} failed)
- False positives: {fp_count} (documented in .bee/false-positives.md)
- Stylistic: {stylistic} ({user_fixed} fixed, {user_ignored} ignored)
Iterations: {iteration_count}

Next step: Run `/bee:test` to test this phase, or `/bee:plan-phase {N+1}` to continue.
```

---

**Design Notes (do not display to user):**

- Both commands (`parallel-review` and `review`) produce identical REVIEW.md format. The only difference is the review step (team vs single agent). The validate-fix pipeline is identical.
- Agent teams are experimental. If any team operation fails, fall back to standard `/bee:review` behavior (single reviewer agent).
- The command IS the team lead -- no separate synthesizer agent needed. The command creates the team, collects findings, deduplicates, and writes REVIEW.md.
- Finding deduplication targets 5-15 merged findings. If more than 15 after dedup, present list to user before validation.
- Teammates use the existing reviewer agent definition. Specialization comes from the context packet, not separate agent files. Same dual-output pattern proven in Phase 7 (EOD mode).
- Token usage is approximately 4x that of standard `/bee:review` due to 4 parallel sessions. Users should be aware of this cost tradeoff.
- The validate-fix pipeline (Steps 7-9) uses subagents, not teammates. No team is active during those steps. The team is shut down and deleted after synthesis.
- Re-review (loop mode) uses a single reviewer agent, not the full team. Re-review checks for new issues introduced by fixes, which is a lighter-weight operation.
- Always re-read STATE.md and REVIEW.md from disk before each update (Read-Modify-Write pattern) to ensure latest state.
- If the session ends mid-review (context limit, crash, user stops), re-running `/bee:parallel-review` detects the REVIEWING status and offers to resume. REVIEW.md on disk reflects the pipeline state at the time of interruption.
