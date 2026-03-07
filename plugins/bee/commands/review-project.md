---
description: Review entire implementation against original spec using four parallel specialized agents with validate-fix pipeline
argument-hint: ""
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`

## Instructions

You are running `/bee:review-project` -- the full project compliance review for BeeDev. This command spawns four specialized review agents in parallel to check all phase implementations against the original spec, validates findings, fixes confirmed issues, and produces a comprehensive REVIEW-PROJECT.md report. Follow these steps in order.

### Step 1: Validation Guards

Check these guards in order. Stop immediately if any fails:

1. **NOT_INITIALIZED guard:** If the dynamic context above contains "NOT_INITIALIZED" (meaning `.bee/STATE.md` does not exist), tell the user:
   "BeeDev is not initialized. Run `/bee:init` first."
   Do NOT proceed.

2. **NO_SPEC guard:** Read STATE.md from the dynamic context above. If no Current Spec Path exists or it shows "(none)", tell the user:
   "No spec found. Run `/bee:new-spec` first."
   Do NOT proceed.

### Step 2: Load Spec Context

From STATE.md in the dynamic context above, extract:
- Current spec path
- All phase directories and their statuses (from the Phases table)

Read `spec.md` from the spec path to confirm it exists. If it does not exist, tell the user:
"Spec file not found at {spec-path}/spec.md. STATE.md may be stale."
Do NOT proceed.

Collect all phase directory paths that have been executed (status EXECUTED or beyond: REVIEWED, TESTED, COMMITTED). These are the phases with actual implementation to review.

If no phases have been executed, tell the user:
"No phases have been executed yet. Run `/bee:execute-phase 1` first."
Do NOT proceed.

Determine the output path: `{spec-path}/REVIEW-PROJECT.md`

Display to user: "Starting full project review against spec..."

### Step 2.5: Extract False Positives

Before spawning review agents, extract documented false positives so each agent can exclude known non-issues:

1. Read `.bee/false-positives.md` using the Read tool.
2. If the file exists, build a formatted false-positives list from its contents. Extract each `## FP-NNN` entry with its finding description, reason, and file reference. Format the list as:
   ```
   EXCLUDE these documented false positives from your findings:
   - FP-001: {summary} ({file}, {reason})
   - FP-002: {summary} ({file}, {reason})
   ...
   ```
3. If the file does not exist, set the false-positives list to: `"No documented false positives."`
4. This formatted list is included verbatim in each agent's context packet in Step 3.

### Step 3: Spawn Four Specialized Review Agents in Parallel

Spawn four specialized review agents in parallel. Each agent focuses on a distinct review domain. The command (not the agents) writes REVIEW-PROJECT.md after consolidating all findings.

#### 3.1: Build context packets

Build a shared context base for all four agents:
- Spec path: `{spec.md path}`
- All executed phase directory paths (with their phase numbers and names)
- Output file: `{spec-path}/REVIEW-PROJECT.md`
- False positives list: the formatted list from Step 2.5

Then build four agent-specific context packets:

**Agent 1: Bug Detector** (`bee:bug-detector`, `model: "sonnet"`)
```
You are reviewing the FULL PROJECT implementation for bugs and security issues. This is a project-scope review across all executed phases, not a single-phase review.

Spec: {spec.md path}
Executed phases:
- Phase {N}: {phase_directory_path}
- Phase {M}: {phase_directory_path}
...

{false-positives list from Step 2.5}

For EACH executed phase, read its TASKS.md to find the files created/modified. Review those files for bugs, logic errors, null handling issues, race conditions, edge cases, and security vulnerabilities (OWASP). Report only HIGH confidence findings in your standard output format.
```

**Agent 2: Pattern Reviewer** (`bee:pattern-reviewer`, `model: "sonnet"`)
```
You are reviewing the FULL PROJECT implementation for pattern deviations. This is a project-scope review across all executed phases, not a single-phase review.

Spec: {spec.md path}
Executed phases:
- Phase {N}: {phase_directory_path}
- Phase {M}: {phase_directory_path}
...

{false-positives list from Step 2.5}

For EACH executed phase, read its TASKS.md to find the files created/modified. For each file, find 2-3 similar existing files in the codebase, extract their patterns, and compare. Report only HIGH confidence deviations in your standard output format.
```

**Agent 3: Plan Compliance Reviewer** (`bee:plan-compliance-reviewer`, `model: "sonnet"`)
```
You are reviewing the FULL PROJECT implementation in CODE REVIEW MODE (not plan review mode). This is a project-scope review across ALL executed phases.

Spec: {spec.md path}
Executed phases:
- Phase {N}: {phase_directory_path}
- Phase {M}: {phase_directory_path}
...

{false-positives list from Step 2.5}

Review mode: code review. Check implemented code against spec requirements and acceptance criteria across ALL executed phases. For EACH phase, read its TASKS.md and verify every acceptance criterion has corresponding implementation. Check for missing features, incorrect behavior, and over-scope additions. CRITICAL: Check cross-phase integration across ALL executed phases (not just adjacent phases) -- verify imports, data contracts, workflow connections, and shared state consistency between every pair of phases. Report findings in your standard code review mode output format.
```

**Agent 4: Stack Reviewer** (`bee:stack-reviewer`, `model: "sonnet"`)
```
You are reviewing the FULL PROJECT implementation for stack best practice violations. This is a project-scope review across all executed phases, not a single-phase review.

Spec: {spec.md path}
Executed phases:
- Phase {N}: {phase_directory_path}
- Phase {M}: {phase_directory_path}
...

{false-positives list from Step 2.5}

For EACH executed phase, read its TASKS.md to find the files created/modified. Load the stack skill dynamically from config.json and check all code against the stack's conventions. Use Context7 to verify framework best practices. Report only HIGH confidence violations in your standard output format.
```

#### 3.2: Spawn all four agents in parallel

Spawn all four agents via four Task tool calls in a SINGLE message (parallel execution). Use `model: "sonnet"` for all four agents -- they perform focused scope scanning and classification work.

Wait for all four agents to complete.

#### 3.3: Parse findings from each agent

After all four agents complete, parse findings from each agent's final message. Each agent has a distinct output format -- normalize all findings into a unified list:

**Bug Detector** findings (from `## Bugs Detected` section):
- Each `- **[Bug type]:** [Description] - \`file:line\`` entry becomes one finding
- Severity: taken from the Critical/High/Medium subsection the entry appears under
- Category: "Bug" (or "Security" if the bug type mentions security, injection, XSS, CSRF, auth, or access control)

**Pattern Reviewer** findings (from `## Project Pattern Deviations` section):
- Each `- **[Pattern type]:** [Deviation description] - \`file:line\`` entry becomes one finding
- Severity: Medium (pattern deviations default to Medium)
- Category: "Pattern"

**Plan Compliance Reviewer** findings (from `## Plan Compliance Findings` section):
- SG-NNN entries (Spec Gap) -> Category: "Spec Gap", severity from the entry
- CI-NNN entries (Cross-Phase Integration) -> Category: "Spec Gap", severity from the entry
- OS-NNN entries (Over-Scope) -> Category: "Spec Gap", severity: Medium

**Stack Reviewer** findings (from `## Stack Best Practice Violations` section):
- Each `- **[Rule category]:** [Violation description] - \`file:line\`` entry becomes one finding
- Severity: Medium (stack violations default to Medium)
- Category: "Standards"

If an agent reports no findings (e.g., "No bugs detected.", "No project pattern deviations found.", etc.), it contributes zero findings.

#### 3.4: Deduplicate and merge

For each pair of findings from different agents, check if they reference the same file AND their line ranges overlap (within 5 lines of each other). If so, merge them:
- Keep the higher severity (Critical > High > Medium)
- Combine categories (e.g., "Bug, Standards")
- Combine descriptions (concatenate with "; " separator)
- Use the broader line range

#### 3.5: Assign IDs and write REVIEW-PROJECT.md

1. Assign sequential IDs to all merged findings: F-001, F-002, F-003, ...
2. Write `{spec-path}/REVIEW-PROJECT.md` using the review-report template (`skills/core/templates/review-report.md`):
   - Adapt the Summary section for project scope: spec name, "Full Project" (instead of phase number), date, iteration: 1 of 1, status: PENDING
   - Fill in the Counts tables (by severity and by category)
   - Write each finding as a `### F-NNN` section with: Severity, Category, File, Lines, Description, Suggested Fix, Validation: pending, Fix Status: pending
   - Leave the False Positives section empty
   - Leave the Fix Summary table with one row per finding, all showing "pending"
3. Verify REVIEW-PROJECT.md was written by reading it back with the Read tool.

#### 3.6: Evaluate findings

1. Count total findings, count by severity (critical, high, medium), count by category.

2. If 0 findings after consolidation:
   - Read current STATE.md from disk
   - Set Last Action result to "Project review: 100% spec compliance -- clean code"
   - Write STATE.md to disk
   - Display: "Project review complete -- clean code! No findings from 4 reviewers. All phases fully compliant."
   - Skip to Step 5 (completion summary).

3. Display findings summary: "{N} findings from 4 reviewers: {critical} critical, {high} high, {medium} medium"

4. If more than 10 findings: present the list to user before proceeding:
   "The review found {N} findings (above typical range). Review the list in REVIEW-PROJECT.md and confirm you want to proceed with validation."
   Wait for user confirmation. If user declines, stop.

### Step 4: Validate-Fix Pipeline

#### 4.1: Validate each finding (spawn finding-validator agents)

1. For each finding in REVIEW-PROJECT.md (parsed from the `### F-NNN` sections):
   - Build validation context: finding ID, summary, severity, category, file path, line range, description, suggested fix, and `source_agent` (the specialist agent that originally produced the finding -- determined by category mapping: Bug/Security -> `bug-detector`, Pattern -> `pattern-reviewer`, Spec Gap -> `plan-compliance-reviewer`, Standards -> `stack-reviewer`)
   - Spawn `finding-validator` agent via Task tool with `model: "sonnet"` (single-finding classification is structured work) and the finding context
   - Multiple validators CAN be spawned in parallel (they are read-only and independent)
   - Batch up to 5 validators at a time to avoid overwhelming the system
2. Collect classifications from each validator's final message (the `## Classification` section with Finding, Verdict, Confidence, Source Agent, and Reason fields)
3. Escalate MEDIUM confidence classifications to specialist agents for a second opinion:
   - Filter the collected classifications: separate HIGH confidence (proceed unchanged) from MEDIUM confidence (need escalation)
   - For each MEDIUM confidence classification, read the `Source Agent` field to identify which specialist originally found the issue (one of: `bug-detector`, `pattern-reviewer`, `plan-compliance-reviewer`, or `stack-reviewer`)
   - Spawn the identified specialist agent (`bee:{source_agent}`) via Task tool with `model: "sonnet"` and a context packet containing:
     ```
     You are providing a second opinion on a review finding that received an uncertain classification.

     ## Original Finding
     - **ID:** F-{NNN}
     - **Severity:** {severity}
     - **Category:** {category}
     - **File:** {file_path}
     - **Lines:** {line_range}
     - **Description:** {description}
     - **Suggested Fix:** {suggested_fix}

     ## Validator Classification
     - **Verdict:** {verdict}
     - **Confidence:** MEDIUM
     - **Reason:** {validator_reason}

     ## Your Task
     Provide a second opinion on whether this finding is valid. Read the file and surrounding context. Respond with your verdict: REAL BUG or FALSE POSITIVE, followed by your reasoning.

     End your response with:
     ## Second Opinion
     - **Verdict:** {REAL BUG | FALSE POSITIVE}
     - **Reason:** {your reasoning}
     ```
   - Specialist escalations are spawned SEQUENTIALLY (one at a time) -- each is a focused re-analysis
   - After the specialist responds, parse the `## Second Opinion` section from the specialist's final message
   - Use the specialist's verdict as the FINAL classification, overriding the validator's uncertain MEDIUM confidence classification
   - If the specialist confirms REAL BUG: the finding stays with verdict REAL BUG
   - If the specialist says FALSE POSITIVE: the finding's verdict becomes FALSE POSITIVE
   - Record the escalation: append " (Escalated to {source_agent} -- reclassified as {verdict})" to the finding's Validation field in REVIEW-PROJECT.md (e.g., "FALSE POSITIVE (Escalated to bug-detector -- reclassified as FALSE POSITIVE)" or "REAL BUG (Escalated to pattern-reviewer -- reclassified as REAL BUG)")
   - Display each escalation: "Escalated F-{NNN} to {source_agent} -- reclassified as {verdict}"
4. Read current REVIEW-PROJECT.md from disk (fresh read). Update REVIEW-PROJECT.md:
   - Set each finding's Validation field to the final classification:
     - HIGH confidence findings: the validator's verdict (REAL BUG / FALSE POSITIVE / STYLISTIC)
     - Escalated MEDIUM confidence findings: the specialist's verdict with escalation note (e.g., "REAL BUG (Escalated to bug-detector -- reclassified as REAL BUG)")
   - Update the Counts table with classification breakdown
5. Handle FALSE POSITIVE findings (including those reclassified by specialist escalation):
   - If `.bee/false-positives.md` does not exist, create it with a `# False Positives` header
   - For each FALSE POSITIVE finding, append an entry:
     ```
     ## FP-{NNN}: {one-line summary}
     - **Finding:** {original finding description from REVIEW-PROJECT.md}
     - **Reason:** {validator's reason for FALSE POSITIVE classification}
     - **Scope:** Full Project Review
     - **Date:** {current ISO 8601 date}
     ```
   - For findings reclassified as FALSE POSITIVE via specialist escalation, include the specialist's reason (not the validator's) in the Reason field
   - Update REVIEW-PROJECT.md: set the finding's Fix Status to "False Positive"

6. Handle STYLISTIC findings (user interaction):
   - For each STYLISTIC finding, present to user:
     "STYLISTIC finding: F-{NNN} -- '{summary}'. Options: (a) Fix it, (b) Ignore, (c) False Positive (won't be flagged again)"
   - Wait for user response for each STYLISTIC finding
   - If user chooses (a): add finding to the confirmed fix list
   - If user chooses (b): mark as "Skipped (user ignored)" in REVIEW-PROJECT.md Fix Status
   - If user chooses (c): append to `.bee/false-positives.md` (same format as step 5) and mark as "False Positive" in REVIEW-PROJECT.md

7. Build confirmed fix list: all REAL BUG findings (both HIGH confidence and specialist-confirmed) + user-approved STYLISTIC findings (those where user chose option a). Exclude any findings reclassified as FALSE POSITIVE by specialist escalation.
8. Display validation summary: "{real_bug} real bugs, {false_positive} false positives, {stylistic} stylistic ({user_fix} to fix, {user_ignore} ignored), {escalated} escalated ({escalated_real_bug} confirmed, {escalated_false_positive} reclassified as FP)"

#### 4.2: Fix confirmed issues (spawn fixer agents sequentially)

1. Sort confirmed findings by priority order:
   - Priority 1: Critical severity
   - Priority 2: High severity
   - Priority 3: Standards category (Medium)
   - Priority 4: Dead Code category (Medium)
   - Priority 5: Other Medium severity
2. If no confirmed findings (all were false positives, ignored, or skipped): display "No confirmed findings to fix -- all findings were classified as false positives or stylistic (ignored)." Skip to Step 5.
3. For EACH confirmed finding in priority order (SEQUENTIAL -- one at a time, never parallel):
   - Build fixer context packet:
     - Finding details: ID, summary, severity, category, file path, line range, description, suggested fix
     - Validation classification: REAL BUG or STYLISTIC (user-approved)
     - Stack info: stack name from config.json for the fixer to load the stack skill
   - Spawn `fixer` agent via Task tool with the context packet. Use the parent model (omit model parameter) -- fixers write production code and need full reasoning.
   - WAIT for the fixer to complete before spawning the next fixer
   - Read the fixer's fix report from its final message (## Fix Report section)
   - Read current REVIEW-PROJECT.md from disk (fresh read -- Read-Modify-Write pattern)
   - Update REVIEW-PROJECT.md: set Fix Status for this finding to the fixer's reported status (Fixed / Reverted / Failed)
   - Write updated REVIEW-PROJECT.md to disk
   - If fixer reports "Reverted" or "Failed" (tests broke and changes were reverted):
     - Display failure to user: "Fix for F-{NNN} failed -- tests broke after fix. Changes reverted. Skipping this finding."
     - Update REVIEW-PROJECT.md Fix Status to "Skipped (tests failed)"

CRITICAL: Spawn fixers SEQUENTIALLY, one at a time. Never spawn multiple fixers in parallel. One fix may change the context for the next finding. Sequential execution prevents file conflicts and ensures each fixer sees the latest code state.

4. After all confirmed findings have been processed, display fix summary:
   "{fixed} fixed, {skipped} skipped, {failed} failed out of {total} confirmed findings"

### Step 5: Present Compliance Report and Completion

After all steps complete (or early exit from clean review):

1. Read the REVIEW-PROJECT.md file (or use the 0-findings clean result) and present the user a condensed summary:

```
Project Review Complete

Per-Phase Compliance:
- Phase 1 ({name}): {percentage}%
- Phase 2 ({name}): {percentage}%
...

Overall Spec Compliance: {overall_percentage}%

Findings: {total} total
- Real bugs: {confirmed} ({fixed} fixed, {failed} failed)
- False positives: {fp_count} (documented in .bee/false-positives.md)
- Stylistic: {stylistic} ({user_fixed} fixed, {user_ignored} ignored)

Key Gaps:
- {gap 1}
- {gap 2}
...

Recommendations:
- {recommendation 1}
- {recommendation 2}
...

Full report: {spec-path}/REVIEW-PROJECT.md
```

Per-phase compliance percentages are calculated from the findings: for each phase, count the findings associated with files in that phase's directory. Compliance = (total criteria met - findings for that phase) / total criteria met * 100, rounded to the nearest integer. If a phase has no findings, it is 100%.

Overall compliance is the weighted average across all phases.

If overall compliance is 100%: congratulate the user and note the project fully meets the spec.

If gaps exist: suggest creating additional phases to address them. For example:
"Consider running `/bee:plan-phase {N+1}` to address the {gap_count} remaining gaps."

2. Update `.bee/STATE.md` Last Action (Read-Modify-Write pattern -- re-read STATE.md from disk before updating):
   - Command: `/bee:review-project`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Project review: {overall_percentage}% spec compliance, {total_findings} findings, {confirmed} confirmed, {fixed} fixed, {false_positives} false positives"

3. Write updated STATE.md to disk.

4. Display next step suggestion:
   ```
   Next step:
     /clear
     /bee:commit              (if fixes were applied)
     /bee:plan-phase {N+1}    (to address remaining gaps)
   ```

---

**Design Notes (do not display to user):**

- This command uses four parallel specialized agents (bug-detector, pattern-reviewer, plan-compliance-reviewer, stack-reviewer) for project-scope review, mirroring the per-phase review architecture.
- All four agents review ALL executed phases (not just one phase), checking cross-phase integration across the entire project.
- The plan-compliance-reviewer operates in "code review mode" (not plan review mode) and is explicitly instructed to check cross-phase integration across ALL executed phases, not just adjacent ones.
- The validate-fix pipeline is a single pass -- no loop mode. Project reviews are comprehensive one-time checks, not iterative.
- REVIEW-PROJECT.md is written to the spec directory (not a phase directory) because it spans all phases.
- The same finding-validator and fixer agents are used as in per-phase review. The pipeline logic (validation batching, MEDIUM confidence escalation, sequential fixing) is identical.
- Category-to-source_agent mapping for escalation: Bug/Security -> bug-detector, Pattern -> pattern-reviewer, Spec Gap -> plan-compliance-reviewer, Standards -> stack-reviewer.
- Per-phase compliance percentages are derived from the findings: fewer findings for a phase's files means higher compliance. This preserves the existing summary format while using finding-based data.
- Step 2.5 extracts false positives BEFORE spawning agents. Each agent receives the formatted false-positives list in its context packet so it can self-filter.
- Deduplication merges findings from different agents when they reference the same file AND line ranges overlap within 5 lines. Higher severity is kept, categories and descriptions are combined.
- Finding validation can be parallel (up to 5 at a time). Fixing MUST be sequential (one at a time) to prevent fix conflicts.
- Specialist escalation for MEDIUM confidence findings happens AFTER batch validation completes. Escalation uses `bee:{source_agent}` with `model: "sonnet"`. HIGH confidence classifications proceed unchanged.
- Always re-read STATE.md from disk before writing updates (Read-Modify-Write pattern).
- The old single project-reviewer agent spawn is completely removed. This command now orchestrates the full multi-agent pipeline directly.
