#!/usr/bin/env node
// Bee Statusline for Claude Code
// Shows: model | 🐝 ▰▰▱▱▱ P2/5 EXEC | gitΔ | context bar

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Compact status map
const STATUS_SHORT = {
  'PLANNED': 'PLAN',
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
  if (!name) return 'Claude';
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

// Build implementation progress bar (▰▰▰▱▱ style, 5 segments)
function progressBar(completed, total) {
  if (total === 0) return '';
  const segments = 5;
  const filled = Math.round((completed / total) * segments);
  const bar = '\u25B0'.repeat(filled) + '\u25B1'.repeat(segments - filled);

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

    // Bee state extraction from .bee/STATE.md
    let beeSegment = '\x1b[2mnot init\x1b[0m';
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
          // Parse phases table — count completed vs total
          const phaseRows = stateContent.match(/^\|\s*\d+\s*\|.*\|$/gm);
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

          const pBar = progressBar(completedPhases, totalPhases);

          if (activePhase) {
            const st = STATUS_SHORT[activePhase.status] || activePhase.status;
            beeSegment = `${pBar} \x1b[1mP${activePhase.num}/${totalPhases}\x1b[0m \x1b[33m${st}\x1b[0m`;
          } else if (totalPhases > 0) {
            beeSegment = `${pBar} \x1b[32mall done\x1b[0m`;
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
      gitSegment = ` \x1b[2m\u2502\x1b[0m \x1b[33m${dirty}\u0394\x1b[0m`;
    }

    // Context window display (shows USED percentage scaled to 80% limit)
    let ctx = '';
    if (remaining != null) {
      const rem = Math.round(remaining);
      const rawUsed = Math.max(0, Math.min(100, 100 - rem));
      const used = Math.min(100, Math.round((rawUsed / 80) * 100));

      const filled = Math.floor(used / 10);
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);

      if (used < 63) {
        ctx = ` \x1b[32m${bar} ${used}%\x1b[0m`;
      } else if (used < 81) {
        ctx = ` \x1b[33m${bar} ${used}%\x1b[0m`;
      } else if (used < 95) {
        ctx = ` \x1b[38;5;208m${bar} ${used}%\x1b[0m`;
      } else {
        ctx = ` \x1b[31m${bar} ${used}%\x1b[0m`;
      }
    }

    // Output: Model │ 🐝 ▰▰▱▱▱ P2/5 EXEC │ 3Δ │ ████░░░░░░ 40%
    process.stdout.write(
      `\x1b[2m${model}\x1b[0m \x1b[2m\u2502\x1b[0m \u{1F41D} ${beeSegment}${gitSegment}${ctx}`
    );
  } catch (e) {
    // Silent fail - don't break statusline on parse errors
  }
});
