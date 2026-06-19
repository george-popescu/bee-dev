// spec-state.js -- per-spec STATE.md lifecycle + the global mirror. Per-spec STATE.md is
// authoritative; .bee/STATE.md mirrors the last-touched spec so existing consumers keep working.
const fs = require('fs');
const path = require('path');

function specStatePath(beeDir, slug) { return path.join(beeDir, 'specs', slug, 'STATE.md'); }
function globalStatePath(beeDir) { return path.join(beeDir, 'STATE.md'); }

function renderSpecState({ name, slug, status }) {
  return [
    '# Spec State', '',
    '## Current Spec',
    `- Name: ${name}`,
    `- Path: .bee/specs/${slug}/`,
    `- Status: ${status}`, '',
    '## Phases', '',
    '## Quick Tasks', '',
    '## Decisions Log', '',
    '## Last Action',
    '- Command: /bee:new-spec',
    '- Timestamp:',
    '- Result: spec created', '',
  ].join('\n');
}

function initSpecState(beeDir, slug, { name, status }) {
  const p = specStatePath(beeDir, slug);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (!fs.existsSync(p)) fs.writeFileSync(p, renderSpecState({ name, slug, status: status || 'SPEC_CREATED' }));
  return p;
}

function mirrorToGlobal(beeDir, slug) {
  const src = specStatePath(beeDir, slug);
  if (!fs.existsSync(src)) return false;
  fs.writeFileSync(globalStatePath(beeDir), fs.readFileSync(src, 'utf8'));
  return true;
}

function snapshotToPerSpec(beeDir, slug) {
  const g = globalStatePath(beeDir);
  if (!fs.existsSync(g)) return false;
  const dest = specStatePath(beeDir, slug);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, fs.readFileSync(g, 'utf8'));
  return true;
}

const PROJECT_GLOBAL_SECTIONS = ['Quick Tasks', 'Decisions Log'];

// The "## heading" block: from its line up to just before the next "## " or end-of-string.
function getSectionBlock(content, heading) {
  const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\n)(## ${esc}[ \\t]*\\n[\\s\\S]*?)(?=\\n## |\\s*$)`);
  const m = content.match(re);
  return m ? m[1] : null;
}

function upsertSectionBlock(content, heading, block) {
  const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|\\n)## ${esc}[ \\t]*\\n[\\s\\S]*?(?=\\n## |\\s*$)`);
  if (re.test(content)) return content.replace(re, (m, p1) => `${p1}${block}`);
  return `${content.replace(/\s*$/, '')}\n\n${block}\n`;
}

// Restore the spec's snapshot into global, but KEEP the live global's project-global sections.
function restoreToGlobal(beeDir, slug) {
  const src = specStatePath(beeDir, slug);
  if (!fs.existsSync(src)) return false;
  let merged = fs.readFileSync(src, 'utf8');
  const g = globalStatePath(beeDir);
  if (fs.existsSync(g)) {
    const cur = fs.readFileSync(g, 'utf8');
    for (const h of PROJECT_GLOBAL_SECTIONS) {
      const block = getSectionBlock(cur, h);
      if (block) merged = upsertSectionBlock(merged, h, block);
    }
  }
  fs.writeFileSync(g, merged);
  return true;
}

module.exports = { specStatePath, globalStatePath, renderSpecState, initSpecState, mirrorToGlobal, snapshotToPerSpec, restoreToGlobal, PROJECT_GLOBAL_SECTIONS, getSectionBlock, upsertSectionBlock };
