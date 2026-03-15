#!/bin/bash
# SubagentStart hook: inject agent memory into subagent context
# Reads agent_type from stdin JSON, outputs memory as additionalContext
# Exit 0 always -- SubagentStart hooks cannot block subagent creation

if ! command -v jq &>/dev/null; then
  echo "inject-memory.sh: jq not found, skipping memory injection" >&2
  exit 0
fi

INPUT=$(cat)
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty')

# Only inject memory for known bee agents
case "$AGENT_TYPE" in
  implementer|fixer|researcher|reviewer|spec-writer|phase-planner|plan-reviewer|spec-shaper|finding-validator|integrity-auditor|test-auditor|test-planner|project-reviewer|context-builder|laravel-inertia-vue-bug-detector|laravel-inertia-vue-pattern-reviewer|laravel-inertia-vue-implementer|quick-implementer|discuss-partner|bug-detector|pattern-reviewer|stack-reviewer|plan-compliance-reviewer|spec-reviewer)
    ;;
  *)
    if [ -f "$CLAUDE_PROJECT_DIR/.claude/bee-extensions/agents/${AGENT_TYPE}.md" ]; then
      :
    else
      exit 0
    fi
    ;;
esac

BEE_DIR="$CLAUDE_PROJECT_DIR/.bee"
MEMORY_DIR="$BEE_DIR/memory"

# Skip if no memory directory
if [ ! -d "$MEMORY_DIR" ]; then
  exit 0
fi

CONTEXT=""

# Read shared memory
if [ -f "$MEMORY_DIR/shared.md" ]; then
  CONTENT=$(cat "$MEMORY_DIR/shared.md" 2>/dev/null)
  # Only include if file has actual entries (not just headers)
  if echo "$CONTENT" | grep -q "^- "; then
    CONTEXT="## Project Memory (shared)
${CONTENT}

"
  fi
fi

# Read agent-specific memory
if [ -f "$MEMORY_DIR/${AGENT_TYPE}.md" ]; then
  AGENT_MEM=$(cat "$MEMORY_DIR/${AGENT_TYPE}.md" 2>/dev/null)
  if echo "$AGENT_MEM" | grep -q "^- "; then
    CONTEXT="${CONTEXT}## Project Memory (${AGENT_TYPE})
${AGENT_MEM}
"
  fi
fi

# Output as JSON with additionalContext if we have content
if [ -n "$CONTEXT" ]; then
  printf '%s' "$CONTEXT" | jq -Rs '{
    hookSpecificOutput: {
      hookEventName: "SubagentStart",
      additionalContext: .
    }
  }'
fi

exit 0
