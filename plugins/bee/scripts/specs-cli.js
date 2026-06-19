#!/usr/bin/env node
// specs-cli.js -- CLI seam so markdown commands drive the multi-spec registry without
// inlining JSON logic in prose. Subcommands: register, list, resolve, touch.
const path = require('path');
const reg = require('./specs-registry');
const { resolveTarget } = require('./spec-resolver');
const { initSpecState, mirrorToGlobal } = require('./spec-state');

function parseFlags(argv) {
  const f = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) f[key] = true;
    else { f[key] = next; i++; }
  }
  return f;
}
function nowIso() { return new Date().toISOString(); }

function main(argv) {
  const sub = argv[0];
  const f = parseFlags(argv.slice(1));
  const beeDir = f.bee || '.bee';

  if (sub === 'register') {
    const fs = require('fs');
    fs.mkdirSync(beeDir, { recursive: true });
    const r = reg.readRegistry(beeDir);
    reg.upsertSpec(r, { slug: f.slug, title: f.title, stage: f.stage || 'shaping', location: 'in-place' }, nowIso());
    reg.writeRegistry(beeDir, r);
    initSpecState(beeDir, f.slug, { name: f.title || f.slug, status: 'SPEC_CREATED' });
    mirrorToGlobal(beeDir, f.slug);
    process.stdout.write(`registered ${f.slug}\n`);
    return 0;
  }
  if (sub === 'list') {
    const r = reg.readRegistry(beeDir);
    const specs = f.active ? reg.activeSpecs(r) : r.specs;
    if (f.json) { process.stdout.write(JSON.stringify(specs, null, 2) + '\n'); return 0; }
    if (specs.length === 0) { process.stdout.write('No specs.\n'); return 0; }
    for (const s of specs) process.stdout.write(`${s.slug}\t${s.stage}\t${s.location}\t${s.title}\n`);
    return 0;
  }
  if (sub === 'resolve') {
    const r = reg.readRegistry(beeDir);
    // Backward compat: if no active specs are registered yet, fall back to a current
    // spec recorded in the legacy global STATE.md so existing mid-spec repos keep working.
    let legacySpec = null;
    if (reg.activeSpecs(r).length === 0) {
      const { parseStateMd } = require('./hive-state-parser');
      const st = parseStateMd(path.join(beeDir, 'STATE.md'));
      if (st.currentSpec && st.currentSpec.path && st.currentSpec.status && st.currentSpec.status !== 'NO_SPEC') {
        legacySpec = st.currentSpec.path;
      }
    }
    process.stdout.write(JSON.stringify(resolveTarget({ registry: r, worktreeSpec: f['worktree-spec'] || null, legacySpec })) + '\n');
    return 0;
  }
  if (sub === 'touch') {
    const r = reg.readRegistry(beeDir);
    reg.touchSpec(r, f.slug, nowIso());
    reg.writeRegistry(beeDir, r);
    mirrorToGlobal(beeDir, f.slug);
    process.stdout.write(`touched ${f.slug}\n`);
    return 0;
  }
  process.stderr.write(`unknown subcommand: ${sub}\n`);
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { main, parseFlags };
