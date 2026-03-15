---
description: Context-aware implementation review -- full spec compliance or ad-hoc code review with four-agent pipeline
argument-hint: ""
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`

## Instructions

You are running `/bee:review-implementation` -- a context-aware implementation review for BeeDev. This command detects whether the project has a spec with executed phases (full spec mode) or not (ad-hoc mode), then spawns specialized review agents, validates findings, and fixes confirmed issues. Follow these steps in order.

### Step 1: Validation Guards

Check these guards in order. Stop immediately if any fails:

1. **NOT_INITIALIZED guard:** If `.bee/STATE.md` does not exist (NOT_INITIALIZED), tell the user:
   "BeeDev is not initialized. Run `/bee:init` first."
   Do NOT proceed.

### Step 2: Context Detection -- Full Spec Mode vs Ad-Hoc Mode

Read STATE.md from the dynamic context above. Determine the review mode:

**Full spec mode** applies when BOTH conditions are met:
1. A spec exists: Current Spec Path is not "(none)" and the spec file exists on disk
2. At least one phase has been executed: at least one phase row has Status of EXECUTED, REVIEWED, TESTED, or COMMITTED

If full spec mode applies:
- Read `spec.md` from the spec path. If it does not exist, tell the user: "Spec file not found at {spec-path}/spec.md. STATE.md may be stale." Do NOT proceed.
- Collect all executed phase directory paths (phases with status EXECUTED or beyond: REVIEWED, TESTED, COMMITTED)
- Set output path: `{spec-path}/REVIEW-IMPLEMENTATION.md`
- This mode spawns 4 agents: bug-detector, pattern-reviewer, plan-compliance-reviewer, stack-reviewer
- Display: "Starting full spec implementation review against spec..."

**Ad-hoc mode** applies when EITHER condition is NOT met (no spec, or no executed phases):
- Detect review scope via `git diff --stat`, `git diff --cached --stat`, and `git status --short`
- Filter to source files only (exclude lock files, generated files, `.bee/` directory files)
- If no reviewable source files exist, tell the user: "No changes to review." Do NOT proceed.
- Create `.bee/reviews/` directory if it does not exist
- Set output path: `.bee/reviews/YYYY-MM-DD-{N}.md` where N is `(existing count for today) + 1`
- This mode spawns 3 agents: bug-detector, pattern-reviewer, stack-reviewer (no plan-compliance-reviewer -- without a spec or executed phases there is no plan context to evaluate)
- Display: "Starting ad-hoc implementation review ({count} changed files)..."

### Step 3: Build & Test Gate

This gate is identical for both modes.

**Build check (automatic):**

1. Check `package.json` for a `build` script (run `node -e "const p=require('./package.json'); process.exit(p.scripts?.build ? 0 : 1)"` via Bash). Also check `composer.json` if the stack is Laravel-based.
2. If a build script exists, run it via Bash:
   - Node projects: `npm run build`
   - PHP projects: skip (no build step typically)
3. If build **fails**: display the error output and ask:
   "Build failed. Options: (a) Fix build errors first (b) Continue review anyway"
   - If (a): stop the review. The user fixes and re-runs.
   - If (b): continue (note build failure in the review context).
4. If build **passes**: display "Build: OK" and continue.
5. If no build script exists: display "Build: skipped (no build script)" and continue.

**Test check (user opt-in):**

Ask the user: "Run tests before review? (yes/no)"

If the user says **yes**:
1. Read `testRunner` from `config.json`. If `none`, display "No test runner configured. Skipping." and continue.
2. Detect the best parallel-capable test command:
   - `vitest`: `npx vitest run` (parallel by default via worker threads)
   - `jest`: `npx jest --maxWorkers=auto` (parallel by default via workers)
   - `pest`: `./vendor/bin/pest --parallel` (uses Paratest under the hood)
3. Run the detected test command via Bash (timeout: 5 minutes).
4. If tests **pass**: display "Tests: {count} passed" and continue.
5. If tests **fail**: display the failure summary and ask:
   "Tests failed ({fail_count} failures). Options: (a) Fix test failures first (b) Continue review anyway"
   - If (a): stop. User fixes and re-runs.
   - If (b): continue (note test failures in the review context).

If the user says **no**: display "Tests: skipped" and continue.

### Step 3.5: Extract False Positives

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
4. This formatted list is included verbatim in each agent's context packet in Step 4.

### Step 4: Spawn Review Agents in Parallel

Spawn specialized review agents based on the detected mode. The command (not the agents) writes the output report after consolidating all findings.

#### 4.1: Determine stacks and build context packets

**4.1a: Read stacks from config**

Read `config.stacks` from `config.json`. Build the stack list:
- If `config.stacks` exists and is an array: use it as-is. Each entry has `name` and `path`.
- If `config.stacks` is absent but `config.stack` exists (legacy v2 config): create a single-entry list: `[{ name: config.stack, path: "." }]`.
- If neither exists: stop with error "No stack configured in config.json."

Also read `config.implementation_mode` (defaults to `"quality"` if absent).

**4.1b: Build shared context base**

For full spec mode:
- Spec path: `{spec.md path}`
- All executed phase directory paths (with their phase numbers and names)
- Output file: `{output_path}`
- False positives list: the formatted list from Step 3.5

For ad-hoc mode:
- Changed files list: `{$REVIEW_FILES}`
- Project stack: `{stack from config.json}`
- Output file: `{output_path}`
- False positives list: the formatted list from Step 3.5

**4.1c: Build per-stack context packets**

For each stack in the stacks list, build agent-specific context packets. When the project has a single stack, this loop runs once and behavior is identical to the original approach.

**Agent resolution (stack-specific fallback):** For each per-stack agent, check if a stack-specific variant exists before using the generic agent. For each stack in the stacks list, resolve agents as follows:

- **Bug Detector:** Check if `plugins/bee/agents/stacks/{stack.name}/bug-detector.md` exists. If yes, use `{stack.name}-bug-detector` as the agent name. If no, fallback to generic `bee:bug-detector`.
- **Pattern Reviewer:** Check if `plugins/bee/agents/stacks/{stack.name}/pattern-reviewer.md` exists. If yes, use `{stack.name}-pattern-reviewer` as the agent name. If no, fallback to generic `bee:pattern-reviewer`.
- **Stack Reviewer:** Check if `plugins/bee/agents/stacks/{stack.name}/stack-reviewer.md` exists. If yes, use `{stack.name}-stack-reviewer` as the agent name. If no, fallback to generic `bee:stack-reviewer`.

Generic agents remain the default for any stack that does not have dedicated stack-specific agents in `plugins/bee/agents/stacks/{stack.name}/`.

**Per-stack Agent: Bug Detector** (resolved agent name) -- model set in 4.2 by implementation_mode -- one per stack

For full spec mode:
```
You are reviewing the FULL PROJECT implementation for bugs and security issues. This is a project-scope review across all executed phases, not a single-phase review.

Spec: {spec.md path}
Executed phases:
- Phase {N}: {phase_directory_path}
- Phase {M}: {phase_directory_path}
...
Stack: {stack.name}

{false-positives list from Step 3.5}

For EACH executed phase, read its TASKS.md to find the files created/modified. Scope your file search to files within the `{stack.path}` directory. Review those files for bugs, logic errors, null handling issues, race conditions, edge cases, and security vulnerabilities (OWASP). Report only HIGH confidence findings in your standard output format.
```

For ad-hoc mode:
```
QUICK REVIEW MODE -- No spec, no TASKS.md, no phase context.

You are reviewing changed files for bugs and security issues.

Review ONLY these changed files:
{$REVIEW_FILES -- one per line}

Project stack: {stack.name}

{false-positives list from Step 3.5}

SKIP these categories (no spec/phase context to evaluate):
- Spec Compliance (no spec exists)
- TDD Compliance (no acceptance criteria to check)

Review these files for bugs, logic errors, null handling issues, race conditions, edge cases, and security vulnerabilities (OWASP). Report only HIGH confidence findings in your standard output format.

Target 1-3 findings. Only report issues you have HIGH confidence in.
```

**Per-stack Agent: Pattern Reviewer** (resolved agent name) -- model set in 4.2 by implementation_mode -- one per stack

For full spec mode:
```
You are reviewing the FULL PROJECT implementation for pattern deviations. This is a project-scope review across all executed phases, not a single-phase review.

Spec: {spec.md path}
Executed phases:
- Phase {N}: {phase_directory_path}
- Phase {M}: {phase_directory_path}
...
Stack: {stack.name}

{false-positives list from Step 3.5}

For EACH executed phase, read its TASKS.md to find the files created/modified. Scope your file search to files within the `{stack.path}` directory. For each file, find 2-3 similar existing files in the codebase, extract their patterns, and compare. Report only HIGH confidence deviations in your standard output format.
```

For ad-hoc mode:
```
QUICK REVIEW MODE -- No spec, no TASKS.md, no phase context.

You are reviewing changed files for pattern deviations against the existing codebase.

Review ONLY these changed files:
{$REVIEW_FILES -- one per line}

{false-positives list from Step 3.5}

Compare changed files against existing codebase patterns only. There is no spec to reference -- focus on whether the changed files follow the patterns already established in the project. For each file, find 2-3 similar existing files and compare.

Target 1-3 findings. Only report deviations you have HIGH confidence in.
```

**Per-stack Agent: Stack Reviewer** (resolved agent name) -- model set in 4.2 by implementation_mode -- one per stack

For full spec mode:
```
You are reviewing the FULL PROJECT implementation for stack best practice violations. This is a project-scope review across all executed phases, not a single-phase review.

Spec: {spec.md path}
Executed phases:
- Phase {N}: {phase_directory_path}
- Phase {M}: {phase_directory_path}
...

{false-positives list from Step 3.5}

The stack for this review pass is `{stack.name}`. For EACH executed phase, read its TASKS.md to find the files created/modified. Load the stack skill at `skills/stacks/{stack.name}/SKILL.md` and check all code within the `{stack.path}` directory against that stack's conventions. Use Context7 to verify framework best practices. Report only HIGH confidence violations in your standard output format.
```

For ad-hoc mode:
```
QUICK REVIEW MODE -- No spec, no TASKS.md, no phase context.

You are reviewing changed files for stack best practice violations.

Review ONLY these changed files:
{$REVIEW_FILES -- one per line}

Project stack: {stack.name}

{false-positives list from Step 3.5}

Check changed files against stack conventions only. Load the stack skill from config.json and verify all code follows the stack's conventions. Use Context7 to verify framework best practices.

Target 1-3 findings. Only report violations you have HIGH confidence in.
```

**4.1d: Build global context packet -- full spec mode ONLY**

Before building the packet, check if `{spec-path}/requirements.md` exists on disk. Set the requirements line:
- If found: `Requirements: {spec-path}/requirements.md`
- If not found: `Requirements: (not found -- skip requirement tracking)`

**Global Agent: Plan Compliance Reviewer** (`bee:plan-compliance-reviewer`) -- model set in 4.2 by implementation_mode -- spawned ONCE globally, full spec mode only. This agent is NOT spawned in ad-hoc mode (no spec or plan context to evaluate).

```
You are reviewing the FULL PROJECT implementation in CODE REVIEW MODE (not plan review mode). This is a project-scope review across ALL executed phases.

Spec: {spec.md path}
Requirements: {spec-path}/requirements.md OR (not found -- skip requirement tracking)
Executed phases:
- Phase {N}: {phase_directory_path}
- Phase {M}: {phase_directory_path}
...

{false-positives list from Step 3.5}

Review mode: code review. Check implemented code against spec requirements and acceptance criteria across ALL executed phases. For EACH phase, read its TASKS.md and verify every acceptance criterion has corresponding implementation. Check for missing features, incorrect behavior, and over-scope additions. CRITICAL: Check cross-phase integration across ALL executed phases (not just adjacent phases) -- verify imports, data contracts, workflow connections, and shared state consistency between every pair of phases. Report findings in your standard code review mode output format.
```

#### 4.2: Spawn agents

In full spec mode, the total number of agents is `(3 x N) + 1` where N is the number of stacks (4 for single-stack: 3 per-stack agents + 1 global plan-compliance-reviewer).

In ad-hoc mode, the total number of agents is `3 x N` where N is the number of stacks (3 for single-stack: bug-detector, pattern-reviewer, stack-reviewer -- no plan-compliance-reviewer).

**Economy mode** (`implementation_mode: "economy"`): Pass `model: "sonnet"` for all agents. Spawn agents sequentially per stack to reduce token usage:
1. In full spec mode: spawn the global plan-compliance-reviewer first (single Task tool call, `model: "sonnet"`). Wait for it to complete.
2. For each stack in order: spawn that stack's per-stack agents (bug-detector, pattern-reviewer, stack-reviewer) via Task tool calls in a single message (parallel within the stack, all `model: "sonnet"`). Wait for all to complete before proceeding to the next stack.

**Quality or Premium mode** (default `"quality"`, or `"premium"`): Spawn ALL agents via Task tool calls in a SINGLE message (parallel execution). Omit the model parameter for all agents (they inherit the parent model) -- quality/premium mode uses the stronger model for deeper, more thorough review analysis. Wait for all agents to complete.

Wait for all agents to complete before proceeding.

#### 4.3: Parse findings from each agent

After all agents complete, parse findings from each agent's final message. Each agent has a distinct output format -- normalize all findings into a unified list:

**Bug Detector** findings (from `## Bugs Detected` section):
- Each `- **[Bug type]:** [Description] - \`file:line\`` entry becomes one finding
- Severity: taken from the Critical/High/Medium subsection the entry appears under
- Category: "Bug" (or "Security" if the bug type mentions security, injection, XSS, CSRF, auth, or access control)

**Pattern Reviewer** findings (from `## Project Pattern Deviations` section):
- Each `- **[Pattern type]:** [Deviation description] - \`file:line\`` entry becomes one finding
- Severity: Medium (pattern deviations default to Medium)
- Category: "Pattern"

**Plan Compliance Reviewer** findings (full spec mode only, from `## Plan Compliance Findings` section):
- SG-NNN entries (Spec Gap) -> Category: "Spec Gap", severity from the entry
- CI-NNN entries (Cross-Phase Integration) -> Category: "Spec Gap", severity from the entry
- OS-NNN entries (Over-Scope) -> Category: "Spec Gap", severity: Medium

**Stack Reviewer** findings (from `## Stack Best Practice Violations` section):
- Each `- **[Rule category]:** [Violation description] - \`file:line\`` entry becomes one finding
- Severity: Medium (stack violations default to Medium)
- Category: "Standards"

If an agent reports no findings (e.g., "No bugs detected.", "No project pattern deviations found.", etc.), it contributes zero findings.

#### 4.4: Deduplicate and merge

For each pair of findings from different agents, check if they reference the same file AND their line ranges overlap (within 5 lines of each other). If so, merge them:
- Keep the higher severity (Critical > High > Medium)
- Combine categories (e.g., "Bug, Standards")
- Combine descriptions (concatenate with "; " separator)
- Use the broader line range

#### 4.5: Assign IDs and write output report

1. Assign sequential IDs to all merged findings: F-001, F-002, F-003, ...
2. Write `{output_path}` using the review-report template (`skills/core/templates/review-report.md`):
   - For full spec mode: Summary section with spec name, "Full Project" (instead of phase number), date, iteration: 1 of 1, status: PENDING
   - For ad-hoc mode: Summary section with Spec="Ad-Hoc Review", Phase="N/A", date, iteration: 1 of 1, status: PENDING
   - Fill in the Counts tables (by severity and by category)
   - Write each finding as a `### F-NNN` section with: Severity, Category, File, Lines, Description, Suggested Fix, Validation: pending, Fix Status: pending
   - Leave the False Positives section empty
   - Leave the Fix Summary table with one row per finding, all showing "pending"
3. Verify the output report was written by reading it back with the Read tool.

#### 4.6: Evaluate findings

1. Count total findings, count by severity (critical, high, medium), count by category.

2. If 0 findings after consolidation:
   - Read current STATE.md from disk
   - For full spec mode: set Last Action result to "Implementation review: 100% spec compliance -- clean code"
   - For ad-hoc mode: set Last Action result to "Ad-hoc review: clean code -- no findings"
   - Write STATE.md to disk
   - Display: "Review complete -- clean code! No findings from {agent_count} reviewers."
   - Skip to Step 7 (completion summary).

3. Display findings summary:
   - Full spec mode: "{N} findings from {agent_count} reviewers ({stack_count} stacks): {critical} critical, {high} high, {medium} medium"
   - Ad-hoc mode: "{N} findings from {agent_count} reviewers: {critical} critical, {high} high, {medium} medium"

4. If more than 10 findings: present the list to user before proceeding:
   "The review found {N} findings (above typical range). Review the list at {output_path} and confirm you want to proceed with validation."
   Wait for user confirmation. If user declines, stop.

### Step 5: Parse, Deduplicate, and Write Output

This step is handled inline in Step 4.3 through 4.5 above. After the output report is written and findings are evaluated, proceed to the validate-fix pipeline.

### Step 6: Validate-Fix Pipeline

#### 6.1: Validate each finding (spawn finding-validator agents)

1. For each finding in the output report (parsed from the `### F-NNN` sections):
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
   - Record the escalation: append " (Escalated to {source_agent} -- reclassified as {verdict})" to the finding's Validation field in the output report
   - Display each escalation: "Escalated F-{NNN} to {source_agent} -- reclassified as {verdict}"
4. Read current output report from disk (fresh read). Update the output report:
   - Set each finding's Validation field to the final classification:
     - HIGH confidence findings: the validator's verdict (REAL BUG / FALSE POSITIVE / STYLISTIC)
     - Escalated MEDIUM confidence findings: the specialist's verdict with escalation note
   - Update the Counts table with classification breakdown
5. Handle FALSE POSITIVE findings (including those reclassified by specialist escalation):
   - If `.bee/false-positives.md` does not exist, create it with a `# False Positives` header
   - Read `.bee/false-positives.md`, count the number of existing `## FP-` headings, set the next FP number to count + 1
   - For each FALSE POSITIVE finding, append an entry (incrementing the FP number for each):
     ```
     ## FP-{NNN}: {one-line summary}
     - **Finding:** {original finding description from the output report}
     - **Reason:** {validator's reason for FALSE POSITIVE classification}
     - **Phase:** {phase number | "Ad-Hoc"}
     - **Date:** {current ISO 8601 date}
     ```
   - For findings reclassified as FALSE POSITIVE via specialist escalation, include the specialist's reason (not the validator's) in the Reason field
   - Update output report: set the finding's Fix Status to "False Positive"

6. Handle STYLISTIC findings (user interaction):
   - For each STYLISTIC finding, present to user:
     "STYLISTIC finding: F-{NNN} -- '{summary}'. Options: (a) Fix it, (b) Ignore, (c) False Positive (won't be flagged again)"
   - Wait for user response for each STYLISTIC finding
   - If user chooses (a): add finding to the confirmed fix list
   - If user chooses (b): mark as "Skipped (user ignored)" in the output report Fix Status
   - If user chooses (c): append to `.bee/false-positives.md` (same format as step 5) and mark as "False Positive" in the output report

7. Build confirmed fix list: all REAL BUG findings (both HIGH confidence and specialist-confirmed) + user-approved STYLISTIC findings (those where user chose option a). Exclude any findings reclassified as FALSE POSITIVE by specialist escalation.
8. Display validation summary: "{real_bug} real bugs, {false_positive} false positives, {stylistic} stylistic ({user_fix} to fix, {user_ignore} ignored), {escalated} escalated ({escalated_real_bug} confirmed, {escalated_false_positive} reclassified as FP)"

#### 6.2: Fix confirmed issues (spawn fixer agents sequentially)

1. Sort confirmed findings by priority order:
   - Priority 1: Critical severity
   - Priority 2: High severity
   - Priority 3: Standards category (Medium)
   - Priority 4: Dead Code category (Medium)
   - Priority 5: Other Medium severity
2. If no confirmed findings (all were false positives, ignored, or skipped): display "No confirmed findings to fix -- all findings were classified as false positives or stylistic (ignored)." Skip to Step 7.
3. For EACH confirmed finding in priority order (SEQUENTIAL -- one at a time, never parallel):
   - Build fixer context packet:
     - Finding details: ID, summary, severity, category, file path, line range, description, suggested fix
     - Validation classification: REAL BUG or STYLISTIC (user-approved)
     - Stack info: resolve the correct stack for the finding's file path using path-overlap logic (compare the finding's file path against each stack's `path` in config.stacks -- a file matches a stack if the file path starts with or is within the stack's path; `"."` matches everything). Pass the resolved stack name explicitly.
   - Spawn `fixer` agent via Task tool with the context packet. Use the parent model (omit model parameter) -- fixers write production code and need full reasoning.
   - WAIT for the fixer to complete before spawning the next fixer
   - Read the fixer's fix report from its final message (## Fix Report section)
   - Read current output report from disk (fresh read -- Read-Modify-Write pattern)
   - Update output report: set Fix Status for this finding to the fixer's reported status (Fixed / Reverted / Failed)
   - Write updated output report to disk
   - If fixer reports "Reverted" or "Failed" (tests broke and changes were reverted):
     - Display failure to user: "Fix for F-{NNN} failed -- tests broke after fix. Changes reverted. Skipping this finding."
     - Update output report Fix Status to "Skipped (tests failed)"

CRITICAL: Spawn fixers SEQUENTIALLY, one at a time. Never spawn multiple fixers in parallel. One fix may change the context for the next finding. Sequential execution prevents file conflicts and ensures each fixer sees the latest code state.

4. After all confirmed findings have been processed, display fix summary:
   "{fixed} fixed, {skipped} skipped, {failed} failed out of {total} confirmed findings"

### Step 7: Summary and STATE.md Update

After all steps complete (or early exit from clean review):

#### Full Spec Mode Summary

1. Read the output report and present a condensed summary:

```
Implementation Review Complete

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

Full report: {spec-path}/REVIEW-IMPLEMENTATION.md
```

Per-phase compliance percentages are calculated from the findings: for each phase, count the findings associated with files in that phase's directory. Compliance = (total criteria met - findings for that phase) / total criteria met * 100, rounded to the nearest integer. If a phase has no findings, it is 100%.

2. Update `.bee/STATE.md` (Read-Modify-Write pattern -- re-read STATE.md from disk before updating):
   - Last Action:
     - Command: `/bee:review-implementation`
     - Timestamp: current ISO 8601 timestamp
     - Result: "Implementation review: {overall_percentage}% spec compliance, {total_findings} findings, {confirmed} confirmed, {fixed} fixed, {false_positives} false positives"
   - If ALL phases have Status COMMITTED: set Current Spec Status to COMPLETED
3. Write updated STATE.md to disk.

4. Display next step suggestion:
   ```
   Next step:
     /clear
     /bee:commit              (if fixes were applied)
     /bee:plan-phase {N+1}    (to address remaining gaps)
   ```

#### Ad-Hoc Mode Summary

1. Display completion summary:

```
Ad-Hoc Review Complete

Findings: {total} total
- Fixed: {fixed}
- False positives: {fp}
- Skipped: {skipped}

Review saved: {output_path}
```

2. Update `.bee/STATE.md` Last Action (Read-Modify-Write pattern):
   - Command: `/bee:review-implementation`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Ad-hoc review: {total_findings} findings, {confirmed} confirmed, {fixed} fixed"
3. Write updated STATE.md to disk.

4. Display next step suggestion:
   ```
   Next step:
     /clear
     /bee:commit              (if fixes were applied)
   ```

---

**Design Notes (do not display to user):**

- This command unifies full spec review and ad-hoc review into a single context-aware command. Mode is detected automatically from STATE.md.
- Full spec mode spawns 4 agent types: bug-detector, pattern-reviewer, plan-compliance-reviewer, stack-reviewer. The plan-compliance-reviewer is the global agent (spawned once, not per-stack). Total agents: `(3 x N) + 1` where N = number of stacks.
- Ad-hoc mode spawns 3 agent types: bug-detector, pattern-reviewer, stack-reviewer. No plan-compliance-reviewer because there is no spec or plan context. Total agents: `3 x N` where N = number of stacks.
- Multi-stack logic follows the same pattern as review.md: per-stack agents (bug-detector, pattern-reviewer, stack-reviewer) with stack-specific fallback routing, plus one global plan-compliance-reviewer (full spec mode only).
- The Build & Test Gate is identical for both modes -- a single step applied before agent spawning.
- The validate-fix pipeline (Step 6) is identical for both modes: finding-validator batched (up to 5 at a time), MEDIUM confidence escalation to source specialist, sequential fixers.
- Output paths differ by mode: full spec writes to `{spec-path}/REVIEW-IMPLEMENTATION.md`, ad-hoc writes to `.bee/reviews/YYYY-MM-DD-{N}.md`.
- COMPLETED status is set on STATE.md Current Spec Status only in full spec mode when all phases are COMMITTED. This reflects that the spec lifecycle is complete.
- This command never auto-commits. The user runs `/bee:commit` manually.
- This command never writes to CLAUDE.md.
- Always use Read-Modify-Write pattern when updating STATE.md and the output report.
- Stack-specific agent variants follow the same resolution pattern as review.md Step 4.1c: check `plugins/bee/agents/stacks/{stack.name}/{role}.md`, fallback to generic `bee:{role}`.
- Category-to-source_agent mapping for escalation: Bug/Security -> bug-detector, Pattern -> pattern-reviewer, Spec Gap -> plan-compliance-reviewer, Standards -> stack-reviewer.
