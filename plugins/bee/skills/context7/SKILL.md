---
name: context7
description: Context7 MCP usage patterns for framework documentation lookups
---

# Context7 Integration

## When to Use

Use Context7 MCP to fetch up-to-date framework documentation in three contexts:

1. **During research** (plan-phase Step 2): fetch relevant framework docs per task to populate research notes
2. **During implementation** (execute-phase): look up specific API details when building features
3. **During review/fixing**: verify patterns match the current framework version before flagging issues

## How to Use

Two-step process for every lookup:

1. **Resolve the library ID:** Call `mcp__context7__resolve-library-id` with the library name (e.g., `laravel/framework`). This returns the correct Context7 identifier.
2. **Query the docs:** Call `mcp__context7__query-docs` with the resolved ID and a specific query string.

**Rules:**
- Always use specific queries: "Inertia useForm validation display" -- not "Inertia docs"
- One concept per query. Do not combine unrelated lookups.
- Do not re-fetch the same documentation multiple times in one session. Cache results mentally and reuse them.

## Library IDs Per Stack

| Stack                 | Libraries to Query                                         |
| --------------------- | ---------------------------------------------------------- |
| laravel-inertia-vue   | `laravel/framework`, `inertiajs/inertia`, `vuejs/core`     |
| laravel-inertia-react | `laravel/framework`, `inertiajs/inertia`, `facebook/react` |
| react                 | `facebook/react`                                           |
| nextjs                | `vercel/next.js`                                           |
| nestjs                | `nestjs/nest`                                              |
| react-native-expo     | `facebook/react-native`, `expo/expo`                       |

Read `config.json` to determine the project stack, then query only the relevant libraries from this table.

## Graceful Fallback

Context7 enhances research but is never required. Follow this three-tier check:

1. **Check config:** Read `config.json` for the `"context7"` field. If `false`, skip Context7 entirely.
2. **Attempt the call:** If enabled, call the MCP tools. If the tools are not available (error, not configured), fall back to codebase analysis.
3. **Log and proceed:** When falling back, note "Context7 not available, using codebase patterns only" and continue. Never hard-fail because Context7 is unavailable.

## Query Strategies

Keep queries focused and practical:

- **Component patterns:** Query component API and composition patterns (e.g., "Vue defineModel two-way binding")
- **API details:** Query function signatures and configuration options (e.g., "Laravel FormRequest authorize method")
- **Testing:** Query testing utilities and patterns (e.g., "Pest assertInertia page component")
- **Configuration:** Query setup and configuration options (e.g., "Inertia shared data middleware")
- **Migrations/models:** Query schema and relationship patterns (e.g., "Laravel belongsToMany pivot table")

Prefer specific framework features over general queries. A targeted query returns more useful context than a broad one.

If a query returns no useful results, refine it with more specific terms rather than broadening it.

## Version-Aware Queries

Context7 may return docs from multiple versions. When working with version-specific APIs:

- **Include version in query** when it matters: "Next.js 15 async params page component" not just "Next.js page component"
- **Check for version-specific library IDs:** `resolve-library-id` may return versioned entries (e.g., `/vercel/next.js/v14.3.0`). Use the version matching your project.
- **When results conflict with stack skill:** The stack skill represents YOUR project's conventions. Context7 shows the LATEST docs. If they differ, check your project's package versions to decide which is correct.
- **Outdated pattern detection:** If Context7 returns a pattern different from what the codebase uses, verify whether the codebase is using a deprecated pattern or an intentional older API.

## Result Disambiguation

When Context7 returns ambiguous or conflicting information:

1. **Multiple approaches shown:** Pick the one matching existing codebase patterns. Consistency > latest API.
2. **No results returned:** Refine query with more specific terms. If still nothing, fall back to stack skill rules.
3. **Results contradict stack skill:** The stack skill is authoritative for project conventions. Context7 supplements with API details. If the API itself changed (deprecation, new syntax), note it as a potential upgrade.
