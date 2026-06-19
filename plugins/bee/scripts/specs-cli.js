#!/usr/bin/env node
// specs-cli.js -- CLI seam so markdown commands drive the multi-spec registry without
// inlining JSON logic in prose. Subcommands: register, list, resolve, touch.
const fs = require('fs');
const path = require('path');
const reg = require('./specs-registry');
const { resolveTarget } = require('./spec-resolver');
const { initSpecState, mirrorToGlobal, specStatePath, snapshotToPerSpec, globalStatePath, restoreToGlobal } = require('./spec-state');
const { parseStateMd } = require('./hive-state-parser');

function nowIso() { return new Date().toISOString(); }

function currentGlobalSlug(beeDir) {
  const g = globalStatePath(beeDir);
  if (!fs.existsSync(g)) return null;
  const cs = parseStateMd(g).currentSpec;
  return (cs && cs.path && cs.status && cs.status !== 'NO_SPEC') ? cs.path : null;
}

function backfillLegacySpec(beeDir) {
  const r = reg.readRegistry(beeDir);
  if (reg.activeSpecs(r).length > 0) return;            // already have registered active specs
  const globalState = path.join(beeDir, 'STATE.md');
  if (!fs.existsSync(globalState)) return;
  const cs = parseStateMd(globalState).currentSpec;
  if (!cs || !cs.path || !cs.status || cs.status === 'NO_SPEC') return;
  if (reg.getSpec(r, cs.path)) return;                  // already registered
  // Preserve A's state: seed its per-spec STATE.md from the current global mirror (which holds A's state)
  const perSpec = specStatePath(beeDir, cs.path);
  if (!fs.existsSync(perSpec)) {
    fs.mkdirSync(path.dirname(perSpec), { recursive: true });
    fs.writeFileSync(perSpec, fs.readFileSync(globalState, 'utf8'));
  }
  // Register A as an active spec so it stays visible/recoverable
  const stage = cs.status === 'IN_PROGRESS' ? 'executing' : 'planning';
  reg.upsertSpec(r, { slug: cs.path, title: cs.name || cs.path, stage, location: 'in-place' }, nowIso());
  reg.writeRegistry(beeDir, r);
}

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

function main(argv) {
  const sub = argv[0];
  const f = parseFlags(argv.slice(1));
  const beeDir = f.bee || '.bee';

  if (sub === 'register') {
    if (typeof f.slug !== 'string' || !f.slug) { process.stderr.write('register requires --slug\n'); return 1; }
    fs.mkdirSync(beeDir, { recursive: true });
    // FIX 1: ALL STATE.md sync (snapshot/restore/init) must run INSIDE the same
    // withRegistryLock as the registry read+write so register+touch races cannot
    // interleave STATE.md file writes and corrupt the global.
    reg.withRegistryLock(beeDir, () => {
      // Back-fill legacy spec while holding the lock so a concurrent register
      // cannot produce duplicate entries from the same legacy slug.
      backfillLegacySpec(beeDir);
      const outgoing = currentGlobalSlug(beeDir);
      if (outgoing && outgoing !== f.slug) snapshotToPerSpec(beeDir, outgoing);
      const r = reg.readRegistry(beeDir);
      const existing = reg.getSpec(r, f.slug);
      let stage = f.stage || 'shaping';
      // --force-stage bypasses the no-regress guard (used only by Overwrite in new-spec)
      if (!f['force-stage'] && existing && reg.STAGES.indexOf(stage) < reg.STAGES.indexOf(existing.stage)) stage = existing.stage;
      reg.upsertSpec(r, { slug: f.slug, title: f.title, stage, location: 'in-place' }, nowIso());
      reg.writeRegistry(beeDir, r);
      // STATE.md sync inside the lock: init per-spec file, then mirror/restore.
      // Track whether initSpecState created a genuinely new file (Overwrite deleted it)
      // so we can distinguish "re-register live spec" from "Overwrite reset".
      const perSpecExistedBefore = fs.existsSync(specStatePath(beeDir, f.slug));
      initSpecState(beeDir, f.slug, { name: f.title || f.slug, status: 'SPEC_CREATED' });
      const freshlyCreated = !perSpecExistedBefore;
      if (!freshlyCreated && currentGlobalSlug(beeDir) === f.slug) {
        // Re-registering the spec already reflected in global (not an Overwrite reset):
        // capture the live global into its per-spec snapshot instead of clobbering it.
        snapshotToPerSpec(beeDir, f.slug);
      } else {
        // New spec, Overwrite reset, or incoming spec switch:
        // restore the (fresh or incoming) per-spec snapshot into the global.
        restoreToGlobal(beeDir, f.slug);
      }
    });
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
    // Backward compat: if the registry has NO specs at all (truly legacy repo that has never
    // used multi-spec), fall back to a spec recorded in the global STATE.md.
    // Do NOT fall back when the registry has specs but they are all terminal — that means
    // all work is complete and the user should start a new spec (mode:create).
    let legacySpec = null;
    if (r.specs.length === 0) {
      const st = parseStateMd(path.join(beeDir, 'STATE.md'));
      if (st.currentSpec && st.currentSpec.path && st.currentSpec.status && st.currentSpec.status !== 'NO_SPEC') {
        legacySpec = st.currentSpec.path;
      }
    }
    let result = resolveTarget({ registry: r, worktreeSpec: f['worktree-spec'] || null, legacySpec });
    if (result.mode === 'pick' && result.candidates.length > 4) {
      const total = result.candidates.length;
      result = { ...result, candidates: result.candidates.slice(0, 4), more: total - 4 };
    }
    process.stdout.write(JSON.stringify(result) + '\n');
    return 0;
  }
  if (sub === 'touch') {
    let touchErr = null;
    // FIX 1: ALL STATE.md sync (snapshotToPerSpec/restoreToGlobal) must run INSIDE
    // the same withRegistryLock as the registry read+write.  A touch racing a
    // cross-spec register previously could interleave STATE.md file writes and
    // produce a global STATE.md contaminated with the wrong spec's content.
    reg.withRegistryLock(beeDir, () => {
      const r = reg.readRegistry(beeDir);
      let sp = reg.getSpec(r, f.slug);
      if (!sp) {
        // Self-heal: check whether this is the legacy global spec that was never registered
        const globalState = path.join(beeDir, 'STATE.md');
        if (fs.existsSync(globalState)) {
          const cs = parseStateMd(globalState).currentSpec;
          if (cs && cs.path === f.slug && cs.status && cs.status !== 'NO_SPEC') {
            // Back-register the legacy spec
            const perSpec = specStatePath(beeDir, f.slug);
            if (!fs.existsSync(perSpec)) {
              fs.mkdirSync(path.dirname(perSpec), { recursive: true });
              fs.writeFileSync(perSpec, fs.readFileSync(globalState, 'utf8'));
            }
            const stage = cs.status === 'IN_PROGRESS' ? 'executing' : 'planning';
            reg.upsertSpec(r, { slug: f.slug, title: cs.name || f.slug, stage, location: 'in-place' }, nowIso());
            reg.writeRegistry(beeDir, r);
            sp = reg.getSpec(r, f.slug);
          }
        }
        if (!sp) { touchErr = 'touch: unknown spec ' + f.slug + '\n'; return; }
      }
      if (reg.TERMINAL_STAGES.includes(sp.stage)) { touchErr = 'touch: spec ' + f.slug + ' is ' + sp.stage + ' (completed/archived)\n'; return; }
      reg.touchSpec(r, f.slug, nowIso());
      reg.writeRegistry(beeDir, r);
      // STATE.md sync inside the lock — atomic with the registry write.
      const g = currentGlobalSlug(beeDir);
      if (g === f.slug) {
        snapshotToPerSpec(beeDir, f.slug); // same spec in global: capture latest edits into the snapshot
      } else {
        if (g) snapshotToPerSpec(beeDir, g); // a DIFFERENT real spec is in global: save it before switching
        const ok = restoreToGlobal(beeDir, f.slug); // load target's snapshot into global (also the NO_SPEC case)
        if (!ok) { touchErr = 'touch: spec ' + f.slug + ' has no per-spec STATE.md snapshot; cannot switch\n'; return; }
      }
    });
    if (touchErr) { process.stderr.write(touchErr); return 1; }
    process.stdout.write(`touched ${f.slug}\n`);
    return 0;
  }
  if (sub === 'set-stage') {
    return reg.withRegistryLock(beeDir, () => {
      const r = reg.readRegistry(beeDir);
      if (!reg.getSpec(r, f.slug)) { process.stderr.write('set-stage: unknown spec ' + f.slug + '\n'); return 1; }
      if (!reg.STAGES.includes(f.stage)) { process.stderr.write('set-stage: invalid stage ' + f.stage + '\n'); return 1; }
      reg.setStage(r, f.slug, f.stage);
      reg.writeRegistry(beeDir, r);
      process.stdout.write('set-stage ' + f.slug + ' -> ' + f.stage + '\n');
      return 0;
    });
  }
  process.stderr.write(`unknown subcommand: ${sub}\n`);
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { main, parseFlags };
