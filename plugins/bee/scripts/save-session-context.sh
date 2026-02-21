#!/bin/bash
# PreCompact hook: snapshot working state to SESSION-CONTEXT.md
# Receives JSON on stdin with trigger (manual/auto)

set -euo pipefail

BEE_DIR="$CLAUDE_PROJECT_DIR/.bee"

# Skip if .bee/ doesn't exist
if [ ! -d "$BEE_DIR" ]; then
  exit 0
fi

# Read current state
STATE=""
if [ -f "$BEE_DIR/STATE.md" ]; then
  STATE=$(cat "$BEE_DIR/STATE.md")
fi

CONFIG=""
if [ -f "$BEE_DIR/config.json" ]; then
  CONFIG=$(cat "$BEE_DIR/config.json")
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Write snapshot
cat > "$BEE_DIR/SESSION-CONTEXT.md" << EOF
# Session Context (auto-generated)

**Snapshot:** $TIMESTAMP
**Trigger:** PreCompact

## Project State
$STATE

## Config
\`\`\`json
$CONFIG
\`\`\`
EOF

exit 0
