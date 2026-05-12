---
description: Review current phase implementation against spec, standards, and quality checklist
argument-hint: "[--phase N] [--loop]"
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`

## Instructions

You are running `/bee:review` -- the code review pipeline for BeeDev. This command orchestrates a four-step pipeline: review code, validate findings, fix confirmed issues, and optionally re-review. Follow these steps in order.

### Step 1: Validation Guards

See `skills/command-primitives/SKILL.md` Validation Guards.
Apply: NOT_INITIALIZED, NO_SPEC, Phase Status (`$ALLOWED_STATUSES = "EXECUTED, REVIEWED, REVIEWING"`), Already Reviewing.

### Step 2: Load Phase Context

1. Read STATE.md to find the Current Spec Path
2. Determine the phase number and slug from the Phases table
3. Find the phase directory using Glob: `{spec-path}/phases/{NN}-*/` where NN is the zero-padded phase number. This avoids slug construction mismatches.
   - TASKS.md: `{phase_directory}/TASKS.md`
   - spec.md: `{spec-path}/spec.md`
4. Read TASKS.md to identify files created/modified by the phase
5. Note whether `.bee/false-positives.md` exists (Step 3.9 extracts false positives before review agents)
6. Check `$ARGUMENTS` for `--loop` flag
7. Read `config.json` from dynamic context for `review.loop` setting
8. Determine loop mode: enabled if `--loop` in arguments OR `config.review.loop` is true
9. Check the Reviewed column for the detected phase. If it shows "Yes (N)" for some number N, this is a re-review -- set the base iteration count to N. Otherwise (empty or no previous review), set the base iteration count to 0.
10. Initialize iteration counter to base iteration count + 1 (first review = 1, first re-review of "Yes (1)" = 2, etc.)

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

**3b.2. Record review start time:**

Record the review start time as `$REVIEW_START_TIME` (ISO 8601 timestamp, e.g., from `date -u +"%Y-%m-%dT%H:%M:%SZ"` via Bash). This will be used to compute review duration at completion.

Display to user: "Starting review of Phase {N}: {phase-name} (iteration {iteration_counter})..."

### Step 3.5: Build & Test Gate

See `skills/command-primitives/SKILL.md` Build & Test Gate (Interactive).
Run per-stack build then user-opt-in tests; on failure prompt the user via AskUserQuestion.

### Step 3.9: Extract False Positives

Before spawning review agents, extract documented false positives so each agent can exclude known non-issues. The extractor operates in dual-mode: it parses both genuine FP entries and stylistic-declined entries and emits two separate exclusion blocks.

1. Read `.bee/false-positives.md` using the Read tool.
2. If the file exists, parse each `## FP-NNN` entry. For each entry, extract its body (text from `## FP-NNN` heading to the next `## FP-` heading or EOF) and classify it:
   - **Stylistic-declined** if the body declares Class: STYLISTIC-DECLINED. Detect via the regex `/(?:\*\*)?Class(?:\*\*)?:?\s*(?:\*\*)?\s*STYLISTIC-DECLINED/`. The regex tolerates markdown bold variants such as `**Class:**` — a plain `Class:` substring search would fail on the bolded form, so the regex is REQUIRED.
   - **Genuine FP** if Class is any other value (e.g., `FALSE-POSITIVE`) or the Class field is absent.
3. Build two formatted blocks (both entries share the `{file}, {reason}` shape):
   ```
   EXCLUDE these documented false positives from your findings:
   - FP-001: {summary} ({file}, {reason})
   - FP-002: {summary} ({file}, {reason})
   ...

   EXCLUDE these stylistic-declined findings (apply only to STYLISTIC candidates):
   - FP-NNN: {summary} ({file}, {reason})
   ...
   ```
4. **Strict class-matching filter (REQ-12, load-bearing):** stylistic-declined entries suppress ONLY candidate findings whose own class is STYLISTIC. A REAL BUG candidate sharing a summary with a stylistic-declined entry is NOT suppressed. Genuine FP entries apply across all classes; stylistic-declined entries are class-scoped.
5. If the file does not exist, set the false-positives list to: `"No documented false positives."`
6. If only one of the two blocks has entries, emit only that block (omit the empty block header).
7. This formatted list (one or both blocks) is included verbatim in each agent's context packet in Step 4.

### Step 3.95: Context Cache and Dependency Scan

See `skills/command-primitives/SKILL.md` Context Cache + Dependency Scan.
Modified-file scope: files identified in Step 2 from TASKS.md.

### Step 4: STEP 1 -- REVIEW (spawn specialized agents)

Spawn specialized review agents. In a multi-stack project, bug-detector, pattern-reviewer, and stack-reviewer are spawned once per stack (3 per-stack agents), while plan-compliance-reviewer is spawned ONCE globally (stack-agnostic). Total agents: `(3 x N) + 1` where N = number of stacks. For single-stack projects, N = 1 so exactly 4 agents are spawned (identical to original behavior). The command (not the agents) writes REVIEW.md after consolidating all findings from all stacks.

#### 4.1: Determine stacks and build context packets

**4.1a: Read stacks from config**

Read `config.stacks` from `config.json`. Build the stack list:
- If `config.stacks` exists and is an array: use it as-is. Each entry has `name` and `path`.
- If `config.stacks` is absent but `config.stack` exists (legacy v2 config): create a single-entry list: `[{ name: config.stack, path: "." }]`.
- If neither exists: stop with error "No stack configured in config.json."

Also read `config.implementation_mode` (defaults to `"premium"` if absent).

**4.1b: Build shared context base**

Build a shared context base for all agents:
- Spec path: `{spec.md path}`
- TASKS.md path: `{TASKS.md path}`
- Phase directory: `{phase_directory}`
- Phase number: `{N}`
- False positives list: the formatted list from Step 3.9

**4.1c: Build per-stack context packets**

For each stack in the stacks list, build three agent-specific context packets. When the project has a single stack, this loop runs once and behavior is identical to the original four-agent approach.

See `skills/command-primitives/SKILL.md` Per-Stack Agent Resolution.
Roles to resolve: bug-detector, pattern-reviewer, stack-reviewer.

**Per-stack Agent: Bug Detector** (resolved agent name -- see agent resolution above) -- model set in 4.2 by implementation_mode -- one per stack
```
You are reviewing Phase {N} implementation for bugs and security issues.

Spec: {spec.md path}
TASKS.md: {TASKS.md path}
Phase directory: {phase_directory}
Phase number: {N}
Stack: {stack.name}

{false-positives list from Step 3.9}

Read TASKS.md to find the files created/modified by this phase. Scope your file search to files within the `{stack.path}` directory. Review those files for bugs, logic errors, null handling issues, race conditions, edge cases, and security vulnerabilities (OWASP). If a project-level CLAUDE.md exists at the project root, read it for project-specific overrides (CLAUDE.md takes precedence over stack skill for project-specific conventions).

Apply the Review Quality Rules from the review skill: same-class completeness (scan ALL similar constructs when finding one bug), edge case enumeration (verify loop bounds, all checkbox states, null paths), and crash-path tracing (for each state write, trace what happens if the session crashes here).

Report only HIGH confidence findings in your standard output format.
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

Read TASKS.md to find the files created/modified by this phase. Scope your file search to files within the `{stack.path}` directory. For each file, find 2-3 similar existing files in the codebase, extract their patterns, and compare. If a project-level CLAUDE.md exists at the project root, read it for project-specific overrides.

Apply same-class completeness: when you find a pattern deviation in one location, scan ALL similar constructs across the codebase for the same deviation. Report ALL instances, not just the first.

Report only HIGH confidence deviations in your standard output format.
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

See `skills/command-primitives/SKILL.md` Model Selection (Reasoning).
Inputs: `config.implementation_mode`. Apply the rule to every agent below.

**Spawn ordering by mode:**
- In economy mode: spawn agents sequentially per stack to reduce token usage. Spawn the global plan-compliance-reviewer first (single Task tool call) and wait for completion. Then for each stack in order: spawn that stack's 3 per-stack agents (bug-detector, pattern-reviewer, stack-reviewer) via three Task tool calls in a single message (parallel within the stack). Wait for all three to complete before proceeding to the next stack. In economy mode with a single stack, this results in the same 4 agents but spawned in two sequential batches instead of one parallel batch.
- In quality or premium mode (default): Spawn ALL agents (all per-stack agents + the global plan-compliance-reviewer) via Task tool calls in a SINGLE message (parallel execution). The stronger inherited model enables deeper, more thorough review analysis.

Wait for all agents to complete before proceeding.

#### 4.2.5: Aggregate-validate 4-agent review outputs

After all review agents in Step 4.2 complete, collect `agent_outputs` per agent: `{agent: "bug-detector" | "pattern-reviewer" | "stack-reviewer" | "plan-compliance-reviewer", transcript_path: <path>, exit_code: 0}`. The `agent` field MUST be the un-prefixed canonical slug matching a `VALIDATOR_ROSTER` entry from `validators-lib.js` (strip any stack prefix like `laravel-inertia-vue-` before building agent_outputs — `runPerAgentValidator` resolves the validator path by literal filename concat, NOT by hooks.json's non-anchored regex routing). Transcript paths come either from the Task tool result or from `.bee/events/<today>.jsonl` SubagentStop entries filtered by this wave's timestamp. Build the stdin payload `{cwd: $ROOT, agent_outputs: [...], expected_count: <N>}` where `N` is `(3 × stack_count) + 1` (the actual spawned roster size), and invoke:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/validators/batch/review-4-agent.js
```

Parse the stdout JSON verdict. If `ok:false`, halt and surface the failure to the user via `Display: "Aggregate validation failed at 4-agent review: {verdict.reason}. Halting review."` -- the aggregate verdict is the authoritative blocking signal per REQ-09 and Rule 12 (Fail Visibly). If `ok:true`, proceed to Step 4.3. This step is unconditional -- `/bee:review` is interactive (not in the autonomous-flag list per REQ-11) so there is no `--no-aggregate-validate` flag; the per-script marker-skip prelude is the sole defense-in-depth tier.

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
   - Write each finding as a `### F-NNN` section with: Severity, Category, File, Lines, Evidence, Evidence Strength: [CITED] | [VERIFIED], Citation: <URL | Context7 lib ID + query | skill section path | codebase file:line>, Impact, Test Gap, Description, Suggested Fix, Validation: pending, Fix Status: pending
   - Leave the False Positives section empty
   - Leave the Fix Summary table with one row per finding, all showing "pending"
3. Verify REVIEW.md was written by reading it back with the Read tool.

#### 4.6: Evaluate findings

1. Count total findings, count by severity (critical, high, medium), count by category.

2. If 0 findings after consolidation:
   - Set `$CLEAN_EXIT = true`
   - Read current STATE.md from disk
   - Set Reviewed column to "Yes ({iteration_counter})" where iteration_counter is the current cumulative iteration count
   - Set Status to REVIEWED
   - Set Last Action result to "Phase {N} reviewed (iteration {iteration_counter}): 0 findings -- clean code"
   - Write STATE.md to disk
   - Display: "Review complete -- clean code! No findings (iteration {iteration_counter})."
   - Skip to Step 8 (completion).

3. Display findings summary: "{N} findings from {agent_count} reviewers ({stack_count} stacks): {critical} critical, {high} high, {medium} medium" (for single-stack, omit the stacks part: "{N} findings from 4 reviewers: {critical} critical, {high} high, {medium} medium")

4. If more than 10 findings: present the list to user before proceeding:
   "The review found {N} findings (above typical range). Review the list in REVIEW.md and confirm you want to proceed with validation."
   Wait for user confirmation. If user declines, stop.

### Step 5: STEP 2 -- VALIDATE EACH FINDING (spawn finding-validator agents)

1. For each finding in REVIEW.md (parsed from the `### F-NNN` sections):
   - Build validation context: finding ID, summary, severity, category, file path, line range, description, suggested fix, and `source_agent` (the specialist agent that originally produced the finding -- determined by category mapping: Bug/Security -> `bug-detector`, Pattern -> `pattern-reviewer`, Spec Gap -> `plan-compliance-reviewer`, Standards -> `stack-reviewer`)
   - Spawn `finding-validator` agent via Task tool and the finding context. Apply the Model Selection (Reasoning) rule referenced in 4.2 -- finding validation is critical classification work.
   - Multiple validators CAN be spawned in parallel (they are read-only and independent)
   - Batch up to 10 validators at a time to avoid overwhelming the system
2. Collect classifications from each validator's final message (the `## Classification` section with Finding, Verdict, Confidence, Source Agent, and Reason fields)

**Aggregate-validate finding-validator outputs (primary):** After collecting all classifications above, build `agent_outputs` with one entry per spawned finding-validator: `{agent: "finding-validator", transcript_path: <path>, exit_code: 0}`. The agent NAME and the VALIDATOR FILE slug both resolve to `finding-validator` (review pipeline's `## Classification` schema — distinct from `audit-finding-validator` which validates the audit pipeline's `### Validation: F-` schema). Build stdin payload `{cwd: $ROOT, agent_outputs: [...], expected_count: <N>}` where `N` equals the number of findings dispatched in this batch (≤10 per Step 5.1). Invoke:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/validators/batch/review-finding-validation.js
```

Parse the stdout JSON verdict. If `ok:false`, halt with `Display: "Aggregate validation failed at finding-validator batch: {verdict.reason}. Halting review."`. If `ok:true`, proceed to the escalation step below. Unconditional invocation (no `--no-aggregate-validate` flag); the per-script marker-skip prelude handles non-autonomous runs.

3. Escalate MEDIUM confidence classifications to specialist agents for a second opinion:
   - Filter the collected classifications: separate HIGH confidence (proceed unchanged) from MEDIUM confidence (need escalation)
   - For each MEDIUM confidence classification, spawn a fresh `finding-validator` agent for a second opinion (NOT the source specialist — specialist agents have SubagentStop hooks that expect their standard output format, not the escalation format). Spawn via Task tool. Apply the Model Selection (Reasoning) rule referenced in 4.2. Provide this context packet:
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

     End your response with your standard classification format:
     ## Classification
     - **Finding:** F-{NNN}
     - **Verdict:** {REAL BUG | FALSE POSITIVE}
     - **Confidence:** HIGH
     - **Source Agent:** {source_agent from original finding}
     - **Reason:** {your reasoning for this second opinion}
     ```
   - Batch up to 10 validators at a time -- specialist escalations use the same parallel pattern as primary validation; each is a focused re-analysis
   - After the finding-validator responds, parse the `## Classification` section from its final message
   - Use the specialist's verdict as the FINAL classification, overriding the validator's uncertain MEDIUM confidence classification
   - If the specialist confirms REAL BUG: the finding stays with verdict REAL BUG
   - If the specialist says FALSE POSITIVE: the finding's verdict becomes FALSE POSITIVE
   - Record the escalation: append " (Escalated to finding-validator for second opinion -- reclassified as {verdict})" to the finding's Validation field in REVIEW.md
   - Display each escalation: "Escalated F-{NNN} for second opinion -- reclassified as {verdict}"

**Aggregate-validate specialist-escalation outputs:** After all specialist-escalation finding-validator spawns from step 3 complete, build `agent_outputs` with one entry per escalated finding-validator: `{agent: "finding-validator", transcript_path: <path>, exit_code: 0}`. The agent NAME and the VALIDATOR FILE slug both resolve to `finding-validator` (review pipeline's `## Classification` schema). Build stdin payload `{cwd: $ROOT, agent_outputs: [...], expected_count: <M>}` where `M` equals the number of MEDIUM confidence classifications escalated in this batch (≤10 per the "Batch up to 10 validators at a time" rule above). Invoke:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/validators/batch/review-specialist-escalation.js
```

Parse the stdout JSON verdict. If `ok:false`, halt with `Display: "Aggregate validation failed at specialist-escalation batch: {verdict.reason}. Halting review."`. If `ok:true`, proceed to Step 4 (REVIEW.md update). Unconditional invocation; the per-script marker-skip prelude is the only tier.

4. Read current REVIEW.md from disk (fresh read -- another validator batch may have been processed). Update REVIEW.md:
   - Set each finding's Validation field to the final classification:
     - HIGH confidence findings: the validator's verdict (REAL BUG / FALSE POSITIVE / STYLISTIC)
     - Escalated MEDIUM confidence findings: the specialist's verdict with escalation note (e.g., "REAL BUG (Escalated to bug-detector -- reclassified as REAL BUG)")
   - Update the Counts table with classification breakdown
5. Handle DROPPED findings (Evidence Strength gate failures): silently discard. Do NOT persist to `.bee/false-positives.md` -- DROPPED is a reviewer process error, not a code claim. Persisting would pollute the FP store and risks suppressing legitimate future findings via summary match. Display a brief tally: "{N} findings dropped at Evidence Strength gate (missing/[ASSUMED]/malformed citation)." Set their REVIEW.md Fix Status to "Dropped (gate failure)".

6. Handle FALSE POSITIVE findings (only TRUE FALSE POSITIVE verdicts -- NOT DROPPED, including those reclassified by specialist escalation):
   - If `.bee/false-positives.md` does not exist, create it with a `# False Positives` header
   - Read `.bee/false-positives.md`, count the number of existing `## FP-` headings, set the next FP number to count + 1
   - For each FALSE POSITIVE finding, append an entry (incrementing the FP number for each):
     ```
     ## FP-{NNN}: {one-line summary}
     - **Finding:** {original finding description from REVIEW.md}
     - **Reason:** {validator's reason for FALSE POSITIVE classification}
     - **File:** {file_path of the finding}
     - **Phase:** {phase number}
     - **Date:** {current ISO 8601 date}
     ```
   - For findings reclassified as FALSE POSITIVE via specialist escalation, include the specialist's reason (not the validator's) in the Reason field
   - Update REVIEW.md: set the finding's Fix Status to "False Positive"

6. Handle STYLISTIC findings (user interaction):
   - For each STYLISTIC finding, use AskUserQuestion:
     Question: "STYLISTIC finding: F-{NNN} -- '{summary}'. What to do?"
     Options: "Fix it" (add to confirmed fix list), "Ignore" (mark as Skipped in REVIEW.md), "False Positive" (persist to false-positives.md, won't be flagged again).
   - Act on the user's choice for each STYLISTIC finding:
     - Fix it: add finding to the confirmed fix list
     - Ignore: mark as "Skipped (user ignored)" in REVIEW.md Fix Status. Also append the finding to .bee/false-positives.md with Class: STYLISTIC-DECLINED using the FP-NNN format (incrementing the FP counter; entry includes Finding/Reason/File/Phase/Date/Class fields). Entry shape:
       ```
       ## FP-{NNN}: {one-line summary}
       - **Finding:** {original finding description}
       - **Reason:** user chose Ignore on STYLISTIC finding
       - **File:** {file_path of the finding}
       - **Phase:** {phase number}
       - **Date:** {current ISO 8601 date}
       - **Class:** STYLISTIC-DECLINED
       ```
     - False Positive: append to `.bee/false-positives.md` (same format as step 5, no Class field or `Class: FALSE-POSITIVE`) and mark as "False Positive" in REVIEW.md

7. Build confirmed fix list: all REAL BUG findings (both HIGH confidence and specialist-confirmed) + user-approved STYLISTIC findings (those where user chose option a). Exclude any findings reclassified as FALSE POSITIVE by specialist escalation.
8. Display validation summary: "{real_bug} real bugs, {false_positive} false positives, {stylistic} stylistic ({user_fix} to fix, {user_ignore} ignored), {escalated} escalated ({escalated_real_bug} confirmed, {escalated_false_positive} reclassified as FP)"

### Step 6: STEP 3 -- FIX CONFIRMED ISSUES (spawn fixer agents with file-based parallelism)

1. Sort confirmed findings by priority order:
   - Priority 1: Critical severity
   - Priority 2: High severity
   - Priority 3: Standards category (Medium)
   - Priority 4: Dead Code category (Medium)
   - Priority 5: Other Medium severity
2. If no confirmed findings (all were false positives, ignored, or skipped): display "No confirmed findings to fix -- all findings were classified as false positives or stylistic (ignored)." Update STATE.md and skip to Step 8.

**Fixer Parallelization Strategy:**

1. Group confirmed findings by file path
2. For findings on DIFFERENT files: spawn fixers in parallel (one fixer per file group, processing its findings)
3. For findings on the SAME file: run fixers sequentially within the group (safety — each fix changes file state)
4. Collect all results, update review file with fix status

Example: 6 findings on 3 files → 3 parallel fixer groups (instead of 6 sequential).

3. For EACH file group (parallel across groups, sequential within each group):
   - Build fixer context packet:
     - Finding details: ID, summary, severity, category, file path, line range, description, suggested fix
     - Validation classification: REAL BUG or STYLISTIC (user-approved)
     - Stack info: resolve the correct stack for the finding's file path using path-overlap logic (compare the finding's file path against each stack's `path` in config.stacks -- a file matches a stack if the file path starts with or is within the stack's path; `"."` matches everything). Pass the resolved stack name explicitly: "Stack: {resolved-stack-name}. Load the stack skill at skills/stacks/{resolved-stack-name}/SKILL.md." If only one stack is configured, use it directly.
   - Spawn `fixer` agent via Task tool with the context packet. Use the parent model (omit model parameter) -- fixers write production code and need full reasoning.
   - For findings on the same file: WAIT for each fixer to complete before spawning the next within that group. For findings on different files: fixer groups run in parallel.
   - Read the fixer's fix report from its final message (## Fix Report section)
   - Read current REVIEW.md from disk (fresh read -- Read-Modify-Write pattern)
   - Update REVIEW.md: set Fix Status for this finding to the fixer's reported status (Fixed / Reverted / Failed)
   - Write updated REVIEW.md to disk
   - If fixer reports "Reverted" or "Failed" (tests broke and changes were reverted):
     - Display failure to user: "Fix for F-{NNN} failed -- tests broke after fix. Changes reverted. Skipping this finding."
     - Update REVIEW.md Fix Status to "Skipped (tests failed)"

CRITICAL: Within the same file group, spawn fixers SEQUENTIALLY, one at a time. Never spawn multiple fixers for the same file in parallel. One fix may change the context for the next finding on that file. Cross-file fixer groups may run in parallel safely.

4. After all confirmed findings have been processed, display fix summary:
   "{fixed} fixed, {skipped} skipped, {failed} failed out of {total} confirmed findings"

### Step 7: STEP 4 -- RE-REVIEW (if loop mode enabled)

1. If loop mode is NOT enabled: skip to Step 8 (completion)
2. Track loop iterations separately from the cumulative iteration counter. Initialize `$LOOP_ITERATION = 1` on first entry to Step 7 (do NOT re-initialize on subsequent loops). Increment `$LOOP_ITERATION` on each re-entry. Also increment the cumulative `iteration_counter` (used for STATE.md and REVIEW.md naming).
   - **Loop cap:** Read `config.review.max_loop_iterations` from config.json (default: 3). If `$LOOP_ITERATION > max_loop_iterations`: display "Max review loop iterations ({max}) reached. Stopping auto-loop." and skip to Step 8 (completion). The user can always re-run `/bee:review --loop` to continue manually.
3. Display: "Starting re-review (loop iteration {$LOOP_ITERATION}, cumulative iteration {iteration_counter})..."

#### 7.1: Archive current REVIEW.md

Before the re-review overwrites REVIEW.md, archive the current one:
1. Compute the previous iteration number: current iteration counter minus 1 (this is the iteration that produced the current REVIEW.md)
2. Rename `{phase_directory}/REVIEW.md` to `{phase_directory}/REVIEW-{previous_iteration}.md`
3. Display: "Archived previous review as REVIEW-{previous_iteration}.md"

#### 7.2: Re-extract false positives

Re-extract false positives. Re-runs Step 3.9's dual-mode parse against `.bee/false-positives.md` — newly-persisted stylistic-decline entries from iteration N take effect in iteration N+1. The file now includes any FPs documented during the previous iteration's validation step (genuine FPs and stylistic-declined entries):
1. Read `.bee/false-positives.md` using the Read tool
2. If the file exists, apply Step 3.9's dual-mode parse and emit the two formatted exclusion blocks (genuine FPs and stylistic-declined entries) with the same strict class-matching filter rule
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

1. **If `$CLEAN_EXIT` is true** (set by Step 4.6 item 2 — 0 findings path), skip items 1-2 below. STATE.md is already updated. Jump directly to "Update phase metrics with review data."

1. Update STATE.md:
   - Reviewed column: "Yes ({iteration_counter})" where iteration_counter is the cumulative review iteration count (first review = 1, first re-review = 2, etc.)
   - Status: `REVIEWED`
   - Last Action:
     - Command: `/bee:review`
     - Timestamp: current ISO 8601 timestamp
     - Result: "Phase {N} reviewed (iteration {iteration_counter}): {total_findings} findings, {confirmed} confirmed, {fixed} fixed, {false_positives} false positives"
2. Write updated STATE.md to disk

**Update phase metrics with review data:**

1. Read STATE.md to get the Current Spec Path. Extract the spec folder name.
2. Determine the phase number from the current review context.
3. Check if `.bee/metrics/{spec-folder-name}/phase-{N}.json` exists (it should -- written by execute-phase).
4. If it exists, Read the file, then update the `review` section:
```json
"review": {
  "iterations": "{iteration_counter}",
  "findings": {
    "critical": "{count_from_REVIEW_md}",
    "high": "{count_from_REVIEW_md}",
    "medium": "{count_from_REVIEW_md}"
  },
  "false_positive_rate": "{total_raw_findings > 0 ? false_positives / total_raw_findings : 0}",
  "duration_seconds": "{seconds_from_REVIEW_START_TIME_to_now}"
}
```
5. Write the updated JSON back to the same file path.
6. Display: "Phase metrics updated with review data."

If the metrics file does NOT exist (phase was executed before metrics were introduced -- backward compatibility), skip the update silently. Do NOT create a new metrics file from the review command -- only execute-phase creates initial metrics files.

**Finding counts extraction:** Parse the REVIEW.md findings to count by severity:
- Count findings with `Severity: Critical` -> `critical`
- Count findings with `Severity: High` -> `high`
- Count findings with `Severity: Medium` -> `medium`
- False positive rate: count of findings marked as false positives by the finding-validator, divided by total raw findings before validation.

**Re-review handling:** If this is a re-review (iteration > 1), the review section is overwritten with the latest iteration's data. The iteration count reflects the total number of reviews performed.

3. Display completion summary:

```
Phase {N} reviewed!

Phase: {phase-name}
Findings: {total} total
- Real bugs: {confirmed} ({fixed} fixed, {failed} failed)
- False positives: {fp_count} (documented in .bee/false-positives.md)
- Stylistic: {stylistic} ({user_fixed} fixed, {user_ignored} ignored)
Iterations: {iteration_count}
```

Use AskUserQuestion to let the user choose:

```
AskUserQuestion(
  question: "Phase {N} review complete. [X] findings: [F] fixed, [S] skipped, [FP] false positives.",
  options: ["Re-review", "Accept", "Testing", "Custom"]
)
```

- **Re-review**: Re-run from Step 1. No iteration limit — user decides when clean.
- **Accept**: End review, update STATE.md
- **Testing**: Proceed to `/bee:test`
- **Custom**: Free text

---

**Design Notes (do not display to user):**

- The command auto-detects the phase to review (last EXECUTED or REVIEWED phase), or accepts an explicit `--phase N` argument to target a specific phase. Re-reviewing an already-reviewed phase is allowed -- the previous REVIEW.md is archived as REVIEW-{N}.md where N is the previous iteration number, and the iteration counter increments.
- In multi-stack projects, bug-detector, pattern-reviewer, and stack-reviewer are spawned once per stack (3 per-stack agents) while plan-compliance-reviewer is spawned ONCE globally (stack-agnostic). Total: `(3 x N) + 1` agents where N = number of stacks. For single-stack projects this is exactly 4 agents, identical to the original behavior. Model tier depends on `implementation_mode`: quality/premium mode omits model (inherits parent for deeper analysis); economy mode passes `model: "sonnet"` and spawns agents sequentially per stack to reduce token usage.
- The command (not the agents) writes REVIEW.md. Agents report findings in their own output formats; the command normalizes, deduplicates, and writes the unified REVIEW.md.
- Step 3.9 extracts false positives BEFORE spawning agents. Each agent receives the formatted false-positives list in its context packet so it can self-filter. The command does NOT need to post-filter.
- The plan-compliance-reviewer operates in "code review mode" (not plan review mode). The context packet explicitly states this.
- Deduplication merges findings from different agents when they reference the same file AND line ranges overlap within 5 lines. Higher severity is kept, categories and descriptions are combined.
- REVIEW.md is the pipeline state, progressively updated as validation and fixing proceed. Analogous to TASKS.md checkboxes in execute-phase.
- Finding validation can be parallel (up to 10 at a time). Fixing uses file-based parallelism: fixers for different files run in parallel; fixers for the same file run sequentially to prevent conflicts.
- Specialist escalation for MEDIUM confidence findings happens AFTER batch validation completes (not inline during validation batching). Flow: (1) batch validate up to 10 findings, (2) collect all classifications, (3) for MEDIUM confidence ones, batch up to 10 validators at a time for second opinions using the same parallel pattern as primary validation, (4) then proceed to update REVIEW.md with final classifications. Escalation uses `bee:finding-validator` (not the source specialist — specialist SubagentStop hooks expect their standard format, not second-opinion format). HIGH confidence classifications proceed unchanged -- only MEDIUM triggers escalation.
- The command handles user interaction for STYLISTIC findings. Commands handle interaction, agents handle work.
- `.bee/false-positives.md` is created on first use when the first false positive is documented. If no false positives exist yet, the file does not exist.
- Loop mode is opt-in: `--loop` flag or `config.review.loop`. No hardcoded iteration cap — the user decides when clean via the interactive menu at Step 8. Re-review (Step 7) re-extracts false positives (Step 7.2), re-spawns all review agents in parallel (Step 7.3), and applies the same parse/deduplicate/consolidate pipeline (Step 7.4) before evaluating findings. The re-review agents see the updated code (post-fix) and updated false-positives list.
- Always re-read STATE.md from disk before each update (Read-Modify-Write pattern) to ensure latest state.
- The review agents, finding-validator, and fixer are spawned via Task tool as foreground subagents. The SubagentStop hook in hooks.json fires for implementer agents only (matcher: "implementer") -- it does NOT fire for review pipeline agents.
- If the session ends mid-review (context limit, crash, user stops), re-running `/bee:review` detects the REVIEWING status and offers to resume. REVIEW.md on disk reflects the pipeline state at the time of interruption.
- Token usage is approximately `(3N + 1)x` that of the previous single-reviewer approach due to per-stack parallel sessions (where N = number of stacks). For single-stack projects this is 4x. The tradeoff is more focused, higher-quality findings from domain specialists. Economy mode reduces peak token usage by serializing per-stack batches.
- Per-stack agents (bug-detector, pattern-reviewer, stack-reviewer) support stack-specific variants. If `agents/stacks/{stack.name}/{role}.md` exists, the stack-specific agent is used (e.g., `laravel-inertia-vue-bug-detector`); otherwise the generic `bee:{role}` agent is the fallback. This allows stacks to override review agents with domain-specific instructions while generic agents remain the default for stacks without dedicated agents.
