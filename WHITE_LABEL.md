# White-label strategy for this Ferdium app fork

This repository is the desktop app fork. Keep it close to upstream and put
client-specific branding in generated/overlay files rather than manual one-off
edits.

The branding pipeline has three parts:

1. **Brand package** — a `brand.json` (+ optional assets) living in the
   companion `whitelabel-branding` repository.
2. **Apply step** — `pnpm brand:apply <brand-folder>` regenerates/patches every
   branded surface from that package.
3. **Audit step** — `pnpm brand:check` fails the build if any user-visible
   upstream branding survived, and `pnpm brand:check:strict` additionally fails
   when a string only survives because the runtime sanitizer covers it.

## Upstream sync workflow

This fork tracks **stable release tags** (e.g. `v7.2.3`), not the upstream nightly
`develop` branch. The branding layer is a small stack of commits on top of a chosen
stable tag, so upgrades are done by **rebasing the branding commits onto the new tag**
(not by merging `upstream/develop`, which would pull in nightly code).

```bash
git remote add upstream https://github.com/ferdium/ferdium-app.git   # first time only
git fetch upstream --tags

# Safety net: keep the current commit reachable on the remote before rewriting history.
git tag pre-<newtag>-backup develop
git push origin refs/tags/pre-<newtag>-backup

# Replay only the branding commits. <oldtag> is the previous stable base.
git rebase --onto <newtag> <oldtag> develop
# resolve any trivial conflicts, then:
git push --force-with-lease origin develop
```

Current baseline: **`v7.2.3`**. So the next sync (say to `v7.2.4`) is:

```bash
git fetch upstream --tags
git tag pre-v7.2.4-backup develop && git push origin refs/tags/pre-v7.2.4-backup
git rebase --onto v7.2.4 v7.2.3 develop
git push --force-with-lease origin develop
```

Because the branding layer never rewrites upstream locale files or source strings
(see below), upstream syncs stay small and conflict-free.

## Companion repositories

- App fork: https://github.com/advanceit2004/ferdium-app
- Recipes fork: https://github.com/advanceit2004/ferdium-recipes
- Branding/private configs: https://github.com/advanceit2004/whitelabel-branding
- Future API/backend: https://github.com/advanceit2004/whitelabel-api
- Future website/download/docs: https://github.com/advanceit2004/whitelabel-website

## Brand package

```bash
pnpm brand:apply ../whitelabel-branding/brands/example
```

Required keys: `appName`, `appSlug`, `appId`, `protocol`, `website`,
`supportEmail`, `accentColor`, `github`. Everything else has a sensible default
(see `whitelabel-branding/schemas/brand.schema.json`).

Notable optional keys:

| Key | Purpose |
| --- | --- |
| `description`, `author`, `copyright`, `publisherName` | packaging metadata |
| `api.defaultServerUrl` | hosted server; `"local"` (default) uses the bundled internal server |
| `api.debugUrl`, `api.translatorUrl` | endpoints; empty hides/omits the feature |
| `github.owner` / `github.repo` | update + publish targets |
| `recipes.url` / `recipes.branch` | recipes submodule |
| `version` | explicit product version (skips the derived version) |
| `versionSuffix` | appended to the upstream version (default `<appSlug>.1`) |
| `legacy` | upstream tokens to neutralize at runtime/build time |

`legacy` defaults to Ferdium (`names: ["Ferdium"]`, `domains: ["ferdium.org", "www.ferdium.org"]`,
`githubOwners: ["ferdium"]`). Reuse it when forking from another upstream brand:

```json
"legacy": {
  "names": ["SomeOtherApp"],
  "domains": ["someotherapp.com"],
  "tokens": { "@SomeOtherApp": "@yourhandle" }
}
```

## What `brand:apply` rewrites

Generated/overlay surfaces (never hand-edited):

- `src/brand.generated.ts` — the typed `BRAND` object every source file imports.
- `package.json` — name, productName, appId, desktopName, version, author,
  description, homepage, repository, debug namespace.
- `electron-builder.yml` — appId, protocols, executable name, synopsis, snap
  description, publisher names, unpack directory.
- `src/index.html`, `src/dev-app-update.yml`, `.gitmodules`.
- `build-helpers/brand-build.json` — machine-readable build metadata (gitignored).
- `build-helpers/images/*` and `src/assets/images/*` — logo/icon assets when the
  brand package ships them.
- `src/internal-server/**` — bundled server name (`config/app.js`, `env.ini`) and
  the imported-account strings in `UserController.js`.
- `src/i18n/locales/*.json` — upstream brand tokens are rewritten **in locale
  values only** (never in translation keys, which are addressed by id).

The bundled internal server also reads `APP_NAME` from the environment;
`src/internal-server/start.ts` sets it from `BRAND.appName`, so the displayed
server name is correct even if the packaged files are stale.

## Runtime sanitizer

Upstream ships ~55 locales full of brand strings, an internal server bundle and
`defaultMessage` fallbacks. Rewriting those files in the repository would create
huge conflicts on every upstream sync, so the remaining tokens are neutralized in
a single place at runtime:

- `src/i18n/brand-i18n.ts` builds the replacement rules from `BRAND` + `legacy`.
- `src/i18n/translations.ts` sanitizes locale dictionaries on load.
- `src/i18n/brand-intl.tsx` wraps `formatMessage` so a missing locale key still
  returns a sanitized `defaultMessage`.

## Auditing coverage

```bash
pnpm brand:report          # grouped report, never fails the build
pnpm brand:check           # fails on user-visible leaks (exit 1)
pnpm brand:check:strict    # also fails when only the runtime sanitizer covers it
```

The auditor (`scripts/check-brand.mjs`) scans every source/locale/front-end file
and classifies each match:

| Class | Meaning |
| --- | --- |
| **leak** | user-visible upstream branding that nothing rewrites — build fails |
| **covered** | locale values / `defaultMessage`s neutralized by the runtime sanitizer |
| **applied** | file is rewritten by `brand:apply` (packaging, internal server) |
| **skipped** | intentional internal identifiers, allowlisted in `docs/brand-allowlist.json` |

`docs/brand-allowlist.json` only contains identifiers that must keep the upstream
name for compatibility — deeplink/npm names, `window.ferdium` preload APIs,
persisted settings sentinels and the `.ferdium-data` export extension. Add a
pattern there only when renaming would break existing installs, and prefer the
narrowest possible pattern.

The report is a no-op for the committed default brand (`ferdium`), since the
repository is expected to hold upstream files; it becomes meaningful right after
`brand:apply`.

## Versioning

Product version = `<upstream version>-<versionSuffix>` with the suffix defaulting
to `<appSlug>.1`, e.g. `7.2.3-office-web-access.1`. `brand:apply` records the
upstream base in `build-helpers/brand-build.json`, so repeated runs and
cross-brand builds stay idempotent, and an upstream rebase (new `package.json`
version) always wins over stale metadata.

## Continuous integration

`.github/workflows/white-label-build.yml` takes a brand package location and
either validates or builds installers:

1. checkout the fork and the `whitelabel-branding` repository side by side,
2. `node scripts/apply-brand.mjs <brand-path>`,
3. `node scripts/check-brand.mjs --strict` (fail on any leak),
4. `pnpm typecheck && pnpm test` against the branded tree,
5. `pnpm build` (optionally publishing with `WHITELABEL_PUBLISH_TOKEN`).

## Source-level brand constants

Brand-sensitive source constants import `BRAND` from `src/brand.generated.ts`. The
committed file preserves Ferdium-compatible values; client builds regenerate it
with `pnpm brand:apply <brand-folder>`.

Current centralized areas include:

- Accent color and app name/slug
- API/website/debug/translator URLs
- GitHub issue/update repo metadata
- Local/no-server display string
- Deeplink protocol and allowed custom protocol list
- Tray/menu titles, About/release-notes copy
- Server display naming

## Recommended rule

Do not manually edit many files for each client. Add or update a brand package,
run `brand:apply`, run `brand:check`, build, test, and release.

Run `brand:apply` on a **pristine checkout**: a few packaging values are matched
by their upstream (Ferdium) text, so the CI jobs and local builds start from a
fresh clone. When switching brands locally, reset first:

```bash
git checkout -- . && git clean -fd
```
