---
name: audit
description: Core audit knowledge -- severity definitions, finding format, output templates, validation rules. Used by all audit agents.
---

# Audit Skill

Knowledge base for all audit agents. Defines severity levels, finding format, validation criteria, and report structure.

## Severity Definitions

Every finding MUST be classified into exactly one severity level:

### CRITICAL
Immediate risk. The application is vulnerable to exploitation, data loss, or total failure RIGHT NOW.
- SQL injection with user input reaching raw queries
- Authentication bypass (routes without auth middleware that should have it)
- Secrets/credentials committed to repository
- Remote code execution vectors
- Missing CSRF protection on state-changing endpoints
- Open redirects to user-controlled URLs
- Unencrypted sensitive data storage (passwords in plaintext)
- Production debug mode enabled

### HIGH
Serious issues that will cause problems under real usage but aren't immediately exploitable.
- Missing input validation on user-facing endpoints
- N+1 query patterns on list endpoints (will degrade under load)
- No error boundaries (single component crash takes down the app)
- Missing authorization checks (auth exists but role/permission checks missing)
- Race conditions in concurrent operations
- Unhandled promise rejections that silently fail
- Missing database indexes on frequently queried columns
- File uploads without size/type validation

### MEDIUM
Code quality and reliability issues that increase maintenance cost and bug risk.
- Inconsistent error handling patterns across codebase
- Missing loading/error states in UI
- No pagination on list endpoints
- Dead code / unused exports
- Hardcoded values that should be configuration
- Missing database transactions on multi-step operations
- No request timeout on external API calls
- Inconsistent naming conventions

### LOW
Improvements that make the codebase better but aren't causing problems today.
- Missing TypeScript types (using `any`)
- Code duplication that could be extracted
- Missing JSDoc/comments on complex functions
- Suboptimal but functional patterns
- Missing accessibility attributes
- Console.log statements left in code
- TODO comments without tracking

### Borderline Calibration

When unsure between severity levels, use these borderline examples:

| Finding | Correct Severity | Why NOT the other |
|---------|-----------------|-------------------|
| Missing `updated_at` on a model | LOW (not MEDIUM) | Functional without it. Not causing bugs today. |
| API returns 500 on empty search | HIGH (not CRITICAL) | Incorrect behavior but no data loss or security risk |
| JWT stored in localStorage | HIGH (not CRITICAL) | XSS could steal it, but requires XSS first (chained vulnerability) |
| Missing rate limit on login | CRITICAL (not HIGH) | Enables brute force NOW without any other prerequisite |
| Unused import | LOW (not MEDIUM) | No runtime impact. Tree-shaking handles it. |
| N+1 on a page with 10 items | MEDIUM (not HIGH) | Works fine at current scale. HIGH only if endpoint serves 100+ items |
| `catch (e) {}` swallowing errors | HIGH (not MEDIUM) | Silent failures hide real bugs and corrupt data flows |

**The test:** "Would I wake someone up at 3 AM for this?" CRITICAL = yes. HIGH = morning standup. MEDIUM = next sprint. LOW = backlog.

## Finding Format

Every finding from every audit agent MUST use this exact format:

```markdown
### F-{AGENT_PREFIX}-{NNN}: {Short title}

- **Severity:** {CRITICAL | HIGH | MEDIUM | LOW}
- **Category:** {category name}
- **File:** `{file path}`
- **Lines:** {start}-{end} (or "multiple" if spread across files)
- **Agent:** {agent name that found it}

**Description:**
{What the problem is. Be specific -- reference the exact code pattern.}

**Evidence:**
{The actual code snippet or pattern that proves this is real. 3-10 lines max.}

**Impact:**
{What happens if this isn't fixed. Be concrete -- "users can X" not "may cause issues".}

**Suggested Fix:**
{How to fix it. Reference framework-specific approach if applicable.}
```

### Agent Prefixes

Each audit agent uses a unique prefix for finding IDs:

| Agent | Prefix | Example |
|-------|--------|---------|
| security-auditor | SEC | F-SEC-001 |
| error-handling-auditor | ERR | F-ERR-001 |
| database-auditor | DB | F-DB-001 |
| architecture-auditor | ARCH | F-ARCH-001 |
| api-auditor | API | F-API-001 |
| frontend-auditor | FE | F-FE-001 |
| performance-auditor | PERF | F-PERF-001 |
| testing-auditor | TEST | F-TEST-001 |
| audit-bug-detector | BUG | F-BUG-001 |
| integration-checker | INT | F-INT-001 |

## Validation Rules

The `audit-finding-validator` agent uses these rules to classify findings:

### CONFIRMED
The finding is real. The code contains exactly the issue described, and the evidence is verifiable by reading the file.

### FALSE POSITIVE
The finding is wrong. Reasons:
- The code handles the concern elsewhere (different file, middleware, framework layer)
- Framework convention that the auditor didn't recognize
- Intentional design choice documented in code or config
- The evidence snippet doesn't actually demonstrate the claimed issue
- The file/line reference doesn't match what's actually there

### NEEDS CONTEXT
Cannot determine without project-specific knowledge. The validator flags it for human review with an explanation of what additional context would clarify.

### Validation Process
For each finding, the validator MUST:
1. Read the actual file at the specified path
2. Verify the code at the specified lines matches the evidence
3. Check if the issue is handled elsewhere (search for related patterns)
4. Check if framework/middleware handles it automatically
5. Classify with confidence level (HIGH / MEDIUM)

## Report Template

The final `AUDIT-REPORT.md` follows this structure:

```markdown
# Audit Report

**Project:** {project name}
**Date:** {YYYY-MM-DD}
**Audited by:** BeeDev Audit System v1.0
**Stack:** {detected stack}
**Audit Scope:** {which audit agents ran}

## Executive Summary

| Severity | Total Found | Confirmed | False Positive | Needs Context |
|----------|-------------|-----------|----------------|---------------|
| CRITICAL | {n} | {n} | {n} | {n} |
| HIGH | {n} | {n} | {n} | {n} |
| MEDIUM | {n} | {n} | {n} | {n} |
| LOW | {n} | {n} | {n} | {n} |
| **Total** | **{n}** | **{n}** | **{n}** | **{n}** |

## Risk Assessment

{Overall risk level: CRITICAL / HIGH / MODERATE / LOW / CLEAN}
{1-3 sentence summary of the most important findings}

## Critical Findings

{All CONFIRMED findings with severity CRITICAL, full detail}

## High Findings

{All CONFIRMED findings with severity HIGH, full detail}

## Medium Findings

{All CONFIRMED findings with severity MEDIUM, full detail}

## Low Findings

{All CONFIRMED findings with severity LOW, full detail}

## Needs Context

{All findings classified as NEEDS CONTEXT, with explanation of what's unclear}

## False Positives Log

{Summary table of false positives -- kept for transparency}

| ID | Title | Reason |
|----|-------|--------|
| F-XXX-NNN | {title} | {why it's false positive} |

## Recommendations

### Immediate Actions (CRITICAL)
{Numbered list of what to fix first}

### Short-term Actions (HIGH)
{What to address within the current sprint}

### Technical Debt (MEDIUM + LOW)
{What to schedule for cleanup}

## Audit Metadata

- Agents used: {list}
- Files scanned: {count}
- Total findings: {count}
- Confirmed: {count}
- False positive rate: {percentage}
```

## Spec Generation Rules

When converting findings to specs via `bee:audit-to-spec`:

| Severity | Action |
|----------|--------|
| CRITICAL | Individual spec per finding. Tag: `[CRITICAL-FIX]`. Priority: immediate. |
| HIGH | Group related findings into one spec. Tag: `[SECURITY-FIX]` or `[BUG-FIX]`. |
| MEDIUM | Group by category into cleanup specs. Tag: `[TECH-DEBT]`. |
| LOW | Single consolidated spec for all LOW findings. Tag: `[IMPROVEMENT]`. |
