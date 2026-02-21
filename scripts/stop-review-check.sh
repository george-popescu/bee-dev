#!/bin/bash
# Stop hook: check for unreviewed executed phases before ending session
# Exit 0 = silent success (no issues), Exit 2 = stderr fed to Claude as feedback
# Do NOT use set -euo pipefail -- handle missing files gracefully

BEE_DIR="$CLAUDE_PROJECT_DIR/.bee"

# Skip if .bee/ doesn't exist (not a bee project or fresh init)
if [ ! -d "$BEE_DIR" ]; then
  exit 0
fi

# Skip if config.json doesn't exist or require_review_before_next is not true
CONFIG_FILE="$BEE_DIR/config.json"
if [ ! -f "$CONFIG_FILE" ]; then
  exit 0
fi

REQUIRE_REVIEW=$(jq -r '.phases.require_review_before_next // false' "$CONFIG_FILE" 2>/dev/null)
if [ "$REQUIRE_REVIEW" != "true" ]; then
  exit 0
fi

# Skip if STATE.md doesn't exist (fresh project, no phases yet)
STATE_FILE="$BEE_DIR/STATE.md"
if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

# Parse the Phases table for rows where Status is EXECUTED but Reviewed is not Yes
# Table format: | # | Name | Status | Plan | Executed | Reviewed | Tested | Committed |
# Fields:        1   2      3        4      5          6          7        8
UNREVIEWED=$(awk -F'|' '
  /EXECUTED/ {
    status = $4
    reviewed = $7
    gsub(/^[ \t]+|[ \t]+$/, "", status)
    gsub(/^[ \t]+|[ \t]+$/, "", reviewed)
    if (status == "EXECUTED" && reviewed != "Yes") {
      name = $3
      gsub(/^[ \t]+|[ \t]+$/, "", name)
      print name
    }
  }
' "$STATE_FILE")

if [ -n "$UNREVIEWED" ]; then
  echo "WARNING: The following phases have been executed but not reviewed:" >&2
  echo "$UNREVIEWED" | while read -r phase; do
    echo "  - $phase" >&2
  done
  echo "" >&2
  echo "Run /bee:review before ending this session." >&2
  exit 2
fi

exit 0
