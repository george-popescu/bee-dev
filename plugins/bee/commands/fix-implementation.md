---
description: Read most recent review output and apply confirmed findings using fixer agents
argument-hint: "[review-file-path]"
---

## Current State (load before proceeding)

Read these files using the Read tool:
- `.bee/STATE.md` — if not found: NOT_INITIALIZED
- `.bee/config.json` — if not found: use `{}`

## Instructions

You are running `/bee:fix-implementation` -- a standalone fix command that reads an existing review file, extracts confirmed findings, and applies fixes using fixer agents. This command does NOT perform a review; it operates on review output that already exists. Follow these steps in order.

### Step 1: Resolve Review File

Check these guards first:

1. **NOT_INITIALIZED guard:** If the dynamic context above contains "NOT_INITIALIZED" (meaning `.bee/STATE.md` does not exist), tell the user:
   "BeeDev is not initialized. Run `/bee:init` first."
   Do NOT proceed.

2. **Resolve the review file path** using this priority:

   **(a) Explicit argument:** If `$ARGUMENTS` contains a file path, use that path directly. Read the file to verify it exists. If it does not exist, tell the user:
   "Review file not found at {path}."
   Do NOT proceed.

   **(b) Auto-detect** (no argument provided): Try these locations in order, stopping at the first one found:

   1. `{spec-path}/REVIEW-IMPLEMENTATION.md` -- Read STATE.md to extract the Current Spec Path. If a spec path exists, check if `{spec-path}/REVIEW-IMPLEMENTATION.md` exists on disk.
   2. Most recent file in `.bee/reviews/` -- Run `ls -t .bee/reviews/` via Bash to list files sorted by modification time. Use the first (newest) file if the directory exists and is not empty.
   3. `{spec-path}/REVIEW-PROJECT.md` -- If a spec path exists, check if `{spec-path}/REVIEW-PROJECT.md` exists on disk.

   If none of these locations yield a review file, tell the user:
   "No review file found. Run `/bee:review` or `/bee:review-implementation` first, or provide a path: `/bee:fix-implementation path/to/REVIEW.md`."
   Do NOT proceed.

3. Display to user: "Fixing findings from: {resolved_review_file_path}"

### Step 2: Parse Findings

1. Read the resolved review file from disk.
2. Scan for `### F-NNN` sections (e.g., `### F-001`, `### F-002`, etc.).
3. For each finding section, extract:
   - Finding ID (F-NNN)
   - One-line summary (from the heading after the ID)
   - Severity (from `- **Severity:**` field)
   - Category (from `- **Category:**` field)
   - File path (from `- **File:**` field)
   - Line range (from `- **Lines:**` field)
   - Description (from `- **Description:**` field)
   - Suggested fix (from `- **Suggested Fix:**` field)
   - Validation (from `- **Validation:**` field)
   - Fix Status (from `- **Fix Status:**` field)
4. Filter to only findings where:
   - **Validation** is `REAL BUG` (exact match or starts with "REAL BUG")
   - **Fix Status** is `pending`
5. If no findings match the filter, tell the user:
   "No actionable findings. All findings are either already fixed, false positives, or not validated as REAL BUG."
   Do NOT proceed.

6. Display: "Found {count} confirmed findings to fix."

### Step 3: Sort by Severity

Sort the filtered findings by priority order:

- Priority 1: Critical severity
- Priority 2: High severity
- Priority 3: Standards category (Medium)
- Priority 4: Dead Code category (Medium)
- Priority 5: Other Medium severity

Display the sorted list:
```
Fix order:
1. F-{NNN}: {summary} (Critical)
2. F-{NNN}: {summary} (High)
3. F-{NNN}: {summary} (Standards-Medium)
...
```

### Step 3.5: Context Cache

**Context Cache (read once, pass to all agents):**

Before spawning any agents, read these files once and include their content in every agent's context packet:
1. Stack skill: `plugins/bee/skills/stacks/{stack}/SKILL.md`
2. Project context: `.bee/CONTEXT.md`
3. False positives: `.bee/false-positives.md`
4. User preferences: `.bee/user.md`

Pass these as part of the agent's prompt context — agents should NOT re-read these files themselves.

### Step 4: Fix Loop

Build the stack list for per-finding resolution:
- If `config.stacks` exists and is an array: use it as-is. Each entry has `name` and `path`.
- If `config.stacks` is absent but `config.stack` exists (legacy v2 config): create a single-entry list: `[{ name: config.stack, path: "." }]`.
- If neither exists, create a single-entry list: `[{ name: "unknown", path: "." }]`.

**Fixer Parallelization Strategy:**

1. Group confirmed findings by file path
2. For findings on DIFFERENT files: spawn fixers in parallel (one fixer per file group, processing its findings)
3. For findings on the SAME file: run fixers sequentially within the group (safety — each fix changes file state)
4. Collect all results, update review file with fix status

Example: 6 findings on 3 files → 3 parallel fixer groups (instead of 6 sequential).

For EACH file group:

1. Display: "Fixing F-{NNN}: {summary}..." (for each finding in the group)

2. Build fixer context packet:
   - Finding details: ID, summary, severity, category, file path, line range, description, suggested fix
   - Validation classification: REAL BUG
   - Stack info: resolve the correct stack for the finding's file path using path-overlap logic (compare the finding's file path against each stack's `path` in the stacks list -- a file matches a stack if the file path starts with or is within the stack's path; `"."` matches everything). Pass the resolved stack name: "Stack: {resolved_stack_name}. Load the stack skill at skills/stacks/{resolved_stack_name}/SKILL.md."

3. Spawn `fixer` agent via Task tool with the context packet. Omit the model parameter -- fixers write production code and need full reasoning capability.

4. For findings on the same file: WAIT for each fixer to complete before spawning the next within that group. For findings on different files: fixer groups run in parallel.

5. Read the fixer's fix report from its final message (the `## Fix Report` section).

6. Read current review file from disk (fresh read -- Read-Modify-Write pattern).

7. Update the review file: set the Fix Status for this finding to the fixer's reported status (Fixed / Reverted / Failed).

8. Write the updated review file to disk.

9. If the fixer reports "Reverted" or "Failed" (tests broke and changes were reverted):
   - Display: "Fix for F-{NNN} failed -- changes reverted. Skipping."
   - Update the review file Fix Status to "Skipped (tests failed)"

CRITICAL: Within the same file group, spawn fixers SEQUENTIALLY, one at a time. Never spawn multiple fixers for the same file in parallel. One fix may change the context for the next finding on that file. Cross-file fixer groups may run in parallel safely.

### Step 5: Summary

After all findings have been processed:

1. Count results: {fixed} fixed, {skipped} skipped, {failed} failed out of {total} total.

2. Display completion summary:

```
Fix Implementation Complete

Review file: {review_file_path}
Findings: {total} processed
- Fixed: {fixed}
- Skipped: {skipped}
- Failed: {failed}

Next steps:
  git diff                   (review all changes)
  /bee:commit                (commit when satisfied)
```

3. Update `.bee/STATE.md` Last Action (Read-Modify-Write pattern -- re-read STATE.md from disk before updating):
   - Command: `/bee:fix-implementation`
   - Timestamp: current ISO 8601 timestamp
   - Result: "Fix implementation: {fixed} fixed, {skipped} skipped, {failed} failed out of {total} findings"

4. Write updated STATE.md to disk.

---

**Design Notes (do not display to user):**

- This command never auto-commits. The user decides when to commit via `/bee:commit`.
- This command does NOT perform a review. It operates on existing review output (REVIEW-IMPLEMENTATION.md, REVIEW-PROJECT.md, or any review file in `.bee/reviews/`).
- The auto-detect priority (REVIEW-IMPLEMENTATION.md > newest in .bee/reviews/ > REVIEW-PROJECT.md) assumes the most specific review is most relevant.
- Fixer agents are spawned sequentially with the parent model (omit model parameter) because they write production code and need full reasoning.
- The Read-Modify-Write pattern ensures each fixer's status is persisted immediately, so progress survives if the session is interrupted.
- Stack resolution uses per-finding path-overlap logic (matching review-implementation.md Step 6.2): compare each finding's file path against stack paths, use the matching stack name. Supports multi-stack projects and v2 config backward compatibility (`config.stacks` first, then `config.stack` fallback).
- The severity sort matches the fix priority order used by `/bee:review` and `/bee:review-implementation` (Step 4.2 / Step 6).
