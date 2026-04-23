#!/bin/bash
# PreToolUse hook: validate linter/test gates before allowing git commit
# Receives JSON on stdin with tool_input.command
# Exit 0 with no stdout = allow, Exit 0 with JSON stdout = block
# Do NOT use set -euo pipefail -- handle missing files gracefully
#
# Optimizations applied (vs. previous full-repo gate):
#   1. Incremental lint: lint only staged files matching each linter's extensions
#      (skip linter entirely if no matching staged files).
#   2. Test impact analysis: vitest/jest run only tests related to staged files
#      via `vitest related` / `jest --findRelatedTests`. Pest/PHPUnit fall back
#      to the full suite (no clean equivalent — derived --filter is too brittle).
#   3. Parallel lint + tests within each stack (background jobs + wait).
#   4. Fast-path: skip gate entirely when no source files are staged
#      (markdown-only, .bee/, dotfiles, JSON/YAML-only commits → instant).
#
# Robustness fixes (review pass):
#   F-001 xargs uses null-delimited input (handles filenames with spaces/quotes).
#   F-002 stack paths validated to reject "../" and absolute paths.
#   F-003 vitest fallback also fires on empty log / non-zero exit without match.
#   F-004 subshell trap comment restored (process substitution NOT pipe-while).
#   F-005 prettier now restricted to code files (no .md/.json/.yml drift noise).
#   F-006 STACK_NAME suffixed with index to avoid temp-file collisions.
#   F-007 test commands wrapped in `timeout` (when available) to bound runtime.
#
# Backwards compatibility: legacy global `.linter` / `.testRunner` (no `stacks`
# array) is treated as one virtual stack at path "." with the global tools.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Skip if not a git commit command
if ! echo "$COMMAND" | grep -qE '\bgit\s+commit\b'; then
  exit 0
fi

# Skip if no .bee/config.json (not a bee project)
CONFIG_FILE="$CLAUDE_PROJECT_DIR/.bee/config.json"
if [ ! -f "$CONFIG_FILE" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

# Fix 4: Fast-path — if no source files are staged, skip gate entirely.
# This makes markdown-only / config-only / dotfile commits instant.
ALL_STAGED=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null)
SOURCE_FILES=$(echo "$ALL_STAGED" | grep -E '\.(php|js|ts|jsx|tsx|vue|css|scss|svelte|mjs|mts|cjs|cts|less|py|go|rs|rb)$')
if [ -z "$SOURCE_FILES" ]; then
  exit 0
fi

# F-007: detect `timeout` binary (GNU coreutils on Linux, gtimeout on macOS+brew).
# When present, wrap test commands to bound runtime at 100s (under 120s hook cap).
if command -v timeout >/dev/null 2>&1; then
  TIMEOUT_CMD="timeout 100"
elif command -v gtimeout >/dev/null 2>&1; then
  TIMEOUT_CMD="gtimeout 100"
else
  TIMEOUT_CMD=""
fi

# Read config in a single jq invocation
CONFIG_JSON=$(jq -c '{stacks: (.stacks // []), linter: (.linter // "none"), testRunner: (.testRunner // "none")}' "$CONFIG_FILE" 2>/dev/null)
[ -z "$CONFIG_JSON" ] && exit 0

STACKS=$(echo "$CONFIG_JSON" | jq -c '.stacks' 2>/dev/null)
GLOBAL_LINTER=$(echo "$CONFIG_JSON" | jq -r '.linter' 2>/dev/null)
GLOBAL_RUNNER=$(echo "$CONFIG_JSON" | jq -r '.testRunner' 2>/dev/null)

STACKS_LEN=$(echo "$STACKS" | jq 'length' 2>/dev/null)
[ -z "$STACKS_LEN" ] && STACKS_LEN=0

# Backwards compat: if no stacks array, synthesize one virtual stack at "."
# using the global linter/runner. Same fallback chain as before.
if [ "$STACKS_LEN" = "0" ]; then
  if [ "$GLOBAL_LINTER" = "none" ] && [ "$GLOBAL_RUNNER" = "none" ]; then
    exit 0
  fi
  STACKS=$(jq -nc --arg l "$GLOBAL_LINTER" --arg r "$GLOBAL_RUNNER" \
    '[{path: ".", linter: $l, testRunner: $r}]')
fi

LINT_FAILED=0
TEST_FAILED=0
LINT_OUTPUT=""
TEST_OUTPUT=""

# Cleanup helper for temp files
GATE_PID=$$
cleanup_tmp() {
  rm -f /tmp/lint.${GATE_PID}.*.log /tmp/lint.${GATE_PID}.*.rc \
        /tmp/test.${GATE_PID}.*.log /tmp/test.${GATE_PID}.*.rc 2>/dev/null
}
trap cleanup_tmp EXIT

# Helper: filter staged files by extension regex, restricted to a stack path.
# Outputs paths relative to the stack path (so linters/test runners receive
# correct relative paths when run from $WORK_DIR).
#   $1 = extension regex (e.g. '\.php$')
#   $2 = stack path (e.g. "." or "backend")
filter_staged() {
  local ext_re="$1"
  local stack_path="$2"
  if [ "$stack_path" = "." ]; then
    echo "$ALL_STAGED" | grep -E "$ext_re"
  else
    echo "$ALL_STAGED" | grep "^${stack_path}/" | grep -E "$ext_re" | sed "s|^${stack_path}/||"
  fi
}

# F-001: pipe a newline list to xargs as null-delimited so filenames with
# spaces/quotes/tabs are passed as single args. Empty input is guarded by the
# `if [ -n "$FILES" ]` check before each invocation. Works on macOS (BSD) and
# Linux (GNU) -- both `tr` and `xargs -0` are POSIX-portable.
xargs0() {
  tr '\n' '\0' | xargs -0 "$@"
}

# F-004: process substitution (NOT pipe-while) -- pipe creates a subshell where
# LINT_FAILED / TEST_FAILED writes are lost. Do not "simplify" to `| while`.
# Process each stack sequentially; within a stack, lint + tests run in parallel.
STACK_INDEX=0
while IFS= read -r STACK; do
    [ -z "$STACK" ] && continue
    STACK_INDEX=$((STACK_INDEX + 1))

    STACK_PATH=$(echo "$STACK" | jq -r '.path // "."')

    # F-002: reject suspicious stack paths (defense in depth against malicious
    # or corrupted .bee/config.json). Absolute paths and `..` traversal are
    # never legitimate -- a stack always lives under the project root.
    case "$STACK_PATH" in
        /*|*..*) continue ;;
    esac

    # F-006: suffix with stack index so name collisions (e.g. `frontend/web`
    # and `frontend.web` both sanitize to `frontend_web`) don't share temp files.
    STACK_NAME_BASE=$(echo "$STACK" | jq -r '.name // .path // "default"' | tr -c 'A-Za-z0-9_' '_')
    STACK_NAME="${STACK_NAME_BASE}_${STACK_INDEX}"
    STACK_LINTER=$(echo "$STACK" | jq -r '.linter // empty')
    STACK_RUNNER=$(echo "$STACK" | jq -r '.testRunner // empty')

    # Fallback to global values if per-stack not set (backwards compat)
    [ -z "$STACK_LINTER" ] && STACK_LINTER="$GLOBAL_LINTER"
    [ -z "$STACK_RUNNER" ] && STACK_RUNNER="$GLOBAL_RUNNER"

    # Skip stack if no staged files belong to it
    if [ "$STACK_PATH" = "." ]; then
        HAS_FILES=$(echo "$ALL_STAGED" | head -1)
    else
        HAS_FILES=$(echo "$ALL_STAGED" | grep "^${STACK_PATH}/" | head -1)
    fi
    [ -z "$HAS_FILES" ] && continue

    # Resolve working directory for this stack
    WORK_DIR="$CLAUDE_PROJECT_DIR"
    [ "$STACK_PATH" != "." ] && WORK_DIR="$CLAUDE_PROJECT_DIR/$STACK_PATH"

    LINT_LOG="/tmp/lint.${GATE_PID}.${STACK_NAME}.log"
    LINT_RC_FILE="/tmp/lint.${GATE_PID}.${STACK_NAME}.rc"
    TEST_LOG="/tmp/test.${GATE_PID}.${STACK_NAME}.log"
    TEST_RC_FILE="/tmp/test.${GATE_PID}.${STACK_NAME}.rc"
    LINT_PID=""
    TEST_PID=""

    # ---- Fix 1: Incremental lint (only staged files for this stack) ----
    if [ "$STACK_LINTER" != "none" ] && [ -n "$STACK_LINTER" ]; then
        case "$STACK_LINTER" in
            pint)
                if [ -f "$WORK_DIR/vendor/bin/pint" ]; then
                    PHP_FILES=$(filter_staged '\.php$' "$STACK_PATH")
                    if [ -n "$PHP_FILES" ]; then
                        ( cd "$WORK_DIR" && echo "$PHP_FILES" | xargs0 vendor/bin/pint --test > "$LINT_LOG" 2>&1; echo $? > "$LINT_RC_FILE" ) &
                        LINT_PID=$!
                    fi
                fi
                ;;
            eslint)
                if [ -f "$WORK_DIR/node_modules/.bin/eslint" ]; then
                    JS_FILES=$(filter_staged '\.(js|ts|jsx|tsx|vue|mjs|mts|cjs|cts)$' "$STACK_PATH")
                    if [ -n "$JS_FILES" ]; then
                        ( cd "$WORK_DIR" && echo "$JS_FILES" | xargs0 npx eslint > "$LINT_LOG" 2>&1; echo $? > "$LINT_RC_FILE" ) &
                        LINT_PID=$!
                    fi
                fi
                ;;
            prettier)
                if [ -f "$WORK_DIR/node_modules/.bin/prettier" ]; then
                    # F-005: restrict prettier to code files only -- avoid drift
                    # noise from unrelated .md / .json / .yml staged alongside.
                    PRETTIER_FILES=$(filter_staged '\.(js|ts|jsx|tsx|vue|css|scss|less|mjs|mts|cjs|cts)$' "$STACK_PATH")
                    if [ -n "$PRETTIER_FILES" ]; then
                        ( cd "$WORK_DIR" && echo "$PRETTIER_FILES" | xargs0 npx prettier --check > "$LINT_LOG" 2>&1; echo $? > "$LINT_RC_FILE" ) &
                        LINT_PID=$!
                    fi
                fi
                ;;
            biome)
                if [ -f "$WORK_DIR/node_modules/.bin/biome" ]; then
                    BIOME_FILES=$(filter_staged '\.(js|ts|jsx|tsx|json|jsonc|mjs|mts|cjs|cts)$' "$STACK_PATH")
                    if [ -n "$BIOME_FILES" ]; then
                        ( cd "$WORK_DIR" && echo "$BIOME_FILES" | xargs0 npx biome check > "$LINT_LOG" 2>&1; echo $? > "$LINT_RC_FILE" ) &
                        LINT_PID=$!
                    fi
                fi
                ;;
        esac
    fi

    # ---- Fix 2: Test impact analysis (vitest/jest) + Fix 3: parallel run ----
    if [ "$STACK_RUNNER" != "none" ] && [ -n "$STACK_RUNNER" ]; then
        case "$STACK_RUNNER" in
            pest)
                # Pest has no clean related-tests equivalent -- fall back to full suite.
                # Deriving --filter from staged class names is too brittle (trait
                # users, factories, observers won't be picked up).
                if [ -f "$WORK_DIR/vendor/bin/pest" ]; then
                    PHP_TEST_FILES=$(filter_staged '\.php$' "$STACK_PATH")
                    if [ -n "$PHP_TEST_FILES" ]; then
                        ( cd "$WORK_DIR" && $TIMEOUT_CMD php artisan test --parallel > "$TEST_LOG" 2>&1; echo $? > "$TEST_RC_FILE" ) &
                        TEST_PID=$!
                    fi
                fi
                ;;
            phpunit)
                # Same caveat as pest -- no clean related-tests; full suite.
                if [ -f "$WORK_DIR/vendor/bin/phpunit" ]; then
                    PHP_TEST_FILES=$(filter_staged '\.php$' "$STACK_PATH")
                    if [ -n "$PHP_TEST_FILES" ]; then
                        ( cd "$WORK_DIR" && $TIMEOUT_CMD vendor/bin/phpunit > "$TEST_LOG" 2>&1; echo $? > "$TEST_RC_FILE" ) &
                        TEST_PID=$!
                    fi
                fi
                ;;
            vitest)
                if [ -f "$WORK_DIR/node_modules/.bin/vitest" ]; then
                    JS_TEST_FILES=$(filter_staged '\.(js|ts|jsx|tsx|vue|mjs|mts|cjs|cts)$' "$STACK_PATH")
                    if [ -n "$JS_TEST_FILES" ]; then
                        # F-003: vitest related: only tests that import the staged files.
                        # Fallback to full suite if (a) "no test files" pattern in log,
                        # (b) log is empty (vitest version mismatch on error message),
                        # or (c) exit code is in the "no tests" family. Errs on the side
                        # of running MORE rather than less.
                        ( cd "$WORK_DIR" && echo "$JS_TEST_FILES" | xargs0 $TIMEOUT_CMD npx vitest related --run > "$TEST_LOG" 2>&1
                          rc=$?
                          if [ $rc -ne 0 ]; then
                              if grep -qiE 'no test files|no tests found|no matching|no spec' "$TEST_LOG" 2>/dev/null || [ ! -s "$TEST_LOG" ]; then
                                  $TIMEOUT_CMD npx vitest run > "$TEST_LOG" 2>&1
                                  rc=$?
                              fi
                          fi
                          echo $rc > "$TEST_RC_FILE" ) &
                        TEST_PID=$!
                    fi
                fi
                ;;
            jest)
                if [ -f "$WORK_DIR/node_modules/.bin/jest" ]; then
                    JS_TEST_FILES=$(filter_staged '\.(js|ts|jsx|tsx|mjs|mts|cjs|cts)$' "$STACK_PATH")
                    if [ -n "$JS_TEST_FILES" ]; then
                        ( cd "$WORK_DIR" && echo "$JS_TEST_FILES" | xargs0 $TIMEOUT_CMD npx jest --findRelatedTests --passWithNoTests > "$TEST_LOG" 2>&1; echo $? > "$TEST_RC_FILE" ) &
                        TEST_PID=$!
                    fi
                fi
                ;;
        esac
    fi

    # Wait for both lint and tests for this stack (Fix 3).
    [ -n "$LINT_PID" ] && wait "$LINT_PID" 2>/dev/null
    [ -n "$TEST_PID" ] && wait "$TEST_PID" 2>/dev/null

    if [ -n "$LINT_PID" ]; then
        LINT_RC=$(cat "$LINT_RC_FILE" 2>/dev/null || echo 0)
        if [ "$LINT_RC" != "0" ]; then
            LINT_FAILED=1
            LINT_OUTPUT="$LINT_OUTPUT$(cat "$LINT_LOG" 2>/dev/null)\n"
        fi
    fi
    if [ -n "$TEST_PID" ]; then
        TEST_RC=$(cat "$TEST_RC_FILE" 2>/dev/null || echo 0)
        if [ "$TEST_RC" != "0" ]; then
            TEST_FAILED=1
            TEST_OUTPUT="$TEST_OUTPUT$(cat "$TEST_LOG" 2>/dev/null)\n"
        fi
    fi
done < <(echo "$STACKS" | jq -c '.[]' 2>/dev/null)

if [ "$LINT_FAILED" = "1" ]; then
    echo '{"decision": "block", "reason": "Pre-commit gate: linter errors found. Fix them before committing."}'
    exit 0
fi

if [ "$TEST_FAILED" = "1" ]; then
    echo '{"decision": "block", "reason": "Pre-commit gate: tests failing. Fix them before committing."}'
    exit 0
fi

# All gates passed -- allow commit
exit 0
