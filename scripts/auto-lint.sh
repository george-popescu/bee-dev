#!/bin/bash
# PostToolUse hook: detect and run project linter on edited file
# Receives JSON on stdin with tool_input.file_path
# Exit 0 = silent success, Exit 2 = stderr fed to Claude as feedback

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Skip if no file path (shouldn't happen for Write|Edit, but safety check)
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Skip non-source files
case "$FILE_PATH" in
  *.php|*.js|*.ts|*.jsx|*.tsx|*.vue|*.css|*.scss)
    # Continue to lint
    ;;
  *)
    exit 0
    ;;
esac

# Skip if file doesn't exist (was deleted)
if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

PROJECT_DIR="$CLAUDE_PROJECT_DIR"

# Detect and run linter
if [ -f "$PROJECT_DIR/vendor/bin/pint" ]; then
  # Laravel Pint (PHP)
  OUTPUT=$("$PROJECT_DIR/vendor/bin/pint" "$FILE_PATH" 2>&1) || {
    echo "$OUTPUT" >&2
    exit 2
  }
elif [ -f "$PROJECT_DIR/node_modules/.bin/eslint" ]; then
  # ESLint
  OUTPUT=$("$PROJECT_DIR/node_modules/.bin/eslint" --fix "$FILE_PATH" 2>&1) || {
    echo "$OUTPUT" >&2
    exit 2
  }
elif [ -f "$PROJECT_DIR/node_modules/.bin/prettier" ]; then
  # Prettier
  OUTPUT=$("$PROJECT_DIR/node_modules/.bin/prettier" --write "$FILE_PATH" 2>&1) || {
    echo "$OUTPUT" >&2
    exit 2
  }
elif [ -f "$PROJECT_DIR/node_modules/.bin/biome" ]; then
  # Biome
  OUTPUT=$("$PROJECT_DIR/node_modules/.bin/biome" format --write "$FILE_PATH" 2>&1) || {
    echo "$OUTPUT" >&2
    exit 2
  }
fi

# No linter found or linter succeeded -- silent exit
exit 0
