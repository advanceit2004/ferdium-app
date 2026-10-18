#!/usr/bin/env node
/**
 * Brand auditor.
 *
 * Verifies that a white-label build carries no upstream branding on
 * user-visible surfaces. Unlike the previous 5-file check this scans the whole
 * repo (source, locales, internal server, packaging metadata) and classifies
 * every hit as:
 *
 *   FAIL   a real, unsanitized leak on a user-visible surface
 *   INFO   covered by the runtime brand sanitizer (locale values, `defaultMessage`)
 *   APPLIED upstream strings that `pnpm brand:apply` rewrites (packaging metadata,
 *          the bundled AdonisJS server) - expected on a pristine checkout
 *   SKIP   an intentional internal identifier (see docs/brand-allowlist.json)
 *
 * Usage:
 *   pnpm brand:check            # fail on real leaks
 *   pnpm brand:check:strict     # same, but also fail on INFO-count regressions
 *   node scripts/check-brand.mjs --report   # grouped counts, never fails
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const strict = args.has('--strict') || args.has('--ci');
const reportOnly = args.has('--report');
const asJson = args.has('--json');

const DEFAULT_LEGACY = {
  names: ['Ferdium'],
  domains: ['www.ferdium.org', 'ferdium.org'],
  githubOwners: ['ferdium'],
  tokens: {},
};

const SCAN_DIRS = ['src'];
// `src/index.html` is already reached through `SCAN_DIRS`.
const ROOT_FILES = ['package.json', 'electron-builder.yml'].map(rel =>
  rel.split('/').join(path.sep),
);
const SCAN_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.edge',
  '.html',
  '.json',
  '.yml',
  '.yaml',
]);
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-electron',
  'build',
  '.cache',
  'coverage',
]);
// Locale files are handled separately (values only, and covered at runtime).
const LOCALE_DIR = path.join('src', 'i18n', 'locales');
// Flat fallback map in the locales folder; rewritten by `pnpm brand:apply`.
const DEFAULT_MESSAGES = path.join(LOCALE_DIR, 'defaultMessages.json');
// Stale `babel-plugin-react-intl` extraction output; not loaded at runtime.
const MESSAGES_DIR = path.join('src', 'i18n', 'messages');

// Upstream literals that `pnpm brand:apply` rewrites for client builds. They are
// reported for visibility but never fail the check, because a pristine checkout
// is expected to still carry them.
const APPLY_BRAND_MANAGED_FILES = [
  'package.json',
  'electron-builder.yml',
  'src/index.html',
  'src/dev-app-update.yml',
  'src/brand.generated.ts',
  'src/i18n/locales/defaultMessages.json',
].map(rel => rel.split('/').join(path.sep));
const APPLY_BRAND_MANAGED_DIRS = [path.join('src', 'internal-server')];
const isApplyBrandManaged = rel =>
  APPLY_BRAND_MANAGED_FILES.includes(rel) ||
  APPLY_BRAND_MANAGED_DIRS.some(dir => rel.startsWith(`${dir}${path.sep}`));

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function loadBrand() {
  const text = read('src/brand.generated.ts');
  const start = text.indexOf('{');
  const endMarker = '} as const';
  const end = text.lastIndexOf(endMarker);
  const literal = text.slice(
    start,
    (end === -1 ? text.lastIndexOf('}') : end) + 1,
  );
  // eslint-disable-next-line no-new-func
  const brand = new Function(`return (${literal});`)();
  const legacy = { ...DEFAULT_LEGACY, ...(brand.legacy ?? {}) };
  return {
    ...brand,
    legacy,
    isDefaultFerdium:
      brand.appName === 'Ferdium' || brand.appSlug === 'ferdium',
  };
}

function loadAllowlist() {
  const file = path.join(root, 'docs', 'brand-allowlist.json');
  if (!fs.existsSync(file)) return { files: [], wholeLine: [], token: [] };
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const global = p => new RegExp(p, 'g');
  return {
    files: (data.files ?? []).map(f => f.split('/').join(path.sep)),
    wholeLine: (data.wholeLinePatterns ?? []).map(p => new RegExp(p)),
    token: (data.linePatterns ?? []).map(global),
  };
}

const brand = loadBrand();
const allowlist = loadAllowlist();

// Matchers that indicate the upstream brand is present.
const matchers = [];
for (const name of brand.legacy.names)
  matchers.push(new RegExp(escapeRegExp(name), 'i'));
for (const domain of brand.legacy.domains)
  matchers.push(new RegExp(escapeRegExp(domain), 'i'));
for (const owner of brand.legacy.githubOwners) {
  matchers.push(new RegExp(`github\\.com/${escapeRegExp(owner)}`, 'i'));
}
for (const token of Object.keys(brand.legacy.tokens))
  matchers.push(new RegExp(escapeRegExp(token), 'i'));

const matchesBrand = value => matchers.some(m => m.test(value));

// The brand's own identifiers are not upstream branding even when they contain a
// legacy token - a fork is commonly named `ferdium-app`. A brand that points at
// the upstream repo or owner verbatim is still flagged.
const legacyValues = new Set(
  [
    ...brand.legacy.names,
    ...brand.legacy.githubOwners,
    ...brand.legacy.domains,
    ...Object.keys(brand.legacy.tokens),
  ].map(value => value.toLowerCase()),
);
const brandOwnPatterns = [brand.appName, brand.appSlug, brand.github?.repo]
  .filter(value => typeof value === 'string' && value.length > 3)
  .filter(value => !legacyValues.has(value.toLowerCase()))
  .map(value => new RegExp(escapeRegExp(value), 'gi'));

// Comments, dev logging and other non-rendered lines are skipped wholesale.
const isWholeLineSkipped = line => allowlist.wholeLine.some(p => p.test(line));

// Everything else is allowlisted token-by-token: neutralize the brand-owned and
// known-internal substrings and re-test, so a genuine leak elsewhere on the same
// line still fails.
const stripAllowlistedTokens = line => {
  let residual = line;
  for (const pattern of brandOwnPatterns)
    residual = residual.replace(pattern, ' ');
  for (const pattern of allowlist.token)
    residual = residual.replace(pattern, ' ');
  return residual;
};

const failures = [];
const covered = [];
const managed = [];
let skipped = 0;
let scannedFiles = 0;

const addFailure = (file, line, text, residual) =>
  failures.push({ file, line, text, residual: residual?.trim() });
const addCovered = (file, line, text, kind) =>
  covered.push({ file, line, text, kind });
const addManaged = (file, line, text) => managed.push({ file, line, text });

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), {
    withFileTypes: true,
  })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (rel === LOCALE_DIR || rel === MESSAGES_DIR) continue;
      walk(rel, out);
    } else if (
      SCAN_EXTENSIONS.has(path.extname(entry.name)) &&
      rel !== DEFAULT_MESSAGES
    ) {
      out.push(rel);
    }
  }
  return out;
}

const allowlistedFiles = new Set(allowlist.files);

/**
 * Helpers whose return value is passed through the runtime brand sanitizer.
 * Keep in sync with `sanitizeBrandText` in `src/i18n/brand-i18n.ts`.
 */
const COVERED_CALLS = ['getTranslatedTextSync', 'getTranslatedText'];

/**
 * Blank out string literals that are guaranteed to be sanitized before being
 * rendered, while preserving line numbers. Two cases qualify:
 *   - `defaultMessage: <literal>` (react-intl descriptor)
 *   - arguments of the i18n helpers (`getTranslatedText`, `getTranslatedTextSync`)
 */
function stripCoveredLiterals(source) {
  const chars = [...source];
  let covered = 0;

  const blank = (from, to) => {
    if (matchesBrand(source.slice(from, to))) covered += 1;
    for (let k = from; k < to; k += 1) {
      if (chars[k] !== '\n') chars[k] = ' ';
    }
  };

  // Blank the string literal starting at/near `from`; returns the index just
  // past its closing quote (or `from` when there is no literal there).
  const blankLiteralAt = from => {
    let i = from;
    while (i < source.length && /\s/.test(source[i])) i += 1;
    const quote = source[i];
    if (quote !== "'" && quote !== '"' && quote !== '`') return from;
    let j = i + 1;
    while (j < source.length) {
      if (source[j] === '\\') {
        j += 2;
        continue;
      }
      if (source[j] === quote) break;
      j += 1;
    }
    blank(i + 1, j);
    return j + 1;
  };

  for (const match of source.matchAll(/\bdefaultMessage\s*:\s*/g)) {
    blankLiteralAt((match.index ?? 0) + match[0].length);
  }

  for (const name of COVERED_CALLS) {
    let from = 0;
    for (;;) {
      const at = source.indexOf(name, from);
      if (at === -1) break;
      from = at + name.length;
      // Must be a standalone identifier (not e.g. `my${name}`) followed by '('.
      const before = at === 0 ? '' : source[at - 1];
      if (before && /[\w$]/.test(before)) continue;
      let open = from;
      while (open < source.length && /\s/.test(source[open])) open += 1;
      if (source[open] !== '(') continue;
      from = open + 1;
      let depth = 1;
      let k = open + 1;
      while (k < source.length && depth > 0) {
        const ch = source[k];
        if (ch === '(') depth += 1;
        else if (ch === ')') depth -= 1;
        else if (ch === "'" || ch === '"' || ch === '`') {
          k = blankLiteralAt(k);
          continue;
        }
        k += 1;
      }
    }
  }
  return { stripped: chars.join(''), covered };
}

function scanSourceFile(rel) {
  if (allowlistedFiles.has(rel)) {
    skipped += 1;
    return;
  }
  scannedFiles += 1;
  const source = read(rel);
  const originalLines = source.split(/\r?\n/);

  if (isApplyBrandManaged(rel)) {
    originalLines.forEach((line, index) => {
      if (!matchesBrand(line) || isWholeLineSkipped(line)) return;
      if (!matchesBrand(stripAllowlistedTokens(line))) return;
      addManaged(rel, index + 1, line.trim());
    });
    return;
  }

  const { stripped, covered: coveredCount } = stripCoveredLiterals(source);
  if (coveredCount)
    addCovered(rel, 0, '', `intl defaultMessage x${coveredCount}`);
  stripped.split(/\r?\n/).forEach((line, index) => {
    if (!matchesBrand(line)) return;
    if (isWholeLineSkipped(line)) {
      skipped += 1;
      return;
    }
    const residual = stripAllowlistedTokens(line);
    if (!matchesBrand(residual)) {
      skipped += 1;
      return;
    }
    addFailure(rel, index + 1, originalLines[index].trim(), residual);
  });
}

// --- scan source tree ------------------------------------------------------
for (const dir of SCAN_DIRS) {
  if (!fs.existsSync(path.join(root, dir))) continue;
  for (const rel of walk(dir)) scanSourceFile(rel);
}
for (const rel of ROOT_FILES) {
  if (fs.existsSync(path.join(root, rel))) scanSourceFile(rel);
}

// --- locales: values only, covered by the runtime sanitizer ----------------
function scanLocaleValues() {
  const dir = path.join(root, LOCALE_DIR);
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.json')) continue;
    if (path.join(LOCALE_DIR, entry) === DEFAULT_MESSAGES) continue;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(dir, entry), 'utf8'));
    } catch {
      continue;
    }
    const visit = (node, keyPath) => {
      for (const [key, value] of Object.entries(node)) {
        if (typeof value === 'string') {
          if (matchesBrand(value))
            addCovered(
              path.join(LOCALE_DIR, entry),
              keyPath.concat(key).join('.'),
              '',
              'locale value',
            );
        } else if (value && typeof value === 'object') {
          visit(value, keyPath.concat(key));
        }
      }
    };
    visit(data, []);
  }
}
scanLocaleValues();

// `defaultMessages.json` is a fallback map that `pnpm brand:apply` rewrites, so
// surface it as APPLIED instead of inflating the runtime-covered count.
if (fs.existsSync(path.join(root, DEFAULT_MESSAGES))) {
  const hits = read(DEFAULT_MESSAGES)
    .split(/\r?\n/)
    .filter(line => matchesBrand(line)).length;
  if (hits)
    addManaged(DEFAULT_MESSAGES, 0, `branded fallback messages x${hits}`);
}

// --- hard metadata assertions ---------------------------------------------
if (!brand.isDefaultFerdium) {
  const assertIncludes = (file, needle, label) => {
    if (!fs.existsSync(path.join(root, file))) return;
    if (!read(file).includes(needle))
      addFailure(file, 0, `missing ${label}: ${needle}`);
  };
  const assertNotIncludes = (file, needle, label) => {
    if (!fs.existsSync(path.join(root, file))) return;
    if (read(file).includes(needle))
      addFailure(file, 0, `still contains ${label}: ${needle}`);
  };

  assertIncludes(
    'package.json',
    `"productName": "${brand.appName}"`,
    'productName',
  );
  assertIncludes('package.json', `"name": "${brand.appSlug}"`, 'package name');
  assertIncludes(
    'electron-builder.yml',
    `appId: "${brand.appId}"`,
    'electron appId',
  );
  assertIncludes(
    'electron-builder.yml',
    `schemes: [${brand.protocol}]`,
    'protocol scheme',
  );
  assertIncludes(
    'src/index.html',
    `<title>${brand.appName}</title>`,
    'HTML title',
  );

  assertNotIncludes(
    'package.json',
    '"productName": "Ferdium"',
    'upstream productName',
  );
  assertNotIncludes(
    'electron-builder.yml',
    'appId: "org.ferdium.ferdium-app"',
    'upstream appId',
  );
  assertNotIncludes(
    'src/index.html',
    '<title>Ferdium</title>',
    'upstream HTML title',
  );
}

// --- runtime sanitizer must be wired --------------------------------------
function assertSanitizerWired() {
  const sanitizer = path.join(root, 'src', 'i18n', 'brand-i18n.ts');
  if (!fs.existsSync(sanitizer)) {
    addFailure(
      'src/i18n/brand-i18n.ts',
      0,
      'runtime brand sanitizer is missing',
    );
    return;
  }
  const expected = [
    ['src/i18n/translations.ts', 'sanitizeTranslationDictionary'],
    ['src/i18n/brand-intl.tsx', 'sanitizeBrandText'],
    ['src/helpers/i18n-helpers.ts', 'sanitizeBrandText'],
  ];
  for (const [file, symbol] of expected) {
    if (!fs.existsSync(path.join(root, file)) || !read(file).includes(symbol)) {
      addFailure(file, 0, `sanitizer not wired in (expected ${symbol})`);
    }
  }
}
assertSanitizerWired();

// --- report ----------------------------------------------------------------
const groupBy = list =>
  list.reduce((acc, item) => {
    acc[item.file] = (acc[item.file] ?? 0) + 1;
    return acc;
  }, {});

if (asJson) {
  console.log(
    JSON.stringify(
      {
        brand: brand.appName,
        failures,
        covered,
        managed,
        skipped,
        scannedFiles,
      },
      null,
      2,
    ),
  );
} else if (reportOnly) {
  console.log(`Brand audit for ${brand.appName} (${brand.appSlug})`);
  console.log(
    `  files scanned: ${scannedFiles} (skipped ${skipped} allowlisted lines/files)`,
  );
  console.log(`  user-visible leaks: ${failures.length}`);
  console.log(`  covered at runtime: ${covered.length}`);
  console.log(`  rewritten by brand:apply: ${managed.length}`);
  const coveredGroups = groupBy(covered);
  for (const [file, count] of Object.entries(coveredGroups)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)) {
    console.log(`    COVERED ${count}  ${file}`);
  }
  const failureGroups = groupBy(failures);
  for (const [file, count] of Object.entries(failureGroups).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`    LEAK    ${count}  ${file}`);
  }
  const managedGroups = groupBy(managed);
  for (const [file, count] of Object.entries(managedGroups).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`    APPLIED ${count}  ${file}`);
  }
} else {
  for (const { file, line, text, residual } of failures) {
    console.error(`FAIL ${file}${line ? `:${line}` : ''}: ${text}`);
    if (process.env.BRAND_CHECK_DEBUG && residual)
      console.error(`     residual: ${residual}`);
  }
  for (const item of covered.slice(0, 200)) {
    console.log(
      `INFO ${item.file}${item.line ? `:${item.line}` : ''} (${item.kind})`,
    );
  }
  if (covered.length > 200)
    console.log(`INFO ...and ${covered.length - 200} more covered strings`);
}

if (reportOnly || asJson) process.exit(0);

// The pristine upstream brand is expected to contain upstream strings everywhere;
// auditing only becomes meaningful once a client brand has been applied.
if (brand.isDefaultFerdium) {
  console.log(
    `Brand check skipped for the upstream default brand (${brand.appName}). ` +
      `Run \`pnpm brand:apply <brand-dir>\` first; ${failures.length} baseline hits, ` +
      `${covered.length} covered strings, ${managed.length} rewritten by brand:apply.`,
  );
  process.exit(0);
}

if (failures.length) {
  console.error(
    `\nBrand check failed (${failures.length} user-visible leaks, ${covered.length} covered).`,
  );
  process.exit(1);
}

console.log(
  `Brand check passed for ${brand.appName} (${brand.appSlug}): 0 user-visible leaks, ` +
    `${covered.length} strings neutralized at runtime.`,
);
if (strict && covered.length) {
  console.log(
    `Note: ${covered.length} strings rely on the runtime sanitizer (see \`--report\`).`,
  );
}
