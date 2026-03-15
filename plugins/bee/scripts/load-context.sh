#!/bin/bash
# SessionStart hook: load project context for Claude
# Stdout is added as context that Claude can see
# Do NOT use set -euo pipefail -- if one file is missing, continue reading others

BEE_DIR="$CLAUDE_PROJECT_DIR/.bee"

# Skip if .bee/ doesn't exist (project not initialized)
if [ ! -d "$BEE_DIR" ]; then
  exit 0
fi

# Clear stop-hook marker from previous session
rm -f "$BEE_DIR/.review-reminder-shown"

# Output state summary (stdout goes to Claude's context)
# Cap at 60 lines to prevent unbounded context growth
if [ -f "$BEE_DIR/STATE.md" ]; then
  echo "## Bee Project State"
  LINES=$(wc -l < "$BEE_DIR/STATE.md" | tr -d ' ')
  if [ "$LINES" -gt 60 ]; then
    head -n 60 "$BEE_DIR/STATE.md"
    echo ""
    echo "(STATE.md truncated at 60/$LINES lines -- read full file with Read tool if needed)"
  else
    cat "$BEE_DIR/STATE.md"
  fi
  echo ""
fi

if [ -f "$BEE_DIR/config.json" ]; then
  STACK=$(jq -r '.stacks[0].name // .stack // "unknown"' "$BEE_DIR/config.json" 2>/dev/null || echo "unknown")
  echo "## Bee Config"
  echo "Stack: $STACK"
  echo ""
fi

# Load session context if exists (from PreCompact snapshot)
if [ -f "$BEE_DIR/SESSION-CONTEXT.md" ]; then
  echo "## Previous Session Context"
  cat "$BEE_DIR/SESSION-CONTEXT.md"
  echo ""
fi

exit 0
