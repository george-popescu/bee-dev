---
description: Review current phase implementation against spec, standards, and quality checklist
argument-hint: "[--loop]"
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`

## Instructions

You are running `/bee:review` -- the code review pipeline for BeeDev. This command orchestrates a four-step pipeline: review code, validate findings, fix confirmed issues, and optionally re-review. Follow these steps in order.

### Step 1: Validation Guards

Check these guards in order. Stop immediately if any fails:

1. **NOT_INITIALIZED guard:** If the dynamic context above contains "NOT_INITIALIZED" (meaning `.bee/STATE.md` does not exist), tell the user:
   "BeeDev is not initialized. Run `/bee:init` first."
   Do NOT proceed.

2. **NO_SPEC guard:** Read STATE.md from the dynamic context above. If no Current Spec Path exists or it shows "(none)", tell the user:
   "No spec found. Run `/bee:new-spec` first."
   Do NOT proceed.

3. **Phase detection:** Read the Phases table from STATE.md. Find the first phase where: Status is "EXECUTED" or "REVIEWED". This allows both first-time reviews and re-reviews of already-reviewed phases. If no such phase exists, tell the user:
   "No executed phases waiting for review. Run `/bee:execute-phase N` first."
   Do NOT proceed.

4. **Already reviewing guard:** If the Status column for the detected phase shows "REVIEWING", warn the user:
   "Phase {N} review is in progress. Continue from where it left off?"
   Wait for explicit confirmation before proceeding. If the user declines, stop.

### Step 2: Load Phase Context

1. Read STATE.md to find the Current Spec Path
2. Determine the phase number and slug from the Phases table
3. Construct paths:
   - Phase directory: `{spec-path}/phases/{NN}-{slug}/`
   - TASKS.md: `{phase_directory}/TASKS.md`
   - spec.md: `{spec-path}/spec.md`
4. Read TASKS.md to identify files created/modified by the phase
5. Note whether `.bee/false-positives.md` exists (Step 3.9 extracts false positives before review agents)
6. Check `$ARGUMENTS` for `--loop` flag
7. Read `config.json` from dynamic context for `review.loop` and `review.max_loop_iterations` settings
8. Determine loop mode: enabled if `--loop` in arguments OR `config.review.loop` is true
9. Set max iterations: from `config.review.max_loop_iterations` (default: 3)
10. Check the Reviewed column for the detected phase. If it shows "Yes (N)" for some number N, this is a re-review -- set the base iteration count to N. Otherwise (empty or no previous review), set the base iteration count to 0.
11. Initialize iteration counter to base iteration count + 1 (first review = 1, first re-review of "Yes (1)" = 2, etc.)

### Step 3: Archive Previous Review (if re-review) and Update STATE.md

Read current `.bee/STATE.md` from disk (fresh read, not cached dynamic context).

**3a. Archive previous REVIEW.md (re-review only):**

If the detected phase has a Reviewed value of "Yes (N)" (i.e., it was previously reviewed):
1. Check if `{phase_directory}/REVIEW.md` exists on disk
2. If it exists, rename it to `{phase_directory}/REVIEW-{N}.md` where N is the iteration number extracted from "Yes (N)" (e.g., "Yes (1)" -> archive as `REVIEW-1.md`, "Yes (2)" -> archive as `REVIEW-2.md`)
3. Display: "Archived previous review as REVIEW-{N}.md"

If the phase has not been reviewed before (Reviewed column is empty), skip archival.

**3b. Update STATE.md:**

1. Set the phase row's Status to `REVIEWING`
2. Set Last Action to:
   - Command: `/bee:review`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Starting review of phase {N} (iteration {iteration_counter})"
3. Write updated STATE.md to disk

Display to user: "Starting review of Phase {N}: {phase-name} (iteration {iteration_counter})..."

### Step 3.5: Build & Test Gate

**Build check (automatic):**

1. Check `package.json` for a `build` script (run `node -e "const p=require('./package.json'); process.exit(p.scripts?.build ? 0 : 1)"` via Bash). Also check `composer.json` if the stack is Laravel-based.
2. If a build script exists, run it via Bash:
   - Node projects: `npm run build`
   - PHP projects: skip (no build step typically)
3. If build **fails**: display the error output and ask:
   "Build failed. Options: (a) Fix build errors first (b) Continue review anyway"
   - If (a): stop the review. The user fixes and re-runs `/bee:review`.
   - If (b): continue to review (note build failure in the review context).
4. If build **passes**: display "Build: OK" and continue.
5. If no build script exists: display "Build: skipped (no build script)" and continue.

**Test check (user opt-in):**

Ask the user: "Run tests before review? (yes/no)"

If the user says **yes**:
1. Read `testRunner` from `config.json`. If `none`, display "No test runner configured. Skipping." and continue.
2. Detect the best parallel-capable test command:
   - `vitest`: `npx vitest run` (parallel by default via worker threads)
   - `jest`: `npx jest` (parallel by default via workers, use `--maxWorkers=auto` if not set)
   - `pest`: `./vendor/bin/pest --parallel` (uses Paratest under the hood)
3. Run the detected test command via Bash (timeout: 5 minutes).
4. If tests **pass**: display "Tests: {count} passed" and continue.
5. If tests **fail**: display the failure summary and ask:
   "Tests failed ({fail_count} failures). Options: (a) Fix test failures first (b) Continue review anyway"
   - If (a): stop. User fixes and re-runs.
   - If (b): continue (note test failures in the review context).

If the user says **no**: display "Tests: skipped" and continue.

### Step 3.9: Extract False Positives

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

### Step 4: STEP 1 -- REVIEW (spawn specialized agents)

Spawn specialized review agents. In a multi-stack project, bug-detector, pattern-reviewer, and stack-reviewer are spawned once per stack (3 per-stack agents), while plan-compliance-reviewer is spawned ONCE globally (stack-agnostic). Total agents: `(3 x N) + 1` where N = number of stacks. For single-stack projects, N = 1 so exactly 4 agents are spawned (identical to original behavior). The command (not the agents) writes REVIEW.md after consolidating all findings from all stacks.

#### 4.1: Determine stacks and build context packets

**4.1a: Read stacks from config**

Read `config.stacks` from `config.json`. Build the stack list:
- If `config.stacks` exists and is an array: use it as-is. Each entry has `name` and `path`.
- If `config.stacks` is absent but `config.stack` exists (legacy v2 config): create a single-entry list: `[{ name: config.stack, path: "." }]`.
- If neither exists: stop with error "No stack configured in config.json."

Also read `config.implementation_mode` (defaults to `"quality"` if absent).

**4.1b: Build shared context base**

Build a shared context base for all agents:
- Spec path: `{spec.md path}`
- TASKS.md path: `{TASKS.md path}`
- Phase directory: `{phase_directory}`
- Phase number: `{N}`
- False positives list: the formatted list from Step 3.9

**4.1c: Build per-stack context packets**

For each stack in the stacks list, build three agent-specific context packets. When the project has a single stack, this loop runs once and behavior is identical to the original four-agent approach.

**Agent resolution (stack-specific fallback):** For each per-stack agent, check if a stack-specific variant exists before using the generic agent. For each stack in the stacks list, resolve agents as follows:

- **Bug Detector:** Check if `plugins/bee/agents/stacks/{stack.name}/bug-detector.md` exists. If yes, use `{stack.name}-bug-detector` as the agent name. If no, fallback to generic `bee:bug-detector`.
- **Pattern Reviewer:** Check if `plugins/bee/agents/stacks/{stack.name}/pattern-reviewer.md` exists. If yes, use `{stack.name}-pattern-reviewer` as the agent name. If no, fallback to generic `bee:pattern-reviewer`.
- **Stack Reviewer:** Check if `plugins/bee/agents/stacks/{stack.name}/stack-reviewer.md` exists. If yes, use `{stack.name}-stack-reviewer` as the agent name. If no, fallback to generic `bee:stack-reviewer`.

Generic agents remain the default for any stack that does not have dedicated stack-specific agents in `plugins/bee/agents/stacks/{stack.name}/`.

**Per-stack Agent: Bug Detector** (resolved agent name -- see agent resolution above) -- model set in 4.2 by implementation_mode -- one per stack
```
You are reviewing Phase {N} implementation for bugs and security issues.

Spec: {spec.md path}
TASKS.md: {TASKS.md path}
Phase directory: {phase_directory}
Phase number: {N}
Stack: {stack.name}

{false-positives list from Step 3.9}

Read TASKS.md to find the files created/modified by this phase. Scope your file search to files within the `{stack.path}` directory. Review those files for bugs, logic errors, null handling issues, race conditions, edge cases, and security vulnerabilities (OWASP). If a project-level CLAUDE.md exists at the project root, read it for project-specific overrides (CLAUDE.md takes precedence over stack skill for project-specific conventions). Report only HIGH confidence findings in your standard output format.
```

**Per-stack Agent: Pattern Reviewer** (resolved agent name -- see agent resolution above) -- model set in 4.2 by implementation_mode -- one per stack
```
You are reviewing Phase {N} implementation for pattern deviations.

Spec: {spec.md path}
TASKS.md: {TASKS.md path}
Phase directory: {phase_directory}
Phase number: {N}
Stack: {stack.name}

{false-positives list from Step 3.9}

Read TASKS.md to find the files created/modified by this phase. Scope your file search to files within the `{stack.path}` directory. For each file, find 2-3 similar existing files in the codebase, extract their patterns, and compare. If a project-level CLAUDE.md exists at the project root, read it for project-specific overrides. Report only HIGH confidence deviations in your standard output format.
```

**Per-stack Agent: Stack Reviewer** (resolved agent name -- see agent resolution above) -- model set in 4.2 by implementation_mode -- one per stack
```
You are reviewing Phase {N} implementation for stack best practice violations.

Spec: {spec.md path}
TASKS.md: {TASKS.md path}
Phase directory: {phase_directory}
Phase number: {N}

{false-positives list from Step 3.9}

The stack for this review pass is `{stack.name}`. Load the stack skill at `skills/stacks/{stack.name}/SKILL.md` and check all code within the `{stack.path}` directory against that stack's conventions. If a project-level CLAUDE.md exists at the project root, read it for project-specific overrides (CLAUDE.md takes precedence over stack skill). Use Context7 to verify framework best practices. Report only HIGH confidence violations in your standard output format.
```

**4.1d: Build global context packet (spawned ONCE, not per-stack)**

Before building the packet, check if `{spec-path}/requirements.md` exists on disk. Set the requirements line:
- If found: `Requirements: {spec-path}/requirements.md`
- If not found: `Requirements: (not found -- skip requirement tracking)`

**Global Agent: Plan Compliance Reviewer** (`bee:plan-compliance-reviewer`) -- model set in 4.2 by implementation_mode -- spawned ONCE globally
```
You are reviewing Phase {N} implementation in CODE REVIEW MODE (not plan review mode).

Spec: {spec.md path}
TASKS.md: {TASKS.md path}
Requirements: {spec-path}/requirements.md OR (not found -- skip requirement tracking)
Phase directory: {phase_directory}
Phase number: {N}

{false-positives list from Step 3.9}

Review mode: code review. Check implemented code against spec requirements and acceptance criteria. Verify every acceptance criterion in TASKS.md has corresponding implementation. Check for missing features, incorrect behavior, and over-scope additions. If phase > 1, also check cross-phase integration (imports, data contracts, workflow connections, shared state). If a project-level CLAUDE.md exists at the project root, read it for project-specific overrides. Report findings in your standard code review mode output format.
```

#### 4.2: Spawn agents

The total number of agents is `(3 x N) + 1` where N is the number of stacks. For a single-stack project this is exactly 4.

**Economy mode** (`implementation_mode: "economy"`): Pass `model: "sonnet"` for all agents. Spawn agents sequentially per stack to reduce token usage:
1. Spawn the global plan-compliance-reviewer first (single Task tool call, `model: "sonnet"`). Wait for it to complete.
2. For each stack in order: spawn that stack's 3 per-stack agents (bug-detector, pattern-reviewer, stack-reviewer) via three Task tool calls in a single message (parallel within the stack, all `model: "sonnet"`). Wait for all three to complete before proceeding to the next stack.
In economy mode with a single stack, this results in the same 4 agents but spawned in two sequential batches instead of one parallel batch.

**Quality or Premium mode** (default `"quality"`, or `"premium"`): Spawn ALL agents (all per-stack agents + the global plan-compliance-reviewer) via Task tool calls in a SINGLE message (parallel execution). Omit the model parameter for all agents (they inherit the parent model) -- quality/premium mode uses the stronger model for deeper, more thorough review analysis. Wait for all agents to complete.

Wait for all agents to complete before proceeding.

#### 4.3: Parse findings from each agent

After all agents complete, parse findings from each agent's final message. Each agent has a distinct output format -- normalize all findings into a unified list. Findings from all stacks are combined into a single consolidated list:

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

#### 4.4: Deduplicate and merge

For each pair of findings from different agents, check if they reference the same file AND their line ranges overlap (within 5 lines of each other). If so, merge them:
- Keep the higher severity (Critical > High > Medium)
- Combine categories (e.g., "Bug, Standards")
- Combine descriptions (concatenate with "; " separator)
- Use the broader line range

#### 4.5: Assign IDs and write REVIEW.md

1. Assign sequential IDs to all merged findings: F-001, F-002, F-003, ...
2. Write `{phase_directory}/REVIEW.md` using the review-report template (`skills/core/templates/review-report.md`):
   - Fill in the Summary section (spec name, phase number, date, iteration, status: PENDING)
   - Fill in the Counts tables (by severity and by category)
   - Write each finding as a `### F-NNN` section with: Severity, Category, File, Lines, Description, Suggested Fix, Validation: pending, Fix Status: pending
   - Leave the False Positives section empty
   - Leave the Fix Summary table with one row per finding, all showing "pending"
3. Verify REVIEW.md was written by reading it back with the Read tool.

#### 4.6: Evaluate findings

1. Count total findings, count by severity (critical, high, medium), count by category.

2. If 0 findings after consolidation:
   - Read current STATE.md from disk
   - Set Reviewed column to "Yes ({iteration_counter})" where iteration_counter is the current cumulative iteration count
   - Set Status to REVIEWED
   - Set Last Action result to "Phase {N} reviewed (iteration {iteration_counter}): 0 findings -- clean code"
   - Write STATE.md to disk
   - Display: "Review complete -- clean code! No findings (iteration {iteration_counter}). Next step: Run `/bee:test` to test this phase."
   - Stop here.

3. Display findings summary: "{N} findings from {agent_count} reviewers ({stack_count} stacks): {critical} critical, {high} high, {medium} medium" (for single-stack, omit the stacks part: "{N} findings from 4 reviewers: {critical} critical, {high} high, {medium} medium")

4. If more than 10 findings: present the list to user before proceeding:
   "The review found {N} findings (above typical range). Review the list in REVIEW.md and confirm you want to proceed with validation."
   Wait for user confirmation. If user declines, stop.

### Step 5: STEP 2 -- VALIDATE EACH FINDING (spawn finding-validator agents)

1. For each finding in REVIEW.md (parsed from the `### F-NNN` sections):
   - Build validation context: finding ID, summary, severity, category, file path, line range, description, suggested fix, and `source_agent` (the specialist agent that originally produced the finding -- determined by category mapping: Bug/Security -> `bug-detector`, Pattern -> `pattern-reviewer`, Spec Gap -> `plan-compliance-reviewer`, Standards -> `stack-reviewer`)
   - Spawn `finding-validator` agent via Task tool and the finding context. Model selection: **economy** mode passes `model: "sonnet"`, **quality or premium** mode omits model (inherit parent) -- finding validation is critical classification work
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
   - Record the escalation: append " (Escalated to {source_agent} -- reclassified as {verdict})" to the finding's Validation field in REVIEW.md (e.g., "FALSE POSITIVE (Escalated to bug-detector -- reclassified as FALSE POSITIVE)" or "REAL BUG (Escalated to pattern-reviewer -- reclassified as REAL BUG)")
   - Display each escalation: "Escalated F-{NNN} to {source_agent} -- reclassified as {verdict}"
4. Read current REVIEW.md from disk (fresh read -- another validator batch may have been processed). Update REVIEW.md:
   - Set each finding's Validation field to the final classification:
     - HIGH confidence findings: the validator's verdict (REAL BUG / FALSE POSITIVE / STYLISTIC)
     - Escalated MEDIUM confidence findings: the specialist's verdict with escalation note (e.g., "REAL BUG (Escalated to bug-detector -- reclassified as REAL BUG)")
   - Update the Counts table with classification breakdown
5. Handle FALSE POSITIVE findings (including those reclassified by specialist escalation):
   - If `.bee/false-positives.md` does not exist, create it with a `# False Positives` header
   - Read `.bee/false-positives.md`, count the number of existing `## FP-` headings, set the next FP number to count + 1
   - For each FALSE POSITIVE finding, append an entry (incrementing the FP number for each):
     ```
     ## FP-{NNN}: {one-line summary}
     - **Finding:** {original finding description from REVIEW.md}
     - **Reason:** {validator's reason for FALSE POSITIVE classification}
     - **Phase:** {phase number}
     - **Date:** {current ISO 8601 date}
     ```
   - For findings reclassified as FALSE POSITIVE via specialist escalation, include the specialist's reason (not the validator's) in the Reason field
   - Update REVIEW.md: set the finding's Fix Status to "False Positive"

6. Handle STYLISTIC findings (user interaction):
   - For each STYLISTIC finding, present to user:
     "STYLISTIC finding: F-{NNN} -- '{summary}'. Options: (a) Fix it, (b) Ignore, (c) False Positive (won't be flagged again)"
   - Wait for user response for each STYLISTIC finding
   - If user chooses (a): add finding to the confirmed fix list
   - If user chooses (b): mark as "Skipped (user ignored)" in REVIEW.md Fix Status
   - If user chooses (c): append to `.bee/false-positives.md` (same format as step 5) and mark as "False Positive" in REVIEW.md

7. Build confirmed fix list: all REAL BUG findings (both HIGH confidence and specialist-confirmed) + user-approved STYLISTIC findings (those where user chose option a). Exclude any findings reclassified as FALSE POSITIVE by specialist escalation.
8. Display validation summary: "{real_bug} real bugs, {false_positive} false positives, {stylistic} stylistic ({user_fix} to fix, {user_ignore} ignored), {escalated} escalated ({escalated_real_bug} confirmed, {escalated_false_positive} reclassified as FP)"

### Step 6: STEP 3 -- FIX CONFIRMED ISSUES (spawn fixer agents sequentially)

1. Sort confirmed findings by priority order:
   - Priority 1: Critical severity
   - Priority 2: High severity
   - Priority 3: Standards category (Medium)
   - Priority 4: Dead Code category (Medium)
   - Priority 5: Other Medium severity
2. If no confirmed findings (all were false positives, ignored, or skipped): display "No confirmed findings to fix -- all findings were classified as false positives or stylistic (ignored)." Update STATE.md and skip to Step 8.
3. For EACH confirmed finding in priority order (SEQUENTIAL -- one at a time, never parallel):
   - Build fixer context packet:
     - Finding details: ID, summary, severity, category, file path, line range, description, suggested fix
     - Validation classification: REAL BUG or STYLISTIC (user-approved)
     - Stack info: resolve the correct stack for the finding's file path using path-overlap logic (compare the finding's file path against each stack's `path` in config.stacks -- a file matches a stack if the file path starts with or is within the stack's path; `"."` matches everything). Pass the resolved stack name explicitly: "Stack: {resolved-stack-name}. Load the stack skill at skills/stacks/{resolved-stack-name}/SKILL.md." If only one stack is configured, use it directly.
   - Spawn `fixer` agent via Task tool with the context packet. Use the parent model (omit model parameter) -- fixers write production code and need full reasoning.
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

### Step 7: STEP 4 -- RE-REVIEW (if loop mode enabled)

1. If loop mode is NOT enabled: skip to Step 8 (completion)
2. Increment iteration counter
3. If iteration counter > max iterations:
   - Display: "Max review iterations ({max}) reached. Review complete."
   - Skip to Step 8
4. Display: "Starting re-review iteration {counter}..."

#### 7.1: Archive current REVIEW.md

Before the re-review overwrites REVIEW.md, archive the current one:
1. Compute the previous iteration number: current iteration counter minus 1 (this is the iteration that produced the current REVIEW.md)
2. Rename `{phase_directory}/REVIEW.md` to `{phase_directory}/REVIEW-{previous_iteration}.md`
3. Display: "Archived previous review as REVIEW-{previous_iteration}.md"

#### 7.2: Re-extract false positives

Re-run the Step 3.9 false-positive extraction. The `.bee/false-positives.md` file now includes any FPs documented during the previous iteration's validation step:
1. Read `.bee/false-positives.md` using the Read tool
2. If the file exists, build the updated formatted false-positives list (same format as Step 3.9)
3. If the file does not exist, set the false-positives list to: `"No documented false positives."`

#### 7.3: Spawn review agents (same multi-stack logic as Step 4)

Apply the same multi-stack spawning logic as Step 4. Rebuild context packets using Step 4.1 (same stacks list, same per-stack and global agent structure) but with the refreshed false-positives list from Step 7.2. The agents review the updated code (including all fixes applied in previous iterations).

- **Per-stack agents** (bug-detector, pattern-reviewer, stack-reviewer): one set per stack, same context packets as Step 4.1c with updated false-positives
- **Global agent** (plan-compliance-reviewer): spawned ONCE, same context packet as Step 4.1d with updated false-positives

Spawn using the same economy/quality/premium mode logic as Step 4.2. Wait for all agents to complete.

#### 7.4: Parse, deduplicate, and write new REVIEW.md

Apply the same consolidation and deduplication logic as Steps 4.3 through 4.5:
1. Parse findings from each agent's final message using the same category/severity mapping as Step 4.3
2. Deduplicate and merge overlapping findings using the same rules as Step 4.4 (same file + line ranges within 5 lines -> merge with higher severity, combined categories/descriptions)
3. Assign sequential IDs (F-001, F-002, ...) and write the new `{phase_directory}/REVIEW.md` using the review-report template, with the iteration number set to the current iteration counter in the Summary section

#### 7.5: Evaluate re-review findings

1. Count total findings after consolidation
2. If 0 new findings after consolidation:
   - Display: "Re-review clean -- no new findings after iteration {counter}."
   - Skip to Step 8 (completion)
3. If new findings found:
   - Display: "Re-review found {N} new findings. Validating and fixing..."
   - Repeat from Step 5 (validate findings -> fix confirmed issues -> check for another loop iteration at Step 7)

### Step 8: Completion

After all steps complete (or early exit from clean review):

1. Update STATE.md:
   - Reviewed column: "Yes ({iteration_counter})" where iteration_counter is the cumulative review iteration count (first review = 1, first re-review = 2, etc.)
   - Status: `REVIEWED`
   - Last Action:
     - Command: `/bee:review`
     - Timestamp: current ISO 8601 timestamp
     - Result: "Phase {N} reviewed (iteration {iteration_counter}): {total_findings} findings, {confirmed} confirmed, {fixed} fixed, {false_positives} false positives"
2. Write updated STATE.md to disk
3. Display completion summary:

```
Phase {N} reviewed!

Phase: {phase-name}
Findings: {total} total
- Real bugs: {confirmed} ({fixed} fixed, {failed} failed)
- False positives: {fp_count} (documented in .bee/false-positives.md)
- Stylistic: {stylistic} ({user_fixed} fixed, {user_ignored} ignored)
Iterations: {iteration_count}

Next step:
  /clear
  /bee:test              (or /bee:plan-phase {N+1} to skip testing)
```

---

**Design Notes (do not display to user):**

- The command auto-detects the phase to review (first EXECUTED or REVIEWED phase). Re-reviewing an already-reviewed phase is allowed -- the previous REVIEW.md is archived as REVIEW-{N}.md where N is the previous iteration number, and the iteration counter increments.
- In multi-stack projects, bug-detector, pattern-reviewer, and stack-reviewer are spawned once per stack (3 per-stack agents) while plan-compliance-reviewer is spawned ONCE globally (stack-agnostic). Total: `(3 x N) + 1` agents where N = number of stacks. For single-stack projects this is exactly 4 agents, identical to the original behavior. Model tier depends on `implementation_mode`: quality/premium mode omits model (inherits parent for deeper analysis); economy mode passes `model: "sonnet"` and spawns agents sequentially per stack to reduce token usage.
- The command (not the agents) writes REVIEW.md. Agents report findings in their own output formats; the command normalizes, deduplicates, and writes the unified REVIEW.md.
- Step 3.9 extracts false positives BEFORE spawning agents. Each agent receives the formatted false-positives list in its context packet so it can self-filter. The command does NOT need to post-filter.
- The plan-compliance-reviewer operates in "code review mode" (not plan review mode). The context packet explicitly states this.
- Deduplication merges findings from different agents when they reference the same file AND line ranges overlap within 5 lines. Higher severity is kept, categories and descriptions are combined.
- REVIEW.md is the pipeline state, progressively updated as validation and fixing proceed. Analogous to TASKS.md checkboxes in execute-phase.
- Finding validation can be parallel (up to 5 at a time). Fixing MUST be sequential (one at a time) to prevent fix conflicts.
- Specialist escalation for MEDIUM confidence findings happens AFTER batch validation completes (not inline during validation batching). Flow: (1) batch validate up to 5 findings, (2) collect all classifications, (3) for MEDIUM confidence ones, spawn the source specialist sequentially for a second opinion, (4) then proceed to update REVIEW.md with final classifications. Escalation uses `bee:{source_agent}` (e.g., `bee:bug-detector`) with `model: "sonnet"`. HIGH confidence classifications proceed unchanged -- only MEDIUM triggers escalation.
- The command handles user interaction for STYLISTIC findings. Commands handle interaction, agents handle work.
- `.bee/false-positives.md` is created on first use when the first false positive is documented. If no false positives exist yet, the file does not exist.
- Loop mode is opt-in: `--loop` flag or `config.review.loop`. Capped at `max_loop_iterations` (default 3). Re-review (Step 7) re-extracts false positives (Step 7.2), re-spawns all review agents in parallel (Step 7.3), and applies the same parse/deduplicate/consolidate pipeline (Step 7.4) before evaluating findings. The re-review agents see the updated code (post-fix) and updated false-positives list.
- Always re-read STATE.md from disk before each update (Read-Modify-Write pattern) to ensure latest state.
- The review agents, finding-validator, and fixer are spawned via Task tool as foreground subagents. The SubagentStop hook in hooks.json fires for implementer agents only (matcher: "implementer") -- it does NOT fire for review pipeline agents.
- If the session ends mid-review (context limit, crash, user stops), re-running `/bee:review` detects the REVIEWING status and offers to resume. REVIEW.md on disk reflects the pipeline state at the time of interruption.
- Token usage is approximately `(3N + 1)x` that of the previous single-reviewer approach due to per-stack parallel sessions (where N = number of stacks). For single-stack projects this is 4x. The tradeoff is more focused, higher-quality findings from domain specialists. Economy mode reduces peak token usage by serializing per-stack batches.
- Per-stack agents (bug-detector, pattern-reviewer, stack-reviewer) support stack-specific variants. If `plugins/bee/agents/stacks/{stack.name}/{role}.md` exists, the stack-specific agent is used (e.g., `laravel-inertia-vue-bug-detector`); otherwise the generic `bee:{role}` agent is the fallback. This allows stacks to override review agents with domain-specific instructions while generic agents remain the default for stacks without dedicated agents.
