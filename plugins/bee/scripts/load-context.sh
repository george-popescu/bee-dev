#!/bin/bash
# SessionStart hook: load project context for Claude
# Stdout is added as context that Claude can see
# Do NOT use set -euo pipefail -- if one file is missing, continue reading others

BEE_DIR="$CLAUDE_PROJECT_DIR/.bee"

# Skip if .bee/ doesn't exist (project not initialized)
if [ ! -d "$BEE_DIR" ]; then
  exit 0
fi

# Output state summary (stdout goes to Claude's context)
if [ -f "$BEE_DIR/STATE.md" ]; then
  echo "## Bee Project State"
  cat "$BEE_DIR/STATE.md"
  echo ""
fi

if [ -f "$BEE_DIR/config.json" ]; then
  STACK=$(jq -r '.stack // "unknown"' "$BEE_DIR/config.json" 2>/dev/null || echo "unknown")
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
