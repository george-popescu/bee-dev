#!/usr/bin/env node
// hive-snapshot.js — Snapshot aggregator for the Bee Hive dashboard API.
//
// Combines every parser/reader/scanner from T1.2-T1.5 into a single JSON
// snapshot object served by `/api/snapshot`. Designed to be mounted on the
// hive-server.js (T1.1) via `setSnapshotHandler(createSnapshotHandler(beeDir))`.
//
// Exports:
//   buildSnapshot(beeDir)           -> snapshot object (never throws)
//   createSnapshotHandler(beeDir)   -> (req, res) handler factory
//
// Snapshot shape:
//   {
//     timestamp:      ISO 8601 string,
//     state:          { currentSpec, phases, quickTasks, decisionsLog, lastAction }   (T1.2)
//     config:         object | null       (T1.3 readConfig)
//     healthHistory:  array | object | null (T1.3 readHealthHistory)
//     phaseMetrics:   array               (T1.3 readPhaseMetrics — always [])
//     workspaces:     object | null       (T1.3 readWorkspaces)
//     notes:          array               (T1.4 scanNotes)
//     seeds:          array               (T1.4 scanSeeds)
//     discussions:    array               (T1.4 scanDiscussions)
//     forensics:      array               (T1.4 scanForensics)
//     debugSessions:  array               (T1.4 scanDebugSessions)
//     quickTasks:     array               (T1.4 scanQuickTasks)
//     spec:           { goal, userStories } | null       (T1.5 readSpec)
//     phases:         array | null                        (T1.5 readPhases)
//     requirements:   { checked, total, sections } | null (T1.5 readRequirements)
//     roadmap:        { phaseMapping } | null             (T1.5 readRoadmap)
//     phaseTasks:     array | null                        (T1.5 readPhaseTasks)
//     learnings:      array               (T1.4 scanLearnings)
//     reviews:        array               (T1.4 scanReviews)
//     error?:         string              (only set when aggregation hit an error)
//   }
//
// Design principles:
//   1. Never throw from buildSnapshot. Any error returns a partial object with
//      an `error` field so the HTTP response still succeeds.
//   2. Synchronous reads only — matches the T1.1-T1.5 pattern and keeps the
//      handler simple. The full snapshot for a typical .bee/ directory is well
//      under 500ms because every reader is cheap (regex + small file I/O).
//   3. Active spec resolution: prefer state.currentSpec.path (joined with
//      beeDir/specs/) over discoverActiveSpec fallback. This lets users pin an
//      older spec by editing STATE.md without touching the filesystem.
//   4. No CORS headers — same-origin dashboard only.

const fs = require('fs');
const path = require('path');

const { parseStateMd } = require('./hive-state-parser');
const {
  readConfig,
  readHealthHistory,
  readPhaseMetrics,
  readWorkspaces,
} = require('./hive-json-readers');
const {
  scanNotes,
  scanSeeds,
  scanDiscussions,
  scanForensics,
  scanDebugSessions,
  scanQuickTasks,
  scanLearnings,
  scanReviews,
} = require('./hive-dir-scanners');
const {
  readSpec,
  readPhases,
  readRequirements,
  readRoadmap,
  readPhaseTasks,
  discoverActiveSpec,
} = require('./hive-spec-reader');

// ---------------------------------------------------------------------------
// Active spec resolution
// ---------------------------------------------------------------------------
//
// T1.2 parseStateMd returns `state.currentSpec.path` as the spec directory
// *slug* (e.g. "2026-04-10-bee-board-dashboard"), NOT an absolute path. We
// have to join it with `{beeDir}/specs/` before passing to any T1.5 reader.
//
// If state does not have an active spec (empty slug, missing file), fall
// back to discoverActiveSpec(beeDir), which already returns an absolute path.
//
// Returns null when no spec could be resolved. All downstream readers accept
// a null specDir and return null, so the snapshot stays valid either way.
function resolveActiveSpecDir(beeDir, state) {
  if (state && state.currentSpec && typeof state.currentSpec.path === 'string' && state.currentSpec.path) {
    const specDir = path.join(beeDir, 'specs', state.currentSpec.path);
    // Cheap sanity check — if the dir doesn't exist fall through to discover.
    try {
      if (fs.existsSync(specDir) && fs.statSync(specDir).isDirectory()) {
        return specDir;
      }
    } catch (_e) {
      // fall through to discovery
    }
  }
  return discoverActiveSpec(beeDir); // returns absolute path or null
}

// ---------------------------------------------------------------------------
// scanArchivedSpecs — scan .bee/archive/ and .bee/specs/ for historical specs
// ---------------------------------------------------------------------------
function scanArchivedSpecs(beeDir) {
  const results = [];

  // Scan .bee/archive/ (formally archived specs)
  const archiveDir = path.join(beeDir, 'archive');
  try {
    const entries = fs.readdirSync(archiveDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const specDir = path.join(archiveDir, entry.name);
      const specInfo = readSpecSummary(specDir, entry.name, 'archived');
      if (specInfo) results.push(specInfo);
    }
  } catch (_) { /* archive dir may not exist */ }

  // Also scan .bee/specs/ for non-active specs (completed/old specs)
  const specsDir = path.join(beeDir, 'specs');
  try {
    const entries = fs.readdirSync(specsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const specDir = path.join(specsDir, entry.name);
      const specInfo = readSpecSummary(specDir, entry.name, 'specs');
      if (specInfo) results.push(specInfo);
    }
  } catch (_) { /* specs dir may not exist */ }

  // Sort by date descending (newest first)
  results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return results;
}

function readSpecSummary(specDir, dirName, source) {
  try {
    // Extract date from dir name (YYYY-MM-DD-slug)
    const dateMatch = dirName.match(/^(\d{4}-\d{2}-\d{2})-(.+)/);
    const date = dateMatch ? dateMatch[1] : null;
    const slug = dateMatch ? dateMatch[2] : dirName;

    // Try to read spec.md for the goal
    let goal = null;
    try {
      const specContent = fs.readFileSync(path.join(specDir, 'spec.md'), 'utf8');
      const goalMatch = specContent.match(/##\s*Goal\s*\n\n([^\n]+)/);
      if (goalMatch) goal = goalMatch[1].trim();
    } catch (_) { /* spec.md may not exist */ }

    // Try to read phases.md for phase count
    let phaseCount = 0;
    try {
      const phasesContent = fs.readFileSync(path.join(specDir, 'phases.md'), 'utf8');
      const phaseMatches = phasesContent.match(/##\s*Phase\s+\d+/g);
      if (phaseMatches) phaseCount = phaseMatches.length;
    } catch (_) { /* phases.md may not exist */ }

    return {
      name: slug,
      date,
      source,
      goal,
      phaseCount,
      dirName,
    };
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// createConfigHandler — POST /api/config writes to .bee/config.json
// ---------------------------------------------------------------------------
function createConfigHandler(beeDir) {
  return function handleConfigWrite(req, res) {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const newConfig = JSON.parse(body);
        if (typeof newConfig !== 'object' || newConfig === null || Array.isArray(newConfig)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Config must be a JSON object' }));
          return;
        }

        // Read-Modify-Write: merge with existing config
        const configPath = path.join(beeDir, 'config.json');
        let existing = {};
        try {
          existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (_) { /* fresh config */ }

        // Deep merge top-level keys (shallow merge for nested objects)
        const merged = { ...existing };
        for (const [key, value] of Object.entries(newConfig)) {
          if (value !== null && typeof value === 'object' && !Array.isArray(value) &&
              existing[key] && typeof existing[key] === 'object' && !Array.isArray(existing[key])) {
            merged[key] = { ...existing[key], ...value };
          } else {
            merged[key] = value;
          }
        }

        fs.writeFileSync(configPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, config: merged }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Invalid JSON' }));
      }
    });
    req.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  };
}

// ---------------------------------------------------------------------------
// buildSnapshot
// ---------------------------------------------------------------------------
function buildSnapshot(beeDir) {
  const timestamp = new Date().toISOString();

  // Defensive initial shape — every section has a safe default so a
  // catastrophic failure mid-aggregation still produces a valid JSON doc.
  const snap = {
    timestamp,
    state: null,
    config: null,
    healthHistory: null,
    phaseMetrics: [],
    workspaces: null,
    notes: [],
    seeds: [],
    discussions: [],
    forensics: [],
    debugSessions: [],
    quickTasks: [],
    spec: null,
    phases: null,
    requirements: null,
    roadmap: null,
    phaseTasks: null,
    learnings: [],
    reviews: [],
    archivedSpecs: [],
  };

  try {
    // T1.2: STATE.md parser — always returns an object (empty state on missing file).
    snap.state = parseStateMd(path.join(beeDir, 'STATE.md'));

    // T1.3: JSON readers
    snap.config = readConfig(beeDir);
    snap.healthHistory = readHealthHistory(beeDir);
    snap.phaseMetrics = readPhaseMetrics(beeDir);
    snap.workspaces = readWorkspaces(beeDir);

    // T1.4: Directory scanners — each returns [] on missing dir.
    snap.notes = scanNotes(beeDir);
    snap.seeds = scanSeeds(beeDir);
    snap.discussions = scanDiscussions(beeDir);
    snap.forensics = scanForensics(beeDir);
    snap.debugSessions = scanDebugSessions(beeDir);
    snap.quickTasks = scanQuickTasks(beeDir);
    snap.learnings = scanLearnings(beeDir);
    snap.reviews = scanReviews(beeDir);

    // Archived specs — scan .bee/archive/ for completed specs
    snap.archivedSpecs = scanArchivedSpecs(beeDir);

    // T1.5: Spec-scoped readers. Requires an absolute spec directory.
    const specDir = resolveActiveSpecDir(beeDir, snap.state);
    if (specDir) {
      snap.spec = readSpec(specDir);
      snap.phases = readPhases(specDir);
      snap.requirements = readRequirements(specDir);
      snap.roadmap = readRoadmap(specDir);
      snap.phaseTasks = readPhaseTasks(specDir);
    }
    // If no specDir, the defaults (null) stay in place.
  } catch (err) {
    // Never fail the whole snapshot — attach the error and return whatever
    // partial data we already collected.
    snap.error = err && err.message ? err.message : String(err);
  }

  return snap;
}

// ---------------------------------------------------------------------------
// createSnapshotHandler
// ---------------------------------------------------------------------------
//
// Returns an `(req, res)` handler suitable for hive-server.js's
// setSnapshotHandler hook. Writes headers + body directly — the hive server
// passes the raw req/res through without any middleware wrapping.
function createSnapshotHandler(beeDir) {
  return function snapshotHandler(req, res) {
    const snap = buildSnapshot(beeDir);
    const body = JSON.stringify(snap);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
  };
}

module.exports = {
  buildSnapshot,
  createSnapshotHandler,
  createConfigHandler,
};
