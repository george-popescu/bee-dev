#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
let passed = 0, failed = 0;
function assert(c, n) { if (c) { passed++; console.log(`  PASS: ${n}`); } else { failed++; console.log(`  FAIL: ${n}`); } }
const md = fs.readFileSync(path.join(__dirname, '..', '..', 'commands', 'workspace.md'), 'utf8');

console.log('Merge-back: spec-aware reconciliation in complete');
assert(md.includes('worktree-spec'), 'complete reads the .bee/worktree-spec marker');
// The spec folder must be copied back BEFORE worktree removal (git does not carry gitignored .bee/)
const markerIdx = md.indexOf('worktree-spec');
const removeIdx = md.indexOf('git worktree remove');
assert(markerIdx > -1 && removeIdx > -1 && markerIdx < removeIdx, 'spec-folder copy-back happens before worktree removal');
assert(md.includes('set-location') && md.includes('in-place'), 'complete resets the promoted spec location to in-place');
assert(/cp -r.*\.bee\/specs\//.test(md) || md.includes('.bee/specs/{slug}/'), 'complete copies the worktree spec folder back to main');

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
process.exit(failed > 0 ? 1 : 0);
