#!/usr/bin/env node
// Bee SessionStart hook: auto-configure statusline globally
// Copies bee-statusline.js to ~/.claude/hooks/ and configures ~/.claude/settings.json
// Idempotent - skips if already configured

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

  // 2. Copy/update bee-statusline.js to ~/.claude/hooks/
  if (fs.existsSync(SOURCE_SCRIPT)) {
    const source = fs.readFileSync(SOURCE_SCRIPT, 'utf8');
    const existing = fs.existsSync(TARGET_SCRIPT) ? fs.readFileSync(TARGET_SCRIPT, 'utf8') : '';
    if (source !== existing) {
      fs.writeFileSync(TARGET_SCRIPT, source);
    }
  }

  // 3. Configure statusLine in ~/.claude/settings.json (if not already set)
  let settings = {};
  if (fs.existsSync(SETTINGS_PATH)) {
    settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  }

  const currentCmd = settings.statusLine?.command || '';
  if (!currentCmd.includes('bee-statusline')) {
    settings.statusLine = { type: 'command', command: STATUSLINE_CMD };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
  }
} catch (e) {
  // Silent fail - never break session start
}
