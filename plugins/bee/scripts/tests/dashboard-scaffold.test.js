#!/usr/bin/env node
// Test: dashboard-scaffold — STRUCTURAL tests only.
// Verifies that the Vite + React + TS + Tailwind + shadcn scaffold has been
// hand-written under plugins/bee/dashboard/ with the correct hive theme tokens,
// dependency set, and configuration. These tests read the files as text and
// assert expected patterns via regex / JSON parsing. They MUST NOT run vite,
// npm, or any build tooling.

const fs = require('fs');
const path = require('path');

const DASHBOARD_DIR = path.join(__dirname, '..', '..', 'dashboard');

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

function readFile(relPath) {
  const full = path.join(DASHBOARD_DIR, relPath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

function fileExists(relPath) {
  return fs.existsSync(path.join(DASHBOARD_DIR, relPath));
}

// ============================================================
// Test 1: Dashboard directory exists
// ============================================================
console.log('Test 1: Dashboard directory exists');
assert(
  fs.existsSync(DASHBOARD_DIR),
  'plugins/bee/dashboard/ directory exists'
);

// ============================================================
// Test 2: package.json has required shape and dependencies
// ============================================================
console.log('\nTest 2: package.json metadata and dependencies');
const pkgRaw = readFile('package.json');
assert(pkgRaw !== null, 'package.json exists');

let pkg = null;
if (pkgRaw) {
  try {
    pkg = JSON.parse(pkgRaw);
  } catch (e) {
    console.log(`  FAIL: package.json is valid JSON (${e.message})`);
    failed++;
  }
}

if (pkg) {
  assert(pkg.name === 'bee-hive-dashboard', 'name is "bee-hive-dashboard"');
  assert(pkg.private === true, 'private is true');
  assert(pkg.type === 'module', 'type is "module"');

  // Scripts
  assert(pkg.scripts && typeof pkg.scripts.dev === 'string', 'scripts.dev defined');
  assert(pkg.scripts && typeof pkg.scripts.build === 'string', 'scripts.build defined');
  assert(pkg.scripts && typeof pkg.scripts.preview === 'string', 'scripts.preview defined');
  assert(pkg.scripts && typeof pkg.scripts.typecheck === 'string', 'scripts.typecheck defined');

  // Dependencies
  const deps = pkg.dependencies || {};
  assert(/^\^?19/.test(deps.react || ''), 'dependencies.react is ^19');
  assert(/^\^?19/.test(deps['react-dom'] || ''), 'dependencies.react-dom is ^19');
  assert(/^\^?2\.15/.test(deps.recharts || ''), 'dependencies.recharts is ^2.15');
  assert(typeof deps['lucide-react'] === 'string', 'dependencies.lucide-react present');
  assert(typeof deps['class-variance-authority'] === 'string', 'dependencies.class-variance-authority present');
  assert(typeof deps.clsx === 'string', 'dependencies.clsx present');
  assert(typeof deps['tailwind-merge'] === 'string', 'dependencies.tailwind-merge present');
  assert(typeof deps['@radix-ui/react-slot'] === 'string', 'dependencies.@radix-ui/react-slot present');
  assert(typeof deps['@radix-ui/react-progress'] === 'string', 'dependencies.@radix-ui/react-progress present');
  assert(typeof deps['@radix-ui/react-scroll-area'] === 'string', 'dependencies.@radix-ui/react-scroll-area present');

  // Dev dependencies
  const devDeps = pkg.devDependencies || {};
  assert(/~?5\.6/.test(devDeps.typescript || ''), 'devDependencies.typescript is ~5.6');
  assert(/^\^?6/.test(devDeps.vite || ''), 'devDependencies.vite is ^6');
  assert(/^\^?4/.test(devDeps['@vitejs/plugin-react'] || ''), 'devDependencies.@vitejs/plugin-react is ^4');
  assert(typeof devDeps['@types/react'] === 'string', 'devDependencies.@types/react present');
  assert(typeof devDeps['@types/react-dom'] === 'string', 'devDependencies.@types/react-dom present');
  assert(typeof devDeps['@types/node'] === 'string', 'devDependencies.@types/node present');
  // Tailwind v3 (NOT v4)
  assert(/~?3\.4/.test(devDeps.tailwindcss || ''), 'devDependencies.tailwindcss is ~3.4 (v3, NOT v4)');
  assert(typeof devDeps.postcss === 'string', 'devDependencies.postcss present');
  assert(typeof devDeps.autoprefixer === 'string', 'devDependencies.autoprefixer present');
}

// ============================================================
// Test 3: vite.config.ts structure
// ============================================================
console.log('\nTest 3: vite.config.ts structure');
const viteConfig = readFile('vite.config.ts');
assert(viteConfig !== null, 'vite.config.ts exists');
if (viteConfig) {
  assert(/from\s+['"]vite['"]/.test(viteConfig), 'imports from "vite"');
  assert(/@vitejs\/plugin-react/.test(viteConfig), 'imports @vitejs/plugin-react');
  assert(/defineConfig/.test(viteConfig), 'uses defineConfig');
  assert(/base\s*:\s*['"]\.\/['"]/.test(viteConfig), "base: './' configured (relative asset paths)");
  assert(/resolve\s*:/.test(viteConfig), 'resolve section present');
  assert(/['"]@['"]\s*:\s*path\.resolve/.test(viteConfig), "'@' alias via path.resolve");
  assert(/server\s*:/.test(viteConfig), 'server section present');
  assert(/proxy\s*:/.test(viteConfig), 'server.proxy configured');
  assert(/127\.0\.0\.1:3333/.test(viteConfig), 'proxy targets http://127.0.0.1:3333 (hive-server)');
  assert(/plugins\s*:\s*\[\s*react\(\)/.test(viteConfig), 'plugins: [react()]');
}

// ============================================================
// Test 4: tsconfig files
// ============================================================
console.log('\nTest 4: tsconfig files');
const tsconfig = readFile('tsconfig.json');
assert(tsconfig !== null, 'tsconfig.json exists');
if (tsconfig) {
  assert(/"strict"\s*:\s*true/.test(tsconfig), 'strict: true');
  assert(/"jsx"\s*:\s*"react-jsx"/.test(tsconfig), 'jsx: "react-jsx"');
  assert(/"target"\s*:\s*"ES2020"/.test(tsconfig), 'target: "ES2020"');
  assert(/"moduleResolution"\s*:\s*"bundler"/.test(tsconfig), 'moduleResolution: "bundler"');
  assert(/"paths"/.test(tsconfig) && /"@\/\*"\s*:\s*\[\s*"\.\/src\/\*"\s*\]/.test(tsconfig), 'paths["@/*"] -> ["./src/*"]');
}

assert(fileExists('tsconfig.node.json'), 'tsconfig.node.json exists');

// ============================================================
// Test 5: tailwind.config.ts with hive theme tokens + 3xl breakpoint
// ============================================================
console.log('\nTest 5: tailwind.config.ts with hive theme');
const tailwind = readFile('tailwind.config.ts');
assert(tailwind !== null, 'tailwind.config.ts exists');
if (tailwind) {
  assert(/content\s*:\s*\[/.test(tailwind), 'content array present');
  assert(/\.\/index\.html/.test(tailwind), "content includes './index.html'");
  assert(/\.\/src\/\*\*\/\*\.\{ts,tsx\}/.test(tailwind), "content includes './src/**/*.{ts,tsx}'");
  // Hive tokens
  assert(/#1C1917/.test(tailwind), 'hive.bg #1C1917 present');
  assert(/#292524/.test(tailwind), 'hive.surface #292524 present');
  assert(/#44403c/.test(tailwind), 'hive.border #44403c present');
  assert(/#78716c/.test(tailwind), 'hive.muted #78716c present');
  assert(/#fafaf9/.test(tailwind), 'hive.text #fafaf9 present');
  assert(/#F59E0B/.test(tailwind), 'hive.gold #F59E0B present');
  assert(/#D97706/.test(tailwind), 'hive.amber #D97706 present');
  assert(/hive\s*:/.test(tailwind), 'hive color group defined');
  // Custom 3xl breakpoint
  assert(/['"]3xl['"]\s*:\s*['"]1440px['"]/.test(tailwind), "'3xl': '1440px' breakpoint present");
}

// ============================================================
// Test 6: postcss.config.js
// ============================================================
console.log('\nTest 6: postcss.config.js');
const postcss = readFile('postcss.config.js');
assert(postcss !== null, 'postcss.config.js exists');
if (postcss) {
  assert(/tailwindcss/.test(postcss), 'references tailwindcss plugin');
  assert(/autoprefixer/.test(postcss), 'references autoprefixer plugin');
}

// ============================================================
// Test 7: index.html with dark color-scheme + Bee Hive title
// ============================================================
console.log('\nTest 7: index.html');
const indexHtml = readFile('index.html');
assert(indexHtml !== null, 'index.html exists');
if (indexHtml) {
  assert(
    /<meta[^>]*name=["']color-scheme["'][^>]*content=["']dark["']/i.test(indexHtml),
    'dark color-scheme meta'
  );
  assert(/<title>[^<]*Bee Hive[^<]*<\/title>/.test(indexHtml), '<title> contains "Bee Hive"');
  assert(/<div id="root"><\/div>/.test(indexHtml), '<div id="root"></div> present');
  assert(/<script[^>]+src="\.\/src\/main\.tsx"/.test(indexHtml), 'script module src="./src/main.tsx"');
  assert(/type="module"/.test(indexHtml), 'script type="module"');
}

// ============================================================
// Test 8: src/main.tsx
// ============================================================
console.log('\nTest 8: src/main.tsx');
const mainTsx = readFile('src/main.tsx');
assert(mainTsx !== null, 'src/main.tsx exists');
if (mainTsx) {
  assert(/from\s+['"]react['"]/.test(mainTsx), 'imports from react');
  assert(/from\s+['"]react-dom\/client['"]/.test(mainTsx), 'imports from react-dom/client');
  assert(/createRoot/.test(mainTsx), 'uses createRoot');
  assert(/<App\s*\/>/.test(mainTsx), 'renders <App />');
  assert(/\.\/index\.css/.test(mainTsx), 'imports ./index.css');
}

// ============================================================
// Test 9: src/App.tsx shell
// ============================================================
console.log('\nTest 9: src/App.tsx');
const appTsx = readFile('src/App.tsx');
assert(appTsx !== null, 'src/App.tsx exists');
if (appTsx) {
  assert(/Bee Hive/.test(appTsx), 'contains "Bee Hive" heading text');
  // bg-hive-bg and text-hive-text now live in MissionControlLayout (T3.6), not App.tsx (T3.14 rewrote it)
  // Verify App.tsx imports MissionControlLayout which carries the hive theme
  assert(/MissionControlLayout/.test(appTsx), 'imports MissionControlLayout (carries hive theme)');
  assert(/export\s+default\s+function\s+App/.test(appTsx) || /export\s+default\s+App/.test(appTsx), 'exports default App');
}

// ============================================================
// Test 10: src/index.css with Tailwind directives + hive CSS vars
// ============================================================
console.log('\nTest 10: src/index.css');
const indexCss = readFile('src/index.css');
assert(indexCss !== null, 'src/index.css exists');
if (indexCss) {
  assert(/@tailwind\s+base/.test(indexCss), '@tailwind base directive');
  assert(/@tailwind\s+components/.test(indexCss), '@tailwind components directive');
  assert(/@tailwind\s+utilities/.test(indexCss), '@tailwind utilities directive');
  assert(/:root\s*{/.test(indexCss), ':root block present');
  assert(/--hive-/.test(indexCss), 'hive CSS variables defined (--hive-*)');
  assert(/#1C1917/.test(indexCss), 'hive bg hex in CSS vars');
  assert(/#F59E0B/.test(indexCss), 'hive gold hex in CSS vars');
}

// ============================================================
// Test 11: components.json (shadcn config)
// ============================================================
console.log('\nTest 11: components.json');
const componentsJsonRaw = readFile('components.json');
assert(componentsJsonRaw !== null, 'components.json exists');
let componentsJson = null;
if (componentsJsonRaw) {
  try {
    componentsJson = JSON.parse(componentsJsonRaw);
  } catch (e) {
    console.log(`  FAIL: components.json is valid JSON (${e.message})`);
    failed++;
  }
}
if (componentsJson) {
  assert(componentsJson.style === 'new-york', 'style: "new-york"');
  assert(
    componentsJson.tailwind && typeof componentsJson.tailwind.config === 'string',
    'tailwind.config path defined'
  );
  assert(
    componentsJson.tailwind && componentsJson.tailwind.baseColor === 'stone',
    'tailwind.baseColor: "stone" (warm)'
  );
  assert(
    componentsJson.aliases && componentsJson.aliases.components === '@/components',
    'aliases.components: "@/components"'
  );
  assert(
    componentsJson.aliases && componentsJson.aliases.utils === '@/lib/utils',
    'aliases.utils: "@/lib/utils"'
  );
}

// ============================================================
// Summary
// ============================================================
const total = passed + failed;
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${total} assertions`);
process.exit(failed > 0 ? 1 : 0);
