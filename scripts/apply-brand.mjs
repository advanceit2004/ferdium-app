#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const brandDirArg = process.argv[2];
if (!brandDirArg) {
  console.error('Usage: pnpm brand:apply <path-to-brand-folder>');
  console.error('Example: pnpm brand:apply ../whitelabel-branding/brands/example');
  process.exit(1);
}

const brandDir = path.resolve(root, brandDirArg);
const brandPath = path.join(brandDir, 'brand.json');
if (!fs.existsSync(brandPath)) {
  console.error(`Missing brand.json at ${brandPath}`);
  process.exit(1);
}

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Quote a value as a single-quoted JavaScript string literal. */
const jsString = value => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const rawBrand = JSON.parse(fs.readFileSync(brandPath, 'utf8'));
const required = ['appName', 'appSlug', 'appId', 'protocol', 'website', 'supportEmail', 'accentColor', 'github'];
for (const key of required) {
  if (rawBrand[key] == null) {
    console.error(`brand.json missing required key: ${key}`);
    process.exit(1);
  }
}

const brand = {
  description: 'A white-label desktop workspace for messaging and collaboration services.',
  privacyUrl: '',
  termsUrl: '',
  translationUrl: '',
  copyright: '',
  author: '',
  ...rawBrand,
  api: {
    defaultServerUrl: 'local',
    debugUrl: '',
    translatorUrl: '',
    ...(rawBrand.api ?? {}),
  },
  github: {
    owner: '',
    repo: '',
    ...(rawBrand.github ?? {}),
  },
  recipes: {
    url: '',
    branch: 'main',
    ...(rawBrand.recipes ?? {}),
  },
  publisherName: rawBrand.publisherName ?? rawBrand.appName,
  features: {
    accounts: false,
    todos: true,
    workspaces: true,
    autoUpdates: true,
    sentry: false,
    ...(rawBrand.features ?? {}),
  },
  // Upstream tokens that the runtime sanitizer (`src/i18n/brand-i18n.ts`) and
  // the build-time locale rewrite below must neutralize.
  legacy: {
    names: ['Ferdium'],
    domains: ['www.ferdium.org', 'ferdium.org'],
    githubOwners: ['ferdium'],
    tokens: {},
    ...(rawBrand.legacy ?? {}),
  },
};

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function replaceInFile(file, replacements) {
  if (!fs.existsSync(file)) return;
  let text = fs.readFileSync(file, 'utf8');
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }
  fs.writeFileSync(file, text);
}

function copyIfExists(fromRel, toRel) {
  const from = path.join(brandDir, fromRel);
  const to = path.join(root, toRel);
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true, force: true });
  return true;
}

// Build the ordered find/replace list used for build-time string rewriting.
// Keep in sync with `buildBrandReplacers()` in `src/i18n/brand-i18n.ts`.
function buildBrandReplacements() {
  const host = String(brand.website ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  const list = [];

  for (const [from, to] of Object.entries(brand.legacy.tokens)) {
    if (from) list.push([new RegExp(escapeRegExp(from), 'g'), to]);
  }
  if (brand.supportEmail) {
    for (const domain of brand.legacy.domains) {
      list.push([new RegExp(`[\\w.+-]+@${escapeRegExp(domain)}`, 'gi'), brand.supportEmail]);
    }
  }
  for (const domain of [...brand.legacy.domains].sort((a, b) => b.length - a.length)) {
    list.push([new RegExp(escapeRegExp(domain), 'gi'), host]);
  }
  if (brand.github?.owner) {
    for (const owner of brand.legacy.githubOwners) {
      list.push([
        new RegExp(`github\\.com/${escapeRegExp(owner)}`, 'gi'),
        `github.com/${brand.github.owner}`,
      ]);
    }
  }
  for (const name of brand.legacy.names) {
    if (name) list.push([new RegExp(escapeRegExp(name), 'gi'), brand.appName]);
  }

  return list.filter(([, to]) => to !== '');
}

const brandReplacements = buildBrandReplacements();

function rewriteJsonValues(file, replacements) {
  if (!fs.existsSync(file)) return false;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return false;
  }
  let changed = false;
  const apply = node => {
    for (const key of Object.keys(node)) {
      const value = node[key];
      if (typeof value === 'string') {
        let next = value;
        for (const [pattern, replacement] of replacements) next = next.replace(pattern, replacement);
        if (next !== value) {
          node[key] = next;
          changed = true;
        }
      } else if (value && typeof value === 'object') {
        apply(value);
      }
    }
  };
  apply(data);
  if (changed) writeJson(file, data);
  return changed;
}

// Rewrite brand tokens in locale *values* (never keys) at build time. This keeps
// the committed locale files untouched (so upstream merges stay clean) while
// producing fully branded bundles; the runtime sanitizer is the second safety net.
function rewriteLocales() {
  const i18nDir = path.join(root, 'src', 'i18n');
  const files = [];
  const localesDir = path.join(i18nDir, 'locales');
  if (fs.existsSync(localesDir)) {
    for (const entry of fs.readdirSync(localesDir)) {
      if (entry.endsWith('.json')) files.push(path.join(localesDir, entry));
    }
  }
  const defaultMessages = path.join(i18nDir, 'defaultMessages.json');
  if (fs.existsSync(defaultMessages)) files.push(defaultMessages);

  let touched = 0;
  for (const file of files) {
    if (rewriteJsonValues(file, brandReplacements)) touched += 1;
  }
  return touched;
}

// 1) package.json
const packagePath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const metadataPath = path.join(root, 'build-helpers', 'brand-build.json');

// Recover the pristine upstream version so repeated `brand:apply` runs stay
// idempotent even when the brand uses a custom version suffix.
function resolveUpstreamVersion() {
  if (fs.existsSync(metadataPath)) {
    try {
      const previous = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      if (previous.upstreamVersion) return previous.upstreamVersion;
    } catch {
      // fall through to the suffix heuristic below
    }
  }
  return pkg.version.replace(new RegExp(`-${escapeRegExp(brand.appSlug)}(\\.[0-9]+)?$`), '');
}

const upstreamVersion = resolveUpstreamVersion();
// Default product version: `<upstream>-<appSlug>.1`, e.g. `7.2.3-office-web-access.1`.
if (brand.version) {
  pkg.version = brand.version;
} else {
  pkg.version = `${upstreamVersion}-${brand.versionSuffix ?? `${brand.appSlug}.1`}`;
}
pkg.name = brand.appSlug;
pkg.productName = brand.appName;
pkg.desktopName = `${brand.appSlug}.desktop`;
pkg.appId = brand.appId;
pkg.description = brand.description ?? pkg.description;
pkg.author = brand.author ?? `${brand.appName} Contributors <${brand.supportEmail}> (${brand.website})`;
pkg.homepage = brand.website;
if (brand.github?.owner && brand.github?.repo) {
  pkg.repository = `https://github.com/${brand.github.owner}/${brand.github.repo}.git`;
}
pkg.copyright = brand.copyright ?? brand.appId.split('.').slice(0, 2).join('.');
if (pkg.scripts?.debug) {
  pkg.scripts.debug = pkg.scripts.debug.replace(/DEBUG=Ferdium:\*/g, `DEBUG=${brand.appName}:*`);
}
writeJson(packagePath, pkg);

// 2) generated brand module used by future source refactors
const generatedTs = `// Auto-generated by scripts/apply-brand.mjs. Do not edit manually.\n\nexport const BRAND = ${JSON.stringify(brand, null, 2)} as const;\n\nexport type BrandConfig = typeof BRAND;\n`;
fs.writeFileSync(path.join(root, 'src', 'brand.generated.ts'), generatedTs);

// 2b) Build-time locale/brand string rewrite (locale values + defaultMessages).
const rewrittenLocales = rewriteLocales();

// Also write a machine-readable build metadata file for CI artifacts.
fs.mkdirSync(path.join(root, 'build-helpers'), { recursive: true });
writeJson(metadataPath, {
  appName: brand.appName,
  appSlug: brand.appSlug,
  appId: brand.appId,
  protocol: brand.protocol,
  version: pkg.version,
  upstreamVersion,
  legacy: brand.legacy,
  github: brand.github,
  generatedAt: new Date().toISOString(),
});

// 3) electron-builder.yml simple stable replacements
const eb = path.join(root, 'electron-builder.yml');
replaceInFile(eb, [
  [/appId: .*/g, `appId: "${brand.appId}"`],
  [/protocols:\n  name: .*\n  schemes: \[[^\]]+\]/g, `protocols:\n  name: ${brand.appName}\n  schemes: [${brand.protocol}]`],
  [/executableName: .*/g, `executableName: ${brand.appSlug}`],
  [/synopsis: .*/g, `synopsis: "${brand.description ?? `${brand.appName} desktop app`}"`],
  [
    /description: 'Ferdium[^']*'/g,
    `description: '${brand.appName} is your cross-platform messaging app which brings your chat & messaging services together into one application. For enabling webcam access you need to connect "camera" plug to snap, and for microphone with PulseAudio the "audio-record" plug. This can be done in Snap GUI or via command: \`snap connect ${brand.appSlug}:camera; snap connect ${brand.appSlug}:audio-record\`.'`,
  ],
  [/description: '[^']*Ferdium[^']*'/g, `description: '${brand.description ?? `${brand.appName} desktop app`}'`],
  [/publisherName: \[.*\]/g, `publisherName: ["${brand.publisherName}"]`],
  [/unpackDirName: "Ferdium-Unpacked"/g, `unpackDirName: "${brand.appName}-Unpacked"`],
]);

// 3b) Optional recipes fork/submodule override.
if (brand.recipes?.url) {
  replaceInFile(path.join(root, '.gitmodules'), [
    [/url = .*/g, `url = ${brand.recipes.url}`],
    [/branch = .*/g, `branch = ${brand.recipes.branch ?? 'main'}`],
  ]);
}

// 4) HTML title
replaceInFile(path.join(root, 'src', 'index.html'), [
  [/<title>.*<\/title>/, `<title>${brand.appName}</title>`],
]);

// 5) dev updater config
if (brand.github?.owner && brand.github?.repo) {
  fs.writeFileSync(
    path.join(root, 'src', 'dev-app-update.yml'),
    `owner: ${brand.github.owner}\nrepo: ${brand.github.repo}\nprovider: github\n`,
  );
}

// 5b) Bundled internal server (AdonisJS). These are plain CommonJS/ini files
// that run in their own process and cannot import `src/brand.generated.ts`, so
// their brand literals are rewritten here. Keep in sync with the runtime
// `process.env.APP_NAME` override in `src/internal-server/start.ts`.
const internalServerName = `${brand.appName} Internal Server`;
replaceInFile(path.join(root, 'src', 'internal-server', 'config', 'app.js'), [
  [
    /name: Env\.get\('APP_NAME', '[^']*'\)/,
    `name: Env.get('APP_NAME', ${jsString(internalServerName)})`,
  ],
]);
replaceInFile(path.join(root, 'src', 'internal-server', 'env.ini'), [
  [/^APP_NAME=.*$/m, `APP_NAME=${internalServerName}`],
]);
replaceInFile(
  path.join(root, 'src', 'internal-server', 'app', 'Controllers', 'Http', 'UserController.js'),
  [
    [/firstname: '[^']*'/, `firstname: ${jsString(brand.appName)}`],
    [/username: '[^']*'/, `username: ${jsString(brand.appName)}`],
    [/mail: '[^']*'/, `mail: ${jsString(`internal@${brand.appSlug}.local`)}`],
    [
      /'Your account has been imported\. You can now use your Franz account in [^']*\.'/,
      `'Your account has been imported. You can now use your Franz account in ${brand.appName}.'`,
    ],
  ],
);

// 6) Optional assets
copyIfExists('assets/logo.svg', 'src/assets/images/logo.svg');
copyIfExists('assets/logo.svg', 'src/assets/images/logo-beard-only.svg');
copyIfExists('assets/icon.icns', 'build-helpers/images/icon.icns');
copyIfExists('assets/icon.ico', 'build-helpers/images/icon.ico');
copyIfExists('assets/icon.png', 'build-helpers/images/icon.png');
copyIfExists('assets/icon.png', 'src/assets/images/icon.png');
copyIfExists('assets/icons', 'build-helpers/images/icons');
copyIfExists('assets/icons', 'src/assets/images/icons');
copyIfExists('assets/installer/dmgInstaller.tiff', 'build-helpers/images/dmgInstaller.tiff');

console.log(`Applied brand: ${brand.appName} (${brand.appSlug}) v${pkg.version}`);
console.log(`  version:          ${pkg.version} (upstream ${upstreamVersion})`);
console.log(`  locale files:     ${rewrittenLocales} rewritten`);
console.log(`  legacy tokens:    ${brandReplacements.length} replacement rules`);
console.log(`  internal server:  ${internalServerName}`);
console.log('Next: inspect git diff, run pnpm typecheck, then build.');
