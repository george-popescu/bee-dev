# Phase {PHASE_NUMBER}: {PHASE_NAME} -- Tasks

<!-- Template semantics:
  [ ] / [x]   = task status (crash recovery reads these)
  acceptance  = what the implementer must deliver (SubagentStop hook validates)
  context     = exact files/notes the implementing agent receives (~30% context window)
  research    = how to implement (from researcher agent, prevents pattern hallucination)
  notes       = agent output after completion (inter-wave communication channel)
  needs       = task dependencies (Wave 2+ only, defines wave grouping)
-->

## Goal

{PHASE_GOAL}

## Wave 1 (parallel -- no dependencies)

- [ ] T{PHASE_NUMBER}.1 | {TASK_DESCRIPTION} | bee-implementer
  - acceptance: {ACCEPTANCE_CRITERIA}
  - context: {CONTEXT_PACKET}
  - research:
    - Pattern: {EXISTING_FILE_PATTERN}
    - Reuse: {REUSABLE_CODE}
    - Context7: {FRAMEWORK_DOCS}
    - Types: {EXISTING_TYPES}
  - notes:

- [ ] T{PHASE_NUMBER}.2 | {TASK_DESCRIPTION} | bee-implementer
  - acceptance: {ACCEPTANCE_CRITERIA}
  - context: {CONTEXT_PACKET}
  - research:
    - {RESEARCH_NOTES}
  - notes:

## Wave 2 (depends on Wave 1)

- [ ] T{PHASE_NUMBER}.3 | {TASK_DESCRIPTION} | bee-implementer | needs: T{PHASE_NUMBER}.1, T{PHASE_NUMBER}.2
  - acceptance: {ACCEPTANCE_CRITERIA}
  - context: {CONTEXT_PACKET}
  - research:
    - {RESEARCH_NOTES}
  - notes:

{ADDITIONAL_WAVES}
