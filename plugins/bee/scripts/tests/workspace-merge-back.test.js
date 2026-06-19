#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
let passed = 0, failed = 0;
function assert(c, n) { if (c) { passed++; console.log(`  PASS: ${n}`); } else { failed++; console.log(`  FAIL: ${n}`); } }
const md = fs.readFileSync(path.join(__dirname, '..', '..', 'commands', 'workspace.md'), 'utf8');

// Scope assertions to the `complete` subcommand only. A whole-file indexOf would match the
// `new` subcommand's rollback `git worktree remove`, making the ordering check vacuous.
const start = md.indexOf('#### **Subcommand: complete');
const nextIdx = md.indexOf('#### **Subcommand:', start + 10);
const complete = md.slice(start, nextIdx === -1 ? md.length : nextIdx);

console.log('Merge-back: spec-aware reconciliation in the complete subcommand');
assert(start > -1, 'complete subcommand section located');
assert(complete.includes('worktree-spec'), 'complete reads the .bee/worktree-spec marker');
assert(complete.includes('set-location') && complete.includes('in-place'),
  'complete resets the promoted spec location to in-place');

const copyIdx = complete.search(/cp -r.*\.bee\/specs\//);
assert(copyIdx > -1, 'complete copies the worktree spec folder (.bee/specs/<slug>/) back to main');

// The data-safety invariant: the spec-folder copy-back MUST precede `git worktree remove`
// WITHIN complete — otherwise the worktree (and its gitignored .bee/ state) is destroyed first.
const removeIdx = complete.indexOf('git worktree remove');
assert(removeIdx > -1, 'complete removes the worktree');
assert(copyIdx > -1 && removeIdx > -1 && copyIdx < removeIdx,
  'in complete, spec-folder copy-back happens BEFORE worktree removal (no state loss)');

// And the marker read precedes the copy-back (you must know the slug before copying it).
const markerIdx = complete.indexOf('worktree-spec');
assert(markerIdx > -1 && markerIdx < copyIdx, 'marker is read before the copy-back');

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
