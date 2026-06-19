#!/usr/bin/env node
// specs-registry.js -- read/write and manipulate the .bee/specs.json multi-spec registry.
// Pure manipulation (registry object in -> out) + thin fs IO keyed by beeDir. Node core only.
const fs = require('fs');
const path = require('path');

const STAGES = ['shaping', 'discussing', 'planning', 'executing', 'reviewing', 'shipped', 'archived'];
const TERMINAL_STAGES = ['shipped', 'archived'];

function registryPath(beeDir) { return path.join(beeDir, 'specs.json'); }
function emptyRegistry() { return { specs: [] }; }

function readRegistry(beeDir) {
  const p = registryPath(beeDir);
  if (!fs.existsSync(p)) return emptyRegistry();
  let raw;
  try { raw = fs.readFileSync(p, 'utf8'); } catch (e) { return emptyRegistry(); }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.specs)) return emptyRegistry();
    return parsed;
  } catch (e) {
    try { fs.writeFileSync(p + '.bak', raw); } catch (_) {}
    return emptyRegistry();
  }
}

function writeRegistry(beeDir, reg) {
  fs.writeFileSync(registryPath(beeDir), JSON.stringify(reg, null, 2) + '\n');
  return reg;
}

function getSpec(reg, slug) { return reg.specs.find(s => s.slug === slug) || null; }

function upsertSpec(reg, { slug, title, stage, location }, ts) {
  const existing = getSpec(reg, slug);
  if (existing) {
    if (title !== undefined) existing.title = title;
    if (stage !== undefined) existing.stage = stage;
    if (location !== undefined) existing.location = location;
    existing.last_touched = ts;
  } else {
    reg.specs.push({
      slug, title: title || slug, stage: stage || 'shaping',
      location: location || 'in-place', created: ts, last_touched: ts,
    });
  }
  return reg;
}

function touchSpec(reg, slug, ts) { const s = getSpec(reg, slug); if (s) s.last_touched = ts; return reg; }
function setStage(reg, slug, stage) { const s = getSpec(reg, slug); if (s) s.stage = stage; return reg; }

function activeSpecs(reg) {
  return reg.specs
    .filter(s => !TERMINAL_STAGES.includes(s.stage))
    .sort((a, b) => String(b.last_touched).localeCompare(String(a.last_touched)));
}

module.exports = {
  STAGES, TERMINAL_STAGES, registryPath, emptyRegistry,
  readRegistry, writeRegistry, getSpec, upsertSpec, touchSpec, setStage, activeSpecs,
};
