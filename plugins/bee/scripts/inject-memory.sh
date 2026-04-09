#!/bin/bash
# SubagentStart hook: inject user preferences into subagent context
# Reads agent_type from stdin JSON, outputs user.md as additionalContext
# Exit 0 always -- SubagentStart hooks cannot block subagent creation

if ! command -v jq &>/dev/null; then
  echo "inject-memory.sh: jq not found, skipping memory injection" >&2
  exit 0
fi

INPUT=$(cat)
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty' | sed 's/^bee://')

# Only inject memory for known bee agents (generic + stack-specific variants)
# Stack-specific agents use suffix matching (e.g., laravel-inertia-vue-implementer)
is_bee_agent() {
  case "$1" in
    implementer|fixer|researcher|spec-writer|phase-planner|plan-reviewer|spec-shaper|finding-validator|integrity-auditor|test-auditor|testing-auditor|test-planner|context-builder|quick-implementer|discuss-partner|bug-detector|pattern-reviewer|stack-reviewer|plan-compliance-reviewer|spec-reviewer|assumptions-analyzer|debug-investigator|dependency-auditor|ui-auditor|integration-checker|swarm-consolidator|api-auditor|architecture-auditor|audit-bug-detector|audit-finding-validator|audit-report-generator|database-auditor|error-handling-auditor|frontend-auditor|performance-auditor|security-auditor)
      return 0 ;;
    *-implementer|*-bug-detector|*-pattern-reviewer|*-stack-reviewer)
      return 0 ;;
    *)
      return 1 ;;
  esac
}

if ! is_bee_agent "$AGENT_TYPE"; then
  if [ -f "$CLAUDE_PROJECT_DIR/.claude/bee-extensions/agents/${AGENT_TYPE}.md" ]; then
    :
  else
    exit 0
  fi
fi

BEE_DIR="$CLAUDE_PROJECT_DIR/.bee"

# Read user preferences
if [ -f "$BEE_DIR/user.md" ]; then
  USER_PREFS=$(cat "$BEE_DIR/user.md" 2>/dev/null)
  if [ -n "$USER_PREFS" ]; then
    CONTEXT="## User Preferences
${USER_PREFS}

"
    printf '%s' "$CONTEXT" | jq -Rs '{
      hookSpecificOutput: {
        hookEventName: "SubagentStart",
        additionalContext: .
      }
    }'
  fi
fi

exit 0
