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
// Events handler constants (GET /api/events)
// ---------------------------------------------------------------------------
//
// Tail-the-log endpoint for the dashboard's Live Activity panel. Reads today's
// (and optionally yesterday's) .bee/events/YYYY-MM-DD.jsonl file, filters by
// `since`, clamps to [1, EVENTS_MAX_LIMIT], and returns the most recent slice.
//
// The default limit is generous enough for a typical polling window (2s at the
// frontend) but the hard ceiling is high enough that an explicit large fetch
// from a diagnostic tool still succeeds without pagination.

const EVENTS_DEFAULT_LIMIT = 500;
const EVENTS_MAX_LIMIT = 5000;

// Local sendJsonError helper — duplicated from hive-server.js rather than
// imported to avoid a circular require cycle between hive-server.js (requires
// this module inside the entry-point guard) and this module (which would need
// to require hive-server.js at the top). Eight lines of duplication is a
// better trade than a fragile cross-module load order.
function sendJsonError(res, status, message, extraHeaders) {
  const body = JSON.stringify({ error: message });
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...(extraHeaders || {}),
  });
  res.end(body);
}

// ---------------------------------------------------------------------------
// createEventsHandler — GET /api/events tail of the hook event log.
// ---------------------------------------------------------------------------
//
// Query parameters (both optional):
//   since  — ISO 8601 timestamp. Only return events with `ts > since`. If
//            omitted, defaults to today's UTC 00:00:00.000Z so a cold start
//            sees the day's history without the client having to pick a
//            sensible default.
//   limit  — max events to return. Default 500, clamped to [1, 5000]. When
//            the matching count exceeds the clamped limit, the MOST RECENT
//            `limit` events are returned and `has_more: true` is set.
//
// Response 200 shape:
//   { events: LiveEvent[], latest_ts: string, count: number, has_more: bool }
//
// Never-throw contract: missing files, ENOENT on the events dir, malformed
// jsonl lines — all yield partial/empty results, never a 500. Only 400s for
// user input validation (malformed `since` / `limit`) and 405 (method gate,
// handled by the router, not here). See `hive-server.js` async-error dual
// branch pattern for how synchronous exceptions bubble back through.
function createEventsHandler(beeDir) {
  const eventsDir = path.join(beeDir, 'events');

  return function realEventsHandler(req, res) {
    // Parse query string via the WHATWG URL constructor. The dummy base is
    // required because req.url is always relative (e.g. `/api/events?since=...`)
    // and `new URL` refuses relative inputs without a base.
    const url = new URL(req.url || '/api/events', 'http://localhost');
    const params = url.searchParams;

    // --- Validate `since` ---
    const todayUtc = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const defaultSince = todayUtc + 'T00:00:00.000Z';

    let since;
    const sinceParam = params.get('since');
    if (sinceParam !== null) {
      // Reject empty strings and non-parseable ISO timestamps.
      if (sinceParam === '' || Number.isNaN(Date.parse(sinceParam))) {
        return sendJsonError(res, 400, 'Malformed since parameter');
      }
      // Canonicalize to strict ISO 8601 via Date round-trip. Date.parse is
      // lenient and accepts non-ISO strings ("April 10 2026") that would
      // break the downstream lex-comparison against event timestamps
      // (API-003 audit finding). Round-tripping through toISOString()
      // forces the format to `YYYY-MM-DDTHH:mm:ss.sssZ` before storage.
      since = new Date(sinceParam).toISOString();
    } else {
      since = defaultSince;
    }

    // --- Validate `limit` ---
    let limit = EVENTS_DEFAULT_LIMIT;
    const limitParam = params.get('limit');
    if (limitParam !== null) {
      if (!/^\d+$/.test(limitParam)) {
        return sendJsonError(res, 400, 'Malformed limit parameter');
      }
      const parsed = parseInt(limitParam, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        return sendJsonError(res, 400, 'Malformed limit parameter');
      }
      // Clamp to [1, EVENTS_MAX_LIMIT]. No upper-bound rejection — huge
      // requests silently clamp, matching the "never throw" contract.
      limit = Math.min(parsed, EVENTS_MAX_LIMIT);
    }

    // --- Determine which file(s) to read ---
    //
    // Always read today's. If `since` is before today's UTC midnight (so the
    // caller wants events from yesterday too), also read yesterday's. This
    // covers the common midnight-UTC-boundary case where a polling client
    // holds a `since` value from late yesterday.
    const todayFile = path.join(eventsDir, todayUtc + '.jsonl');
    const filesToRead = [todayFile];

    const todayMidnightUtc = todayUtc + 'T00:00:00.000Z';
    if (since < todayMidnightUtc) {
      // E2E-003 audit finding notes a cold-start dashboard opened shortly
      // after midnight UTC misses late-yesterday events. The trivial
      // predicate fix (`<=`) reads yesterday's file but the downstream
      // `ev.ts >= since` filter still excludes events with ts < today's
      // midnight — so the fix is cosmetic. A real fix requires a grace-
      // window default `since` calculation which changes contract for
      // mid-day cold starts and is deferred to a follow-up polish quick.
      // Compute yesterday's UTC date by subtracting one day from today's
      // midnight. Date math on ms is reliable across DST and month boundaries.
      const yesterdayMs = Date.parse(todayMidnightUtc) - 24 * 60 * 60 * 1000;
      const yesterdayUtc = new Date(yesterdayMs).toISOString().slice(0, 10);
      const yesterdayFile = path.join(eventsDir, yesterdayUtc + '.jsonl');
      // Prepend yesterday so the combined list is naturally chronological
      // before the sort below (minor perf hint — sort is still the source
      // of truth for ordering).
      filesToRead.unshift(yesterdayFile);
    }

    // --- Read + parse + filter ---
    const collected = [];
    for (const filePath of filesToRead) {
      let content;
      try {
        content = fs.readFileSync(filePath, 'utf8');
      } catch (_err) {
        // ENOENT (or any read error) on an events file is not an error —
        // treat as empty. This preserves the "never throw, empty on missing"
        // contract the frontend relies on.
        continue;
      }
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.length === 0) continue;
        let ev;
        try {
          ev = JSON.parse(line);
        } catch (_parseErr) {
          // Malformed lines (partial writes, manual edits) are skipped
          // silently. Valid lines in the same file are still returned.
          continue;
        }
        if (!ev || typeof ev.ts !== 'string') {
          continue;
        }
        // `>=` (not strict `>`) so events that share a millisecond with
        // the baseline `since` are returned and the polling client sees
        // them. The client-side dedup (composite key of
        // ts|session|kind|tool|filePath in useLiveEvents) handles the
        // boundary duplicate that `>=` causes on steady-state polling.
        // Strict `>` silently dropped events written in the same ms as
        // the previous response's newest event (E2E-001 audit finding).
        if (ev.ts >= since) {
          collected.push(ev);
        }
      }
    }

    // --- Sort oldest-first by ts ---
    collected.sort((a, b) => a.ts.localeCompare(b.ts));

    // --- Truncate to the MOST RECENT `limit` events if over budget ---
    let events;
    let hasMore = false;
    if (collected.length > limit) {
      hasMore = true;
      events = collected.slice(collected.length - limit);
    } else {
      events = collected;
    }

    // --- Compute latest_ts (last element's ts, or `since` if empty) ---
    const latestTs = events.length > 0 ? events[events.length - 1].ts : since;

    // --- Response ---
    const body = JSON.stringify({
      events,
      latest_ts: latestTs,
      count: events.length,
      has_more: hasMore,
    });
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
    });
    res.end(body);
  };
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
    // `Cache-Control: no-store` brings the snapshot endpoint into line
    // with /api/file and /api/events, preventing bfcache or proxy reuse
    // of stale live-project state (API-001 audit finding).
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
    });
    res.end(body);
  };
}

module.exports = {
  buildSnapshot,
  createSnapshotHandler,
  createConfigHandler,
  createEventsHandler,
  EVENTS_DEFAULT_LIMIT,
  EVENTS_MAX_LIMIT,
};
