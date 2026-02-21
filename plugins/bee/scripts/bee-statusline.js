#!/usr/bin/env node
// Bee Statusline for Claude Code
// Shows: model | bee state | directory | context usage

const fs = require('fs');
const path = require('path');

// Read JSON from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}');
    const model = data.model?.display_name || 'Claude';
    const dir = data.workspace?.current_dir || process.cwd();
    const remaining = data.context_window?.remaining_percentage;

    // Bee state extraction from .bee/STATE.md
    let beeState = 'Not Initialized';
    try {
      const statePath = path.join(dir, '.bee', 'STATE.md');
      if (fs.existsSync(statePath)) {
        const stateContent = fs.readFileSync(statePath, 'utf8');

        // Extract spec status from "## Current Spec" section
        const specStatusMatch = stateContent.match(/^- Status:\s*(.+)$/m);
        const specStatus = specStatusMatch ? specStatusMatch[1].trim() : 'NO_SPEC';

        if (specStatus === 'NO_SPEC') {
          beeState = 'No Spec';
        } else {
          // Find active phase from "## Phases" table
          // Table rows look like: | 1 | Name | STATUS | ... |
          const phaseRows = stateContent.match(/^\|\s*\d+\s*\|.*\|$/gm);
          let activePhase = null;

          if (phaseRows) {
            for (const row of phaseRows) {
              const cols = row.split('|').map(c => c.trim()).filter(c => c !== '');
              if (cols.length >= 3) {
                const phaseNum = cols[0];
                const phaseStatus = cols[2];
                if (phaseStatus && phaseStatus !== 'DONE') {
                  activePhase = { num: phaseNum, status: phaseStatus };
                  break;
                }
              }
            }
          }

          if (activePhase) {
            beeState = `Phase ${activePhase.num}: ${activePhase.status}`;
          } else {
            beeState = 'Ready';
          }
        }
      }
    } catch (e) {
      // Never crash the statusline
    }

    // Context window display (shows USED percentage scaled to 80% limit)
    // Claude Code enforces an 80% context limit, so we scale to show 100% at that point
    let ctx = '';
    if (remaining != null) {
      const rem = Math.round(remaining);
      const rawUsed = Math.max(0, Math.min(100, 100 - rem));
      // Scale: 80% real usage = 100% displayed
      const used = Math.min(100, Math.round((rawUsed / 80) * 100));

      // Build progress bar (10 segments)
      const filled = Math.floor(used / 10);
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);

      // Color based on scaled usage
      if (used < 63) {
        ctx = ` \x1b[32m${bar} ${used}%\x1b[0m`;
      } else if (used < 81) {
        ctx = ` \x1b[33m${bar} ${used}%\x1b[0m`;
      } else if (used < 95) {
        ctx = ` \x1b[38;5;208m${bar} ${used}%\x1b[0m`;
      } else {
        ctx = ` \x1b[5;31m\u{1F480} ${bar} ${used}%\x1b[0m`;
      }
    }

    // Output assembly
    const dirname = path.basename(dir);
    process.stdout.write(
      `\x1b[2m${model}\x1b[0m \x1b[2m\u2502\x1b[0m \u{1F41D} \x1b[1m${beeState}\x1b[0m \x1b[2m\u2502\x1b[0m \x1b[2m${dirname}\x1b[0m${ctx}`
    );
  } catch (e) {
    // Silent fail - don't break statusline on parse errors
  }
});
