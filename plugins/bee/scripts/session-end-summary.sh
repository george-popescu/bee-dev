#!/bin/bash
# SessionEnd hook: warn about memory files approaching consolidation limit
# SessionEnd hooks cannot block termination -- stderr shown to user only

BEE_DIR="$CLAUDE_PROJECT_DIR/.bee"
MEMORY_DIR="$BEE_DIR/memory"

# Skip if no memory directory
if [ ! -d "$MEMORY_DIR" ]; then
  exit 0
fi

# Check each memory file for line count approaching limit
for f in "$MEMORY_DIR"/*.md; do
  [ -f "$f" ] || continue
  LINES=$(wc -l < "$f" | tr -d ' ')
  if [ "$LINES" -ge 45 ]; then
    BASENAME=$(basename "$f")
    echo "Memory: $BASENAME approaching 50-line limit ($LINES lines) -- consolidation needed soon" >&2
  fi
done

exit 0
