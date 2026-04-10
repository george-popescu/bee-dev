#!/usr/bin/env node
// Test: hive-server.js /api/file endpoint — STRUCTURAL tests only.
//
// These tests read the source file as text and assert expected patterns via
// regex. They MUST NOT spawn the server or touch the filesystem beyond reading
// the source under test. End-to-end verification is done by the conductor via
// curl against a live server after restart.
//
// Covers Quick 002 acceptance criteria:
//   - fileHandler stub + setFileHandler setter follow the existing pattern
//   - createFileHandler(beeDir) factory exists and returns a request handler
//   - GET /api/file routing in handleRequest
//   - 405 method gate for non-GET methods
//   - Path traversal guard (literal `..` rejection + path.resolve containment)
//   - Size limit constant (1 MB / 1048576 bytes)
//   - Extension allowlist includes .md, .markdown, .txt, .json, .yml, .yaml
//   - Content-Type: application/json and Cache-Control: no-store headers
//   - setFileHandler + createFileHandler exported from module.exports
//   - Wired in the entry-point guard via setFileHandler(createFileHandler(beeDir))

const fs = require('fs');
const path = require('path');

const SRC_PATH = path.join(__dirname, '..', 'hive-server.js');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${testName}`);
  } else {
    failed++;
    console.log(`  FAIL: ${testName}`);
  }
}

let content;
try {
  content = fs.readFileSync(SRC_PATH, 'utf8');
} catch (e) {
  console.log('FAIL: hive-server.js does not exist at expected path');
  console.log(`  Expected: ${SRC_PATH}`);
  console.log('\nResults: 0 passed, 1 failed out of 1 assertions');
  process.exit(1);
}

// ============================================================
// Test 1: File handler stub and setter follow the existing pattern
// ============================================================
console.log('Test 1: File handler stub + setter');
assert(
  /let\s+fileHandler\s*=\s*function\s+defaultFileHandler/.test(content),
  'defines `let fileHandler = function defaultFileHandler`'
);
assert(
  /function\s+setFileHandler\s*\(\s*fn\s*\)/.test(content),
  'defines `function setFileHandler(fn)` setter'
);
assert(
  /setFileHandler[\s\S]*?typeof\s+fn\s*!==\s*['"]function['"]/.test(content),
  'setFileHandler validates argument with `typeof fn !== "function"`'
);
assert(
  /setFileHandler[\s\S]*?TypeError/.test(content),
  'setFileHandler throws TypeError on invalid input'
);

// ============================================================
// Test 2: Constants for size limit and extension allowlist
// ============================================================
console.log('\nTest 2: Size limit + extension allowlist constants');
assert(
  /const\s+FILE_MAX_BYTES\s*=\s*1024\s*\*\s*1024/.test(content) ||
    /const\s+FILE_MAX_BYTES\s*=\s*1048576/.test(content),
  'FILE_MAX_BYTES constant is 1 MB (1024*1024 or 1048576)'
);
assert(
  /const\s+FILE_ALLOWED_EXTENSIONS\s*=\s*new\s+Set/.test(content),
  'FILE_ALLOWED_EXTENSIONS is a Set'
);
assert(
  /['"]\.md['"]/.test(content) &&
    /['"]\.markdown['"]/.test(content) &&
    /['"]\.txt['"]/.test(content) &&
    /['"]\.json['"]/.test(content) &&
    /['"]\.yml['"]/.test(content) &&
    /['"]\.yaml['"]/.test(content),
  'allowlist contains .md, .markdown, .txt, .json, .yml, .yaml'
);

// ============================================================
// Test 3: createFileHandler factory
// ============================================================
console.log('\nTest 3: createFileHandler factory');
assert(
  /function\s+createFileHandler\s*\(\s*beeDir\s*\)/.test(content),
  'defines `function createFileHandler(beeDir)`'
);
assert(
  /createFileHandler[\s\S]*?path\.resolve\s*\(\s*beeDir\s*\)/.test(content),
  'createFileHandler resolves beeDir via path.resolve()'
);

// ============================================================
// Test 4: Routing for /api/file in handleRequest
// ============================================================
console.log('\nTest 4: /api/file routing in handleRequest');
assert(
  /url\s*===\s*['"]\/api\/file['"]/.test(content) ||
    /\/api\/file['"]/.test(content),
  'routes exact match `/api/file`'
);
assert(
  /url\.startsWith\s*\(\s*['"]\/api\/file\?['"]\s*\)/.test(content),
  'routes querystring form `/api/file?...`'
);
assert(
  /fileHandler\s*\(\s*req\s*,\s*res\s*\)/.test(content),
  'delegates to fileHandler(req, res) inside the route'
);

// ============================================================
// Test 5: 405 Method Not Allowed gate for non-GET
// ============================================================
console.log('\nTest 5: 405 method gate');
// Look for a 405 response with Allow: GET inside the /api/file routing block.
// Use a slice around the /api/file routing to avoid catching the snapshot 405.
const fileRouteIndex = content.indexOf("url === '/api/file'");
assert(
  fileRouteIndex !== -1,
  'found /api/file route anchor for slice-based checks'
);
const fileRouteSlice = fileRouteIndex !== -1
  ? content.slice(fileRouteIndex, fileRouteIndex + 1200)
  : '';
assert(
  /req\.method\s*!==\s*['"]GET['"]/.test(fileRouteSlice),
  'checks `req.method !== "GET"` inside the /api/file route'
);
assert(
  /writeHead\s*\(\s*405/.test(fileRouteSlice) ||
    /sendJsonError\s*\(\s*res\s*,\s*405\b/.test(fileRouteSlice),
  'responds 405 for non-GET methods (via writeHead or sendJsonError)'
);
assert(
  /Allow['"]?\s*:\s*['"]GET['"]/.test(fileRouteSlice),
  'sets Allow: GET header on 405 response'
);

// ============================================================
// Test 6: Path traversal guard
// ============================================================
console.log('\nTest 6: Path traversal guard');
assert(
  /\.\.['"]?\s*\)|seg\s*===\s*['"]\.\.['"]/.test(content),
  'rejects literal `..` path segments'
);
assert(
  /resolved\s*!==\s*rootResolved[\s\S]{0,150}startsWith\s*\(\s*rootResolved\s*\+\s*path\.sep/.test(
    content
  ),
  'uses containment check `resolved === rootResolved || startsWith(rootResolved + path.sep)`'
);
assert(
  /403/.test(content),
  'uses 403 for path traversal rejection'
);

// ============================================================
// Test 7: Absolute-path rejection
// ============================================================
console.log('\nTest 7: Absolute path rejection');
assert(
  /requestedPath\.startsWith\s*\(\s*['"]\/['"]\s*\)/.test(content),
  'rejects absolute paths starting with /'
);

// ============================================================
// Test 8: Size limit check before read
// ============================================================
console.log('\nTest 8: Size limit check');
assert(
  /stat\.size\s*>\s*FILE_MAX_BYTES/.test(content),
  'checks `stat.size > FILE_MAX_BYTES` (stat before read)'
);
assert(
  /writeHead\s*\(\s*413/.test(content) ||
    /sendJsonError\s*\(\s*res\s*,\s*413\b/.test(content),
  'responds 413 for oversized files (via writeHead or sendJsonError)'
);

// ============================================================
// Test 9: Extension allowlist enforcement
// ============================================================
console.log('\nTest 9: Extension allowlist enforcement');
assert(
  /FILE_ALLOWED_EXTENSIONS\.has\s*\(\s*ext\s*\)/.test(content),
  'checks FILE_ALLOWED_EXTENSIONS.has(ext) for allowlist enforcement'
);
assert(
  /writeHead\s*\(\s*415/.test(content) ||
    /sendJsonError\s*\(\s*res\s*,\s*415\b/.test(content),
  'responds 415 for disallowed extensions (via writeHead or sendJsonError)'
);
assert(
  /path\.extname\s*\(\s*requestedPath\s*\)/.test(content),
  'extracts extension via path.extname(requestedPath)'
);

// ============================================================
// Test 10: 404 for missing / not-a-file
// ============================================================
console.log('\nTest 10: 404 for missing or non-regular files');
assert(
  /ENOENT/.test(content),
  'handles ENOENT (missing file)'
);
assert(
  /writeHead\s*\(\s*404/.test(content),
  'responds 404 for missing files'
);
assert(
  /stat\.isFile\s*\(\s*\)/.test(content),
  'checks stat.isFile() before reading'
);

// ============================================================
// Test 11: Success response shape
// ============================================================
console.log('\nTest 11: Success response shape');
const successSlice = content.indexOf('JSON.stringify({');
assert(
  /path:\s*requestedPath/.test(content),
  'success response includes path field'
);
assert(
  /content,/.test(content) && /readFile/.test(content),
  'success response includes content from fs.readFile'
);
assert(
  /mtime:\s*stat\.mtime\.toISOString\s*\(\s*\)/.test(content),
  'success response includes mtime as ISO string'
);
assert(
  /size:\s*stat\.size/.test(content),
  'success response includes size field'
);
assert(
  /fs\.readFile\s*\([^,]+,\s*['"]utf8['"]/.test(content),
  'reads file as UTF-8'
);

// ============================================================
// Test 12: Response headers — Content-Type + Cache-Control
// ============================================================
console.log('\nTest 12: Response headers');
assert(
  /['"]Content-Type['"]\s*:\s*['"]application\/json['"]/.test(content),
  'sets Content-Type: application/json'
);
assert(
  /['"]Cache-Control['"]\s*:\s*['"]no-store['"]/.test(content),
  'sets Cache-Control: no-store'
);

// ============================================================
// Test 13: Module exports include setFileHandler + createFileHandler
// ============================================================
console.log('\nTest 13: module.exports');
const exportsStart = content.indexOf('module.exports');
assert(
  exportsStart !== -1,
  'module.exports block exists'
);
const exportsSlice = exportsStart !== -1 ? content.slice(exportsStart) : '';
assert(
  /setFileHandler/.test(exportsSlice),
  'module.exports includes setFileHandler'
);
assert(
  /createFileHandler/.test(exportsSlice),
  'module.exports includes createFileHandler'
);

// ============================================================
// Test 14: Entry-point wiring
// ============================================================
console.log('\nTest 14: Entry-point wiring');
assert(
  /setFileHandler\s*\(\s*createFileHandler\s*\(\s*beeDir\s*\)\s*\)/.test(
    content
  ),
  'entry-point wires setFileHandler(createFileHandler(beeDir))'
);

// ============================================================
// Summary
// ============================================================
const total = passed + failed;
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${total} assertions`);
process.exit(failed > 0 ? 1 : 0);
