import { BRAND } from '../brand.generated';

/**
 * Runtime brand sanitizer for upstream strings.
 *
 * Upstream ships thousands of translation values (across ~55 locales) that embed
 * the upstream brand name, support e-mail addresses, website links and GitHub
 * links. Forking every locale file would create enormous conflicts on every
 * upstream sync, so instead we neutralize those tokens *at runtime*, once, when
 * the locale bundles are loaded (see `./translations` and `./brand-intl`).
 *
 * The replacement list is derived from the active brand config
 * (`src/brand.generated.ts`) and its optional `legacy` block, which is written by
 * `scripts/apply-brand.mjs` from `brand.json` (see
 * `whitelabel-branding/schemas/brand.schema.json`).
 *
 * Defaults target Ferdium so the committed (upstream) values are neutralized for
 * any real white-label brand. When the active brand *is* the upstream default the
 * substitutions collapse to no-ops.
 */

interface LegacyConfig {
  /** Brand names to replace, e.g. `["Ferdium"]`. Case-insensitive. */
  names?: string[];
  /** Website domains to replace, e.g. `["ferdium.org", "www.ferdium.org"]`. */
  domains?: string[];
  /** GitHub org/user path segments to replace, e.g. `["ferdium"]`. */
  githubOwners?: string[];
  /** Explicit find/replace overrides applied before everything else. */
  tokens?: Record<string, string>;
}

interface Replacer {
  pattern: RegExp;
  replacement: string;
}

const DEFAULT_LEGACY: Required<LegacyConfig> = {
  names: ['Ferdium'],
  domains: ['www.ferdium.org', 'ferdium.org'],
  githubOwners: ['ferdium'],
  tokens: {},
};

const brandRecord = BRAND as unknown as Record<string, unknown>;
const legacyConfig = (brandRecord.legacy as LegacyConfig | undefined) ?? {};

const legacy: Required<LegacyConfig> = {
  names: legacyConfig.names ?? DEFAULT_LEGACY.names,
  domains: legacyConfig.domains ?? DEFAULT_LEGACY.domains,
  githubOwners: legacyConfig.githubOwners ?? DEFAULT_LEGACY.githubOwners,
  tokens: legacyConfig.tokens ?? DEFAULT_LEGACY.tokens,
};

function escapeRegExp(value: string): string {
  return value.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&');
}

function websiteHost(): string {
  return String(BRAND.website ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
}

const brandGithubOwner =
  (brandRecord.github as { owner?: string } | undefined)?.owner ?? '';

export function buildBrandReplacers(): Replacer[] {
  const replacers: Replacer[] = [];
  const host = websiteHost();

  // 1) Explicit overrides (e.g. "@FerdiumMessenger" -> "@mysocialhandle").
  for (const [from, to] of Object.entries(legacy.tokens)) {
    if (from) {
      replacers.push({
        pattern: new RegExp(escapeRegExp(from), 'g'),
        replacement: to,
      });
    }
  }

  // 2) Support/contact e-mail addresses (before bare domains).
  if (BRAND.supportEmail) {
    for (const domain of legacy.domains) {
      replacers.push({
        pattern: new RegExp(`[\\w.+-]+@${escapeRegExp(domain)}`, 'gi'),
        replacement: BRAND.supportEmail,
      });
    }
  }

  // 3) Website domains. Longest first so "www.ferdium.org" is consumed as a whole.
  for (const domain of [...legacy.domains].sort(
    (a, b) => b.length - a.length,
  )) {
    replacers.push({
      pattern: new RegExp(escapeRegExp(domain), 'gi'),
      replacement: host,
    });
  }

  // 4) GitHub org paths: github.com/ferdium -> github.com/<owner>.
  if (brandGithubOwner) {
    for (const legacyOwner of legacy.githubOwners) {
      replacers.push({
        pattern: new RegExp(`github\\.com/${escapeRegExp(legacyOwner)}`, 'gi'),
        replacement: `github.com/${brandGithubOwner}`,
      });
    }
  }

  // 5) Brand name last, so it also covers inflected/compound forms in other
  //    languages ("Ferdium-Konto", "Ferdiumn", "Ferdiuma", ...).
  for (const name of legacy.names) {
    if (name) {
      replacers.push({
        pattern: new RegExp(escapeRegExp(name), 'gi'),
        replacement: String(BRAND.appName),
      });
    }
  }

  return replacers.filter(replacer => replacer.replacement !== '');
}

const replacers = buildBrandReplacers();

/** Replace upstream brand tokens in a single string. */
export function sanitizeBrandText(text: string): string {
  if (!text || replacers.length === 0) return text;
  let result = text;
  for (const { pattern, replacement } of replacers) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/** Replace upstream brand tokens in every string value of a (possibly nested) dictionary. */
export function sanitizeTranslationDictionary<
  T extends Record<string, unknown>,
>(dictionary: T): T {
  if (!dictionary || replacers.length === 0) return dictionary;
  const sanitized: Record<string, unknown> = { ...dictionary };
  for (const [key, value] of Object.entries(dictionary)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeBrandText(value);
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeTranslationDictionary(
        value as Record<string, unknown>,
      );
    }
  }
  return sanitized as T;
}
