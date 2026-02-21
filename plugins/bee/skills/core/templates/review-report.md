# Review: Phase {PHASE_NUMBER} -- {PHASE_NAME}

## Summary

- **Spec:** {SPEC_NAME}
- **Phase:** {PHASE_NUMBER} - {PHASE_NAME}
- **Date:** {DATE}
- **Iteration:** {ITERATION} of {MAX_ITERATIONS}
- **Status:** {PENDING | IN_PROGRESS | COMPLETE}

### Counts

| Severity | Total | Real Bug | False Positive | Stylistic | Fixed |
|----------|-------|----------|----------------|-----------|-------|
| Critical | 0     | 0        | 0              | 0         | 0     |
| High     | 0     | 0        | 0              | 0         | 0     |
| Medium   | 0     | 0        | 0              | 0         | 0     |

### By Category

| Category  | Count |
|-----------|-------|
| Bug       | 0     |
| Spec Gap  | 0     |
| Standards | 0     |
| Dead Code | 0     |
| Security  | 0     |
| TDD       | 0     |
| Pattern   | 0     |

## Findings

<!-- Each finding uses the format below. Finding IDs are sequential: F-001, F-002, etc.
     The reviewer sets Validation and Fix Status to "pending" on creation.
     The review command updates Validation after the finding-validator classifies each finding.
     The review command updates Fix Status after the fixer processes each confirmed finding.
     The review command moves false positives to the False Positives section below.
     The review command updates the Counts tables after validation and fixing. -->

### F-001: {ONE_LINE_SUMMARY}
- **Severity:** {Critical | High | Medium}
- **Category:** {Bug | Spec Gap | Standards | Dead Code | Security | TDD | Pattern}
- **File:** {FILE_PATH}
- **Lines:** {START_LINE}-{END_LINE}
- **Description:** {DETAILED_DESCRIPTION}
- **Suggested Fix:** {WHAT_TO_CHANGE}
- **Validation:** pending
- **Fix Status:** pending

{ADDITIONAL_FINDINGS}

## False Positives

<!-- Entries moved here after the finding-validator classifies them as FALSE POSITIVE.
     Each entry preserves the original finding for reference. -->

{FALSE_POSITIVES_DOCUMENTED_THIS_REVIEW}

## Fix Summary

| Finding | Severity | Action                          | Files Changed |
|---------|----------|---------------------------------|---------------|
| F-001   | {SEV}    | {Fixed | False Positive | Skipped} | {FILE_LIST}   |
