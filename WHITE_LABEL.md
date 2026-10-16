# White-label strategy for this Ferdium app fork

This repository is the desktop app fork. Keep it close to upstream and put client-specific branding in generated/overlay files rather than manual one-off edits.

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

## Companion repositories

- App fork: https://github.com/advanceit2004/ferdium-app
- Recipes fork: https://github.com/advanceit2004/ferdium-recipes
- Branding/private configs: https://github.com/advanceit2004/whitelabel-branding
- Future API/backend: https://github.com/advanceit2004/whitelabel-api
- Future website/download/docs: https://github.com/advanceit2004/whitelabel-website

## Future branding automation target

A future `brand:apply` script should read a brand package from `whitelabel-branding` and generate/patch:

- `package.json`: name, productName, appId, desktopName, author, homepage, repository
- `electron-builder.yml`: appId, protocols, icon paths, Linux executable name, publish owner/repo
- `src/config.ts`: API URLs, website URLs, support URLs, accent colors, translator/debug endpoints
- `src/environment-remote.ts`: deeplink protocol and production API defaults
- `src/index.html`: app title
- `src/dev-app-update.yml`: GitHub update owner/repo
- `build-helpers/images/*`: macOS/Windows/Linux icons and installer graphics
- docs/readme links where appropriate

## Recommended rule

Do not manually edit many files for each client. Add or update a brand package, run the apply script, build, test, and release.

## Starter script added

This fork includes a starter script:

```bash
pnpm brand:apply ../whitelabel-branding/brands/example
```

The script currently patches core metadata and copies optional assets. Over time, extend it to replace all remaining Ferdium-specific source constants with imports from `src/brand.generated.ts`.

Useful check:

```bash
pnpm brand:check
```

## Source-level brand constants

Core brand-sensitive source constants now import `BRAND` from `src/brand.generated.ts`. The default committed file preserves Ferdium-compatible values; client builds should regenerate it with `pnpm brand:apply <brand-folder>`.

Current centralized areas include:

- Accent color
- API/website/debug/translator URLs
- GitHub issue/update repo metadata
- Local/no-server display string
- Deeplink protocol
- Allowed custom protocol list
- Server display naming
