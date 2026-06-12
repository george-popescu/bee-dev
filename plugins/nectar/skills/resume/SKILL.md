---
name: resume
description: Use when returning to a project — "where were we", "what's next", "continue", or any new session touching existing work in docs/work/. Reconstructs status purely from artifacts and git, then proposes exactly one next action. Not for starting brand-new work (shape).
---

# Resume

Reconstruct where the work stands from artifacts and git alone, then propose exactly one next action. Resume reads, reports, and proposes — it never creates or edits a file, never ticks a box, never deletes anything, never commits. The single next action is a proposal for the user to accept or override, not something to execute unprompted.

## Scan

Read everything before concluding anything:

1. List `docs/work/` — every `<topic>/` folder and its contents (design.md, plan.md, review.md, any `debug-<slug>.md`), `backlog.md`, the `debug/` folder, and any `audit-YYYY-MM-DD.md` at the root.
2. Run `git log --oneline -15` and `git status`.

Artifacts and git are the only sources. Never trust memory of a past session — not a summary, not a recollection of "where we got to" — over what the files say now. If `docs/work/` does not exist or is empty, and `git status` is clean or shows only changes unrelated to any docs/work/ topic, say so plainly and suggest the shape skill for whatever the user wants to start; there is nothing to resume.

## Status derivation

Derive each topic's status mechanically from its files. The rules, in the order to check them:

- Any `debug-<slug>.md` in the topic folder, or any file under `docs/work/debug/` → *open debug hunt*. Report its frontier line — the next test to run and what each outcome means — verbatim from the file. An open hunt outranks the topic's other statuses: a known-broken thing is resolved before anything else advances.
- design.md only, no plan.md → *designed, needs plan*.
- plan.md with unticked `- [ ]` boxes → *building, wave N of M*, where N is the first wave containing an unticked box and M is the total wave count.
- plan.md exists and all boxes are ticked, and review.md has CONFIRMED findings without a resolution recorded, or review.md does not end with a clean-pass confirmation → *in review*.
- plan.md exists and all boxes are ticked, and review.md ends with a clean-pass confirmation → *done*. plan.md fully ticked with no review.md at all means the review pass has not happened: that is *in review* too — the review skill still owes a clean pass.
- Anything else — an empty folder, a review.md with no plan.md, files outside the convention, any combination the workflow cannot produce → no status. Name what is there and ask the user.

State each topic's status using exactly these names — they are the shared vocabulary across sessions.

## Cross-check

The cross-check runs in addition to whichever status rule matched — it never changes the derived status, it annotates it. Checkboxes are trusted by default — build only ticks verified work — so the cross-check exists to catch external edits, not to re-verify every task.

- A ticked task whose `- files:` paths show no related change in `git log`/`git status` → say so explicitly: "T3 is ticked but I see no commit or change touching `src/auth/session.ts`."
- Any commit or uncommitted change touching a `- files:` path while its task's box is unticked → same, in reverse.
- design.md present, and `git status` shows uncommitted changes that diverge from what the design describes → flag the discrepancy and ask, instead of guessing which is current.

Report the mismatch as a fact and let the user decide which is true. Do not untick, tick, or "repair" anything — resume has no write access to reality, only a description of it.

## Propose

Propose exactly ONE next action. Name it concretely, name the skill that does it, and give a one-line reason:

> Wave 2 of payments: T4 and T5 can run in parallel — build skill. Reason: wave 1 is fully ticked and the suite was green at the last commit.

Not a menu, not "you could either…", not a ranked list of options. One action. The mapping from status to action:

- *open debug hunt* → resume the hunt from its frontier — debug skill.
- *designed, needs plan* → plan the topic — plan skill.
- *building, wave N of M* → execute wave N (name its unticked tasks) — build skill.
- *in review* → run or finish the review until a clean pass — review skill.
- *done* → suggest deleting the folder (the user may decline and leave it); if other topics are open, the next action comes from them instead.
- Flagged discrepancy (design vs. working tree, a cross-check mismatch, or a no-status folder) → resolving that ambiguity IS the next action; nothing else is safe to propose on top of it.

If multiple topics are open, pick by priority: *open debug hunt* (topicless hunts under `docs/work/debug/` included) beats *in review* beats *building* beats *designed, needs plan*; a flagged discrepancy on the selected topic preempts its normal action. Say why in one line. Every other open topic gets a single status line each, nothing more.

## Backlog and audit surfacing

If `docs/work/backlog.md` exists, mention its entry count in one line. If any `audit-YYYY-MM-DD.md` exists at the docs/work root, mention the date of the newest one. Do not act on either — no surfacing of individual entries, no re-running audits; the backlog belongs to shape, the report speaks for itself.
