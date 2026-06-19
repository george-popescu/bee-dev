#!/bin/bash
# SessionStart hook: load project context for Claude
# Stdout is added as context that Claude can see
# Do NOT use set -euo pipefail -- if one file is missing, continue reading others

shopt -s nullglob

BEE_DIR="$CLAUDE_PROJECT_DIR/.bee"

# Skip if .bee/ doesn't exist (project not initialized)
if [ ! -d "$BEE_DIR" ]; then
  exit 0
fi

# Clear stop-hook marker from previous session
rm -f "$BEE_DIR/.review-reminder-shown"

# Write session start timestamp for metrics
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$BEE_DIR/.session-start"

# Output a STATE.md DIGEST (stdout goes to Claude's context).
# The old head-60 slice injected ~20KB of mostly Decisions Log history while never
# reaching the Last Action section. The digest injects exactly what a resuming
# session needs -- Current Spec, the Phases table, and Last Action (a few KB) --
# and points at the full file for everything else.
if [ -f "$BEE_DIR/STATE.md" ]; then
  echo "## Bee Project State"
  awk '
    /^## / { insec = ($0 == "## Current Spec" || $0 == "## Phases" || $0 == "## Last Action") }
    insec { print }
  ' "$BEE_DIR/STATE.md"
  echo ""
  echo "(Digest: Current Spec + Phases + Last Action. Decisions Log and history: read $BEE_DIR/STATE.md with the Read tool when needed.)"
  echo ""
fi

if [ -f "$BEE_DIR/config.json" ]; then
  echo "## Bee Config"
  # Check for new per-stack format (stacks array with objects)
  STACKS_COUNT=$(jq '.stacks | length // 0' "$BEE_DIR/config.json" 2>/dev/null || echo "0")
  STACKS_IS_OBJECTS=$(jq -r '.stacks[0] | type // "null"' "$BEE_DIR/config.json" 2>/dev/null || echo "null")

  if [ "$STACKS_COUNT" -gt 0 ] 2>/dev/null && [ "$STACKS_IS_OBJECTS" = "object" ]; then
    # New per-stack format: stacks is an array of objects with name, path, linter, testRunner
    jq -r '.stacks[] | "Stack: \(.name) at '"'"'\(.path // ".")'"'"' (linter: \(.linter // "none"), tests: \(.testRunner // "none"))"' "$BEE_DIR/config.json" 2>/dev/null
  else
    # Old format: single stack string or stacks array of strings
    STACK=$(jq -r '.stacks[0] // .stack // "unknown"' "$BEE_DIR/config.json" 2>/dev/null || echo "unknown")
    echo "Stack: $STACK"
  fi
  echo ""
fi

# Load user preferences if exists
if [ -f "$BEE_DIR/user.md" ]; then
  echo "## User Preferences (user.md)"
  cat "$BEE_DIR/user.md"
  echo ""
fi

# Load session context if exists (prefer COMPACT-CONTEXT.md over SESSION-CONTEXT.md)
# Cap at 100 lines to prevent unbounded context growth — the recent decisions
# stay visible, the historical archive is reachable via Read tool when needed.
if [ -f "$BEE_DIR/COMPACT-CONTEXT.md" ]; then
  echo "## Previous Session Context"
  LINES=$(wc -l < "$BEE_DIR/COMPACT-CONTEXT.md" | tr -d ' ')
  if [ "$LINES" -gt 100 ]; then
    head -n 100 "$BEE_DIR/COMPACT-CONTEXT.md"
    echo ""
    echo "(COMPACT-CONTEXT.md truncated at 100/$LINES lines -- read full file with Read tool if needed)"
  else
    cat "$BEE_DIR/COMPACT-CONTEXT.md"
  fi
  echo ""
elif [ -f "$BEE_DIR/SESSION-CONTEXT.md" ]; then
  echo "## Previous Session Context"
  LINES=$(wc -l < "$BEE_DIR/SESSION-CONTEXT.md" | tr -d ' ')
  if [ "$LINES" -gt 100 ]; then
    head -n 100 "$BEE_DIR/SESSION-CONTEXT.md"
    echo ""
    echo "(SESSION-CONTEXT.md truncated at 100/$LINES lines -- read full file with Read tool if needed)"
  else
    cat "$BEE_DIR/SESSION-CONTEXT.md"
  fi
  echo ""
fi

# Detect active debug sessions (both old and new formats)
ACTIVE_DEBUG=""

if [ -d "$BEE_DIR/debug" ]; then
  # Old format: .bee/debug/*.md (legacy sessions)
  for debug_file in "$BEE_DIR"/debug/*.md; do
    [ -f "$debug_file" ] || continue
    if grep -q 'status: active' "$debug_file" 2>/dev/null; then
      slug=$(basename "$debug_file" .md)
      ACTIVE_DEBUG="${ACTIVE_DEBUG}- ${slug} (legacy)\n"
    fi
  done

  # New format: .bee/debug/sessions/*/state.json
  if [ -d "$BEE_DIR/debug/sessions" ]; then
    for session_dir in "$BEE_DIR"/debug/sessions/*/; do
      [ -d "$session_dir" ] || continue
      state_file="${session_dir}state.json"
      [ -f "$state_file" ] || continue
      status=$(jq -r '.status // empty' "$state_file" 2>/dev/null)
      if [ "$status" = "active" ]; then
        slug=$(basename "$session_dir")
        ACTIVE_DEBUG="${ACTIVE_DEBUG}- ${slug}\n"
      fi
    done
  fi
fi

if [ -n "$ACTIVE_DEBUG" ]; then
  echo "## Active Debug Sessions"
  printf "%b" "$ACTIVE_DEBUG"
  echo ""
fi

# Multi-spec awareness: if specs.json exists and more than one active spec is present,
# emit a short advisory so a resumed chat knows no spec is auto-bound.
# Single-active-spec and legacy (no specs.json) output is unchanged.
if [ -f "$BEE_DIR/specs.json" ]; then
  ACTIVE_SPEC_COUNT=$(node -e "
    try {
      const reg = JSON.parse(require('fs').readFileSync('$BEE_DIR/specs.json', 'utf8'));
      const TERMINAL = ['shipped', 'archived'];
      const active = (reg.specs || []).filter(s => !TERMINAL.includes(s.stage));
      process.stdout.write(String(active.length));
      if (active.length > 1) {
        const slugs = active
          .sort((a,b) => String(b.last_touched).localeCompare(String(a.last_touched)))
          .map(s => s.slug).join(', ');
        process.stdout.write('\n' + slugs);
      }
    } catch(e) { process.stdout.write('0'); }
  " 2>/dev/null)
  ACTIVE_COUNT=$(echo "$ACTIVE_SPEC_COUNT" | head -1)
  ACTIVE_SLUGS=$(echo "$ACTIVE_SPEC_COUNT" | tail -n +2)
  if [ "$ACTIVE_COUNT" -gt 1 ] 2>/dev/null; then
    echo "## Multiple Active Specs"
    echo "Multiple active specs ($ACTIVE_COUNT): $ACTIVE_SLUGS. This session is not bound to one — run a spec command (it will show a picker) or \`/bee:spec use <slug>\`."
    echo "NOTE: The Current Spec shown above is the last-touched spec, not an auto-selection; a spec command will show a picker."
    echo ""
  fi
fi

# Bee Quick Guide (compact workflow intelligence for parent Claude)
echo "## Bee Quick Guide"
echo "Intent routing: new-spec (feature) | quick (bugfix) | debug (investigate) | forensics (stuck workflow) | workspace (parallel work)"
echo "Phase cycle: plan-phase -> plan-review -> execute-phase -> review -> test -> commit (repeat per phase)"
echo "Automation: autonomous (full pipeline per phase) | ship (execute all planned) | plan-all (batch plan)"
echo "Review depth: review (per-phase) < swarm-review (multi-agent) < review-implementation (cross-phase) < audit (codebase)"
echo "Proactive: suggest metrics after 3+ phases | seed for deferred ideas | health for diagnostics | eod for integrity"
echo "Anti-patterns: no auto-commit | no skip review | no code before test | disk is truth | review (not review-implementation) after single phase"
echo "Full guide: read plugins/bee/skills/guide/SKILL.md for decision trees, smart suggestions, and intent routing"
echo ""

exit 0
