#!/usr/bin/env node
// Bee SessionStart hook: auto-configure statusline globally
// Copies bee-statusline.js to ~/.claude/hooks/ and configures ~/.claude/settings.json
// Always overwrites statusline config to ensure bee statusbar persists across sessions

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOKS_DIR = path.join(os.homedir(), '.claude', 'hooks');
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const TARGET_SCRIPT = path.join(HOOKS_DIR, 'bee-statusline.js');
const SOURCE_SCRIPT = path.join(__dirname, 'bee-statusline.js');
const STATUSLINE_CMD = `node "${TARGET_SCRIPT}"`;

try {
  // 1. Ensure ~/.claude/hooks/ exists
  fs.mkdirSync(HOOKS_DIR, { recursive: true });

  // 2. Always copy latest bee-statusline.js to ~/.claude/hooks/
  if (fs.existsSync(SOURCE_SCRIPT)) {
    const source = fs.readFileSync(SOURCE_SCRIPT, 'utf8');
    fs.writeFileSync(TARGET_SCRIPT, source);
  }

  // 3. Always set statusLine in ~/.claude/settings.json
  let settings = {};
  if (fs.existsSync(SETTINGS_PATH)) {
    settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  }

  settings.statusLine = { type: 'command', command: STATUSLINE_CMD };
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
} catch (e) {
  // Silent fail - never break session start
}
