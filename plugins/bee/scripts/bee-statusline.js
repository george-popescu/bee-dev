#!/usr/bin/env node
// Bee Statusline for Claude Code — Honeycomb Design
// Shows: 🐝 4.0 ┊ ⬢⬢⬢⬡⬡ P3/5 EXEC ┊ █████░░░░░ 48% ┊ Δ7

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Compact status map
const STATUS_SHORT = {
  'PLANNED': 'PLAN',
  'PLAN_REVIEWED': 'PRVW',
  'EXECUTING': 'EXEC',
  'EXECUTED': 'BUILT',
  'REVIEWING': 'RVNG',
  'REVIEWED': 'REV',
  'TESTING': 'TEST',
  'TESTED': 'PASS',
  'COMMITTED': 'OK',
  'DONE': 'DONE',
};

// Phases considered "complete" for progress calculation
const DONE_STATUSES = new Set(['REVIEWED', 'TESTED', 'COMMITTED', 'DONE']);

// Short model name: "Claude Opus 4.6" → "Opus"
function shortModel(name) {
  if (!name) return '';
  const lower = name.toLowerCase();
  if (lower.includes('opus')) return 'Opus';
  if (lower.includes('sonnet')) return 'Sonnet';
  if (lower.includes('haiku')) return 'Haiku';
  const parts = name.split(/\s+/);
  return parts.length > 1 ? parts.slice(-1)[0] : name;
}

// Count git dirty files (uncommitted changes + untracked)
function gitDirtyCount(dir) {
  try {
    const out = execFileSync('git', ['status', '--porcelain'], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 2000,
    });
    if (!out.trim()) return 0;
    return out.trim().split('\n').length;
  } catch {
    return -1;
  }
}

// Build honeycomb phase progress (⬢⬢⬢⬡⬡ style, 5 segments)
function honeycombBar(completed, total) {
  if (total === 0) return '';
  const segments = 5;
  const filled = Math.round((completed / total) * segments);
  const done = '\u2B22'; // ⬢ filled hexagon
  const pending = '\u2B21'; // ⬡ empty hexagon
  const bar = done.repeat(filled) + pending.repeat(segments - filled);

  // Color: green if all done, cyan if in progress
  if (completed === total) {
    return `\x1b[32m${bar}\x1b[0m`;
  }
  return `\x1b[36m${bar}\x1b[0m`;
}

// Read JSON from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}');
    const model = shortModel(data.model?.display_name);
    const dir = data.workspace?.current_dir || process.cwd();
    const remaining = data.context_window?.remaining_percentage;

    // Plugin version — injected by setup-statusline.js, falls back to plugin.json
    const BEE_VERSION = '__BEE_VERSION__';
    let version = '';
    try {
      version = BEE_VERSION.startsWith('__') ? null : BEE_VERSION;
      if (!version) {
        const pluginPath = path.join(__dirname, '..', '.claude-plugin', 'plugin.json');
        if (fs.existsSync(pluginPath)) {
          version = JSON.parse(fs.readFileSync(pluginPath, 'utf8')).version;
        }
      }
      // Trim to major.minor (4.0.0 → 4.0)
      if (version) {
        const parts = version.split('.');
        version = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : version;
      }
    } catch (e) {
      // Never crash the statusline
    }

    // Separator style
    const sep = `\x1b[2m\u250A\x1b[0m`; // ┊ thin dotted vertical

    // Bee state extraction from .bee/STATE.md
    let beeSegment = '\x1b[2mready\x1b[0m';
    try {
      const statePath = path.join(dir, '.bee', 'STATE.md');
      if (fs.existsSync(statePath)) {
        const stateContent = fs.readFileSync(statePath, 'utf8');

        // Extract spec status
        const specStatusMatch = stateContent.match(/^- Status:\s*(.+)$/m);
        const specStatus = specStatusMatch ? specStatusMatch[1].trim() : 'NO_SPEC';

        // Check last action for quick task indicator
        const lastCmdMatch = stateContent.match(/^- Command:\s*(.+)$/m);
        const lastCmd = lastCmdMatch ? lastCmdMatch[1].trim() : '';
        const isQuick = lastCmd.includes('quick');

        // Extract spec name
        const specPathMatch = stateContent.match(/^- Path:\s*\.bee\/specs\/([^/\s]+)/m);
        const specName = specPathMatch ? specPathMatch[1] : null;

        if (specStatus === 'NO_SPEC' || !specName) {
          if (isQuick) {
            beeSegment = '\x1b[36mquick\x1b[0m';
          } else {
            beeSegment = '\x1b[2mready\x1b[0m';
          }
        } else {
          // Parse phases table — count completed vs total (only from ## Phases section)
          const phasesSection = stateContent.match(/## Phases\n[\s\S]*?(?=\n## |\n*$)/);
          const phaseRows = phasesSection ? phasesSection[0].match(/^\|\s*\d+\s*\|.*\|$/gm) : null;
          let activePhase = null;
          let totalPhases = 0;
          let completedPhases = 0;

          if (phaseRows) {
            totalPhases = phaseRows.length;
            for (const row of phaseRows) {
              const cols = row.split('|').map(c => c.trim()).filter(c => c !== '');
              if (cols.length >= 3) {
                const phaseNum = cols[0];
                const phaseStatus = cols[2];
                if (DONE_STATUSES.has(phaseStatus)) {
                  completedPhases++;
                } else if (!activePhase) {
                  activePhase = { num: phaseNum, status: phaseStatus };
                }
              }
            }
          }

          const hBar = honeycombBar(completedPhases, totalPhases);

          if (activePhase) {
            const st = STATUS_SHORT[activePhase.status] || activePhase.status;
            beeSegment = `${hBar} \x1b[1mP${activePhase.num}/${totalPhases}\x1b[0m \x1b[33m${st}\x1b[0m`;
          } else if (totalPhases > 0) {
            beeSegment = `${hBar} \x1b[32mall done\x1b[0m`;
          } else {
            beeSegment = '\x1b[2mno phases\x1b[0m';
          }
        }
      }
    } catch (e) {
      // Never crash the statusline
    }

    // Git dirty count
    let gitSegment = '';
    const dirty = gitDirtyCount(dir);
    if (dirty > 0) {
      gitSegment = ` ${sep} \x1b[33m\u0394${dirty}\x1b[0m`;
    }

    // Context window — fuel gauge with ━ (heavy line) and ░ (light shade)
    const rem = Math.round(remaining ?? 100);
    const rawUsed = Math.max(0, Math.min(100, 100 - rem));
    const used = Math.min(100, Math.round((rawUsed / 80) * 100));

    const totalSegs = 10;
    const filledSegs = Math.floor(used / 10);
    const heavy = '\u2588'; // █ full block — high-contrast filled cell
    const light = '\u2591'; // ░ light shade — empty cell
    const bar = heavy.repeat(filledSegs) + light.repeat(totalSegs - filledSegs);

    let ctx;
    if (used < 63) {
      ctx = `\x1b[32m${bar}\x1b[0m \x1b[32m${used}%\x1b[0m`;
    } else if (used < 81) {
      ctx = `\x1b[33m${bar}\x1b[0m \x1b[33m${used}%\x1b[0m`;
    } else if (used < 95) {
      ctx = `\x1b[38;5;208m${bar}\x1b[0m \x1b[38;5;208m${used}%\x1b[0m`;
    } else {
      ctx = `\x1b[31m${bar}\x1b[0m \x1b[31m${used}%\x1b[0m`;
    }

    // Model segment (dim, only if available)
    const modelSeg = model ? `\x1b[2m${model}\x1b[0m ` : '';

    // Output: 🐝 4.0 ┊ ⬢⬢⬢⬡⬡ P3/5 EXEC ┊ ━━━━░░░░░░ 48% ┊ Δ7
    process.stdout.write(
      `${modelSeg}\u{1F41D} ${version ? version + ' ' : ''}${sep} ${beeSegment} ${sep} ${ctx}${gitSegment}`
    );
  } catch (e) {
    // Silent fail - don't break statusline on parse errors
  }
});
