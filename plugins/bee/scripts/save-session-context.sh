#!/bin/bash
# PreCompact hook: save compact session note to SESSION-CONTEXT.md
# STATE.md and config.json are already on disk and loaded separately at SessionStart
# This file only stores session-specific context not captured elsewhere

set -euo pipefail

BEE_DIR="$CLAUDE_PROJECT_DIR/.bee"

# Skip if .bee/ doesn't exist
if [ ! -d "$BEE_DIR" ]; then
  exit 0
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Extract current spec and phase from STATE.md if available
CURRENT_SPEC=""
if [ -f "$BEE_DIR/STATE.md" ]; then
  CURRENT_SPEC=$(grep -A1 "## Current Spec" "$BEE_DIR/STATE.md" 2>/dev/null | tail -1 || true)
fi

# Write compact session note (avoid duplicating STATE.md/config.json)
cat > "$BEE_DIR/SESSION-CONTEXT.md" << EOF
# Session Context (auto-generated)

**Last compaction:** $TIMESTAMP
**Active spec:** $CURRENT_SPEC
EOF

exit 0
